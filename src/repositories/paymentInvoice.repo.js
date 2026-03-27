import { AppDataSource } from "../config/database.js";

export const paymentInvoiceRepository =
	AppDataSource.getRepository("PaymentInvoice");

/**
 * Create a new payment invoice
 */
export const create = async (data) => {
	return await paymentInvoiceRepository.save(
		data,
	);
};

/**
 * Find invoice by heleket UUID
 */
export const findByUuid = async (uuid) => {
	return await paymentInvoiceRepository.findOne({
		where: { heleketUuid: uuid },
		relations: ["user"],
	});
};

/**
 * Find invoice by order ID
 */
export const findByOrderId = async (orderId) => {
	return await paymentInvoiceRepository.findOne({
		where: { orderId },
		relations: ["user"],
	});
};

/**
 * Find invoice by UUID or Order ID
 */
export const findByUuidOrOrderId = async (
	uuid,
	orderId,
) => {
	return await paymentInvoiceRepository.findOne({
		where: [{ heleketUuid: uuid }, { orderId }],
		relations: ["user"],
	});
};

/**
 * Update invoice
 */
export const update = async (id, data) => {
	await paymentInvoiceRepository.update(id, data);
	return await paymentInvoiceRepository.findOne({
		where: { id },
		relations: ["user"],
	});
};

/**
 * Get all invoices for a user
 */
export const getByUserId = async (userId) => {
	return await paymentInvoiceRepository.find({
		where: { userId },
		order: { createdAt: "DESC" },
	});
};

/**
 * Get invoice by ID
 */
export const getById = async (id) => {
	return await paymentInvoiceRepository.findOne({
		where: { id },
		relations: ["user"],
	});
};

/**
 * Get all invoices with user relations
 */
export const getAll = async () => {
	return await paymentInvoiceRepository.find({
		relations: ["user"],
		order: { createdAt: "DESC" },
	});
};

/**
 * Get active invoices for a user (check, process statuses)
 */
export const getActiveInvoicesByUserId = async (
	userId,
) => {
	return await paymentInvoiceRepository.find({
		where: {
			userId,
			paymentStatus: [
				"check",
				"process",
				"confirm_check",
			],
		},
		order: { createdAt: "DESC" },
	});
};
