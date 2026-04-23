import cron from "node-cron";
import EmailAvailabilitySync from "./EmailAvailabilitySync.js";
import OrderExpirationService from "./OrderExpirationService.js";
import Provider3AccessSync from "./Provider3AccessSync.js";
import CacheService from "./CacheService.js";

class BackgroundService {
	constructor() {
		this.isRunning = false;
		this.cacheRefreshCronTask = null;
		this.CACHE_REFRESH_INTERVAL =
			10 * 60 * 60 * 1000; // Cache refresh every 10 hours
		// Convert interval to cron expression (every 10 hours)
		this.cacheRefreshCronExpression = "0 */10 * * *"; // Every 10 hours at minute 0
	}

	/**
	 * Start the background services
	 */
	async start() {
		if (this.isRunning) {
			console.log(
				"Background service is already running",
			);
			return;
		}

		console.log(
			"Starting background services...",
		);
		this.isRunning = true;

		// Start cache warming first
		await CacheService.warmCache();

		// Start order expiration service (now handles both expiration and refunds)
		OrderExpirationService.start();

		// Start email availability sync
		EmailAvailabilitySync.start();

		// Provider3 /accessinfo snapshot sync (cron)
		Provider3AccessSync.start();

		// Start cache refresh service
		this.startCacheRefresh();

		console.log(
			"Background services started successfully",
		);
	}

	/**
	 * Stop the background services
	 */
	stop() {
		if (!this.isRunning) {
			console.log(
				"Background service is not running",
			);
			return;
		}

		console.log(
			"Stopping background services...",
		);
		this.isRunning = false;

		if (this.cacheRefreshCronTask) {
			this.cacheRefreshCronTask.stop();
			this.cacheRefreshCronTask = null;
		}

		// Stop order expiration service
		OrderExpirationService.stop();

		// Stop email availability sync
		EmailAvailabilitySync.stop();

		Provider3AccessSync.stop();

		console.log(
			"Background services stopped successfully",
		);
	}

	/**
	 * Start cache refresh service
	 */
	startCacheRefresh() {
		console.log(
			`🔄 Starting cache refresh service with cron (expression: ${this.cacheRefreshCronExpression})`,
		);

		// Schedule cache refresh with cron (every 10 hours)
		this.cacheRefreshCronTask = cron.schedule(
			this.cacheRefreshCronExpression,
			async () => {
				try {
					console.log("🔄 Refreshing cache...");
					await CacheService.refreshCache();
					console.log(
						"✅ Cache refresh completed",
					);
				} catch (error) {
					console.error(
						"❌ Error refreshing cache:",
						error,
					);
				}
			},
			{
				scheduled: true,
				timezone: "UTC",
			},
		);
	}

	/**
	 * Start services with staggered execution to avoid concurrent load
	 */
	startStaggeredServices() {
		console.log(
			"⏰ Starting services with staggered execution...",
		);

		// Start order expiration immediately (critical)
		setTimeout(() => {
			OrderExpirationService.start();
		}, 0);

		// Start email sync after 30 seconds
		setTimeout(() => {
			EmailAvailabilitySync.start();
		}, 30000);

		// Start cache refresh after 45 seconds
		setTimeout(() => {
			this.startCacheRefresh();
		}, 45000);
	}

	/**
	 * Get status of background services
	 */
	getStatus() {
		return {
			isRunning: this.isRunning,
			cacheRefreshInterval:
				this.CACHE_REFRESH_INTERVAL,
			nextCacheRefresh: this.isRunning
				? "Every 10 hours"
				: "Not running",
			orderExpiration:
				OrderExpirationService.getStatus(),
			emailSyncEnabled:
				EmailAvailabilitySync.isEnabled,
			emailSyncInterval:
				EmailAvailabilitySync.syncInterval,
			provider3AccessSyncCron:
				process.env.PROVIDER3_ACCESS_SYNC_CRON ||
				"* * * * *",
			cacheStats: CacheService.getStats(),
		};
	}
}

export default new BackgroundService();
