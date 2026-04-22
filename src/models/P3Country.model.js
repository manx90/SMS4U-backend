import { EntitySchema } from "typeorm";

const P3Country = new EntitySchema({
	name: "P3Country",
	tableName: "p3_countries",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: "increment",
			nullable: false,
		},
		name: {
			type: "varchar",
			length: 255,
			nullable: false,
		},
		code_country: {
			type: "varchar",
			length: 10,
			nullable: false,
			unique: true,
		},
	},
	relations: {
		configRows: {
			target: "Provider3CountryServiceConfig",
			type: "one-to-many",
			inverseSide: "p3Country",
		},
		orders: {
			target: "Order",
			type: "one-to-many",
			inverseSide: "p3Country",
		},
	},
});

export default P3Country;
