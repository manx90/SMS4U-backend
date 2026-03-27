import axios from "axios";
import cron from "node-cron";
import { getActiveSites } from "../repositories/emailSite.repo.js";
import { getActiveDomains } from "../repositories/emailDomain.repo.js";
import { emailPriceRepository } from "../repositories/emailPrice.repo.js";

class EmailAvailabilitySync {
	constructor() {
		this.apiUrl =
			process.env.EMAIL_API ||
			"https://api.anymessage.shop";
		this.apiToken =
			process.env.EMAIL_TOKEN ||
			"Fef8GYf4wAJ8C4W9KED8f0D5N4G5VyZ1";
		this.syncInterval =
			parseInt(
				process.env.EMAIL_SYNC_INTERVAL ||
					"600000",
			) || 600000; // 10 minutes default
		this.isEnabled =
			process.env.EMAIL_SYNC_ENABLED !== "false";
		this.isSyncing = false;
		this.cronTask = null;
		// Convert interval to cron expression (every 10 minutes)
		this.cronExpression = "*/10 * * * *"; // Every 10 minutes
	}

	/**
	 * Start the background sync service
	 */
	start() {
		if (!this.isEnabled) {
			console.log(
				"⏸️  Email availability sync is disabled",
			);
			return;
		}

		console.log(
			`🔄 Starting email availability sync service with cron (expression: ${this.cronExpression})`,
		);

		// Run immediately on start
		this.syncAvailability();

		// Schedule with cron (every 10 minutes)
		this.cronTask = cron.schedule(
			this.cronExpression,
			() => {
				this.syncAvailability();
			},
			{
				scheduled: true,
				timezone: "UTC",
			},
		);
	}

	/**
	 * Stop the background sync service
	 */
	stop() {
		if (this.cronTask) {
			this.cronTask.stop();
			this.cronTask = null;
			console.log(
				"⏹️  Email availability sync service stopped",
			);
		}
	}

	/**
	 * Main sync function - fetches and caches email availability
	 */
	async syncAvailability() {
		if (this.isSyncing) {
			console.log(
				"⏳ Email sync already in progress, skipping...",
			);
			return;
		}

		this.isSyncing = true;
		const startTime = Date.now();

		try {
			console.log(
				"🔄 Starting email availability sync...",
			);

			// Get all active sites and domains from our database
			const sites = await getActiveSites();
			const domains = await getActiveDomains();

			if (!sites || sites.length === 0) {
				console.log(
					"⚠️  No active sites found, skipping sync",
				);
				return;
			}

			if (!domains || domains.length === 0) {
				console.log(
					"⚠️  No active domains found, skipping sync",
				);
				return;
			}

			// Create a set of domain names for quick lookup
			const domainNames = new Set(
				domains.map((d) => d.name),
			);

			let totalUpdated = 0;
			let totalErrors = 0;

			// Loop through each site
			for (const site of sites) {
				try {
					console.log(
						`  📧 Fetching counts for ${site.display_name} (${site.name})...`,
					);

					// Call API to get availability for this site
					const response = await axios.get(
						`${this.apiUrl}/email/quantity`,
						{
							params: {
								token: this.apiToken,
								site: site.name,
							},
							timeout: 15000, // 15 second timeout
						},
					);

					if (
						response.data.status === "success" &&
						response.data.data
					) {
						const apiData = response.data.data;

						// Filter and update only domains we support
						for (const [
							domainName,
							domainData,
						] of Object.entries(apiData)) {
							// Only process if this domain exists in our database
							if (domainNames.has(domainName)) {
								const count =
									domainData.count || 0;

								// Find the price record for this site+domain
								const priceRecord =
									await emailPriceRepository.findOne(
										{
											where: {
												site: site.name,
												domain: domainName,
											},
										},
									);

								if (priceRecord) {
									// Update the count and timestamp
									await emailPriceRepository.update(
										priceRecord.id,
										{
											available_count: count,
											last_synced_at: new Date(),
										},
									);
									totalUpdated++;
								}
							}
						}

						// Also update the default price (no domain)
						const defaultPriceRecord =
							await emailPriceRepository.findOne({
								where: {
									site: site.name,
									domain: null,
								},
							});

						if (defaultPriceRecord) {
							// Sum all counts for this site
							let totalCount = 0;
							for (const domainData of Object.values(
								apiData,
							)) {
								totalCount +=
									domainData.count || 0;
							}
							await emailPriceRepository.update(
								defaultPriceRecord.id,
								{
									available_count: totalCount,
									last_synced_at: new Date(),
								},
							);
							totalUpdated++;
						}

						console.log(
							`  ✅ Updated counts for ${site.display_name}`,
						);
					} else {
						console.warn(
							`  ⚠️  Invalid response for ${site.name}`,
						);
						totalErrors++;
					}
				} catch (siteError) {
					console.error(
						`  ❌ Error fetching ${site.name}:`,
						siteError.message,
					);
					totalErrors++;
				}

				// Small delay between requests to avoid rate limiting
				await this.sleep(500);
			}

			const duration = Date.now() - startTime;
			console.log(
				`✅ Email sync completed in ${duration}ms - Updated: ${totalUpdated}, Errors: ${totalErrors}`,
			);
		} catch (error) {
			console.error(
				"❌ Email availability sync failed:",
				error.message,
			);
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Get cached availability data
	 */
	async getCachedAvailability(site = null) {
		try {
			const query = {
				where: { active: true },
			};

			if (site) {
				query.where.site = site;
			}

			const prices =
				await emailPriceRepository.find(query);

			// Group by site, then by domain
			const grouped = {};

			for (const price of prices) {
				if (!grouped[price.site]) {
					grouped[price.site] = {};
				}

				const domainKey =
					price.domain || "default";
				grouped[price.site][domainKey] = {
					count: price.available_count || 0,
					last_synced:
						price.last_synced_at || null,
					price: price.price,
				};
			}

			return grouped;
		} catch (error) {
			console.error(
				"Error getting cached availability:",
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Utility function to sleep
	 */
	sleep(ms) {
		return new Promise((resolve) =>
			setTimeout(resolve, ms),
		);
	}
}

export default new EmailAvailabilitySync();
