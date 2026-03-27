import {
	createHeleketInvoice,
	getHeleketStatus,
	handleHeleketWebhook,
	getAllPayments,
} from "../handler/heleket.handler.js";
import { requireApiKey } from "../decorator/AuthApi.decorator.js";

export const heleketRoute = async (app) => {
	// Create Heleket invoice (requires JWT or API Key)
	// Route: POST /api/v1/payment/heleket/create-invoice
	app.post("/create-invoice", {
		schema: {
			body: {
				type: "object",
				properties: {
					amount: {
						type: "string",
						description: "Amount to be paid (as string)",
					},
					orderId: {
						type: "string",
						description: "Unique order ID",
					},
					userId: {
						type: "number",
						description: "User ID (optional, will use authenticated user)",
					},
					urlReturn: {
						type: "string",
						description: "URL to return to before payment",
					},
					urlSuccess: {
						type: "string",
						description: "URL to return to after successful payment",
					},
					lifetime: {
						type: "number",
						description: "Invoice lifetime in seconds",
					},
					additionalData: {
						type: "string",
						description: "Additional data as JSON string",
					},
				},
				required: ["amount"],
			},
		},
		preHandler: [requireApiKey(["user", "admin"])],
		handler: createHeleketInvoice,
	});

	// Get payment status by UUID (requires JWT or API Key)
	app.get("/status/:uuid", {
		preHandler: [requireApiKey(["user", "admin"])],
		handler: getHeleketStatus,
	});

	// Get all payments (Admin only)
	app.get("/all", {
		preHandler: [requireApiKey(["admin"])],
		handler: getAllPayments,
	});

	// Webhook endpoint (no auth required - verified by Heleket)
	app.post("/webhook", {
		handler: handleHeleketWebhook,
	});
};

