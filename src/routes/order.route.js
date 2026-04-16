import {
	create,
	getAll,
	getOne,
	update,
	getByUserApiKey,
	getByNumberForUser,
	getByPublicId,
	getEmailOrderForUser,
} from "../repositories/order.repo.js";
import { requireUser } from "../decorator/AuthApi.decorator.js";
import secondNumberServices from "../api/second-Number.service.js";
import firstNumberServices from "../api/first-Number.service.js";
import { getSmsMessageForNumber } from "../modules/provider3/services/orderMessage.service.js";
import { userRepository } from "../repositories/user.repo.js";
import RefundService from "../services/RefundService.js";
import EmailService from "../api/Email.service.js";
import { extractEmailContent } from "../utils/htmlStripper.js";
import {
	getActiveSites,
	getSiteByName,
} from "../repositories/emailSite.repo.js";
import logger from "../utils/logger.js";
import {
	getActiveDomains,
	getDomainByName,
} from "../repositories/emailDomain.repo.js";
import { getPriceBySiteAndDomain } from "../repositories/emailPrice.repo.js";
import { AppDataSource } from "../config/database.js";
import OrderModel from "../models/Order.model.js";
import { orderRepository } from "../repositories/order.repo.js";
import OrderExpirationService from "../services/OrderExpirationService.js";
import BackgroundService from "../services/BackgroundService.js";
import {
	cacheStatic,
	cacheDynamic,
	cacheDisabled,
} from "../decorator/cache.decorator.js";
import { getTimeoutMs } from "../config/timeout.js";
import {
	createReorderAttempt,
	markLatestReorderCompleted,
	markLatestReorderFailed,
} from "../repositories/orderReorder.repo.js";
export const orderRoute = async (app) => {
	app.get("/get-number", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			// Extract and validate inputs outside try so they're available in catch
			const {
				apiKey,
				country,
				serviceCode,
				provider,
			} = request.query;

			// Validate required parameters (allow "0" as valid value)
			if (
				!apiKey ||
				country === undefined ||
				country === null ||
				country === "" ||
				serviceCode === undefined ||
				serviceCode === null ||
				serviceCode === "" ||
				provider === undefined ||
				provider === null ||
				provider === ""
			) {
				return reply.status(400).send({
					state: "400",
					error:
						"apiKey, country, serviceCode, provider are required",
				});
			}
			if (String(provider) === "3") {
				return reply.status(400).send({
					state: "400",
					error:
						"Provider 3 orders use GET /api/v1/provider3/get-number",
				});
			}

			const prov =
				String(provider) === "1"
					? "first"
					: "second";

			try {
				const order = await create(
					apiKey,
					country,
					serviceCode,
					prov,
				);
				console.log(order);
				return reply.send({
					state: "200",
					msg: "success",
					data: {
						number: order.number,
						orderId: order.publicId,
					},
				});
			} catch (error) {
				console.log(error);
				// create() throws Error with preserved stack from upstream services
				const errorMessage =
					error?.message ||
					(typeof error === "string"
						? error
						: String(error));
				const errorMessageLower =
					errorMessage?.toLowerCase() || "";

				const netCodes = [
					"ECONNRESET",
					"ECONNREFUSED",
					"ETIMEDOUT",
					"ENOTFOUND",
					"ECONNABORTED",
					"EPIPE",
				];
				const isProviderError =
					netCodes.includes(error?.code) ||
					errorMessageLower?.includes(
						"provider",
					) ||
					errorMessageLower?.includes(
						"failed to get mobile number",
					) ||
					errorMessageLower?.includes(
						"no operator found",
					) ||
					errorMessageLower?.includes(
						"service provider",
					) ||
					errorMessageLower?.includes(
						"network",
					) ||
					errorMessageLower?.includes(
						"timeout",
					) ||
					errorMessageLower?.includes(
						"connection",
					) ||
					errorMessageLower?.includes(
						"temporarily unavailable",
					) ||
					errorMessageLower?.includes(
						"repeated failures",
					) ||
					errorMessageLower?.includes(
						"request failed",
					) ||
					errorMessageLower?.includes(
						"status code",
					) ||
					errorMessageLower?.includes(
						"socket hang up",
					) ||
					errorMessageLower?.includes(
						"getaddrinfo",
					) ||
					errorMessageLower?.includes(
						"econn",
					) ||
					error?.stack?.includes(
						"Number.service",
					) ||
					error?.stack?.includes(
						"orderMessage.service",
					) ||
					error?.stack?.includes(
						"upstream.service",
					) ||
					error?.code === "NO_OPERATOR";

				// Internal errors that should be shown to client
				const internalErrors = [
					"user not found",
					"balance is insufficient",
					"country not found",
					"service not found",
					"no pricing found",
					"not configured for provider 3",
					"operator is required for provider 3",
					"no pricing configured for provider 3",
				];
				const isInternalError =
					internalErrors.some((err) =>
						errorMessageLower?.includes(err),
					);

				// Check internal errors first (more specific) to avoid false positives
				if (isInternalError) {
					// Internal errors: log and show to client (non-sensitive message)
					logger.error(
						"Internal error during order creation:",
						{
							error: error,
							message: errorMessage,
							stack: error.stack,
							name: error.name,
							apiKey: apiKey,
						},
					);

					// Return appropriate status code and message based on error type
					if (
						errorMessageLower?.includes(
							"user not found",
						)
					) {
						return reply.status(401).send({
							state: "401",
							error:
								"Authentication failed. Invalid API key.",
						});
					} else if (
						errorMessageLower?.includes(
							"balance is insufficient",
						)
					) {
						return reply.status(400).send({
							state: "400",
							error:
								"Your balance is insufficient for this purchase.",
						});
					} else if (
						errorMessageLower?.includes(
							"not found",
						)
					) {
						return reply.status(400).send({
							state: "400",
							error: errorMessage,
						});
					} else {
						return reply.status(400).send({
							state: "400",
							error: errorMessage,
						});
					}
				} else if (isProviderError) {
					// Provider errors: log to provider log with full details but hide from client
					logger.providerError(
						"Provider error during order creation:",
						{
							error: error,
							message: errorMessage,
							stack: error.stack,
							name: error.name,
							provider: prov,
							apiKey: apiKey,
							country: country,
							serviceCode: serviceCode,
						},
					);

					return reply.status(500).send({
						state: "500",
						error:
							"Failed to create order. Please try again later.",
					});
				} else {
					// Unknown errors: log with full details, show generic message to client
					logger.error(
						"Unknown error during order creation:",
						{
							error: error,
							message: errorMessage,
							stack: error?.stack,
							name: error?.name,
							code: error?.code,
							apiKey: apiKey,
							country,
							serviceCode,
							provider: prov,
						},
					);

					return reply.status(500).send({
						state: "500",
						error:
							"An error occurred while creating the order. Please try again later.",
					});
				}
			}
		},
	});
	app.get("/get-message", {
		preHandler: requireUser(),
		handler: async (request, reply) => {
			try {
				const { apiKey, orderId } = request.query;
				if (!apiKey || !orderId) {
					return reply.status(400).send({
						state: "400",
						error:
							"apiKey and orderId are required",
					});
				}

				// Ensure the orderId belongs to a user's order
				const order = await getByPublicId(
					apiKey,
					orderId,
				);

				// Check if order is failed before calling provider
				if (order.status === "failed") {
					return reply.status(400).send({
						state: "400",
						error:
							"Order is failed, cannot retrieve messages",
					});
				}

				// If order already completed, return stored message (if any)
				if (order.status === "completed") {
					return reply.send({
						code: 200,
						status: "ok",
						message:
							"Message already received for this order.",
						data: order.message || null,
					});
				}

				// Call provider to get messages for this number
				let providerRes;
				if (Number(order.provider) === 1) {
					providerRes =
						await firstNumberServices.getMessage(
							order.number,
						);
				} else if (Number(order.provider) === 3) {
					providerRes =
						await getSmsMessageForNumber(
							order.number,
						);
				} else {
					providerRes =
						await secondNumberServices.getMsg(
							order.number,
							order.service?.provider2 ||
								order.service?.provider1,
						);
				}

				// Unified response shape for all SMS providers
				const isSuccess =
					Number(providerRes?.code) === 200;
				if (isSuccess) {
					const messageData = providerRes.data;

					// Send response first, then update order status in background
					const responseData = {
						code: 200,
						status: "ok",
						message: "Message received",
						data: messageData,
					};
					reply.send(responseData);

					// Non-blocking background update
					setImmediate(async () => {
						try {
							await update(order.id, {
								status: "completed",
								message: messageData ?? null,
								messageReceivedAt: new Date(),
								financialLocked: true,
							});

							if ((order.reorderCount || 0) > 0) {
								await markLatestReorderCompleted(
									order.id,
								);
							}
						} catch (error) {
							console.error(
								"Background order update failed:",
								error,
							);
						}
					});
					return;
				}

				// Check if it's a pending state (202) or an error
				console.log(
					"providerRes =>",
					providerRes,
				);
				// Return HTTP 200 with code 202 in body so axios doesn't treat it as error
				return reply.status(200).send({
					code: 202,
					status: "pending",
					message:
						"Message not received yet. Please check again shortly.",
					data: null,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});
	app.get("/orders", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				const authUser = request.user; // set by requireUser

				if (!authUser) {
					return reply.status(401).send({
						state: "401",
						error: "Unauthorized",
					});
				}

				// Admin can see all orders; user only own orders
				if (authUser.role === "admin") {
					const orders = await getAll();
					return reply.send({
						state: "200",
						msg: "success",
						data: orders,
					});
				}

				// For non-admin, require apiKey and return scoped orders
				if (!apiKey) {
					return reply.status(400).send({
						state: "400",
						error:
							"apiKey is required for user scope",
					});
				}

				const orders = await getByUserApiKey(
					apiKey,
				);
				return reply.send({
					state: "200",
					msg: "success",
					data: orders,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});
	// Check refund status for a specific order
	app.get("/refund-status", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey, orderId } = request.query;
				if (!apiKey || !orderId) {
					return reply.status(400).send({
						state: "400",
						error:
							"apiKey and orderId are required",
					});
				}

				const order = await getOne(
					parseInt(orderId),
				);
				if (!order) {
					return reply.status(404).send({
						state: "404",
						error: "Order not found",
					});
				}

				// Check if user owns this order
				if (order.user.apiKey !== apiKey) {
					return reply.status(403).send({
						state: "403",
						error: "Access denied",
					});
				}

				const shouldRefund =
					RefundService.shouldRefundOrder(order);
				const timeLeft = shouldRefund
					? 0
					: Math.max(
							0,
							getTimeoutMs("ORDER_EXPIRATION") -
								(Date.now() -
									new Date(
										order.createdAt,
									).getTime()),
					  );

				return reply.send({
					state: "200",
					data: {
						orderId: order.id,
						status: order.status,
						refundProcessed:
							order.refundProcessed,
						shouldRefund,
						timeLeftMs: timeLeft,
						timeLeftMinutes: Math.ceil(
							timeLeft / (60 * 1000),
						),
						createdAt: order.createdAt,
						messageReceivedAt:
							order.messageReceivedAt,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});
	// Manual refund processing (Admin only)
	app.get("/process-refunds", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				const user = await userRepository.findOne(
					{ where: { apiKey } },
				);

				if (!user || user.role !== "admin") {
					return reply.status(403).send({
						state: "403",
						error: "Admin access required",
					});
				}

				const result =
					await RefundService.processPendingRefunds();

				return reply.send({
					state: "200",
					message: "Refund processing completed",
					data: result,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});
	// Get orders eligible for refund (Admin only)
	app.get("/refund-eligible", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				const user = await userRepository.findOne(
					{ where: { apiKey } },
				);

				if (!user || user.role !== "admin") {
					return reply.status(403).send({
						state: "403",
						error: "Admin access required",
					});
				}

				const orders =
					await RefundService.getOrdersEligibleForRefund();

				return reply.send({
					state: "200",
					data: orders,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// ============== EMAIL ROUTES ==============

	// Get email sites
	app.get("/email-sites", {
		preHandler: [requireUser(), cacheStatic()],
		handler: async (request, reply) => {
			try {
				const sites = await getActiveSites();

				// Filter data based on user role
				let responseData = sites;
				if (request.user.role === "user") {
					responseData = sites.map((site) => ({
						name: site.name,
					}));
				}

				return reply.send({
					state: "200",
					msg: "success",
					data: responseData,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Get email domains
	app.get("/email-domains", {
		preHandler: [requireUser(), cacheStatic()],
		handler: async (request, reply) => {
			try {
				const domains = await getActiveDomains();

				// Filter data based on user role
				let responseData = domains;
				if (request.user.role === "user") {
					responseData = domains.map(
						(domain) => ({
							name: domain.name,
						}),
					);
				}

				return reply.send({
					state: "200",
					msg: "success",
					data: responseData,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Order an email
	app.get("/get-email", {
		preHandler: [requireUser(), cacheDisabled()],
		handler: async (request, reply) => {
			try {
				const { apiKey, site, domain } =
					request.query;

				if (!apiKey || !site) {
					return reply.status(400).send({
						state: "400",
						error: "apiKey and site are required",
					});
				}

				// Get user
				const user = await userRepository.findOne(
					{
						where: { apiKey },
					},
				);
				if (!user) {
					return reply.status(401).send({
						state: "401",
						error: "Invalid API key",
					});
				}

				// Get price from email_prices table
				const priceRecord =
					await getPriceBySiteAndDomain(
						site,
						domain || null,
					);

				if (!priceRecord) {
					return reply.status(400).send({
						state: "400",
						error:
							"Price not found for this site/domain combination",
					});
				}

				const price = priceRecord.price;

				// Check balance
				if (user.balance < price) {
					return reply.status(400).send({
						state: "400",
						error: "Insufficient balance",
					});
				}

				// Order email from provider
				const emailResponse =
					await EmailService.orderEmail(
						site,
						domain,
					);

				if (emailResponse.status !== "success") {
					return reply.status(400).send({
						state: "400",
						error:
							emailResponse.value ||
							"Failed to order email",
					});
				}

				// Immediately decrement the cached availability count
				const { decrementAvailability } =
					await import(
						"../repositories/emailPrice.repo.js"
					);
				await decrementAvailability(
					site,
					domain || null,
				);

				// Create order and deduct balance in transaction
				let savedOrder = null;
				await AppDataSource.transaction(
					async (manager) => {
						// Atomic balance deduction
						const debitResult = await manager
							.createQueryBuilder()
							.update("User")
							.set({
								balance: () => "balance - :price",
							})
							.where("id = :id", { id: user.id })
							.andWhere("balance >= :price")
							.setParameters({
								id: user.id,
								price: parseFloat(price),
							})
							.execute();

						if (!debitResult?.affected) {
							throw new Error(
								"Insufficient balance for this purchase",
							);
						}

						// Create order
						const orderRepoTx =
							manager.getRepository(OrderModel);
						const orderEntity =
							orderRepoTx.create({
								user,
								price,
								typeServe: "email",
								status: "pending",
								email: emailResponse.email,
								emailSite: site,
								emailDomain: domain || null,
								activationId: emailResponse.id,
								refundProcessed: false,
								publicId: generatePublicOrderId(),
							});
						savedOrder = await orderRepoTx.save(
							orderEntity,
						);
					},
				);

				return reply.send({
					state: "200",
					msg: "Email ordered successfully",
					data: {
						email: emailResponse.email,
						orderId: savedOrder.publicId,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Reorder an email without charging balance
	app.get("/reorder-email", {
		preHandler: [requireUser(), cacheDisabled()],
		handler: async (request, reply) => {
			const { apiKey, orderId, email } =
				request.query;

			if (!apiKey) {
				return reply.status(400).send({
					state: "400",
					error: "apiKey is required",
				});
			}

			if (!orderId && !email) {
				return reply.status(400).send({
					state: "400",
					error:
						"orderId or email must be provided to reorder",
				});
			}

			let reorderRecord = null;
			let parentOrderId = null;
			try {
				const order = await getEmailOrderForUser(
					apiKey,
					{
						publicId: orderId,
						email,
					},
				);
				parentOrderId = order.id;

				// Check if there's already a pending reorder
				if (order.statusReorder === "pending") {
					return reply.status(400).send({
						state: "400",
						error:
							"There is already a pending reorder for this order",
					});
				}

				if (
					!order.activationId &&
					(!order.email || !order.emailSite)
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"Stored order is missing data required for reorder",
					});
				}

				const reorderParams = {};
				if (order.activationId) {
					reorderParams.activationId =
						order.activationId;
				} else {
					reorderParams.email = order.email;
					reorderParams.site = order.emailSite;
				}

				const providerResponse =
					await EmailService.reorderEmail(
						reorderParams,
					);

				if (
					providerResponse.status !== "success"
				) {
					return reply.status(400).send({
						state: "400",
						error:
							providerResponse.value ||
							"Failed to reorder email",
					});
				}

				reorderRecord =
					await createReorderAttempt({
						order,
						activationId:
							providerResponse.id ||
							order.activationId,
						email:
							providerResponse.email ||
							order.email,
						metadata: providerResponse,
					});

				const nextReorderCount =
					(order.reorderCount || 0) + 1;

				// Update order WITHOUT changing main status
				const updates = {
					// Keep main status unchanged!
					statusReorder: "pending", // Track reorder state separately
					message: null,
					messageReceivedAt: null,
					financialLocked: true,
					reorderCount: nextReorderCount,
					lastReorderAt: new Date(),
				};

				// Update activation ID if provider returns a new one
				if (providerResponse.id) {
					updates.activationId =
						providerResponse.id;
				}

				// Update email if provider returns a new one
				if (providerResponse.email) {
					updates.email = providerResponse.email;
				}

				// Update the order - TypeORM will automatically update updatedAt
				// Note: We don't update createdAt to preserve original order creation
				// The expiration service should check updatedAt instead for reordered emails
				await orderRepository.update(
					order.id,
					updates,
				);

				return reply.send({
					state: "200",
					msg: "Email reordered successfully",
					data: {
						email:
							providerResponse.email ||
							order.email,
						orderId: order.publicId,
						reorderAttempt:
							reorderRecord.attemptNo,
					},
				});
			} catch (error) {
				if (reorderRecord && parentOrderId) {
					await markLatestReorderFailed(
						parentOrderId,
						error?.message || "Reorder failed",
					);
				}
				const message =
					error?.message ||
					"Unexpected error while reordering email";
				if (message === "User not found") {
					return reply.status(401).send({
						state: "401",
						error: message,
					});
				}
				if (
					message ===
						"Email order not found or not completed" ||
					message === "Email order not found" ||
					message ===
						"Order publicId or email must be provided"
				) {
					return reply.status(404).send({
						state: "404",
						error: message,
					});
				}
				return reply.status(500).send({
					state: "500",
					error: message,
				});
			}
		},
	});

	// Get email message
	app.get("/get-email-message", {
		preHandler: [requireUser(), cacheDisabled()],
		handler: async (request, reply) => {
			try {
				const { apiKey, orderId } = request.query;

				if (!apiKey || !orderId) {
					return reply.status(400).send({
						state: "400",
						error:
							"apiKey and orderId are required",
					});
				}

				// Get order
				const order = await getByPublicId(
					apiKey,
					orderId,
				);

				if (!order) {
					return reply.status(404).send({
						state: "404",
						error: "Order not found",
					});
				}

				// Check if order is email type
				if (order.typeServe !== "email") {
					return reply.status(400).send({
						state: "400",
						error:
							"This order is not an email order",
					});
				}

				// Check if order is failed or cancelled
				if (
					order.status === "failed" ||
					order.status === "cancelled"
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"Order is " +
							order.status +
							", cannot retrieve messages",
					});
				}

				// Check if order is already completed
				// But allow if it's a reorder (statusReorder = "pending")
				if (
					order.status === "completed" &&
					order.statusReorder !== "pending"
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"This order has already been used and cannot retrieve messages again.",
					});
				}

				// Note: Order expiration is now handled by the background OrderExpirationService
				// This ensures consistent timezone handling and prevents early expiration

				// Check if activationId exists
				if (!order.activationId) {
					return reply.status(400).send({
						state: "400",
						error:
							"Activation ID not found for this order",
					});
				}

				// Get message from provider
				try {
					const messageResponse =
						await EmailService.getMessage(
							order.activationId,
						);

					if (
						messageResponse.status === "success"
					) {
						// Extract and clean the message content
						const emailContent =
							extractEmailContent(
								messageResponse,
							);

						// Update order with cleaned message
						await update(order.id, {
							message: emailContent.message,
							status: "completed",
							statusReorder: "completed", // Mark reorder as completed
							messageReceivedAt: new Date(),
							financialLocked: true,
						});

						if ((order.reorderCount || 0) > 0) {
							await markLatestReorderCompleted(
								order.id,
							);
						}

						return reply.send({
							state: "200",
							msg: "Message received",
							data: emailContent.message,
						});
					} else {
						// Still waiting for message
						return reply.status(202).send({
							state: "202",
							msg: "Waiting for message",
							data: null,
						});
					}
				} catch (providerError) {
					console.error(
						"Provider API error:",
						providerError,
					);
					return reply.status(503).send({
						state: "503",
						error:
							"Email provider is temporarily unavailable. Please try again later.",
					});
				}
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Cancel email
	app.get("/cancel-email", {
		preHandler: [requireUser(), cacheDisabled()],
		handler: async (request, reply) => {
			try {
				const { apiKey, orderId } = request.query;

				if (!apiKey || !orderId) {
					return reply.status(400).send({
						state: "400",
						error:
							"apiKey and orderId are required",
					});
				}

				// Get order
				const order = await getByPublicId(
					apiKey,
					orderId,
				);

				if (!order) {
					return reply.status(404).send({
						state: "404",
						error: "Order not found",
					});
				}

				// Check if order is email type
				if (order.typeServe !== "email") {
					return reply.status(400).send({
						state: "400",
						error:
							"This order is not an email order",
					});
				}

				// Check if already cancelled or completed
				if (order.status === "cancelled") {
					return reply.status(400).send({
						state: "400",
						error: "Order already cancelled",
					});
				}

				if (order.status === "completed") {
					return reply.status(400).send({
						state: "400",
						error:
							"Cannot cancel completed order",
					});
				}

				// Cancel with provider
				const cancelResponse =
					await EmailService.cancelEmail(
						order.activationId,
					);

				if (cancelResponse.status === "success") {
					// Immediately increment the cached availability count back
					const { incrementAvailability } =
						await import(
							"../repositories/emailPrice.repo.js"
						);
					await incrementAvailability(
						order.emailSite,
						order.emailDomain || null,
					);

					// Refund balance if not already refunded
					if (!order.refundProcessed) {
						await AppDataSource.transaction(
							async (manager) => {
								await manager
									.createQueryBuilder()
									.update("User")
									.set({
										balance: () =>
											"balance + :price",
									})
									.where("id = :id", {
										id: order.user.id,
									})
									.setParameters({
										price: parseFloat(
											order.price,
										),
									})
									.execute();

								await manager
									.createQueryBuilder()
									.update("Order")
									.set({
										status: "cancelled",
										refundProcessed: true,
									})
									.where("id = :id", {
										id: order.id,
									})
									.execute();
							},
						);
					} else {
						await update(order.id, {
							status: "cancelled",
						});
					}

					return reply.send({
						state: "200",
						msg: "Email cancelled successfully",
					});
				} else {
					return reply.status(400).send({
						state: "400",
						error:
							cancelResponse.value ||
							"Failed to cancel email",
					});
				}
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Debug route for testing order expiration (Admin only)
	app.get("/debug/expire-orders", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				const user = await userRepository.findOne(
					{ where: { apiKey } },
				);

				if (!user || user.role !== "admin") {
					return reply.status(403).send({
						state: "403",
						error: "Admin access required",
					});
				}

				// Manually trigger expiration check
				const result =
					await OrderExpirationService.triggerExpirationCheck();

				return reply.send({
					state: "200",
					message:
						"Order expiration check completed",
					data: result,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Debug route for checking order expiration status (Admin only)
	app.get("/debug/expiration-status", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				const user = await userRepository.findOne(
					{ where: { apiKey } },
				);

				if (!user || user.role !== "admin") {
					return reply.status(403).send({
						state: "403",
						error: "Admin access required",
					});
				}

				const status =
					OrderExpirationService.getStatus();

				return reply.send({
					state: "200",
					data: status,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Debug route for cache statistics (Admin only)
	app.get("/debug/cache-stats", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				const user = await userRepository.findOne(
					{ where: { apiKey } },
				);

				if (!user || user.role !== "admin") {
					return reply.status(403).send({
						state: "403",
						error: "Admin access required",
					});
				}

				const cacheStats =
					CacheService.getStats();

				return reply.send({
					state: "200",
					data: cacheStats,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Debug route for background service status (Admin only)
	app.get("/debug/background-status", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				const user = await userRepository.findOne(
					{ where: { apiKey } },
				);

				if (!user || user.role !== "admin") {
					return reply.status(403).send({
						state: "403",
						error: "Admin access required",
					});
				}

				const status =
					BackgroundService.getStatus();

				return reply.send({
					state: "200",
					data: status,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});
};

// Helper function to generate public order ID
const generatePublicOrderId = () => {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "";
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(
			Math.floor(Math.random() * chars.length),
		);
	}
	return result;
};
