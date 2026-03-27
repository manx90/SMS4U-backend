import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const fixServiceCodesRaw = async () => {
	let connection;

	try {
		console.log(
			"Starting raw MySQL service code migration...",
		);

		// Create direct MySQL connection
		connection = await mysql.createConnection({
			host: process.env.DB_HOST || "localhost",
			port: parseInt(process.env.DB_PORT) || 3306,
			user: process.env.DB_USERNAME,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_DATABASE,
		});

		console.log("Connected to MySQL database");

		// Step 1: Check current services
		console.log(
			"\nStep 1: Checking current services...",
		);
		const [services] = await connection.execute(`
			SELECT id, name, code FROM service ORDER BY id
		`);

		console.log(
			`Found ${services.length} services:`,
		);
		services.forEach((service) => {
			console.log(
				`- ID: ${service.id}, Name: ${
					service.name
				}, Code: '${service.code || "NULL"}'`,
			);
		});

		// Step 2: Temporarily remove unique constraint
		console.log(
			"\nStep 2: Removing unique constraint...",
		);
		try {
			await connection.execute(`
				ALTER TABLE service DROP INDEX IDX_4cb3cf237c83885cc504634829
			`);
			console.log("✓ Unique constraint removed");
		} catch (error) {
			console.log(
				"Constraint might not exist or have different name, continuing...",
			);
		}

		// Step 3: Update all services with unique codes
		console.log(
			"\nStep 3: Setting unique codes...",
		);
		const usedCodes = new Set();

		for (const service of services) {
			// Generate unique code
			let baseCode = service.name
				.replace(/\s+/g, "")
				.toUpperCase()
				.substring(0, 10);
			let finalCode = baseCode;
			let counter = 1;

			while (usedCodes.has(finalCode)) {
				finalCode = `${baseCode}-${counter}`;
				counter++;
			}

			usedCodes.add(finalCode);

			// Update service
			await connection.execute(
				`
				UPDATE service SET code = ? WHERE id = ?
			`,
				[finalCode, service.id],
			);

			console.log(
				`✓ Updated service ID ${service.id} (${service.name}) with code: ${finalCode}`,
			);
		}

		// Step 4: Add unique constraint back
		console.log(
			"\nStep 4: Adding unique constraint back...",
		);
		await connection.execute(`
			ALTER TABLE service ADD UNIQUE INDEX unique_code (code)
		`);
		console.log("✓ Unique constraint added back");

		// Step 5: Verify results
		console.log("\nStep 5: Verifying results...");
		const [updatedServices] =
			await connection.execute(`
			SELECT id, name, code FROM service ORDER BY id
		`);

		console.log("\nFinal service codes:");
		updatedServices.forEach((service) => {
			console.log(
				`- ID: ${service.id}, Name: ${service.name}, Code: ${service.code}`,
			);
		});

		// Check for duplicates
		const codes = updatedServices.map(
			(s) => s.code,
		);
		const uniqueCodes = new Set(codes);

		if (codes.length === uniqueCodes.size) {
			console.log(
				"\n🎉 SUCCESS! All services now have unique codes!",
			);
			console.log(
				"The service code system is ready to use.",
			);
			console.log("\nExample usage:");
			console.log(
				"GET /order/get-number?apiKey=YOUR_KEY&country=218&serviceCode=WHATSAPP&provider=1",
			);
		} else {
			console.log(
				"\n❌ Warning: Duplicate codes detected!",
			);
		}
	} catch (error) {
		console.error(
			"Error in migration:",
			error.message,
		);
	} finally {
		if (connection) {
			await connection.end();
		}
	}
};

// Run the raw migration
fixServiceCodesRaw();
