import { EntitySchema } from "typeorm";

const Order = new EntitySchema({
	name: "Order",
	tableName: "orders",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: true,
		},
		typeServe: {
			type: "enum",
			enum: ["number", "email"],
			nullable: false,
		},
		status: {
			type: "enum",
			enum: ["pending", "completed", "failed"],
			default: "pending",
		},
		provider: {
			type: "int",
			default: 2,
		},
		price: {
			type: "float",
		},
		number: {
			type: "varchar",
			length: 20,
			nullable: true,
		},
	email: {
		type: "varchar",
		length: 255,
		nullable: true,
	},
	emailSite: {
		type: "varchar",
		length: 100,
		nullable: true,
	},
	emailDomain: {
		type: "varchar",
		length: 100,
		nullable: true,
	},
	activationId: {
		type: "varchar",
		length: 255,
		nullable: true,
	},
		message: {
			type: "text",
			nullable: true,
		},
		financialLocked: {
			type: "boolean",
			default: false,
		},
		reorderCount: {
			type: "int",
			default: 0,
		},
		lastReorderAt: {
		type: "timestamp",
		nullable: true,
	},
	statusReorder: {
		type: "enum",
		enum: ["pending", "completed", "failed"],
		nullable: true,
		default: null,
		comment: "Tracks reorder state: null=no reorder, pending=in progress, completed=success, failed=timeout/error",
	},
		createdAt: {
			type: "timestamp",
			createDate: true,
		},
		updatedAt: {
			type: "timestamp",
			updateDate: true,
		},
		messageReceivedAt: {
			type: "timestamp",
			nullable: true,
		},
		refundProcessed: {
			type: "boolean",
			default: false,
		},
		expiredAt: {
			type: "timestamp",
			nullable: true,
		},
		publicId: {
			type: "varchar",
			length: 16,
			unique: true,
			nullable: true,
		},
	},
	relations: {
		user: {
			target: "User",
			type: "many-to-one",
			joinColumn: {
				name: "userId",
				foreignKeyConstraintName: "FK_orders_userId",
			},
			inverseSide: "Order",
			onDelete: "CASCADE",
		},
		service: {
			target: "Service",
			type: "many-to-one",
			joinColumn: {
				name: "serviceId",
				nullable: true,
				foreignKeyConstraintName: "FK_orders_serviceId",
			},
			inverseSide: "orders",
			onDelete: "SET NULL",
		},
		country: {
			target: "Country",
			type: "many-to-one",
			joinColumn: {
				name: "countryId",
				nullable: true,
				foreignKeyConstraintName: "FK_orders_countryId",
			},
			inverseSide: "orders",
			onDelete: "SET NULL",
		},
		p3Country: {
			target: "P3Country",
			type: "many-to-one",
			joinColumn: {
				name: "p3CountryId",
				nullable: true,
				foreignKeyConstraintName: "FK_orders_p3CountryId",
			},
			inverseSide: "orders",
			onDelete: "SET NULL",
		},
		p3Service: {
			target: "P3Service",
			type: "many-to-one",
			joinColumn: {
				name: "p3ServiceId",
				nullable: true,
				foreignKeyConstraintName: "FK_orders_p3ServiceId",
			},
			inverseSide: "orders",
			onDelete: "SET NULL",
		},
		reorders: {
			target: "OrderReorder",
			type: "one-to-many",
			inverseSide: "order",
		},
	},
});

export default Order;
