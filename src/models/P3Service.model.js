import { EntitySchema } from "typeorm";

const P3Service = new EntitySchema({
	name: "P3Service",
	tableName: "p3_services",
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
		code: {
			type: "varchar",
			length: 50,
			unique: true,
			nullable: false,
		},
	},
	relations: {
		configRows: {
			target: "Provider3CountryServiceConfig",
			type: "one-to-many",
			inverseSide: "p3Service",
		},
		orders: {
			target: "Order",
			type: "one-to-many",
			inverseSide: "p3Service",
		},
	},
});

export default P3Service;
