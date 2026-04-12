import { EntitySchema } from "typeorm";
const Country = new EntitySchema({
	name: "Country",
	tableName: "countries",
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
			nullable: false,
		},
		provider1: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		provider2: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		code_country: {
			type: "varchar",
			length: 10,
			nullable: false,
			unique: true,
		},
	},
	relations: {
		orders: {
			target: "Order",
			type: "one-to-many",
			inverseSide: "country",
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
		},
	},
});

export default Country;
