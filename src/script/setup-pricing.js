import { AppDataSource } from "../config/database.js";
import { countryRepository } from "../repositories/country.repo.js";
import { serviceRepository } from "../repositories/service.repo.js";
import { create } from "../repositories/countryServicePricing.repo.js";

/**
 * Script to set up initial pricing for countries and services
 * Usage: node src/script/setup-pricing.js
 */

async function setupInitialPricing() {
	try {
		// Initialize database connection
		await AppDataSource.initialize();
		console.log("✅ Database connected");

		// Get all countries and services
		const countries =
			await countryRepository.find();
		const services =
			await serviceRepository.find();

		console.log(
			`Found ${countries.length} countries and ${services.length} services`,
		);

		if (
			countries.length === 0 ||
			services.length === 0
		) {
			console.log(
				"❌ No countries or services found. Please create them first.",
			);
			return;
		}

		// Example pricing setup - you can modify these values
		const pricingData = [
			// Example: Libya pricing
			{
				countryName: "libya",
				serviceName: "telegram",
				price: 2.0,
			},
			{
				countryName: "libya",
				serviceName: "whatsapp",
				price: 5.0,
			},
			{
				countryName: "libya",
				serviceName: "instagram",
				price: 3.0,
			},

			// Example: Egypt pricing
			{
				countryName: "egypt",
				serviceName: "telegram",
				price: 1.5,
			},
			{
				countryName: "egypt",
				serviceName: "whatsapp",
				price: 4.0,
			},
			{
				countryName: "egypt",
				serviceName: "instagram",
				price: 2.5,
			},

			// Example: Saudi Arabia pricing
			{
				countryName: "saudi",
				serviceName: "telegram",
				price: 3.0,
			},
			{
				countryName: "saudi",
				serviceName: "whatsapp",
				price: 6.0,
			},
			{
				countryName: "saudi",
				serviceName: "instagram",
				price: 4.0,
			},
		];

		let createdCount = 0;
		let skippedCount = 0;

		for (const pricing of pricingData) {
			try {
				// Find country and service
				const country = countries.find(
					(c) =>
						c.name.toLowerCase() ===
						pricing.countryName.toLowerCase(),
				);
				const service = services.find(
					(s) =>
						s.name.toLowerCase() ===
						pricing.serviceName.toLowerCase(),
				);

				if (!country) {
					console.log(
						`⚠️  Country "${pricing.countryName}" not found, skipping...`,
					);
					skippedCount++;
					continue;
				}

				if (!service) {
					console.log(
						`⚠️  Service "${pricing.serviceName}" not found, skipping...`,
					);
					skippedCount++;
					continue;
				}

				// Create pricing
				const pricingConfig = {
					country: { id: country.id },
					service: { id: service.id },
					price: pricing.price,
				};

				await create(pricingConfig);
				console.log(
					`✅ Created pricing: ${country.name} - ${service.name} = $${pricing.price}`,
				);
				createdCount++;
			} catch (error) {
				if (
					error.message.includes("duplicate") ||
					error.message.includes("unique")
				) {
					console.log(
						`⚠️  Pricing already exists for ${pricing.countryName} - ${pricing.serviceName}`,
					);
					skippedCount++;
				} else {
					console.error(
						`❌ Error creating pricing for ${pricing.countryName} - ${pricing.serviceName}:`,
						error.message,
					);
				}
			}
		}

		console.log(`\n📊 Setup Summary:`);
		console.log(
			`✅ Created: ${createdCount} pricing configurations`,
		);
		console.log(
			`⚠️  Skipped: ${skippedCount} (already exist or missing data)`,
		);
		console.log(`\n🎉 Pricing setup completed!`);
	} catch (error) {
		console.error(
			"❌ Error setting up pricing:",
			error,
		);
	} finally {
		if (AppDataSource.isInitialized) {
			await AppDataSource.destroy();
			console.log(
				"✅ Database connection closed",
			);
		}
	}
}

// Run the setup if this file is executed directly
if (
	import.meta.url === `file://${process.argv[1]}`
) {
	setupInitialPricing();
}

export default setupInitialPricing;
