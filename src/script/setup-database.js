import { AppDataSource } from "../config/database.js";
import dotenv from "dotenv";

dotenv.config();

async function setupDatabase() {
	try {
		console.log("🔧 Setting up database...");

		// Initialize the data source
		await AppDataSource.initialize();
		console.log(
			"✅ Database connection established",
		);

		// Check if we have pending migrations
		const pendingMigrations =
			await AppDataSource.showMigrations();
		if (pendingMigrations) {
			console.log(
				"📋 Running pending migrations...",
			);
			await AppDataSource.runMigrations();
			console.log("✅ Migrations completed");
		} else {
			console.log("✅ No pending migrations");
		}

		// Test the connection by running a simple query
		await AppDataSource.query("SELECT 1 as test");
		console.log(
			"✅ Database setup completed successfully",
		);

		await AppDataSource.destroy();
		console.log("✅ Database connection closed");
	} catch (error) {
		console.error(
			"❌ Database setup failed:",
			error,
		);
		process.exit(1);
	}
}

setupDatabase();
