import { DataSource } from "typeorm";
import { entities } from "../models/index.js";
import dotenv from "dotenv";
dotenv.config();

const poolSize = Math.min(
	100,
	Math.max(
		5,
		parseInt(process.env.DB_POOL_SIZE, 10) || 25,
	),
);

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
		poolSize,
		connectTimeout:
			parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 30000,
		acquireTimeout:
			parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS, 10) || 60000,
		extra: {
			waitForConnections: true,
			queueLimit: 0,
		},
	});
};

export const AppDataSource = createDataSource();
