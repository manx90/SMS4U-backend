import { EntitySchema } from "typeorm";

const EmailSite = new EntitySchema({
	name: "EmailSite",
	tableName: "email_sites",
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
			unique: true,
		},
		display_name: {
			type: "varchar",
			length: 255,
			nullable: false,
		},
		api_name: {
			type: "varchar",
			length: 255,
			nullable: true,
		},
		description: {
			type: "text",
			nullable: true,
		},
		status: {
			type: "boolean",
			default: true,
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

export default EmailSite;
