export const TIMEOUT_CONFIG = {
	ORDER_EXPIRATION_MINUTES: 15,
	ORDER_EXPIRATION_CHECK_INTERVAL:
		0.25 * 60 * 1000,
	API_REQUEST_TIMEOUT: 15 * 1000,
	CIRCUIT_BREAKER_TIMEOUT: 60 * 1000,
	EMAIL_SYNC_TIMEOUT: 2 * 1000,
	REORDER_TIMEOUT_MINUTES: 15,
	REORDER_TIMEOUT_CHECK_INTERVAL: 1 * 60 * 1000,
	// Database now uses UTC (timezone: '+00:00')
	// No offset needed
	DATABASE_TIME_OFFSET_MINUTES: 0,
};

export function getTimeoutMs(timeoutType) {
	switch (timeoutType) {
		case "ORDER_EXPIRATION":
			return (
				TIMEOUT_CONFIG.ORDER_EXPIRATION_MINUTES *
				60 *
				1000
			);
		case "ORDER_EXPIRATION_CHECK":
			return TIMEOUT_CONFIG.ORDER_EXPIRATION_CHECK_INTERVAL;
		case "API_REQUEST":
			return TIMEOUT_CONFIG.API_REQUEST_TIMEOUT;
		case "CIRCUIT_BREAKER":
			return TIMEOUT_CONFIG.CIRCUIT_BREAKER_TIMEOUT;
		case "EMAIL_SYNC":
			return TIMEOUT_CONFIG.EMAIL_SYNC_TIMEOUT;
		case "REORDER_TIMEOUT":
			return (
				TIMEOUT_CONFIG.REORDER_TIMEOUT_MINUTES *
				60 *
				1000
			);
		case "REORDER_TIMEOUT_CHECK":
			return TIMEOUT_CONFIG.REORDER_TIMEOUT_CHECK_INTERVAL;
		default:
			throw new Error(
				`Unknown timeout type: ${timeoutType}`,
			);
	}
}

export function getTimeoutMinutes(timeoutType) {
	switch (timeoutType) {
		case "ORDER_EXPIRATION":
			return TIMEOUT_CONFIG.ORDER_EXPIRATION_MINUTES;
		case "DATABASE_TIME_OFFSET":
			return TIMEOUT_CONFIG.DATABASE_TIME_OFFSET_MINUTES;
		case "REORDER_TIMEOUT":
			return TIMEOUT_CONFIG.REORDER_TIMEOUT_MINUTES;
		default:
			return (
				getTimeoutMs(timeoutType) / (60 * 1000)
			);
	}
}
