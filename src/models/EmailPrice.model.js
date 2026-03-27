import { EntitySchema } from "typeorm";

const EmailPrice = new EntitySchema({
	name: "EmailPrice",
	tableName: "email_prices",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: "increment",
			unique: true,
			nullable: false,
		},
		site: {
			type: "varchar",
			length: 255,
			nullable: false,
		},
		domain: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		price: {
			type: "float",
			nullable: false,
		},
		active: {
			type: "boolean",
			default: true,
		},
		available_count: {
			type: "int",
			default: 0,
			nullable: true,
		},
		last_synced_at: {
			type: "timestamp",
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
});

export default EmailPrice;
