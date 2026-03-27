import { requireUser } from "../decorator/AuthApi.decorator.js";
import {
	getActiveSites,
	getSiteByName,
} from "../repositories/emailSite.repo.js";
import {
	getActiveDomains,
	getDomainByName,
} from "../repositories/emailDomain.repo.js";
import { getPriceBySiteAndDomain } from "../repositories/emailPrice.repo.js";
import { cacheStatic } from "../decorator/cache.decorator.js";

export const emailRoute = async (app) => {
	// List active email sites
	app.get("/sites", {
		preHandler: [requireUser(), cacheStatic()],
		handler: async (request, reply) => {
			try {
				const sites = await getActiveSites();

				// صفّي البيانات - أرجع فقط name
				const filteredSites = sites.map((site) => ({
					name: site.name,
				}));

				return reply.send({
					state: "200",
					msg: "success",
					data: filteredSites,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// List active email domains
	app.get("/domains", {
		preHandler: [requireUser(), cacheStatic()],
		handler: async (request, reply) => {
			try {
				const domains = await getActiveDomains();

				// صفّي البيانات - أرجع فقط name
				const filteredDomains = domains.map(
					(domain) => ({
						name: domain.name,
					}),
				);

				return reply.send({
					state: "200",
					msg: "success",
					data: filteredDomains,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Return LIVE availability counts directly from provider (NO CACHE)
	app.get("/quantity", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			try {
				const { site, domain } = request.query;

				if (!site) {
					return reply.status(400).send({
						state: "400",
						error: "site parameter is required",
					});
				}

				// Ensure site exists in our database
				const siteEntity = await getSiteByName(
					site,
				);
				if (!siteEntity) {
					return reply.status(400).send({
						state: "400",
						error: "Site not found",
					});
				}

				// Get all domains we support from our database
				const allDomains =
					await getActiveDomains();
				const ourDomainNames = new Set(
					allDomains.map((d) => d.name),
				);

				// Fetch DIRECTLY from provider API (NO CACHE!)
				const EmailService = (
					await import("../api/Email.service.js")
				).default;
				const providerResponse =
					await EmailService.getEmailQuantity(
						site,
					);

				if (
					providerResponse.status !== "success" ||
					!providerResponse.data
				) {
					return reply.status(500).send({
						state: "500",
						error:
							"Failed to fetch from provider",
					});
				}

				const providerData =
					providerResponse.data;

				// If a specific domain is requested
				if (domain) {
					// Validate domain exists in our database
					const domainEntity =
						await getDomainByName(domain);
					if (!domainEntity) {
						return reply.status(400).send({
							state: "400",
							error: "Domain not found",
						});
					}

					// Return only that domain from provider with price
					const count =
						providerData[domain]?.count || 0;

					// Get price for this site/domain combination
					const priceRecord =
						await getPriceBySiteAndDomain(
							site,
							domain,
						);

					return reply.send({
						state: "200",
						msg: "success",
						data: [
							{
								domain: domain,
								count: count,
								price: priceRecord?.price || 0,
							},
						],
					});
				}

				// Filter provider data to only domains we have in our database and add prices
				const result = [];

				// First, check if there's a base price for site without specific domain
				const basePriceRecord =
					await getPriceBySiteAndDomain(
						site,
						null,
					);
				if (basePriceRecord) {
					// Add a special "any" domain entry to represent "any available domain"
					const totalCount = Object.values(
						providerData,
					).reduce(
						(sum, d) => sum + (d.count || 0),
						0,
					);
					result.push({
						domain: "any",
						count: totalCount,
						price: basePriceRecord.price,
					});
				}

				// Then add specific domain prices
				for (const [
					domainName,
					domainData,
				] of Object.entries(providerData)) {
					if (ourDomainNames.has(domainName)) {
						// Get price for this site/domain combination
						const priceRecord =
							await getPriceBySiteAndDomain(
								site,
								domainName,
							);

						if (priceRecord) {
							result.push({
								domain: domainName,
								count: domainData.count || 0,
								price: priceRecord.price,
							});
						}
					}
				}

				return reply.send({
					state: "200",
					msg: "success",
					data: result,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});
};
