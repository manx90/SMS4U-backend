import crypto from "crypto";
import axios from "axios";
import { userRepository } from "../repositories/user.repo.js";

const CRYPTOMUS_API_URL =
	"https://api.cryptomus.com/v1";
const MERCHANT_ID =
	process.env.CRYPTOMUS_MERCHANT_ID;
const API_KEY = process.env.CRYPTOMUS_API;

// Generate signature for Cryptomus API
const generateSignature = (body) => {
	const base64Body = Buffer.from(
		JSON.stringify(body),
	).toString("base64");
	return crypto
		.createHash("md5")
		.update(base64Body + API_KEY)
		.digest("hex");
};

// Verify webhook signature
const verifySignature = (body, receivedSign) => {
	const calculatedSign = generateSignature(body);
	return calculatedSign === receivedSign;
};

// Create payment invoice (Based on official Cryptomus Node.js example)
export const createInvoice = async (
	request,
	reply,
) => {
	try {
		const { amount, userId } = request.body;

		// Validate input
		if (!amount || !userId) {
			return reply.status(400).send({
				state: "400",
				error: "amount and userId are required",
			});
		}

		if (amount <= 0) {
			return reply.status(400).send({
				state: "400",
				error: "Amount must be greater than 0",
			});
		}

		// Prepare request data
		const orderId = `${userId}_${Date.now()}`;
		const baseUrl =
			process.env.BASE_URL ||
			"http://localhost:3000";

		const data = {
			amount: amount.toString(),
			currency: "USDT",
			order_id: orderId,
			url_callback: `${baseUrl}/api/v1/payment/webhook`,
			url_success: `${baseUrl}/payment/success`,
			url_return: `${baseUrl}/payment/return`,
		};

		// Get credentials from environment
		const MERCHANT_ID =
			process.env.CRYPTOMUS_MERCHANT_ID;
		const API_KEY = process.env.CRYPTOMUS_API;

		if (!MERCHANT_ID || !API_KEY) {
			return reply.status(500).send({
				state: "500",
				error:
					"Missing CRYPTOMUS_MERCHANT_ID or CRYPTOMUS_API in environment",
			});
		}

		// Generate signature (EXACTLY like Cryptomus example)
		// 1. Stringify JSON and escape forward slashes
		const jsonData = JSON.stringify(data).replace(
			/\//g,
			"\\/",
		);

		// 2. Convert to base64
		const base64Data =
			Buffer.from(jsonData).toString("base64");

		// 3. Generate MD5 signature
		const sign = crypto
			.createHash("md5")
			.update(base64Data + API_KEY)
			.digest("hex");

		// Debug logging
		console.log("🔍 Request Details:");
		console.log("JSON Data:", jsonData);
		console.log("Base64:", base64Data);
		console.log("Signature:", sign);
		console.log("Merchant ID:", MERCHANT_ID);

		// Send request to Cryptomus (JSON format like their example)
		const response = await axios.post(
			"https://api.cryptomus.com/v1/payment",
			jsonData,
			{
				headers: {
					"Content-Type": "application/json",
					merchant: MERCHANT_ID,
					sign: sign,
				},
			},
		);

		// Check response
		if (response.data?.result?.url) {
			return reply.status(200).send({
				state: "200",
				message: "Invoice created successfully",
				data: {
					paymentUrl: response.data.result.url,
					orderId: orderId,
					amount: amount,
					currency: "USDT",
				},
			});
		}

		throw new Error(
			"Invalid response from Cryptomus",
		);
	} catch (error) {
		console.error(
			"❌ Cryptomus Invoice Error:",
			error.response?.data || error.message,
		);

		return reply.status(500).send({
			state: "500",
			error:
				error.response?.data?.message ||
				error.message,
		});
	}
};

// Handle webhook from Cryptomus
export const handleWebhook = async (
	request,
	reply,
) => {
	try {
		const receivedSign = request.headers["sign"];
		const payload = request.body;

		// Verify signature
		if (!verifySignature(payload, receivedSign)) {
			console.error(
				"❌ Invalid webhook signature",
			);
			return reply
				.status(403)
				.send({ error: "Invalid signature" });
		}

		// Verify IP (Cryptomus server IP)
		const clientIp =
			request.headers["x-forwarded-for"] ||
			request.ip;
		const validIps = ["91.227.144.54"];
		if (
			!validIps.some((ip) =>
				clientIp.includes(ip),
			)
		) {
			console.warn(
				`⚠️ Webhook from unknown IP: ${clientIp}`,
			);
		}

		const { status, order_id, amount, currency } =
			payload;

		if (!order_id || !status) {
			return reply
				.status(400)
				.send({ error: "Invalid payload" });
		}

		// Extract user ID from order_id
		const userId = parseInt(
			order_id.split("_")[0],
		);

		const user = await userRepository.findOne({
			where: { id: userId },
		});
		if (!user) {
			console.error(
				`❌ User not found for order: ${order_id}`,
			);
			return reply
				.status(404)
				.send({ error: "User not found" });
		}

		console.log(
			`📨 Webhook received: ${order_id} - Status: ${status}`,
		);

		// Process payment status
		switch (status) {
			case "paid":
			case "paid_over":
				// Update user balance
				user.balance =
					parseFloat(user.balance) +
					parseFloat(amount);
				await userRepository.save(user);

				console.log(
					`✅ Balance updated for User ${userId}: +${amount} ${currency}`,
				);

				return reply.status(200).send({
					message:
						"Payment processed successfully",
				});

			case "wrong_amount":
				console.warn(
					`⚠️ Wrong amount for order: ${order_id}`,
				);
				return reply.status(400).send({
					message: "Wrong amount received",
				});

			case "process":
			case "confirm_check":
			case "check":
				console.log(
					`⏳ Payment processing: ${order_id}`,
				);
				return reply.status(202).send({
					message: "Payment is processing",
				});

			case "cancel":
				console.log(
					`🚫 Payment cancelled: ${order_id}`,
				);
				return reply
					.status(200)
					.send({ message: "Payment cancelled" });

			case "fail":
			case "system_fail":
			case "locked":
				console.error(
					`❌ Payment failed: ${order_id} - Status: ${status}`,
				);
				return reply
					.status(400)
					.send({ message: "Payment failed" });

			case "refund_process":
			case "refund_fail":
			case "refund_paid":
				console.log(
					`🔄 Refund status: ${status} for ${order_id}`,
				);
				return reply.status(200).send({
					message: "Refund status recorded",
				});

			default:
				console.warn(
					`⚠️ Unhandled status: ${status} for ${order_id}`,
				);
				return reply.status(400).send({
					message: "Unhandled payment status",
				});
		}
	} catch (error) {
		console.error(
			"❌ Webhook Error:",
			error.message,
		);
		return reply
			.status(500)
			.send({ error: "Internal server error" });
	}
};

// Get payment history (optional - for admin)
export const getPaymentHistory = async (
	request,
	reply,
) => {
	try {
		const body = {};
		const signature = generateSignature(body);

		const response = await axios.post(
			`${CRYPTOMUS_API_URL}/payment/list`,
			body,
			{
				headers: {
					"Content-Type": "application/json",
					merchant: MERCHANT_ID,
					sign: signature,
				},
			},
		);

		return reply.status(200).send({
			state: "200",
			data: response.data.result || [],
		});
	} catch (error) {
		console.error(
			"❌ Payment History Error:",
			error.message,
		);
		return reply.status(500).send({
			state: "500",
			error:
				error.response?.data?.message ||
				error.message,
		});
	}
};
