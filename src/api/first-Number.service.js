import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

class firstNumberServices {
	constructor() {
		this.apiUrl =
			process.env.first_NUMBER_API_URL;
		this.apiKey =
			process.env.first_NUMBER_API_KEY;
	}

	async getMobileNumber(country, service) {
		try {
			const response = await axios.get(
				`${this.apiUrl}`,
				{
					params: {
						api_key: this.apiKey,
						country,
						service,
						action: "getNumber",
					},
					// We want the body even on HTTP 400 to inspect provider error text
					validateStatus: () => true,
					timeout: 15000,
					headers: {
						Connection: "close",
						"Cache-Control": "no-cache",
					},
				},
			);
			console.log(response.data);
			// Provider sometimes responds with HTTP 400 and plain text like:
			// "ERROR: No operator found"
			const raw = response?.data;
			if (
				typeof raw === "string" &&
				raw.toUpperCase().startsWith("ERROR:")
			) {
				const message = raw
					.replace(/^ERROR:\s*/i, "")
					.trim();
				if (/no operator/i.test(message)) {
					const err = new Error(
						"No operator found",
					);
					err.code = "NO_OPERATOR";
					throw err;
				}
				throw new Error(
					message || "Provider error",
				);
			}

			if (response.status >= 400) {
				throw new Error(
					(typeof raw === "string" && raw) ||
						"Provider request failed",
				);
			}

			// Example success: "ACCESS_NUMBER:21624938329:21624938329"
			if (
				typeof raw === "string" &&
				/^ACCESS_NUMBER:/i.test(raw)
			) {
				const parts = raw.split(":");
				// parts[1] can be id, parts[2] phone; some providers return both same
				const phone = parts[2] || parts[1];
				// Remove the + sign if present
				return phone.replace(/^\+/, "");
			}

			// Remove the + sign if present
			return typeof raw === "string"
				? raw.replace(/^\+/, "")
				: raw;
		} catch (error) {
			console.error(error);
			throw new Error(
				error?.message ||
					"Failed to get mobile number",
			);
		}
	}
	async getMessage(number) {
		try {
			const response = await axios.get(
				`${this.apiUrl}`,
				{
					params: {
						api_key: this.apiKey,
						id: number,
						action: "getStatus",
					},
					validateStatus: () => true,
					timeout: 15000,
					headers: {
						Connection: "close",
						"Cache-Control": "no-cache",
					},
				},
			);

			const raw = response?.data;
			if (typeof raw === "string") {
				const text = raw.trim();
				if (/^STATUS_OK/i.test(text)) {
					// Example: "STATUS_OK:123456"
					const parts = text.split(":");
					const code = parts[1]?.trim() || null;
					return {
						code: 200,
						msg: "OK",
						data: code,
					};
				}
				if (/^STATUS_WAITING/i.test(text)) {
					return {
						code: 202,
						msg: "PENDING",
						data: null,
					};
				}
				if (/^ERROR:/i.test(text)) {
					const message = text
						.replace(/^ERROR:\s*/i, "")
						.trim();
					throw new Error(
						message || "Provider error",
					);
				}
				// Unknown string format; treat as pending
				return {
					code: 202,
					msg: "PENDING",
					data: null,
				};
			}

			// If provider returns structured JSON with code/msg
			if (raw && typeof raw === "object") {
				return raw;
			}

			// Fallback pending
			return {
				code: 202,
				msg: "PENDING",
				data: null,
			};
		} catch (error) {
			console.error(
				"First Number Service getMessage error:",
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
}

export default new firstNumberServices();
