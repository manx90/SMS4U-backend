import { LRUCache } from "lru-cache";

/**
 * CacheService - Centralized in-memory caching service
 *
 * Provides LRU-cache with TTL support, automatic warming, invalidation,
 * and fallback to database for optimal performance.
 */
class CacheService {
	constructor() {
		// Configuration from environment or defaults
		this.maxSize =
			parseInt(process.env.CACHE_MAX_SIZE) ||
			1000;
		this.defaultTTL =
			parseInt(process.env.CACHE_TTL_SECONDS) *
				1000 || 5000; // 5 seconds
		this.enabled =
			process.env.CACHE_ENABLED !== "false";

		// Initialize LRU cache
		this.cache = new LRUCache({
			max: this.maxSize,
			ttl: this.defaultTTL,
			updateAgeOnGet: true,
			allowStale: false,
			// Custom dispose function for cleanup
			dispose: (value, key) => {
				// console.log(`🗑️ Cache evicted: ${key}`);
			},
		});

		// Statistics tracking
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			deletes: 0,
			evictions: 0,
			startTime: Date.now(),
		};

		// console.log(
		// 	`📦 CacheService initialized - Max: ${
		// 		this.maxSize
		// 	}, TTL: ${this.defaultTTL / 1000}s`,
		// );
	}

	/**
	 * Get value from cache or fetch from database
	 * @param {string} key - Cache key
	 * @param {Function} fetcher - Function to fetch data if cache miss
	 * @param {number} ttl - Optional TTL override in milliseconds
	 * @returns {Promise<any>} Cached or fetched data
	 */
	async get(key, fetcher, ttl = null) {
		if (!this.enabled) {
			console.log(
				`🚫 Cache disabled, fetching directly: ${key}`,
			);
			return await fetcher();
		}

		// Check cache first
		if (this.cache.has(key)) {
			this.stats.hits++;
			const value = this.cache.get(key);
			// console.log(`✅ Cache hit: ${key}`);
			return value;
		}

		// Cache miss - fetch from database
		this.stats.misses++;
		// console.log(`❌ Cache miss: ${key}`);

		try {
			const value = await fetcher();

			// Store in cache with TTL
			const cacheTTL = ttl || this.defaultTTL;
			this.cache.set(key, value, {
				ttl: cacheTTL,
			});
			this.stats.sets++;

			// console.log(
			// 	`💾 Cached: ${key} (TTL: ${
			// 		cacheTTL / 1000
			// 	}s)`,
			// );
			return value;
		} catch (error) {
			console.error(
				`❌ Error fetching data for key ${key}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Set value in cache
	 * @param {string} key - Cache key
	 * @param {any} value - Value to cache
	 * @param {number} ttl - TTL in milliseconds
	 */
	set(key, value, ttl = null) {
		if (!this.enabled) return;

		const cacheTTL = ttl || this.defaultTTL;
		this.cache.set(key, value, { ttl: cacheTTL });
		this.stats.sets++;
		// console.log(
		// 	`💾 Set cache: ${key} (TTL: ${
		// 		cacheTTL / 1000
		// 	}s)`,
		// );
	}

	/**
	 * Invalidate specific cache key
	 * @param {string} key - Cache key to invalidate
	 */
	invalidate(key) {
		if (!this.enabled) return;

		const deleted = this.cache.delete(key);
		if (deleted) {
			this.stats.deletes++;
			// console.log(`🗑️ Invalidated: ${key}`);
		}
	}

	/**
	 * Invalidate multiple keys by pattern
	 * @param {string} pattern - Pattern to match keys (supports wildcards)
	 */
	invalidatePattern(pattern) {
		if (!this.enabled) return;

		const regex = new RegExp(
			pattern.replace(/\*/g, ".*"),
		);
		let invalidatedCount = 0;

		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
				invalidatedCount++;
			}
		}

		this.stats.deletes += invalidatedCount;
		// console.log(
		// 	`🗑️ Invalidated ${invalidatedCount} keys matching pattern: ${pattern}`,
		// );
	}

	/**
	 * Clear all cache entries
	 */
	clear() {
		if (!this.enabled) return;

		const size = this.cache.size;
		this.cache.clear();
		this.stats.deletes += size;
		// console.log(
		// 	`🗑️ Cleared all cache entries (${size} keys)`,
		// );
	}

	/**
	 * Warm cache with static data
	 * This should be called on server startup
	 */
	async warmCache() {
		if (!this.enabled) {
			console.log(
				"🚫 Cache warming skipped - cache disabled",
			);
			return;
		}

		// console.log("🔥 Starting cache warming...");
		const startTime = Date.now();

		try {
			// Import repositories dynamically to avoid circular dependencies
			const { countryRepository } = await import(
				"../repositories/country.repo.js"
			);
			const { serviceRepository } = await import(
				"../repositories/service.repo.js"
			);
			const { countryServicePricingRepository } =
				await import(
					"../repositories/countryServicePricing.repo.js"
				);
			const { getActiveSites } = await import(
				"../repositories/emailSite.repo.js"
			);
			const { getActiveDomains } = await import(
				"../repositories/emailDomain.repo.js"
			);

			// Warm static data caches
			await Promise.all([
				this.warmCountries(countryRepository),
				this.warmServices(serviceRepository),
				this.warmPricing(
					countryServicePricingRepository,
				),
				this.warmEmailData(
					getActiveSites,
					getActiveDomains,
				),
			]);

			const duration = Date.now() - startTime;
			// console.log(
			// 	`✅ Cache warming completed in ${duration}ms`,
			// );
		} catch (error) {
			console.error(
				"❌ Cache warming failed:",
				error,
			);
		}
	}

	/**
	 * Warm countries cache
	 */
	async warmCountries(countryRepository) {
		const countries =
			await countryRepository.find();
		this.set("countries:all", countries);
		// console.log(
		// 	`🔥 Warmed countries cache (${countries.length} countries)`,
		// );
	}

	/**
	 * Warm services cache
	 */
	async warmServices(serviceRepository) {
		const services =
			await serviceRepository.find();
		this.set("services:all", services);
		// console.log(
		// 	`🔥 Warmed services cache (${services.length} services)`,
		// );
	}

	/**
	 * Warm pricing cache
	 */
	async warmPricing(
		countryServicePricingRepository,
	) {
		const pricing =
			await countryServicePricingRepository.find({
				relations: {
					country: true,
					service: true,
				},
			});
		this.set("pricing:all", pricing);
		// console.log(
		// 	`🔥 Warmed pricing cache (${pricing.length} pricing entries)`,
		// );
	}

	/**
	 * Warm email data cache
	 */
	async warmEmailData(
		getActiveSites,
		getActiveDomains,
	) {
		const [sites, domains] = await Promise.all([
			getActiveSites(),
			getActiveDomains(),
		]);

		this.set("email:sites", sites);
		this.set("email:domains", domains);
		// console.log(
		// 	`🔥 Warmed email cache (${sites.length} sites, ${domains.length} domains)`,
		// );
	}

	/**
	 * Get cache statistics
	 * @returns {Object} Cache statistics
	 */
	getStats() {
		const hitRate =
			this.stats.hits + this.stats.misses > 0
				? (
						(this.stats.hits /
							(this.stats.hits +
								this.stats.misses)) *
						100
				  ).toFixed(2)
				: 0;

		return {
			enabled: this.enabled,
			size: this.cache.size,
			maxSize: this.maxSize,
			hitRate: `${hitRate}%`,
			stats: {
				...this.stats,
				uptime: Date.now() - this.stats.startTime,
			},
			keys: Array.from(this.cache.keys()).slice(
				0,
				10,
			), // First 10 keys for debugging
		};
	}

	/**
	 * Refresh cache by invalidating and re-warming
	 */
	async refreshCache() {
		// console.log("🔄 Refreshing cache...");
		this.clear();
		await this.warmCache();
	}

	/**
	 * Check if cache is enabled
	 * @returns {boolean} Cache enabled status
	 */
	isEnabled() {
		return this.enabled;
	}

	/**
	 * Get cache size
	 * @returns {number} Number of cached entries
	 */
	size() {
		return this.cache.size;
	}

	/**
	 * Check if key exists in cache
	 * @param {string} key - Cache key
	 * @returns {boolean} Key exists
	 */
	has(key) {
		return this.cache.has(key);
	}
}

export default new CacheService();
