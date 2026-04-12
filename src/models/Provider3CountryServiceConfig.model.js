import { EntitySchema } from "typeorm";

const Provider3CountryServiceConfig = new EntitySchema({
	name: "Provider3CountryServiceConfig",
	tableName: "provider3_country_service_config",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: "increment",
			nullable: false,
		},
		price: {
			type: "float",
			nullable: false,
		},
		upstreamCountryCode: {
			type: "varchar",
			length: 255,
			nullable: false,
		},
		upstreamServiceName: {
			type: "varchar",
			length: 255,
			nullable: false,
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
		country: {
			target: "Country",
			type: "many-to-one",
			joinColumn: { name: "countryId" },
			onDelete: "CASCADE",
		},
		service: {
			target: "Service",
			type: "many-to-one",
			joinColumn: { name: "serviceId" },
			onDelete: "CASCADE",
		},
	},
});

export default Provider3CountryServiceConfig;
