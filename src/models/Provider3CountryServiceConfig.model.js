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
		p3Country: {
			target: "P3Country",
			type: "many-to-one",
			joinColumn: { name: "p3CountryId" },
			onDelete: "CASCADE",
		},
		p3Service: {
			target: "P3Service",
			type: "many-to-one",
			joinColumn: { name: "p3ServiceId" },
			onDelete: "CASCADE",
		},
	},
});

export default Provider3CountryServiceConfig;
