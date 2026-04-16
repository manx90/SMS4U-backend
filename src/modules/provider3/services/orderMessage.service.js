import upstream from "./upstream.service.js";
import {
	getByPublicId,
	update,
} from "../../../repositories/order.repo.js";
import {
	markLatestReorderCompleted,
} from "../../../repositories/orderReorder.repo.js";

export async function getSmsMessageForNumber(number) {
	return upstream.getMessage(number);
}

export async function handleProvider3GetMessage(
	request,
	reply,
) {
	try {
		const { apiKey, orderId } = request.query;
		if (!apiKey || !orderId) {
			return reply.status(400).send({
				state: "400",
				error:
					"apiKey and orderId are required",
			});
		}

		const order = await getByPublicId(
			apiKey,
			orderId,
		);

		if (Number(order.provider) !== 3) {
			return reply.status(400).send({
				state: "400",
				error:
					"Order is not provider 3. Use GET /api/v1/order/get-message",
			});
		}

		if (order.status === "failed") {
			return reply.status(400).send({
				state: "400",
				error:
					"Order is failed, cannot retrieve messages",
			});
		}

		if (order.status === "completed") {
			return reply.send({
				code: 200,
				status: "ok",
				message:
					"Message already received for this order.",
				data: order.message || null,
			});
		}

		const providerRes = await upstream.getMessage(
			order.number,
		);

		const isSuccess =
			Number(providerRes?.code) === 200;
		if (isSuccess) {
			const messageData = providerRes.data;

			const responseData = {
				code: 200,
				status: "ok",
				message: "Message received",
				data: messageData,
			};
			reply.send(responseData);

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
}
