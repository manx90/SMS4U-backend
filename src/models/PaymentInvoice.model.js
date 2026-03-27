import { EntitySchema } from "typeorm";

const PaymentInvoice = new EntitySchema({
	name: "PaymentInvoice",
	tableName: "payment_invoices",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: true,
		},
		userId: {
			type: "int",
			nullable: false,
		},
		heleketUuid: {
			type: "varchar",
			length: 255,
			unique: true,
			nullable: false,
		},
		orderId: {
			type: "varchar",
			length: 255,
			unique: true,
			nullable: false,
		},
		amount: {
			type: "decimal",
			precision: 10,
			scale: 2,
			nullable: false,
		},
		currency: {
			type: "varchar",
			length: 10,
			default: "USDT",
		},
		payerAmount: {
			type: "decimal",
			precision: 10,
			scale: 2,
			nullable: true,
		},
		payerCurrency: {
			type: "varchar",
			length: 10,
			nullable: true,
		},
		paymentStatus: {
			type: "varchar",
			length: 50,
			default: "check",
		},
		paymentAmount: {
			type: "decimal",
			precision: 10,
			scale: 2,
			nullable: true,
		},
		paymentAmountUsd: {
			type: "decimal",
			precision: 10,
			scale: 2,
			nullable: true,
		},
		merchantAmount: {
			type: "decimal",
			precision: 10,
			scale: 2,
			nullable: true,
		},
		address: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		url: {
			type: "text",
			nullable: true,
		},
		expiredAt: {
			type: "bigint",
			nullable: true,
		},
		additionalData: {
			type: "text",
			nullable: true,
		},
		createdAt: {
			type: "timestamp",
			createDate: true,
		},
		updatedAt: {
			type: "timestamp",
			updateDate: true,
		},
	},
	relations: {
		user: {
			target: "User",
			type: "many-to-one",
			joinColumn: {
				name: "userId",
			},
			onDelete: "CASCADE",
		},
	},
	indices: [
		{
			name: "idx_user_id",
			columns: ["userId"],
		},
		{
			name: "idx_uuid",
			columns: ["heleketUuid"],
		},
		{
			name: "idx_order_id",
			columns: ["orderId"],
		},
		{
			name: "idx_status",
			columns: ["paymentStatus"],
		},
	],
});

export default PaymentInvoice;

