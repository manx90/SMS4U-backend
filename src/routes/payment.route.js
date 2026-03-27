import {
	createInvoice,
	handleWebhook,
	getPaymentHistory,
} from "../handler/payment.handler.js";
import { requireUser } from "../decorator/AuthApi.decorator.js";

export const paymentRoute = async (app) => {
	// Create payment invoice
	app.post("/create-invoice", {
		preHandler: [requireUser()],
		handler: createInvoice,
	});

	// Webhook endpoint (no auth required - verified by signature)
	app.post("/webhook", {
		handler: handleWebhook,
	});

	// Get payment history (admin only)
	app.get("/history", {
		preHandler: [requireUser()],
		handler: getPaymentHistory,
	});

	// Success page redirect (optional)
	app.get("/success", {
		handler: async (request, reply) => {
			return reply.send({
				state: "200",
				message:
					"Payment successful! Your balance will be updated shortly.",
			});
		},
	});

	// Return page redirect (optional)
	app.get("/return", {
		handler: async (request, reply) => {
			return reply.send({
				state: "200",
				message: "Returned from payment page",
			});
		},
	});
};
