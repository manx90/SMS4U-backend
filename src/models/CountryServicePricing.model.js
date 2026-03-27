import { EntitySchema } from "typeorm";

const CountryServicePricing = new EntitySchema({
	name: "CountryServicePricing",
	tableName: "country_service_pricing",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: "increment",
			unique: true,
			nullable: false,
		},
		provider1: {
			type: "float",
			nullable: false,
		},
		provider2: {
			type: "float",
			nullable: false,
		},
		/** null until admin sets price for provider 3 */
		provider3: {
			type: "float",
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
	indices: [
		{
			name: "IDX_COUNTRY_SERVICE",
			unique: true,
			columns: ["country", "service"],
		},
	],
	relations: {
		country: {
			target: "Country",
			type: "many-to-one",
			joinColumn: true,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
		},
		service: {
			target: "Service",
			type: "many-to-one",
			joinColumn: true,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
		},
	},
});

export default CountryServicePricing;
