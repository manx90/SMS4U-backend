import { AppDataSource } from "../config/database.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Setup script for payment_invoices table
 * This script creates the payment_invoices table if it doesn't exist
 * Note: TypeORM will auto-create tables if synchronize: true, but this script
 * can be used for manual setup or to verify the table structure
 */
async function setupPaymentInvoices() {
	try {
		console.log("🔧 Setting up payment_invoices table...");

		// Initialize the data source
		await AppDataSource.initialize();
		console.log("✅ Database connection established");

		// SQL to create payment_invoices table
		const createTableSQL = `
			CREATE TABLE IF NOT EXISTS payment_invoices (
				id INT PRIMARY KEY AUTO_INCREMENT,
				userId INT NOT NULL,
				heleketUuid VARCHAR(255) UNIQUE NOT NULL,
				orderId VARCHAR(255) UNIQUE NOT NULL,
				amount DECIMAL(10,2) NOT NULL,
				currency VARCHAR(10) DEFAULT 'USDT',
				payerAmount DECIMAL(10,2),
				payerCurrency VARCHAR(10),
				paymentStatus VARCHAR(50) DEFAULT 'check',
				paymentAmount DECIMAL(10,2),
				paymentAmountUsd DECIMAL(10,2),
				merchantAmount DECIMAL(10,2),
				address VARCHAR(255),
				url TEXT,
				expiredAt BIGINT,
				additionalData TEXT,
				createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
				INDEX idx_user_id (userId),
				INDEX idx_uuid (heleketUuid),
				INDEX idx_order_id (orderId),
				INDEX idx_status (paymentStatus)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
		`;

		// Execute the SQL
		await AppDataSource.query(createTableSQL);
		console.log("✅ payment_invoices table created/verified");

		// Verify table exists
		const [tables] = await AppDataSource.query(
			"SHOW TABLES LIKE 'payment_invoices'",
		);
		if (tables.length > 0) {
			console.log("✅ payment_invoices table exists");
		} else {
			console.warn("⚠️ payment_invoices table not found");
		}

		await AppDataSource.destroy();
		console.log("✅ Database connection closed");
		console.log("✅ Setup completed successfully");
	} catch (error) {
		console.error("❌ Setup failed:", error);
		process.exit(1);
	}
}

setupPaymentInvoices();

