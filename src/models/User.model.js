import { EntitySchema } from "typeorm";

const User = new EntitySchema({
	name: "User",
	tableName: "users",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: true,
		},
		name: {
			type: "varchar",
			length: 255,
		},
		role: {
			type: "enum",
			enum: ["admin", "user"],
			default: "user",
		},
		balance: {
			type: "float",
			default: 0,
		},
		apiKey: {
			type: "varchar",
			length: 255,
			unique: true,
			nullable: true,
		},
		email: {
			type: "varchar",
			length: 255,
			unique: true,
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
		password: {
			type: "varchar",
			nullable: false,
		},
	},
	relation: {
		Order: {
			target: "Order",
			type: "one-to-many",
			inverseSide: "user",
			onDelete: "CASCADE",
		},
	},
});
export default User;
