import { AppDataSource } from "../config/database.js";
import {
	emailSiteRepository,
	createSite,
} from "../repositories/emailSite.repo.js";
import {
	emailDomainRepository,
	createDomain,
} from "../repositories/emailDomain.repo.js";
import {
	emailPriceRepository,
	createPrice,
} from "../repositories/emailPrice.repo.js";

async function setupEmailTables() {
	try {
		// Initialize database connection
		if (!AppDataSource.isInitialized) {
			await AppDataSource.initialize();
		}

		console.log(
			"🚀 Starting email tables setup...",
		);

		// Clear existing data
		console.log(
			"🗑️  Clearing existing email data...",
		);
		await emailPriceRepository.delete({});
		await emailSiteRepository.delete({});
		await emailDomainRepository.delete({});

		// Create email sites
		console.log("📧 Creating email sites...");
		const sites = [
			{
				name: "instagram.com",
				display_name: "Instagram",
				api_name: "instagram.com",
				description:
					"Instagram verification emails",
				status: true,
			},
			{
				name: "facebook.com",
				display_name: "Facebook",
				api_name: "facebook.com",
				description:
					"Facebook verification emails",
				status: true,
			},
			{
				name: "twitter.com",
				display_name: "Twitter",
				api_name: "twitter.com",
				description:
					"Twitter verification emails",
				status: true,
			},
			{
				name: "gmail.com",
				display_name: "Gmail",
				api_name: "gmail.com",
				description: "Gmail account verification",
				status: true,
			},
			{
				name: "yahoo.com",
				display_name: "Yahoo",
				api_name: "yahoo.com",
				description: "Yahoo account verification",
				status: true,
			},
			{
				name: "outlook.com",
				display_name: "Outlook",
				api_name: "outlook.com",
				description:
					"Outlook account verification",
				status: true,
			},
			{
				name: "hotmail.com",
				display_name: "Hotmail",
				api_name: "hotmail.com",
				description:
					"Hotmail account verification",
				status: true,
			},
		];

		for (const site of sites) {
			await createSite(site);
			console.log(
				`  ✅ Created site: ${site.display_name}`,
			);
		}

		// Create email domains
		console.log("🌐 Creating email domains...");
		const domains = [
			{
				name: "gmx.com",
				display_name: "GMX",
				api_name: "gmx.com",
				description: "GMX email domain",
				status: true,
			},
			{
				name: "mail.com",
				display_name: "Mail.com",
				api_name: "mail.com",
				description: "Mail.com email domain",
				status: true,
			},
			{
				name: "hotmail.com",
				display_name: "Hotmail",
				api_name: "hotmail.com",
				description: "Hotmail email domain",
				status: true,
			},
			{
				name: "outlook.com",
				display_name: "Outlook",
				api_name: "outlook.com",
				description: "Outlook email domain",
				status: true,
			},
			{
				name: "yahoo.com",
				display_name: "Yahoo",
				api_name: "yahoo.com",
				description: "Yahoo email domain",
				status: true,
			},
		];

		for (const domain of domains) {
			await createDomain(domain);
			console.log(
				`  ✅ Created domain: ${domain.display_name}`,
			);
		}

		// Create email prices
		console.log("💰 Creating email prices...");
		const defaultPrice = 0.5; // $0.50 default price
		let priceCount = 0;

		// Create prices for each site without domain (default)
		for (const site of sites) {
			await createPrice({
				site: site.name,
				domain: null,
				price: defaultPrice,
				active: true,
			});
			priceCount++;
		}

		// Create prices for each site+domain combination
		for (const site of sites) {
			for (const domain of domains) {
				await createPrice({
					site: site.name,
					domain: domain.name,
					price: defaultPrice,
					active: true,
				});
				priceCount++;
			}
		}

		console.log(
			`  ✅ Created ${priceCount} price entries`,
		);

		console.log(
			"\n✨ Email tables setup completed successfully!",
		);
		console.log(
			`   - Sites created: ${sites.length}`,
		);
		console.log(
			`   - Domains created: ${domains.length}`,
		);
		console.log(
			`   - Price entries created: ${priceCount}`,
		);
		console.log(
			"\n📝 Note: Default price is set to $0.50 per email",
		);
		console.log(
			"   You can update prices through the admin panel or directly in the database.\n",
		);

		process.exit(0);
	} catch (error) {
		console.error(
			"❌ Error setting up email tables:",
			error,
		);
		process.exit(1);
	}
}

// Run the setup
setupEmailTables();
