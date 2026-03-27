// ALTERNATIVE VERSION - Sends JSON instead of form data
// If current version doesn't work, try this one

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
	const jsonBody = JSON.stringify(body);
	const base64Body =
		Buffer.from(jsonBody).toString("base64");
	return crypto
		.createHash("md5")
		.update(base64Body + API_KEY)
		.digest("hex");
};

// Create payment invoice - JSON VERSION (as per official SDK)
export const createInvoice = async (
	request,
	reply,
) => {
	try {
		const { amount, userId } = request.body;

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

		const user = await userRepository.findOne({
			where: { id: userId },
		});
		if (!user) {
			return reply.status(404).send({
				state: "404",
				error: "User not found",
			});
		}

		const orderId = `${userId}_${Date.now()}`;
		const baseUrl =
			process.env.BASE_URL ||
			"http://localhost:3000";

		const body = {
			amount: amount.toString(),
			currency: "usd",
			order_id: orderId,
			url_callback: `${baseUrl}/api/v1/payment/webhook`,
			url_success: `${baseUrl}/payment/success`,
			url_return: `${baseUrl}/payment/return`,
		};

		const jsonBody = JSON.stringify(body);
		const signature = generateSignature(body);

		console.log("🔍 JSON VERSION Debug:");
		console.log("Body:", jsonBody);
		console.log("Signature:", signature);

		// Send as JSON (official SDK way)
		const response = await axios.post(
			`${CRYPTOMUS_API_URL}/payment`,
			jsonBody,
			{
				headers: {
					Accept: "application/json",
					"Content-Type":
						"application/json; charset=UTF-8",
					merchant: MERCHANT_ID,
					sign: signature,
				},
			},
		);

		if (response.data && response.data.result) {
			return reply.status(200).send({
				state: "200",
				message: "Invoice created successfully",
				data: {
					paymentUrl: response.data.result.url,
					orderId: orderId,
					amount: amount,
					currency: "USD",
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
