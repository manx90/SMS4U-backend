import { DataSource } from "typeorm";
import { entities } from "../models/index.js";
import dotenv from "dotenv";
dotenv.config();
export const createDataSource = () => {
	return new DataSource({
		type: "mysql",
		host: process.env.DB_HOST || "localhost",
		port: parseInt(process.env.DB_PORT) || 3306,
		timezone: "Z", // Force UTC
		username: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_DATABASE,
		synchronize: true, // Disable auto-synchronization to avoid table conflicts
		logging: false,
		entities: entities,
		subscribers: ["./src/subscribers/*.js"],
	});
};

export const AppDataSource = createDataSource();
