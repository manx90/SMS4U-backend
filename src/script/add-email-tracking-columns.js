import { AppDataSource } from "../config/database.js";

/**
 * Migration script to add emailSite and emailDomain columns to orders table
 * This allows tracking which site/domain was used for email orders
 * and enables proper availability count management when orders are cancelled/expired
 */
async function addEmailTrackingColumns() {
	try {
		console.log(
			"🔄 Starting migration: Adding email tracking columns to orders table...",
		);

		await AppDataSource.initialize();

		const queryRunner =
			AppDataSource.createQueryRunner();
		await queryRunner.connect();

		// Check if columns already exist
		const table =
			await queryRunner.getTable("orders");
		const hasEmailSite = table.columns.some(
			(col) => col.name === "emailSite",
		);
		const hasEmailDomain = table.columns.some(
			(col) => col.name === "emailDomain",
		);

		if (hasEmailSite && hasEmailDomain) {
			console.log(
				"✅ Columns already exist. No migration needed.",
			);
			await queryRunner.release();
			await AppDataSource.destroy();
			return;
		}

		// Add emailSite column if it doesn't exist
		if (!hasEmailSite) {
			console.log(
				"  📝 Adding emailSite column...",
			);
			await queryRunner.query(`
				ALTER TABLE orders 
				ADD COLUMN emailSite VARCHAR(100) NULL
				AFTER email
			`);
			console.log("  ✅ emailSite column added");
		}

		// Add emailDomain column if it doesn't exist
		if (!hasEmailDomain) {
			console.log(
				"  📝 Adding emailDomain column...",
			);
			await queryRunner.query(`
				ALTER TABLE orders 
				ADD COLUMN emailDomain VARCHAR(100) NULL
				AFTER emailSite
			`);
			console.log("  ✅ emailDomain column added");
		}

		await queryRunner.release();
		await AppDataSource.destroy();

		console.log(
			"✅ Migration completed successfully!",
		);
		console.log(
			"\n📋 Summary:\n" +
				"   - Added emailSite column to track which email site was used\n" +
				"   - Added emailDomain column to track which email domain was used\n" +
				"   - These columns enable proper availability count management\n",
		);
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	}
}

// Run the migration
addEmailTrackingColumns();

