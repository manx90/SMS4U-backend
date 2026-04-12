import { EntitySchema } from "typeorm";
const Service = new EntitySchema({
	name: "Service",
	tableName: "service",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: "increment",
			unique: true,
			nullable: false,
		},
		name: {
			type: "varchar",
			length: 255,
		},
		code: {
			type: "varchar",
			length: 50,
			unique: true,
			nullable: false,
		},
		provider1: {
			type: "varchar",
			length: 255,
		},
		provider2: {
			type: "varchar",
			length: 255,
		},
	},
	relations: {
		orders: {
			target: "Order",
			type: "one-to-many",
			inverseSide: "service",
			onDelete: "CASCADE",
		},
	},
});

export default Service;
