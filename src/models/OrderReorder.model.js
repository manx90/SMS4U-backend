import { EntitySchema } from "typeorm";

const OrderReorder = new EntitySchema({
	name: "OrderReorder",
	tableName: "order_reorders",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: true,
		},
		attemptNo: {
			type: "int",
			default: 1,
		},
		status: {
			type: "enum",
			enum: ["pending", "completed", "failed"],
			default: "pending",
		},
		activationId: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		email: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		metadata: {
			type: "text",
			nullable: true,
		},
		errorMessage: {
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
		order: {
			target: "Order",
			type: "many-to-one",
			joinColumn: true,
			onDelete: "CASCADE",
		},
	},
});

export default OrderReorder;
