import fastifyCaching from "@fastify/caching";

/**
 * Cache decorators for different TTLs and caching strategies
 *
 * These decorators provide fine-grained control over HTTP caching
 * based on the type of data being served.
 */

/**
 * Static data cache - 5 seconds TTL with revalidation
 * For countries, services, pricing tables, email sites/domains
 */
export const cacheStatic = () => {
	return async (request, reply) => {
		// Set cache headers for static data with short TTL and revalidation
		reply.header(
			"Cache-Control",
			"private, max-age=5, must-revalidate",
		); // 5 seconds with revalidation
		reply.header(
			"Expires",
			new Date(Date.now() + 5000).toUTCString(),
		);
	};
};

/**
 * Dynamic data cache - 10 seconds TTL with revalidation
 * For user data, orders, real-time information
 */
export const cacheDynamic = () => {
	return async (request, reply) => {
		// Set cache headers for dynamic data with revalidation
		reply.header(
			"Cache-Control",
			"private, max-age=10, must-revalidate",
		); // 10 seconds with revalidation
		reply.header(
			"Expires",
			new Date(Date.now() + 10000).toUTCString(),
		);
	};
};

/**
 * Email availability cache - 10 seconds TTL with revalidation
 * For email availability data that updates periodically
 */
export const cacheEmailAvailability = () => {
	return async (request, reply) => {
		// Set cache headers for email availability with revalidation
		reply.header(
			"Cache-Control",
			"private, max-age=10, must-revalidate",
		); // 10 seconds with revalidation
		reply.header(
			"Expires",
			new Date(Date.now() + 10000).toUTCString(),
		);
	};
};

/**
 * No cache - for real-time data
 * For order status, user balances, live data
 */
export const cacheDisabled = () => {
	return async (request, reply) => {
		// Disable caching for real-time data
		reply.header(
			"Cache-Control",
			"no-cache, no-store, must-revalidate, max-age=0",
		);
		reply.header("Pragma", "no-cache");
		reply.header("Expires", "0");
	};
};

/**
 * Private cache - 5 seconds TTL with revalidation
 * For user-specific data that should not be cached by CDNs
 */
export const cachePrivate = () => {
	return {
		preHandler: async (request, reply) => {
			// Set private cache headers with revalidation
			reply.header(
				"Cache-Control",
				"private, max-age=5, must-revalidate",
			); // 5 seconds with revalidation
			reply.header(
				"Expires",
				new Date(Date.now() + 5000).toUTCString(),
			);
		},
	};
};

/**
 * Conditional cache - based on user role
 * Admin data cached longer than user data
 */
export const cacheConditional = (
	adminTTL = 10,
	userTTL = 5,
) => {
	return {
		preHandler: async (request, reply) => {
			const isAdmin =
				request.user?.role === "admin";
			const ttl = isAdmin ? adminTTL : userTTL;

			reply.header(
				"Cache-Control",
				`private, max-age=${ttl}, must-revalidate`,
			);
			reply.header(
				"Expires",
				new Date(
					Date.now() + ttl * 1000,
				).toUTCString(),
			);
		},
	};
};

/**
 * ETag-based cache - for data that changes infrequently
 * Uses ETag for conditional requests
 */
export const cacheETag = () => {
	return {
		preHandler: async (request, reply) => {
			// Enable ETag support with short TTL
			reply.header(
				"Cache-Control",
				"private, max-age=10, must-revalidate",
			); // 10 seconds with revalidation
			reply.header("Vary", "Accept-Encoding");
		},
	};
};

/**
 * Cache with custom TTL
 * @param {number} ttlSeconds - TTL in seconds
 * @param {boolean} isPrivate - Whether cache should be private
 */
export const cacheCustom = (
	ttlSeconds,
	isPrivate = true,
) => {
	return {
		preHandler: async (request, reply) => {
			const privacy = isPrivate
				? "private"
				: "public";
			reply.header(
				"Cache-Control",
				`${privacy}, max-age=${ttlSeconds}, must-revalidate`,
			);
			reply.header(
				"Expires",
				new Date(
					Date.now() + ttlSeconds * 1000,
				).toUTCString(),
			);
		},
	};
};

/**
 * Cache middleware factory for Fastify
 * Registers caching plugin with different configurations
 */
export const registerCachePlugin = (
	fastify,
	options = {},
) => {
	const defaultOptions = {
		privacy: "private",
		expiresIn: 5_000, // 5 seconds default
		...options,
	};

	return fastify.register(
		fastifyCaching,
		defaultOptions,
	);
};

/**
 * Cache revalidation helper - forces immediate revalidation
 * For sensitive data that must always be fresh
 */
export const cacheRevalidate = () => {
	return async (request, reply) => {
		// Force immediate revalidation for sensitive data
		reply.header(
			"Cache-Control",
			"private, max-age=0, must-revalidate",
		);
		reply.header("Pragma", "no-cache");
		reply.header("Expires", "0");
	};
};

/**
 * Cache key generator for consistent cache keys
 * @param {string} prefix - Cache key prefix
 * @param {Object} params - Parameters to include in key
 * @returns {string} Generated cache key
 */
export const generateCacheKey = (
	prefix,
	params = {},
) => {
	const sortedParams = Object.keys(params)
		.sort()
		.map((key) => `${key}:${params[key]}`)
		.join(":");

	return sortedParams
		? `${prefix}:${sortedParams}`
		: prefix;
};

/**
 * Cache invalidation helper
 * @param {Object} reply - Fastify reply object
 * @param {string} pattern - Cache pattern to invalidate
 */
export const invalidateCache = (
	reply,
	pattern,
) => {
	// Set headers to prevent caching of this response
	reply.header(
		"Cache-Control",
		"no-cache, no-store, must-revalidate",
	);
	reply.header("Pragma", "no-cache");
	reply.header("Expires", "0");

	// Log cache invalidation
	console.log(`🗑️ Cache invalidated: ${pattern}`);
};

/**
 * Cache statistics helper
 * @param {Object} reply - Fastify reply object
 * @param {Object} stats - Cache statistics
 */
export const addCacheStats = (reply, stats) => {
	reply.header(
		"X-Cache-Hit",
		stats.hit ? "true" : "false",
	);
	reply.header(
		"X-Cache-TTL",
		stats.ttl || "unknown",
	);
	reply.header(
		"X-Cache-Size",
		stats.size || "unknown",
	);
};
