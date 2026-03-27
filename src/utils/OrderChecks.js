import { OrderService } from "../services/Order.service.js";
import { UserService } from "../services/User.service.js";
import { SiteDomainService } from "../services/SiteDomain.service.js";
import { PricingService } from "../services/Pricing.service.js";
import { CountryService } from "../services/Country.service.js";
import { SiteService } from "../services/Site.service.js";
import { DomainService } from "../services/Domain.service.js";

class OrderChecks {
	constructor() {
		this.orderService = OrderService;
		this.userService = UserService;
		this.siteDomainService = SiteDomainService;
		this.pricingService = PricingService;
		this.countryService = CountryService;
		this.siteService = SiteService;
		this.domainService = DomainService;
	}

	// ==================== PHONE NUMBER VALIDATION ====================

	/**
	 * Validates phone number format and country code
	 */
	validatePhoneNumber(
		phoneNumber,
		countryCode = null,
	) {
		if (
			!phoneNumber ||
			typeof phoneNumber !== "string"
		) {
			throw new Error(
				"Phone number is required and must be a string",
			);
		}

		// Remove all non-digit characters except +
		const cleaned = phoneNumber.replace(
			/[^\d+]/g,
			"",
		);

		// Check if it starts with + or is a local number
		if (
			!cleaned.startsWith("+") &&
			!cleaned.match(/^\d{7,15}$/)
		) {
			throw new Error(
				"Invalid phone number format",
			);
		}

		// If country code provided, validate against it
		if (countryCode) {
			const country =
				this.countryService.findByIsoCode(
					countryCode,
				);
			if (!country) {
				throw new Error("Invalid country code");
			}

			// Check if phone number matches country's expected format
			if (
				country.phoneCode &&
				!phoneNumber.startsWith(country.phoneCode)
			) {
				throw new Error(
					`Phone number must start with country code ${country.phoneCode}`,
				);
			}
		}

		return {
			isValid: true,
			cleaned: cleaned,
			countryCode: countryCode,
		};
	}

	/**
	 * Extracts country code from phone number
	 */
	extractCountryCode(phoneNumber) {
		if (!phoneNumber.startsWith("+")) {
			throw new Error(
				"Phone number must include country code (+XXX)",
			);
		}

		// Common country codes and their lengths
		const countryCodes = {
			"+1": "US/CA",
			"+7": "RU/KZ",
			"+20": "EG",
			"+27": "ZA",
			"+30": "GR",
			"+31": "NL",
			"+32": "BE",
			"+33": "FR",
			"+34": "ES",
			"+39": "IT",
			"+40": "RO",
			"+41": "CH",
			"+44": "GB",
			"+45": "DK",
			"+46": "SE",
			"+47": "NO",
			"+48": "PL",
			"+49": "DE",
			"+51": "PE",
			"+52": "MX",
			"+54": "AR",
			"+55": "BR",
			"+56": "CL",
			"+57": "CO",
			"+58": "VE",
			"+60": "MY",
			"+61": "AU",
			"+62": "ID",
			"+63": "PH",
			"+64": "NZ",
			"+65": "SG",
			"+66": "TH",
			"+81": "JP",
			"+82": "KR",
			"+84": "VN",
			"+86": "CN",
			"+90": "TR",
			"+91": "IN",
			"+92": "PK",
			"+93": "AF",
			"+94": "LK",
			"+95": "MM",
			"+98": "IR",
			"+212": "MA",
			"+213": "DZ",
			"+216": "TN",
			"+218": "LY",
			"+220": "GM",
			"+221": "SN",
			"+222": "MR",
			"+223": "ML",
			"+224": "GN",
			"+225": "CI",
			"+226": "BF",
			"+227": "NE",
			"+228": "TG",
			"+229": "BJ",
			"+230": "MU",
			"+231": "LR",
			"+232": "SL",
			"+233": "GH",
			"+234": "NG",
			"+235": "TD",
			"+236": "CF",
			"+237": "CM",
			"+238": "CV",
			"+239": "ST",
			"+240": "GQ",
			"+241": "GA",
			"+242": "CG",
			"+243": "CD",
			"+244": "AO",
			"+245": "GW",
			"+246": "IO",
			"+248": "SC",
			"+249": "SD",
			"+250": "RW",
			"+251": "ET",
			"+252": "SO",
			"+253": "DJ",
			"+254": "KE",
			"+255": "TZ",
			"+256": "UG",
			"+257": "BI",
			"+258": "MZ",
			"+260": "ZM",
			"+261": "MG",
			"+262": "RE",
			"+263": "ZW",
			"+264": "NA",
			"+265": "MW",
			"+266": "LS",
			"+267": "BW",
			"+268": "SZ",
			"+269": "KM",
			"+290": "SH",
			"+291": "ER",
			"+297": "AW",
			"+298": "FO",
			"+299": "GL",
			"+350": "GI",
			"+351": "PT",
			"+352": "LU",
			"+353": "IE",
			"+354": "IS",
			"+355": "AL",
			"+356": "MT",
			"+357": "CY",
			"+358": "FI",
			"+359": "BG",
			"+370": "LT",
			"+371": "LV",
			"+372": "EE",
			"+373": "MD",
			"+374": "AM",
			"+375": "BY",
			"+376": "AD",
			"+377": "MC",
			"+378": "SM",
			"+380": "UA",
			"+381": "RS",
			"+382": "ME",
			"+383": "XK",
			"+385": "HR",
			"+386": "SI",
			"+387": "BA",
			"+389": "MK",
			"+420": "CZ",
			"+421": "SK",
			"+423": "LI",
			"+500": "FK",
			"+501": "BZ",
			"+502": "GT",
			"+503": "SV",
			"+504": "HN",
			"+505": "NI",
			"+506": "CR",
			"+507": "PA",
			"+508": "PM",
			"+509": "HT",
			"+590": "GP",
			"+591": "BO",
			"+592": "GY",
			"+593": "EC",
			"+594": "GF",
			"+595": "PY",
			"+596": "MQ",
			"+597": "SR",
			"+598": "UY",
			"+599": "CW",
			"+670": "TL",
			"+672": "NF",
			"+673": "BN",
			"+674": "NR",
			"+675": "PG",
			"+676": "TO",
			"+677": "SB",
			"+678": "VU",
			"+679": "FJ",
			"+680": "PW",
			"+681": "WF",
			"+682": "CK",
			"+683": "NU",
			"+684": "AS",
			"+685": "WS",
			"+686": "KI",
			"+687": "NC",
			"+688": "TV",
			"+689": "PF",
			"+690": "TK",
			"+691": "FM",
			"+692": "MH",
			"+850": "KP",
			"+852": "HK",
			"+853": "MO",
			"+855": "KH",
			"+856": "LA",
			"+880": "BD",
			"+886": "TW",
			"+960": "MV",
			"+961": "LB",
			"+962": "JO",
			"+963": "SY",
			"+964": "IQ",
			"+965": "KW",
			"+966": "SA",
			"+967": "YE",
			"+968": "OM",
			"+970": "PS",
			"+971": "AE",
			"+972": "IL",
			"+973": "BH",
			"+974": "QA",
			"+975": "BT",
			"+976": "MN",
			"+977": "NP",
			"+992": "TJ",
			"+993": "TM",
			"+994": "AZ",
			"+995": "GE",
			"+996": "KG",
			"+998": "UZ",
		};

		for (const code in countryCodes) {
			if (phoneNumber.startsWith(code)) {
				return {
					countryCode: code,
					country: countryCodes[code],
					remaining: phoneNumber.substring(
						code.length,
					),
				};
			}
		}

		throw new Error(
			"Unrecognized country code in phone number",
		);
	}

	// ==================== EMAIL VALIDATION ====================

	/**
	 * Validates email format and domain
	 */
	validateEmail(email) {
		if (!email || typeof email !== "string") {
			throw new Error(
				"Email is required and must be a string",
			);
		}

		const emailRegex =
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			throw new Error("Invalid email format");
		}

		const [localPart, domain] = email.split("@");

		if (localPart.length > 64) {
			throw new Error(
				"Email local part too long",
			);
		}

		if (domain.length > 253) {
			throw new Error("Email domain too long");
		}

		return {
			isValid: true,
			email: email.toLowerCase(),
			localPart,
			domain,
		};
	}

	/**
	 * Validates email domain against known domains
	 */
	async validateEmailDomain(email) {
		const { domain } = this.validateEmail(email);

		// Check if domain exists in our system
		const domainRecord =
			await this.domainService.getOne({
				name: domain,
			});
		if (!domainRecord) {
			throw new Error(
				"Email domain not supported",
			);
		}

		return {
			isValid: true,
			domain: domainRecord,
			email,
		};
	}

	// ==================== USER VALIDATION ====================

	/**
	 * Validates user exists and has sufficient balance
	 */
	async validateUserBalance(
		userId,
		requiredAmount,
	) {
		if (
			!userId ||
			typeof userId !== "number" ||
			userId <= 0
		) {
			throw new Error(
				"Valid user ID is required",
			);
		}

		if (
			!requiredAmount ||
			typeof requiredAmount !== "number" ||
			requiredAmount <= 0
		) {
			throw new Error("Valid amount is required");
		}

		const user = await this.userService.getOne(
			userId,
		);
		if (!user) {
			throw new Error("User not found");
		}

		if (typeof user.balance !== "number") {
			throw new Error("User balance is invalid");
		}

		if (user.balance < requiredAmount) {
			throw new Error(
				`Insufficient balance. Required: ${requiredAmount}, Available: ${user.balance}`,
			);
		}

		return {
			isValid: true,
			user,
			balance: user.balance,
			remaining: user.balance - requiredAmount,
		};
	}

	// ==================== PRICING VALIDATION ====================

	/**
	 * Validates and resolves pricing for order
	 */
	async resolveOrderPricing(
		siteId,
		domainId,
		pricingId = null,
	) {
		let price = null;
		let pricingSource = null;

		// First, try explicit pricing if provided
		if (pricingId) {
			const pricing =
				await this.pricingService.getOne(
					pricingId,
				);
			if (!pricing) {
				throw new Error("Pricing not found");
			}
			price = pricing.pricePerMessage;
			pricingSource = "explicit_pricing";
		}

		// If no explicit pricing or price not found, try site-domain pair
		if (!price && siteId && domainId) {
			const siteDomain =
				await this.siteDomainService.findByPair(
					siteId,
					domainId,
				);
			if (siteDomain) {
				price = siteDomain.price;
				pricingSource = "site_domain_pair";
			}
		}

		if (!price) {
			throw new Error(
				"No pricing found for this order configuration",
			);
		}

		return {
			price,
			pricingSource,
			siteId,
			domainId,
			pricingId,
		};
	}

	// ==================== ORDER VALIDATION ====================

	/**
	 * Pre-order validation - checks all requirements before creating order
	 */
	async validatePreOrder(orderData) {
		const errors = [];
		const warnings = [];

		try {
			// Validate order type
			if (
				!orderData.type ||
				!["number", "email"].includes(
					orderData.type,
				)
			) {
				errors.push(
					'Order type must be either "number" or "email"',
				);
			}

			// Validate value based on type
			if (orderData.type === "number") {
				this.validatePhoneNumber(orderData.value);
			} else if (orderData.type === "email") {
				this.validateEmail(orderData.value);
			}

			// Validate user exists
			if (orderData.user?.id) {
				const user =
					await this.userService.getOne(
						orderData.user.id,
					);
				if (!user) {
					errors.push("User not found");
				}
			}

			// Validate site exists
			if (orderData.Site?.id) {
				const site =
					await this.siteService.getOne(
						orderData.Site.id,
					);
				if (!site) {
					errors.push("Site not found");
				}
			}

			// Validate domain exists
			if (orderData.domain?.id) {
				const domain =
					await this.domainService.getOne(
						orderData.domain.id,
					);
				if (!domain) {
					errors.push("Domain not found");
				}
			}

			// Validate pricing exists
			if (orderData.pricing?.id) {
				const pricing =
					await this.pricingService.getOne(
						orderData.pricing.id,
					);
				if (!pricing) {
					errors.push("Pricing not found");
				}
			}

			// Check if pricing can be resolved
			if (
				orderData.Site?.id &&
				orderData.domain?.id
			) {
				try {
					await this.resolveOrderPricing(
						orderData.Site.id,
						orderData.domain.id,
						orderData.pricing?.id,
					);
				} catch (error) {
					warnings.push(
						`Pricing warning: ${error.message}`,
					);
				}
			}
		} catch (error) {
			errors.push(error.message);
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Post-order validation - checks order after creation
	 */
	async validatePostOrder(orderId) {
		const order = await this.orderService.getOne(
			orderId,
		);
		if (!order) {
			throw new Error("Order not found");
		}

		const issues = [];

		// Check if order has all required relations
		if (!order.user) {
			issues.push("Order has no associated user");
		}

		if (!order.Site) {
			issues.push("Order has no associated site");
		}

		if (!order.domain) {
			issues.push(
				"Order has no associated domain",
			);
		}

		// Check if pricing can be resolved
		try {
			await this.resolveOrderPricing(
				order.Site?.id,
				order.domain?.id,
				order.pricing?.id,
			);
		} catch (error) {
			issues.push(
				`Pricing issue: ${error.message}`,
			);
		}

		return {
			order,
			isValid: issues.length === 0,
			issues,
		};
	}

	/**
	 * Pre-completion validation - checks before marking order as completed
	 */
	async validatePreCompletion(orderId) {
		const order = await this.orderService.getOne(
			orderId,
		);
		if (!order) {
			throw new Error("Order not found");
		}

		if (order.status === "completed") {
			throw new Error(
				"Order is already completed",
			);
		}

		if (order.status === "failed") {
			throw new Error(
				"Cannot complete a failed order",
			);
		}

		// Resolve pricing
		const pricing =
			await this.resolveOrderPricing(
				order.Site?.id,
				order.domain?.id,
				order.pricing?.id,
			);

		// Check user balance
		await this.validateUserBalance(
			order.user.id,
			pricing.price,
		);

		return {
			order,
			pricing,
			canComplete: true,
		};
	}

	/**
	 * Post-completion validation - checks after order completion
	 */
	async validatePostCompletion(orderId) {
		const order = await this.orderService.getOne(
			orderId,
		);
		if (!order) {
			throw new Error("Order not found");
		}

		if (order.status !== "completed") {
			throw new Error("Order is not completed");
		}

		const issues = [];

		// Check if price was set
		if (!order.price || order.price <= 0) {
			issues.push(
				"Order price not set or invalid",
			);
		}

		// Check if user balance was properly deducted
		const user = await this.userService.getOne(
			order.user.id,
		);
		if (!user) {
			issues.push(
				"User not found after completion",
			);
		}

		return {
			order,
			user,
			isValid: issues.length === 0,
			issues,
		};
	}

	// ==================== COMPREHENSIVE ORDER CHECK ====================

	/**
	 * Complete order validation pipeline
	 */
	async validateOrderPipeline(
		orderData,
		orderId = null,
	) {
		const results = {
			preOrder: null,
			postOrder: null,
			preCompletion: null,
			postCompletion: null,
		};

		try {
			// Pre-order validation
			results.preOrder =
				await this.validatePreOrder(orderData);

			if (orderId) {
				// Post-order validation
				results.postOrder =
					await this.validatePostOrder(orderId);

				// Pre-completion validation
				results.preCompletion =
					await this.validatePreCompletion(
						orderId,
					);

				// Post-completion validation (if order is completed)
				const order =
					await this.orderService.getOne(orderId);
				if (
					order &&
					order.status === "completed"
				) {
					results.postCompletion =
						await this.validatePostCompletion(
							orderId,
						);
				}
			}

			return results;
		} catch (error) {
			return {
				error: error.message,
				results,
			};
		}
	}

	// ==================== UTILITY METHODS ====================

	/**
	 * Get order health status
	 */
	async getOrderHealth(orderId) {
		const order = await this.orderService.getOne(
			orderId,
		);
		if (!order) {
			return {
				status: "not_found",
				issues: ["Order not found"],
			};
		}

		const issues = [];
		let status = "healthy";

		// Check order status
		if (
			!order.status ||
			![
				"pending",
				"completed",
				"failed",
			].includes(order.status)
		) {
			issues.push("Invalid order status");
			status = "unhealthy";
		}

		// Check required fields
		if (
			!order.type ||
			!["number", "email"].includes(order.type)
		) {
			issues.push("Invalid order type");
			status = "unhealthy";
		}

		if (!order.value) {
			issues.push("Order value is missing");
			status = "unhealthy";
		}

		// Check relations
		if (!order.user) {
			issues.push("No user associated");
			status = "warning";
		}

		if (!order.Site) {
			issues.push("No site associated");
			status = "warning";
		}

		if (!order.domain) {
			issues.push("No domain associated");
			status = "warning";
		}

		// Check pricing
		try {
			await this.resolveOrderPricing(
				order.Site?.id,
				order.domain?.id,
				order.pricing?.id,
			);
		} catch (error) {
			issues.push(
				`Pricing issue: ${error.message}`,
			);
			status = "warning";
		}

		return {
			orderId,
			status,
			issues,
			order,
		};
	}
}

export default OrderChecks;
