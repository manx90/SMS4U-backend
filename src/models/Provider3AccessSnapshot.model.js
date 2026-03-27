import { EntitySchema } from "typeorm";

/**
 * Cached rows from provider3 /accessinfo for a given service + interval.
 */
const Provider3AccessSnapshot = new EntitySchema({
	name: "Provider3AccessSnapshot",
	tableName: "provider3_access_snapshots",
	columns: {
		id: {
			primary: true,
			type: "int",
			generated: "increment",
			nullable: false,
		},
		/** Internal service.code (e.g. wa) */
		serviceCode: {
			type: "varchar",
			length: 50,
			nullable: false,
		},
		/** Provider API service name used in accessinfo (e.g. WhatsApp) */
		serviceApiName: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		/** e.g. 30min — avoids SQL reserved word `interval` */
		snapshotInterval: {
			type: "varchar",
			length: 32,
			nullable: false,
		},
		ccode: {
			type: "varchar",
			length: 10,
			nullable: false,
		},
		countryName: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		operator: {
			type: "varchar",
			length: 64,
			nullable: false,
		},
		accessCount: {
			type: "int",
			default: 0,
		},
		fetchedAt: {
			type: "timestamp",
			createDate: true,
		},
	},
	indices: [
		{
			name: "IDX_P3_ACCESS_SERVICE_INTERVAL",
			columns: ["serviceCode", "snapshotInterval"],
		},
		{
			name: "IDX_P3_ACCESS_LOOKUP",
			columns: ["serviceCode", "snapshotInterval", "ccode"],
		},
	],
});

export default Provider3AccessSnapshot;
