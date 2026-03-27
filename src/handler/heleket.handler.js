import axios from "axios";
import crypto from "crypto";
import { userRepository } from "../repositories/user.repo.js";
import {
	create as createInvoice,
	findByUuid,
	findByOrderId,
	findByUuidOrOrderId,
	update as updateInvoice,
	getAll as getAllInvoices,
	getActiveInvoicesByUserId,
} from "../repositories/paymentInvoice.repo.js";
import { balanceChange } from "../repositories/user.repo.js";

const HELEKET_API_URL =
	process.env.HELEKET_API_URL ||
	"https://api.heleket.com/v1";
const HELEKET_API_KEY =
	process.env.HELEKET_API_KEY;
const HELEKET_MERCHANT_ID =
	process.env.HELEKET_MERCHANT_ID;

/**
 * Generate signature for Heleket API requests
 * Signature = MD5(base64(json_data) + API_KEY)
 */
function generateHeleketSignature(payload) {
	const jsonData = JSON.stringify(payload);
	const base64Data =
		Buffer.from(jsonData).toString("base64");
	const signature = crypto
		.createHash("md5")
		.update(base64Data + HELEKET_API_KEY)
		.digest("hex");
	return signature;
}

/**
 * Create Heleket payment invoice
 */
export const createHeleketInvoice = async (
	request,
	reply,
) => {
	try {
		// Get user from JWT (set by requireJWT middleware)
		const user = request.user;
		if (!user) {
			return reply.status(401).send({
				state: "401",
				error: "Unauthorized",
			});
		}

		// Get request body
		const {
			amount,
			orderId,
			userId: requestUserId,
			urlReturn,
			urlSuccess,
			lifetime,
			additionalData,
		} = request.body || {};

		// Validate required fields
		if (!amount) {
			return reply.status(400).send({
				state: "400",
				error: "amount is required",
			});
		}

		// Validate amount
		const amountNum = parseFloat(amount);
		if (isNaN(amountNum) || amountNum <= 0) {
			return reply.status(400).send({
				state: "400",
				error: "amount must be a positive number",
			});
		}

		// Verify userId matches token
		if (
			requestUserId &&
			requestUserId !== user.id
		) {
			return reply.status(403).send({
				state: "403",
				error:
					"userId does not match authenticated user",
			});
		}

		// Use userId from token
		const userId = user.id;

		// Close any active invoices for this user before creating a new one
		try {
			const activeInvoices =
				await getActiveInvoicesByUserId(userId);
			if (
				activeInvoices &&
				activeInvoices.length > 0
			) {
				console.log(
					`🔄 Closing ${activeInvoices.length} active invoice(s) for user ${userId}`,
				);
				for (const activeInvoice of activeInvoices) {
					await updateInvoice(activeInvoice.id, {
						paymentStatus: "expired",
					});
				}
			}
		} catch (error) {
			console.error(
				"⚠️ Error closing active invoices:",
				error.message,
			);
			// Continue anyway - don't block invoice creation
		}

		// Generate order ID if not provided
		const finalOrderId =
			orderId ||
			`payment_user${userId}_${Date.now()}`;

		// Check if order ID already exists
		const existingInvoice = await findByOrderId(
			finalOrderId,
		);
		if (existingInvoice) {
			return reply.status(400).send({
				state: "400",
				error: "orderId already exists",
			});
		}

		// Get base URL from environment
		const baseUrl =
			process.env.BASE_URL ||
			"https://api.sms4u.pro";

		// Check if API key and merchant ID are configured
		if (
			!HELEKET_API_KEY ||
			!HELEKET_MERCHANT_ID
		) {
			console.error(
				"❌ HELEKET_API_KEY or HELEKET_MERCHANT_ID is not configured",
			);
			return reply.status(500).send({
				state: "500",
				error:
					"Payment service is not configured. Please contact support.",
			});
		}

		// Prepare Heleket API request payload
		// Remove null/undefined values and merchant_id (it goes in header)
		const heleketPayload = {
			amount: amount.toString(),
			currency: "USDT",
			order_id: finalOrderId,
		};

		// Add optional fields only if provided
		if (urlReturn) {
			heleketPayload.url_return = urlReturn;
		} else {
			heleketPayload.url_return = `${baseUrl}/user/account`;
		}

		if (urlSuccess) {
			heleketPayload.url_success = urlSuccess;
		} else {
			heleketPayload.url_success = `${baseUrl}/user/account?payment=success`;
		}

		heleketPayload.url_callback = `${baseUrl}/api/v1/payment/heleket/webhook`;

		if (lifetime) {
			heleketPayload.lifetime = lifetime;
		}

		if (additionalData) {
			heleketPayload.additional_data =
				additionalData;
		} else {
			heleketPayload.additional_data =
				JSON.stringify({
					userId,
					userName: user.name,
				});
		}

		// Generate signature for Heleket API
		const signature = generateHeleketSignature(
			heleketPayload,
		);

		// Log the payload being sent to Heleket (for debugging)
		console.log(
			"📤 Sending to Heleket API:",
			JSON.stringify(heleketPayload, null, 2),
		);
		console.log(
			"💰 Currency being sent:",
			heleketPayload.currency,
		);

		// Call Heleket API
		let heleketResponse;
		try {
			heleketResponse = await axios.post(
				`${HELEKET_API_URL}/payment`,
				heleketPayload,
				{
					headers: {
						merchant: HELEKET_MERCHANT_ID,
						sign: signature,
						"Content-Type": "application/json",
					},
				},
			);
		} catch (error) {
			console.error(
				"❌ Heleket API Error:",
				error.response?.data || error.message,
			);
			return reply.status(500).send({
				state: "500",
				error:
					error.response?.data?.message ||
					error.response?.data?.error ||
					"Failed to create invoice",
				details:
					error.response?.data || error.message,
			});
		}

		// Check if response is successful
		if (
			!heleketResponse.data ||
			heleketResponse.status !== 200
		) {
			return reply.status(500).send({
				state: "500",
				error:
					"Invalid response from payment service",
			});
		}

		// Heleket API returns {state: 0, result: {...}} structure
		// Extract invoice data from the nested result structure
		const heleketData = heleketResponse.data;

		// Debug: Log the response structure
		console.log(
			"🔍 Heleket API Response:",
			JSON.stringify(heleketData, null, 2),
		);

		// Extract invoice data - Heleket returns {state: 0, result: {uuid: ..., ...}}
		// But axios wraps it, so we need to check the actual structure
		let invoiceData = null;
		let extractedUuid = null;

		// Try different possible structures (most common first)
		// Structure 1: {state: 0, result: {uuid: ...}} - Direct Heleket response
		if (
			heleketData.result &&
			typeof heleketData.result === "object"
		) {
			if (heleketData.result.uuid) {
				// Direct: {state: 0, result: {uuid: ...}}
				invoiceData = heleketData.result;
				extractedUuid = heleketData.result.uuid;
				console.log(
					"✅ Found invoice data in heleketData.result (direct)",
				);
			} else if (
				heleketData.result.result &&
				heleketData.result.result.uuid
			) {
				// Nested: {state: 0, result: {result: {uuid: ...}}}
				invoiceData = heleketData.result.result;
				extractedUuid =
					heleketData.result.result.uuid;
				console.log(
					"✅ Found invoice data in heleketData.result.result (nested)",
				);
			}
		}

		// Structure 2: Alternative paths
		if (!invoiceData) {
			if (
				heleketData.data &&
				heleketData.data.uuid
			) {
				invoiceData = heleketData.data;
				extractedUuid = heleketData.data.uuid;
				console.log(
					"✅ Found invoice data in heleketData.data",
				);
			} else if (heleketData.uuid) {
				invoiceData = heleketData;
				extractedUuid = heleketData.uuid;
				console.log(
					"✅ Found invoice data in heleketData (direct)",
				);
			}
		}

		// Validate that we have the required UUID
		if (!invoiceData || !extractedUuid) {
			console.error(
				"❌ Invalid Heleket response: missing UUID",
				JSON.stringify(heleketData, null, 2),
			);
			console.error(
				"🔍 Attempted extraction paths:",
			);
			console.error(
				"  - heleketData.result.uuid:",
				heleketData.result?.uuid,
			);
			console.error(
				"  - heleketData.result.result.uuid:",
				heleketData.result?.result?.uuid,
			);
			console.error(
				"  - heleketData.data.uuid:",
				heleketData.data?.uuid,
			);
			console.error(
				"  - heleketData.uuid:",
				heleketData.uuid,
			);
			return reply.status(500).send({
				state: "500",
				error:
					"Invalid response from payment service: missing UUID",
				details: heleketData,
			});
		}

		// Ensure invoiceData has uuid property
		if (!invoiceData.uuid) {
			invoiceData.uuid = extractedUuid;
		}

		console.log(
			"✅ Extracted UUID:",
			extractedUuid,
		);
		console.log(
			"💰 Currency in Heleket response:",
			invoiceData?.currency || "not found",
		);

		// Save invoice to database
		try {
			// Prepare invoice data with explicit UUID check
			// Use extractedUuid to ensure we have the value
			const finalUuid =
				extractedUuid || invoiceData.uuid;
			if (!finalUuid) {
				throw new Error(
					"UUID is required but was not found in response",
				);
			}

			const invoicePayload = {
				userId,
				heleketUuid: finalUuid, // This must be present
				orderId: finalOrderId,
				amount: parseFloat(amount),
				currency: "USDT", // Always use USDT
				payerAmount: invoiceData.payer_amount
					? parseFloat(invoiceData.payer_amount)
					: null,
				payerCurrency:
					invoiceData.payer_currency || null,
				paymentStatus:
					invoiceData.payment_status || "check",
				paymentAmount: invoiceData.payment_amount
					? parseFloat(invoiceData.payment_amount)
					: null,
				paymentAmountUsd:
					invoiceData.payment_amount_usd
						? parseFloat(
								invoiceData.payment_amount_usd,
						  )
						: null,
				merchantAmount:
					invoiceData.merchant_amount
						? parseFloat(
								invoiceData.merchant_amount,
						  )
						: null,
				address: invoiceData.address || null,
				url: invoiceData.url || null,
				expiredAt: invoiceData.expired_at || null,
				additionalData: additionalData || null,
			};

			// Validate heleketUuid before saving
			if (!invoicePayload.heleketUuid) {
				console.error(
					"❌ CRITICAL: heleketUuid is missing before save!",
				);
				console.error(
					"Invoice payload:",
					JSON.stringify(invoicePayload, null, 2),
				);
				throw new Error(
					"heleketUuid is required but was not found",
				);
			}

			console.log(
				"💾 Saving invoice to database with UUID:",
				invoicePayload.heleketUuid,
			);
			const invoice = await createInvoice(
				invoicePayload,
			);

			console.log(
				`✅ Invoice created and saved: ${invoiceData.uuid} for User ${userId}`,
			);

			// Return response to frontend
			// Format: { state: "200", result: {...} } to match Frontend expectations
			// Use the actual invoice data from Heleket response
			const responseData =
				heleketData.result?.result ||
				heleketData.result ||
				invoiceData;
			// Ensure currency is always USDT and required fields are present
			if (responseData) {
				responseData.currency = "USDT";
				// Ensure URL and UUID are present (critical for frontend)
				if (
					!responseData.url &&
					invoiceData.url
				) {
					responseData.url = invoiceData.url;
				}
				if (
					!responseData.uuid &&
					invoiceData.uuid
				) {
					responseData.uuid = invoiceData.uuid;
				}
				// Ensure address is included if available
				if (
					!responseData.address &&
					invoiceData.address
				) {
					responseData.address =
						invoiceData.address;
				}
			}
			return reply.status(200).send({
				state: "200",
				result: responseData,
				data: responseData, // Also include data for backward compatibility
			});
		} catch (dbError) {
			console.error(
				"❌ Database Error saving invoice:",
				dbError.message,
				dbError.stack,
			);
			// Still return the invoice data even if DB save fails
			// Use the actual invoice data from Heleket response
			const responseData =
				heleketData.result?.result ||
				heleketData.result ||
				invoiceData;
			// Ensure currency is always USDT and required fields are present
			if (responseData) {
				responseData.currency = "USDT";
				// Ensure URL and UUID are present (critical for frontend)
				if (
					!responseData.url &&
					invoiceData.url
				) {
					responseData.url = invoiceData.url;
				}
				if (
					!responseData.uuid &&
					invoiceData.uuid
				) {
					responseData.uuid = invoiceData.uuid;
				}
				// Ensure address is included if available
				if (
					!responseData.address &&
					invoiceData.address
				) {
					responseData.address =
						invoiceData.address;
				}
			}
			return reply.status(200).send({
				state: "200",
				result: responseData,
				data: responseData, // Also include data for backward compatibility
				warning:
					"Invoice created but not saved to database",
			});
		}
	} catch (error) {
		console.error(
			"❌ Create Invoice Error:",
			error.message,
		);
		return reply.status(500).send({
			state: "500",
			error:
				error.message ||
				"Failed to create invoice",
		});
	}
};

/**
 * Get payment status by UUID
 */
export const getHeleketStatus = async (
	request,
	reply,
) => {
	try {
		// Get user from JWT
		const user = request.user;
		if (!user) {
			return reply.status(401).send({
				state: "401",
				error: "Unauthorized",
			});
		}

		const { uuid } = request.params;
		if (!uuid) {
			return reply.status(400).send({
				state: "400",
				error: "uuid is required",
			});
		}

		// Check if invoice exists and belongs to user
		const invoice = await findByUuid(uuid);
		if (!invoice) {
			return reply.status(404).send({
				state: "404",
				error: "Invoice not found",
			});
		}

		// Verify invoice belongs to user (unless admin)
		if (
			invoice.userId !== user.id &&
			user.role !== "admin"
		) {
			return reply.status(403).send({
				state: "403",
				error: "Access denied",
			});
		}

		// Check if API key and merchant ID are configured
		if (
			!HELEKET_API_KEY ||
			!HELEKET_MERCHANT_ID
		) {
			return reply.status(500).send({
				state: "500",
				error:
					"Payment service is not configured",
			});
		}

		// For GET requests, signature is generated from empty payload or UUID
		// Based on Heleket docs, GET requests may use different signature method
		// For now, we'll use the UUID as payload for signature
		const statusPayload = { uuid };
		const signature = generateHeleketSignature(
			statusPayload,
		);

		// Call Heleket API to get latest status
		try {
			const response = await axios.get(
				`${HELEKET_API_URL}/payment/${uuid}`,
				{
					headers: {
						merchant: HELEKET_MERCHANT_ID,
						sign: signature,
						"Content-Type": "application/json",
					},
				},
			);

			const statusData =
				response.data.data || response.data;

			// Update invoice in database
			if (statusData) {
				await updateInvoice(invoice.id, {
					paymentStatus:
						statusData.payment_status ||
						invoice.paymentStatus,
					paymentAmount: statusData.payment_amount
						? parseFloat(
								statusData.payment_amount,
						  )
						: invoice.paymentAmount,
					paymentAmountUsd:
						statusData.payment_amount_usd
							? parseFloat(
									statusData.payment_amount_usd,
							  )
							: invoice.paymentAmountUsd,
					merchantAmount:
						statusData.merchant_amount
							? parseFloat(
									statusData.merchant_amount,
							  )
							: invoice.merchantAmount,
					url: statusData.url || invoice.url, // Preserve URL if exists
					address:
						statusData.address || invoice.address, // Preserve address if exists
				});
			}

			// Ensure currency is always USDT
			if (statusData) {
				statusData.currency = "USDT";
			}

			// Ensure URL and address are included from invoice if not in statusData
			if (statusData) {
				if (!statusData.url && invoice.url) {
					statusData.url = invoice.url;
				}
				if (
					!statusData.address &&
					invoice.address
				) {
					statusData.address = invoice.address;
				}
				// Ensure UUID is present
				if (!statusData.uuid) {
					statusData.uuid = invoice.heleketUuid;
				}
			}

			return reply.status(200).send({
				state: "200",
				result: statusData,
				data: statusData, // Also include data for backward compatibility
			});
		} catch (error) {
			console.error(
				"❌ Heleket Status API Error:",
				error.response?.data || error.message,
			);

			// Return cached status from database if API fails
			const cachedData = {
				uuid: invoice.heleketUuid,
				order_id: invoice.orderId,
				payment_status: invoice.paymentStatus,
				amount: invoice.amount.toString(),
				currency: "USDT", // Always USDT
				payment_amount: invoice.paymentAmount
					? invoice.paymentAmount.toString()
					: null,
				payment_amount_usd:
					invoice.paymentAmountUsd
						? invoice.paymentAmountUsd.toString()
						: null,
				merchant_amount: invoice.merchantAmount
					? invoice.merchantAmount.toString()
					: null,
				url: invoice.url || null, // Include URL from database
				address: invoice.address || null, // Include address from database
			};
			return reply.status(200).send({
				state: "200",
				result: cachedData,
				data: cachedData, // Also include data for backward compatibility
				note: "Using cached data (API unavailable)",
			});
		}
	} catch (error) {
		console.error(
			"❌ Get Status Error:",
			error.message,
		);
		return reply.status(500).send({
			state: "500",
			error:
				error.message || "Failed to get status",
		});
	}
};

/**
 * Handle webhook from Heleket
 */
export const handleHeleketWebhook = async (
	request,
	reply,
) => {
	try {
		const payload = request.body;

		// Validate payload
		if (!payload.uuid && !payload.order_id) {
			return reply.status(400).send({
				status: "error",
				error: "Missing uuid or order_id",
			});
		}

		// Optional: Verify IP address (Heleket IPs)
		// You can add Heleket IP addresses here for additional security
		const clientIp =
			request.headers["x-forwarded-for"] ||
			request.ip ||
			request.socket?.remoteAddress;
		console.log(
			`📨 Webhook received from IP: ${clientIp}`,
		);

		// Find invoice by UUID or order_id
		const invoice = await findByUuidOrOrderId(
			payload.uuid,
			payload.order_id,
		);

		if (!invoice) {
			console.error(
				`❌ Invoice not found: uuid=${payload.uuid}, order_id=${payload.order_id}`,
			);
			// Still return 200 to Heleket to prevent retries
			return reply.status(200).send({
				status: "ok",
				note: "Invoice not found",
			});
		}

		// Extract payment status - Heleket sends "status" but we also support "payment_status" for compatibility
		const paymentStatus =
			payload.status || payload.payment_status;

		// Update invoice status
		const updateData = {
			paymentStatus:
				paymentStatus || invoice.paymentStatus,
		};

		if (payload.payment_amount) {
			updateData.paymentAmount = parseFloat(
				payload.payment_amount,
			);
		}
		if (payload.payment_amount_usd) {
			updateData.paymentAmountUsd = parseFloat(
				payload.payment_amount_usd,
			);
		}
		if (payload.merchant_amount) {
			updateData.merchantAmount = parseFloat(
				payload.merchant_amount,
			);
		}

		await updateInvoice(invoice.id, updateData);

		console.log(
			`📨 Webhook processed: ${
				payload.uuid
			} - Status: ${paymentStatus || "unknown"}`,
		);

		// Process payment if status is "paid"
		if (paymentStatus === "paid") {
			// Check if balance was already added (prevent double credit)
			if (invoice.paymentStatus === "paid") {
				console.log(
					`⚠️ Invoice ${invoice.id} already processed as paid`,
				);
				return reply.status(200).send({
					status: "ok",
					note: "Already processed",
				});
			}

			// Get user
			const user = await userRepository.findOne({
				where: { id: invoice.userId },
			});

			if (!user) {
				console.error(
					`❌ User not found: ${invoice.userId}`,
				);
				return reply.status(200).send({
					status: "ok",
					note: "User not found",
				});
			}

			// Calculate amount to add (use merchant_amount if available, otherwise payment_amount)
			const amountToAdd =
				payload.merchant_amount ||
				payload.payment_amount ||
				payload.amount ||
				invoice.amount;

			// Add balance to user
			try {
				const updatedUser = await balanceChange(
					invoice.userId,
					parseFloat(amountToAdd),
				);

				if (!updatedUser) {
					throw new Error(
						"balanceChange returned null/undefined",
					);
				}

				const finalBalance =
					parseFloat(updatedUser.balance) || 0;
				console.log(
					`✅ Balance updated for User ${invoice.userId}: +${amountToAdd} ${invoice.currency} (New balance: ${finalBalance})`,
				);
			} catch (balanceError) {
				console.error(
					`❌ Failed to update balance for User ${invoice.userId}:`,
					balanceError.message,
					balanceError.stack,
				);
				// Still return 200 to Heleket
			}
		}

		// Return success to Heleket
		return reply.status(200).send({
			status: "ok",
		});
	} catch (error) {
		console.error(
			"❌ Webhook Error:",
			error.message,
		);
		// Still return 200 to prevent Heleket from retrying
		return reply.status(200).send({
			status: "error",
			error: error.message,
		});
	}
};

/**
 * Get all payment invoices (Admin only)
 */
export const getAllPayments = async (
	request,
	reply,
) => {
	try {
		// Get user from JWT
		const user = request.user;
		if (!user) {
			return reply.status(401).send({
				state: "401",
				error: "Unauthorized",
			});
		}

		// Check if user is admin
		if (user.role !== "admin") {
			return reply.status(403).send({
				state: "403",
				error: "Access denied. Admin only.",
			});
		}

		// Get all invoices with user relations
		const invoices = await getAllInvoices();

		// Format response
		const formattedInvoices = invoices.map(
			(invoice) => ({
				id: invoice.id,
				userId: invoice.userId,
				user: invoice.user
					? {
							id: invoice.user.id,
							name: invoice.user.name,
							email: invoice.user.email,
					  }
					: null,
				heleketUuid: invoice.heleketUuid,
				orderId: invoice.orderId,
				amount: parseFloat(invoice.amount) || 0,
				currency: invoice.currency || "USDT",
				payerAmount: invoice.payerAmount
					? parseFloat(invoice.payerAmount)
					: null,
				payerCurrency:
					invoice.payerCurrency || null,
				paymentStatus:
					invoice.paymentStatus || "check",
				paymentAmount: invoice.paymentAmount
					? parseFloat(invoice.paymentAmount)
					: null,
				paymentAmountUsd: invoice.paymentAmountUsd
					? parseFloat(invoice.paymentAmountUsd)
					: null,
				merchantAmount: invoice.merchantAmount
					? parseFloat(invoice.merchantAmount)
					: null,
				address: invoice.address || null,
				url: invoice.url || null,
				expiredAt: invoice.expiredAt || null,
				additionalData:
					invoice.additionalData || null,
				createdAt: invoice.createdAt || null,
				updatedAt: invoice.updatedAt || null,
			}),
		);

		return reply.status(200).send({
			state: "200",
			data: formattedInvoices,
		});
	} catch (error) {
		console.error(
			"❌ Get All Payments Error:",
			error.message,
		);
		return reply.status(500).send({
			state: "500",
			error:
				error.message || "Failed to get payments",
		});
	}
};
