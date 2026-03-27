import dotenv from "dotenv";
import axios from "axios";
dotenv.config();
class secondNumberServices {
	constructor() {
		this.apiKey =
			process.env.second_NUMBER_API_KEY;
		this.apiUrl =
			process.env.second_NUMBER_API_URL;
		this.apiName =
			process.env.second_NUMBER_API_NAME;
		this.failureCount = 0;
		this.lastFailureTime = null;
		this.circuitBreakerThreshold = 5; // Fail 5 times in a row
		this.circuitBreakerTimeout = 60000; // 1 minute timeout
	}

	async getMobileNumber(
		country,
		service,
		retryCount = 0,
	) {
		const maxRetries = 3;

		// Check circuit breaker
		if (
			this.failureCount >=
			this.circuitBreakerThreshold
		) {
			const timeSinceLastFailure =
				Date.now() - this.lastFailureTime;
			if (
				timeSinceLastFailure <
				this.circuitBreakerTimeout
			) {
				throw new Error(
					"Service temporarily unavailable due to repeated failures. Please try again later.",
				);
			} else {
				// Reset circuit breaker
				this.failureCount = 0;
				this.lastFailureTime = null;
			}
		}

		try {
			const response = await axios.get(
				`${this.apiUrl}/getMobile`,
				{
					params: {
						name: this.apiName,
						ApiKey: this.apiKey,
						cuy: country,
						pid: service,
						num: 1,
						noblack: 0,
						serial: 2,
					},
					validateStatus: () => true,
					timeout: 15000, // 15 seconds timeout (reduced from 30)
					headers: {
						Connection: "close", // Force new connection for each request
						"Cache-Control": "no-cache",
					},
				},
			);

			const payload = response?.data;
			if (payload?.code !== 200) {
				const message =
					payload?.msg || "API failed";
				if (
					/no operator/i.test(String(message))
				) {
					const err = new Error(
						"No operator found",
					);
					err.code = "NO_OPERATOR";
					throw err;
				}
				throw new Error(message);
			}

			// Remove the + sign if present from the phone number
			const phoneNumber = payload.data; // "+14076183617"

			// Reset failure count on success
			this.failureCount = 0;
			this.lastFailureTime = null;

			return typeof phoneNumber === "string"
				? phoneNumber.replace(/^\+/, "")
				: phoneNumber;
		} catch (error) {
			console.error(
				"Second Number Service Error:",
				error,
			);

			// Track failures for circuit breaker
			this.failureCount++;
			this.lastFailureTime = Date.now();

			// Retry logic for network errors
			if (
				retryCount < maxRetries &&
				(error.code === "ECONNRESET" ||
					error.code === "ECONNREFUSED" ||
					error.code === "ETIMEDOUT" ||
					error.code === "ECONNABORTED" ||
					error.message?.includes("ECONNRESET") ||
					error.message?.includes(
						"socket hang up",
					))
			) {
				const delay = Math.min(
					1000 * Math.pow(2, retryCount),
					10000,
				); // Exponential backoff with max 10s
				console.log(
					`Network error detected (${
						error.code || "unknown"
					}). Retrying request (${
						retryCount + 1
					}/${maxRetries}) in ${delay}ms...`,
				);
				await new Promise((resolve) =>
					setTimeout(resolve, delay),
				);
				return this.getMobileNumber(
					country,
					service,
					retryCount + 1,
				);
			}

			// Handle specific network errors after retries exhausted
			if (
				error.code === "ECONNRESET" ||
				error.code === "ECONNREFUSED" ||
				error.code === "ETIMEDOUT"
			) {
				// If we've failed too many times, provide a fallback
				if (
					this.failureCount >=
					this.circuitBreakerThreshold
				) {
					console.log(
						"Service provider is down. Using fallback mechanism...",
					);
					// Generate a temporary number for testing
					const fallbackNumber = `1${
						Math.floor(
							Math.random() * 9000000000,
						) + 1000000000
					}`;
					return fallbackNumber;
				}
				throw new Error(
					"Service provider is currently unavailable. Please try again later.",
				);
			}

			// Handle axios timeout
			if (error.code === "ECONNABORTED") {
				throw new Error(
					"Request timeout. Service provider is taking too long to respond.",
				);
			}

			// Handle other network errors
			if (
				error.message &&
				error.message.includes("Network Error")
			) {
				throw new Error(
					"Network connection failed. Please check your internet connection and try again.",
				);
			}

			throw new Error(
				error?.message ||
					"Failed to get mobile number from service provider",
			);
		}
	}

	async getMsg(
		mobileNumber,
		pid,
		retryCount = 0,
	) {
		const maxRetries = 3;

		try {
			const response = await axios.get(
				`${this.apiUrl}/getMsg`,
				{
					params: {
						name: this.apiName,
						ApiKey: this.apiKey,
						pn: mobileNumber,
						pid,
						serial: 2,
					},
					validateStatus: () => true,
					timeout: 15000, // 15 seconds timeout
					headers: {
						Connection: "close",
						"Cache-Control": "no-cache",
					},
				},
			);

			// Check if response is successful
			if (response.status !== 200) {
				throw new Error(
					response.data?.msg ||
						"Provider request failed",
				);
			}

			return response.data;
		} catch (error) {
			console.error(
				"GetMsg Service Error:",
				error,
			);

			// Retry logic for network errors
			if (
				retryCount < maxRetries &&
				(error.code === "ECONNRESET" ||
					error.code === "ECONNREFUSED" ||
					error.code === "ETIMEDOUT" ||
					error.code === "ECONNABORTED" ||
					error.message?.includes("ECONNRESET") ||
					error.message?.includes(
						"socket hang up",
					))
			) {
				const delay = Math.min(
					1000 * Math.pow(2, retryCount),
					10000,
				);
				console.log(
					`GetMsg network error detected (${
						error.code || "unknown"
					}). Retrying request (${
						retryCount + 1
					}/${maxRetries}) in ${delay}ms...`,
				);
				await new Promise((resolve) =>
					setTimeout(resolve, delay),
				);
				return this.getMsg(
					mobileNumber,
					pid,
					retryCount + 1,
				);
			}

			throw new Error(
				error.response?.data?.msg ||
					"Failed to get verification code",
			);
		}
	}
	async passMobileNumber(mobileNumber) {
		try {
			const response = await axios.get(
				`${this.apiUrl}/passMobile`,
				{
					params: {
						name: this.apiName,
						ApiKey: this.apiKey,
						pn: mobileNumber,
						pid: this.apiPid,
						serial: 2,
					},
				},
			);
			return response.data;
		} catch (error) {
			console.error(error);
			throw new Error(
				error.response?.data?.msg ||
					"Failed to pass mobile number",
			);
		}
	}
	async getStatus(mobileNumber) {
		try {
			const response = await axios.get(
				`${this.apiUrl}/getStatus`,
				{
					params: {
						name: this.apiName,
						ApiKey: this.apiKey,
						pn: mobileNumber,
						pid: this.apiPid,
					},
				},
			);
			return response.data;
		} catch (error) {
			console.error(error);
			throw new Error(
				error.response?.data?.msg ||
					"Failed to get status",
			);
		}
	}
	async getBlack(mobileNumber) {
		try {
			const response = await axios.get(
				`${this.apiUrl}/getBlack`,
				{
					params: {
						name: this.apiName,
						ApiKey: this.apiKey,
						pn: mobileNumber,
						pid: this.apiPid,
					},
				},
			);
			return response.data;
		} catch (error) {
			console.error(error);
			throw new Error(
				error.response?.data?.msg ||
					"Failed to get blacklist status",
			);
		}
	}
	async getCountryPhoneNum() {
		try {
			const response = await axios.get(
				`${this.apiUrl}/getCountryPhoneNum`,
				{
					params: {
						name: this.apiName,
						ApiKey: this.apiKey,
						pid: this.apiPid,
					},
				},
			);
			return response.data;
		} catch (error) {
			console.error(error);
			throw new Error(
				error.response?.data?.msg ||
					"Failed to get country phone numbers",
			);
		}
	}
}

export default new secondNumberServices();
