import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const NO_MESSAGES_YET_RE =
	/no messages found|no messages|no message|not found.*number|not received yet/i;

/**
 * Provider still waiting for SMS (any HTTP status / shape).
 * e.g. {"detail":"No messages found for the provided number"}
 */
function isPendingNoMessagesBody(data) {
	if (data == null) return false;
	if (typeof data === "string") {
		return NO_MESSAGES_YET_RE.test(data);
	}
	if (typeof data === "object") {
		const parts = [
			data.detail,
			data.message,
			data.msg,
			data.error,
			data.description,
		];
		if (Array.isArray(data.errors)) {
			parts.push(...data.errors.map((e) => String(e)));
		} else if (data.errors != null) {
			parts.push(String(data.errors));
		}
		const text = parts
			.filter((x) => x != null && String(x).trim() !== "")
			.map((x) => String(x))
			.join(" ");
		if (NO_MESSAGES_YET_RE.test(text)) return true;
		try {
			return NO_MESSAGES_YET_RE.test(JSON.stringify(data));
		} catch {
			return false;
		}
	}
	return false;
}

function logThirdProviderRequest(method, url, params) {
	const full = axios.getUri({ method, url, params });
	const safe = full.replace(/([?&]token=)[^&]*/gi, "$1***");
	console.log("[third-provider] outgoing", method, safe);
}

/**
 * Provider 3: HTTP API with get_numbers, get_messages, accessinfo.
 * Env: third_NUMBER_API_URL (e.g. http://host:9191/api), third_NUMBER_API_KEY (token).
 */
class ThirdNumberServices {
	constructor() {
		this.apiKey = process.env.third_NUMBER_API_KEY;
		this.apiUrl = (process.env.third_NUMBER_API_URL || "").replace(
			/\/+$/,
			"",
		);
	}

	/** Base URL without trailing /api — used for /accessinfo */
	getAccessInfoBaseUrl() {
		if (!this.apiUrl) return "";
		if (this.apiUrl.endsWith("/api")) {
			return this.apiUrl.slice(0, -4);
		}
		return this.apiUrl;
	}

	assertConfigured() {
		if (!this.apiKey || !this.apiUrl) {
			throw new Error(
				"Third number provider is not configured (third_NUMBER_API_URL / third_NUMBER_API_KEY)",
			);
		}
	}

	/**
	 * @param {string} countryCcode - ISO country code e.g. IT
	 * @param {string} operator - e.g. op3410
	 * @param {number} count
	 * @returns {Promise<string>} phone digits without leading +
	 */
	async getMobileNumber(countryCcode, operator, count = 1) {
		this.assertConfigured();
		const url = `${this.apiUrl}/get_numbers`;
		const params = {
			country: countryCcode,
			operator,
			count,
			token: this.apiKey,
		};
		logThirdProviderRequest("GET", url, params);
		const response = await axios.get(url, {
			params,
			validateStatus: () => true,
			timeout: 15000,
			headers: {
				Connection: "close",
				"Cache-Control": "no-cache",
			},
		});

		const data = response?.data;
		console.log("third-Number.service.js data", data);
		if (response.status >= 400) {
			const msg =
				typeof data === "string"
					? data
					: data?.message ||
						data?.msg ||
						JSON.stringify(data) ||
						"Provider request failed";
			throw new Error(msg);
		}

		if (!data?.success) {
			const msg =
				data?.message ||
				data?.msg ||
				"Failed to get number from provider";
			if (/no operator|not found|unavailable/i.test(String(msg))) {
				const err = new Error("No operator found");
				err.code = "NO_OPERATOR";
				throw err;
			}
			throw new Error(msg);
		}

		const nums = data.number;
		const first = Array.isArray(nums) ? nums[0] : nums;
		if (first == null || first === "") {
			throw new Error("No number returned from provider");
		}
		return String(first).replace(/^\+/, "");
	}

	/**
	 * Raw JSON from provider (optional use).
	 */
	async getMessagesRaw(number) {
		this.assertConfigured();
		const url = `${this.apiUrl}/get_messages`;
		const params = {
			number: String(number).replace(/^\+/, ""),
			token: this.apiKey,
		};
		logThirdProviderRequest("GET", url, params);
		const response = await axios.get(url, {
			params,
			validateStatus: () => true,
			timeout: 15000,
			headers: {
				Connection: "close",
				"Cache-Control": "no-cache",
			},
		});
		return response;
	}

	/**
	 * Normalize to same shape as first provider for order.route:
	 * { code: 200|202, msg, data: string|null }
	 */
	async getMessage(number) {
		try {
			const response = await this.getMessagesRaw(number);
			const data = response?.data;

			if (isPendingNoMessagesBody(data)) {
				return {
					code: 202,
					msg: "PENDING",
					data: null,
				};
			}

			if (response.status >= 400) {
				const msg =
					typeof data === "string"
						? data
						: data?.message ||
							data?.msg ||
							data?.detail ||
							"Provider request failed";
				throw new Error(msg);
			}

			if (!data?.success) {
				return {
					code: 202,
					msg: "PENDING",
					data: null,
				};
			}

			const messages = Array.isArray(data.messages)
				? data.messages
				: [];
			if (messages.length === 0) {
				return {
					code: 202,
					msg: "PENDING",
					data: null,
				};
			}

			const latest = messages[messages.length - 1];
			const text =
				(latest && latest.message != null
					? String(latest.message)
					: ""
				).trim();

			if (text) {
				return {
					code: 200,
					msg: "OK",
					data: text,
				};
			}

			return {
				code: 202,
				msg: "PENDING",
				data: null,
			};
		} catch (error) {
			console.error(
				"Third Number Service getMessage error:",
				error,
			);
			if (error.code === "ECONNABORTED") {
				throw new Error(
					"Request timeout. Service provider is taking too long to respond.",
				);
			}
			if (
				error.code === "ECONNRESET" ||
				error.code === "ECONNREFUSED" ||
				error.code === "ETIMEDOUT"
			) {
				throw new Error(
					"Service provider is currently unavailable. Please try again later.",
				);
			}
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
					"Failed to get message status",
			);
		}
	}

	/**
	 * @param {string} serviceName - e.g. WhatsApp (provider API value)
	 * @param {string} interval - e.g. 30min
	 */
	async fetchAccessInfo(serviceName, interval = "30min") {
		this.assertConfigured();
		const base = this.getAccessInfoBaseUrl();
		if (!base) {
			throw new Error(
				"Cannot derive accessinfo URL from third_NUMBER_API_URL",
			);
		}
		const url = `${base}/accessinfo`;
		const params = {
			interval,
			service: serviceName,
			token: this.apiKey,
		};
		logThirdProviderRequest("GET", url, params);
		const response = await axios.get(url, {
			params,
			validateStatus: () => true,
			timeout: 30000,
			headers: {
				Connection: "close",
				"Cache-Control": "no-cache",
			},
		});

		const data = response?.data;
		if (response.status >= 400) {
			const msg =
				typeof data === "string"
					? data
					: data?.message ||
						data?.status ||
						"accessinfo request failed";
			throw new Error(msg);
		}
		return data;
	}
}

export default new ThirdNumberServices();
