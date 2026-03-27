import { requireUser } from "../decorator/AuthApi.decorator.js";
import { userRepository } from "../repositories/user.repo.js";
import {
	getAllSites,
	getActiveSites,
	getSiteById,
	createSite,
	updateSite,
	deleteSite,
	getSiteByName,
} from "../repositories/emailSite.repo.js";
import {
	getAllDomains,
	getActiveDomains,
	getDomainById,
	createDomain,
	updateDomain,
	deleteDomain,
	getDomainByName,
} from "../repositories/emailDomain.repo.js";
import {
	getAllPrices,
	getPriceById,
	createPrice,
	updatePrice,
	deletePrice,
	getPriceBySiteAndDomain,
} from "../repositories/emailPrice.repo.js";
import {
	isNonEmptyString,
	toTrimmedLower,
	parseBoolean,
	isValidDomainName,
	parsePriceNumber,
} from "../utils/validation.js";

// Helper to check if user is admin
const checkAdmin = async (apiKey) => {
	const user = await userRepository.findOne({
		where: { apiKey },
	});
	if (!user || user.role !== "admin") {
		throw new Error("Admin access required");
	}
	return user;
};

export const emailAdminRoute = async (app) => {
	// ============== EMAIL SITES MANAGEMENT ==============

	// Get all email sites
	app.get("/sites", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				await checkAdmin(apiKey);

				const sites = await getAllSites();
				return reply.send({
					state: "200",
					msg: "success",
					data: sites,
				});
			} catch (error) {
				return reply.status(403).send({
					state: "403",
					error: error.message,
				});
			}
		},
	});

	// Get site by ID
	app.get("/sites/:id", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				await checkAdmin(apiKey);

				const { id } = request.params;
				const site = await getSiteById(
					parseInt(id),
				);

				if (!site) {
					return reply.status(404).send({
						state: "404",
						error: "Site not found",
					});
				}

				return reply.send({
					state: "200",
					msg: "success",
					data: site,
				});
			} catch (error) {
				return reply.status(403).send({
					state: "403",
					error: error.message,
				});
			}
		},
	});

	// Create email site
	app.get("/sites/create", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const {
					apiKey,
					name,
					display_name,
					api_name,
					description,
					status,
				} = request.query;
				await checkAdmin(apiKey);

				// Validate required fields
				if (
					!isNonEmptyString(name) ||
					!isNonEmptyString(display_name)
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"name and display_name are required",
					});
				}

				const normalizedName =
					toTrimmedLower(name);
				if (!isValidDomainName(normalizedName)) {
					return reply.status(400).send({
						state: "400",
						error: "Invalid site name format",
					});
				}

				// Duplicate check
				const existing = await getSiteByName(
					normalizedName,
				);
				if (existing) {
					return reply.status(400).send({
						state: "400",
						error: "Site already exists",
					});
				}

				let site;
				try {
					site = await createSite({
						name: normalizedName,
						display_name: display_name.trim(),
						api_name: api_name
							? api_name.trim()
							: null,
						description: description
							? description.trim()
							: null,
						status: parseBoolean(status),
					});
				} catch (err) {
					return reply.status(400).send({
						state: "400",
						error: "Site already exists",
					});
				}

				return reply.send({
					state: "200",
					msg: "Email site created successfully",
					data: site,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Update email site
	app.get("/sites/update", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const {
					apiKey,
					id,
					name,
					display_name,
					api_name,
					description,
					status,
				} = request.query;
				await checkAdmin(apiKey);

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error: "id is required",
					});
				}

				const site = await getSiteById(
					parseInt(id),
				);

				if (!site) {
					return reply.status(404).send({
						state: "404",
						error: "Site not found",
					});
				}

				const updatedSite = await updateSite(
					parseInt(id),
					{
						name: name || site.name,
						display_name:
							display_name || site.display_name,
						api_name:
							api_name !== undefined
								? api_name
								: site.api_name,
						description:
							description !== undefined
								? description
								: site.description,
						status:
							status !== undefined
								? status === "true" ||
								  status === true
								: site.status,
					},
				);

				return reply.send({
					state: "200",
					msg: "Email site updated successfully",
					data: updatedSite,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Delete email site
	app.get("/sites/delete", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey, id } = request.query;
				await checkAdmin(apiKey);

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error: "id is required",
					});
				}

				const site = await getSiteById(
					parseInt(id),
				);

				if (!site) {
					return reply.status(404).send({
						state: "404",
						error: "Site not found",
					});
				}

				await deleteSite(parseInt(id));

				return reply.send({
					state: "200",
					msg: "Email site deleted successfully",
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// ============== EMAIL DOMAINS MANAGEMENT ==============

	// Get all email domains
	app.get("/domains", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				await checkAdmin(apiKey);

				const domains = await getAllDomains();
				return reply.send({
					state: "200",
					msg: "success",
					data: domains,
				});
			} catch (error) {
				return reply.status(403).send({
					state: "403",
					error: error.message,
				});
			}
		},
	});

	// Get domain by ID
	app.get("/domains/:id", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				await checkAdmin(apiKey);

				const { id } = request.params;
				const domain = await getDomainById(
					parseInt(id),
				);

				if (!domain) {
					return reply.status(404).send({
						state: "404",
						error: "Domain not found",
					});
				}

				return reply.send({
					state: "200",
					msg: "success",
					data: domain,
				});
			} catch (error) {
				return reply.status(403).send({
					state: "403",
					error: error.message,
				});
			}
		},
	});

	// Create email domain
	app.get("/domains/create", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const {
					apiKey,
					name,
					display_name,
					api_name,
					description,
					status,
				} = request.query;
				await checkAdmin(apiKey);

				// Validate required fields
				if (
					!isNonEmptyString(name) ||
					!isNonEmptyString(display_name)
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"name and display_name are required",
					});
				}

				const normalizedName =
					toTrimmedLower(name);
				if (!isValidDomainName(normalizedName)) {
					return reply.status(400).send({
						state: "400",
						error: "Invalid domain name",
					});
				}

				// Duplicate check
				const existing = await getDomainByName(
					normalizedName,
				);
				if (existing) {
					return reply.status(400).send({
						state: "400",
						error: "Domain already exists",
					});
				}

				let domain;
				try {
					domain = await createDomain({
						name: normalizedName,
						display_name: display_name.trim(),
						api_name: api_name
							? api_name.trim()
							: null,
						description: description
							? description.trim()
							: null,
						status: parseBoolean(status),
					});
				} catch (err) {
					return reply.status(400).send({
						state: "400",
						error: "Domain already exists",
					});
				}

				return reply.send({
					state: "200",
					msg: "Email domain created successfully",
					data: domain,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Update email domain
	app.get("/domains/update", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const {
					apiKey,
					id,
					name,
					display_name,
					api_name,
					description,
					status,
				} = request.query;
				await checkAdmin(apiKey);

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error: "id is required",
					});
				}

				const domain = await getDomainById(
					parseInt(id),
				);

				if (!domain) {
					return reply.status(404).send({
						state: "404",
						error: "Domain not found",
					});
				}

				const updatedDomain = await updateDomain(
					parseInt(id),
					{
						name: name || domain.name,
						display_name:
							display_name || domain.display_name,
						api_name:
							api_name !== undefined
								? api_name
								: domain.api_name,
						description:
							description !== undefined
								? description
								: domain.description,
						status:
							status !== undefined
								? status === "true" ||
								  status === true
								: domain.status,
					},
				);

				return reply.send({
					state: "200",
					msg: "Email domain updated successfully",
					data: updatedDomain,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Delete email domain
	app.get("/domains/delete", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey, id } = request.query;
				await checkAdmin(apiKey);

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error: "id is required",
					});
				}

				const domain = await getDomainById(
					parseInt(id),
				);

				if (!domain) {
					return reply.status(404).send({
						state: "404",
						error: "Domain not found",
					});
				}

				await deleteDomain(parseInt(id));

				return reply.send({
					state: "200",
					msg: "Email domain deleted successfully",
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// ============== EMAIL PRICES MANAGEMENT ==============

	// Get all email prices
	app.get("/prices", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				await checkAdmin(apiKey);

				const prices = await getAllPrices();
				return reply.send({
					state: "200",
					msg: "success",
					data: prices,
				});
			} catch (error) {
				return reply.status(403).send({
					state: "403",
					error: error.message,
				});
			}
		},
	});

	// Get price by ID
	app.get("/prices/:id", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				await checkAdmin(apiKey);

				const { id } = request.params;
				const price = await getPriceById(
					parseInt(id),
				);

				if (!price) {
					return reply.status(404).send({
						state: "404",
						error: "Price not found",
					});
				}

				return reply.send({
					state: "200",
					msg: "success",
					data: price,
				});
			} catch (error) {
				return reply.status(403).send({
					state: "403",
					error: error.message,
				});
			}
		},
	});

	// Create email price
	app.get("/prices/create", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const {
					apiKey,
					site,
					domain,
					price,
					active,
				} = request.query;
				await checkAdmin(apiKey);

				// Validate required fields
				if (
					!isNonEmptyString(site) ||
					!isNonEmptyString(String(price))
				) {
					return reply.status(400).send({
						state: "400",
						error: "site and price are required",
					});
				}

				const normalizedSite =
					toTrimmedLower(site);
				if (!isValidDomainName(normalizedSite)) {
					return reply.status(400).send({
						state: "400",
						error: "Invalid site name format",
					});
				}

				const parsedPrice =
					parsePriceNumber(price);
				if (parsedPrice === null) {
					return reply.status(400).send({
						state: "400",
						error:
							"price must be a number greater than 0",
					});
				}

				// Referential checks
				const siteEntity = await getSiteByName(
					normalizedSite,
				);
				if (!siteEntity) {
					return reply.status(400).send({
						state: "400",
						error: "Site not found",
					});
				}

				let normalizedDomain = null;
				if (
					domain !== undefined &&
					domain !== null &&
					String(domain).trim() !== ""
				) {
					normalizedDomain =
						toTrimmedLower(domain);
					if (
						!isValidDomainName(normalizedDomain)
					) {
						return reply.status(400).send({
							state: "400",
							error: "Invalid domain name",
						});
					}
					const domainEntity =
						await getDomainByName(
							normalizedDomain,
						);
					if (!domainEntity) {
						return reply.status(400).send({
							state: "400",
							error: "Domain not found",
						});
					}
				}

				// Check if price already exists for this site/domain combo
				const existingPrice =
					await getPriceBySiteAndDomain(
						normalizedSite,
						normalizedDomain,
					);

				if (existingPrice) {
					return reply.status(400).send({
						state: "400",
						error:
							"Price already exists for this site/domain combination",
					});
				}

				let newPrice;
				try {
					newPrice = await createPrice({
						site: normalizedSite,
						domain: normalizedDomain,
						price: parsedPrice,
						active: parseBoolean(active),
					});
				} catch (err) {
					return reply.status(400).send({
						state: "400",
						error:
							"Price already exists for this site/domain combination",
					});
				}

				return reply.send({
					state: "200",
					msg: "Email price created successfully",
					data: newPrice,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Update email price
	app.get("/prices/update", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const {
					apiKey,
					id,
					site,
					domain,
					price: priceValue,
					active,
				} = request.query;
				await checkAdmin(apiKey);

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error: "id is required",
					});
				}

				const price = await getPriceById(
					parseInt(id),
				);

				if (!price) {
					return reply.status(404).send({
						state: "404",
						error: "Price not found",
					});
				}

				const updatedPrice = await updatePrice(
					parseInt(id),
					{
						site: site || price.site,
						domain:
							domain !== undefined
								? domain
								: price.domain,
						price: priceValue
							? parseFloat(priceValue)
							: price.price,
						active:
							active !== undefined
								? active === "true" ||
								  active === true
								: price.active,
					},
				);

				return reply.send({
					state: "200",
					msg: "Email price updated successfully",
					data: updatedPrice,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Delete email price
	app.get("/prices/delete", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey, id } = request.query;
				await checkAdmin(apiKey);

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error: "id is required",
					});
				}

				const price = await getPriceById(
					parseInt(id),
				);

				if (!price) {
					return reply.status(404).send({
						state: "404",
						error: "Price not found",
					});
				}

				await deletePrice(parseInt(id));

				return reply.send({
					state: "200",
					msg: "Email price deleted successfully",
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Bulk populate prices (like Laravel's populatePrices)
	app.get("/prices/populate", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey, defaultPrice } =
					request.query;
				await checkAdmin(apiKey);

				const price = defaultPrice
					? parseFloat(defaultPrice)
					: 0.5;

				// Get all active sites and domains
				const sites = await getActiveSites();
				const domains = await getActiveDomains();

				let createdCount = 0;

				// Create default prices for each site
				for (const site of sites) {
					const exists =
						await getPriceBySiteAndDomain(
							site.name,
							null,
						);
					if (!exists) {
						await createPrice({
							site: site.name,
							domain: null,
							price: price,
							active: true,
						});
						createdCount++;
					}
				}

				// Create prices for each site+domain combo
				for (const site of sites) {
					for (const domain of domains) {
						const exists =
							await getPriceBySiteAndDomain(
								site.name,
								domain.name,
							);
						if (!exists) {
							await createPrice({
								site: site.name,
								domain: domain.name,
								price: price,
								active: true,
							});
							createdCount++;
						}
					}
				}

				return reply.send({
					state: "200",
					msg: `Populated ${createdCount} new price entries`,
					data: {
						created: createdCount,
						defaultPrice: price,
					},
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Manually trigger email availability sync
	app.get("/sync-availability", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				await checkAdmin(apiKey);

				console.log(
					"🔄 Manual email availability sync triggered by admin",
				);

				// Import and run the sync
				const EmailAvailabilitySync = (
					await import(
						"../services/EmailAvailabilitySync.js"
					)
				).default;

				// Run the sync immediately
				await EmailAvailabilitySync.syncAvailability();

				return reply.send({
					state: "200",
					msg: "Email availability sync completed successfully",
					data: {
						message:
							"All email availability counts have been refreshed from the provider",
					},
				});
			} catch (error) {
				console.error(
					"❌ Manual sync failed:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Get real-time count directly from provider (NO CACHE)
	app.get("/live-count", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { apiKey, site } = request.query;
				await checkAdmin(apiKey);

				if (!site) {
					return reply.status(400).send({
						state: "400",
						error: "site parameter is required",
					});
				}

				console.log(
					`🔴 LIVE: Fetching real count from provider for ${site} (bypassing ALL cache)`,
				);

				// Import EmailService and call provider API directly
				const EmailService = (
					await import("../api/Email.service.js")
				).default;

				// Fetch directly from provider API - NO CACHE!
				const providerResponse =
					await EmailService.getEmailQuantity(
						site,
					);

				console.log(
					`✅ LIVE: Provider responded for ${site}`,
				);

				return reply.send({
					state: "200",
					msg: "Live count from provider (no cache)",
					data: providerResponse.data || {},
					provider_status:
						providerResponse.status,
					source: "LIVE_PROVIDER_API",
					cached: false,
				});
			} catch (error) {
				console.error(
					"❌ Failed to fetch live count:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});
};
