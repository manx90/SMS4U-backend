import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

class EmailService {
	constructor() {
		// Use environment variables with fallback to hardcoded values from Laravel
		this.apiUrl =
			process.env.EMAIL_API ||
			"https://api.anymessage.shop";
		this.apiToken =
			process.env.EMAIL_TOKEN ||
			"Fef8GYf4wAJ8C4W9KED8f0D5N4G5VyZ1";
	}

	async getEmailQuantity(site) {
		try {
			const response = await axios.get(
				`${this.apiUrl}/email/quantity`,
				{
					params: { site, token: this.apiToken },
				},
			);
			return response.data;
		} catch (error) {
			console.error(
				"Error fetching email quantity:",
				error.message,
			);
			throw new Error(
				"Failed to fetch email quantity",
			);
		}
	}

	async orderEmail(site, domain = null) {
		const params = {
			site,
			token: this.apiToken,
		};

		if (domain) {
			params.domain = domain;
		}

		try {
			const response = await axios.get(
				`${this.apiUrl}/email/order`,
				{
					params,
				},
			);
			return response.data;
		} catch (error) {
			console.error(
				"Error ordering email:",
				error.message,
			);
			throw new Error("Failed to order email");
		}
	}

	async cancelEmail(activationId) {
		try {
			const response = await axios.get(
				`${this.apiUrl}/email/cancel`,
				{
					params: {
						id: activationId,
						token: this.apiToken,
					},
				},
			);
			return response.data;
		} catch (error) {
			console.error(
				"Error canceling email:",
				error.message,
			);
			throw new Error("Failed to cancel email");
		}
	}

	async getMessage(activationId) {
		if (!activationId) {
			throw new Error(
				"Activation ID is required",
			);
		}
		try {
			const response = await axios.get(
				`${this.apiUrl}/email/getmessage`,
				{
					params: {
						id: activationId,
						token: this.apiToken,
					},
				},
			);
			return response.data;
		} catch (error) {
			console.error(
				"Error getting message:",
				error.message,
			);
			throw new Error(
				error.response?.data?.message ||
					"Failed to fetch messages",
			);
		}
	}

	async reorderEmail({
		activationId,
		email,
		site,
	}) {
		const params = { token: this.apiToken };
		if (activationId) {
			params.id = activationId;
		} else if (email && site) {
			params.email = email;
			params.site = site;
		} else {
			throw new Error(
				"activationId or email + site must be provided to reorder email",
			);
		}
		try {
			const response = await axios.get(
				`${this.apiUrl}/email/reorder`,
				{
					params,
				},
			);
			console.log("reorderEmail response", response.data);
			return response.data;
		} catch (error) {
			console.error(
				"Error reordering email:",
				error.message,
			);
			throw new Error("Failed to reorder email");
		}
	}
}

export default new EmailService();
