import { AppDataSource } from "../config/database.js";
import OrderReorderModel from "../models/OrderReorder.model.js";
import OrderModel from "../models/Order.model.js";

export const orderReorderRepository =
	AppDataSource.getRepository(OrderReorderModel);

export const createReorderAttempt = async ({
	order,
	activationId = null,
	email = null,
	metadata = null,
}) => {
	const existingAttempts = await orderReorderRepository.count({
		where: {
			order: { id: order.id },
		},
	});

	const reorderEntity = orderReorderRepository.create({
		order,
		attemptNo: existingAttempts + 1,
		status: "pending",
		activationId,
		email,
		metadata: metadata ? JSON.stringify(metadata) : null,
	});

	return orderReorderRepository.save(reorderEntity);
};

export const markLatestReorderCompleted = async (orderId) => {
	const latestReorder = await orderReorderRepository.findOne({
		where: {
			order: { id: orderId },
		},
		order: {
			createdAt: "DESC",
		},
	});

	if (!latestReorder) {
		return null;
	}

	if (latestReorder.status === "completed") {
		return latestReorder;
	}

	latestReorder.status = "completed";
	return orderReorderRepository.save(latestReorder);
};

export const markLatestReorderFailed = async (
	orderId,
	errorMessage,
) => {
	const latestReorder = await orderReorderRepository.findOne({
		where: {
			order: { id: orderId },
		},
		order: {
			createdAt: "DESC",
		},
	});

	if (!latestReorder) {
		return null;
	}

	latestReorder.status = "failed";
	latestReorder.errorMessage = errorMessage;
	return orderReorderRepository.save(latestReorder);
};

export const expireReorder = async (reorderId, orderId) => {
	await AppDataSource.transaction(async (manager) => {
		// Mark reorder record as failed
		await manager
			.createQueryBuilder()
			.update("OrderReorder")
			.set({
				status: "failed",
				errorMessage:
					"This order don't has come the message, and it failed, make again reorder",
			})
			.where("id = :id", { id: reorderId })
			.execute();

		// Update order statusReorder but keep main status unchanged
		await manager
			.createQueryBuilder()
			.update(OrderModel)
			.set({
				statusReorder: "failed", // Mark reorder as failed
				financialLocked: false, // Unlock for potential new reorder
			})
			.where("id = :id", { id: orderId })
			.execute();
	});
};
