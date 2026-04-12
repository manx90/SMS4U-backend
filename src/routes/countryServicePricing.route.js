import {
	create,
	getAll,
	getOne,
	getCount,
	update,
	remove,
	getByCountry,
	getByService,
	getByCountryAndService,
	validateCountryExists,
	validateServiceExists,
} from "../repositories/countryServicePricing.repo.js";
import {
	requireAdmin,
	requireUser,
} from "../decorator/AuthApi.decorator.js";
import {
	cacheStatic,
	cacheDisabled,
} from "../decorator/cache.decorator.js";

export const countryServicePricingRoute = (
	app,
) => {
	// Get all pricing configurations with pagination
	app.get("/", {
		preHandler: [requireUser(), cacheDisabled()],
		handler: async (request, reply) => {
			try {
				// Get pagination parameters from query
				const page = parseInt(request.query.page) || 1;
				const limit = parseInt(request.query.limit) || 50;

				// Must match countryServicePricing.repo getAll() cap (max 100 per page)
				const effectiveLimit = Math.max(
					1,
					Math.min(100, limit),
				);

				const search =
					typeof request.query.search === "string"
						? request.query.search
						: "";

				// Get paginated data and total count (same search filter for both)
				const [data, total] = await Promise.all([
					getAll(page, effectiveLimit, search),
					getCount(search),
				]);

				// Use effective page size — client may send limit=1000 but repo only returns 100 rows/page
				const totalPages = Math.ceil(
					total / effectiveLimit,
				);

				// Filter data based on user role
				let responseData = data;
				if (request.user.role === "user") {
					responseData = data.map((pricing) => ({
						country: {
							code: pricing.country.code_country,
							name: pricing.country.name,
						},
						service: {
							code: pricing.service.code,
							name: pricing.service.name,
						},
						provider1: pricing.provider1,
						provider2: pricing.provider2,
					}));
				}

				return reply.send({
					state: "200",
					data: responseData,
					pagination: {
						page,
						limit: effectiveLimit,
						total,
						totalPages,
					},
				});
			} catch (error) {
				console.error(
					"Pricing fetch error:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error:
						"Failed to fetch pricing configurations. Please try again.",
				});
			}
		},
	});

	// Get pricing by country
	app.get("/country/:countryId", {
		preHandler: [requireUser(), cacheDisabled()],
		handler: async (request, reply) => {
			try {
				const { countryId } = request.params;
				const data = await getByCountry(
					parseInt(countryId),
				);

				// Filter data based on user role
				let responseData = data;
				if (request.user.role === "user") {
					responseData = data.map((pricing) => ({
						country: {
							code: pricing.country.code_country,
							name: pricing.country.name,
						},
						service: {
							code: pricing.service.code,
							name: pricing.service.name,
						},
						provider1: pricing.provider1,
						provider2: pricing.provider2,
					}));
				}

				return reply.send({
					state: "200",
					data: responseData,
				});
			} catch (error) {
				console.error(
					"Pricing by country error:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error:
						"Failed to fetch pricing configurations. Please try again.",
				});
			}
		},
	});

	// Get pricing by service
	app.get("/service/:serviceId", {
		preHandler: requireUser(),
		handler: async (request, reply) => {
			try {
				const { serviceId } = request.params;
				const data = await getByService(
					parseInt(serviceId),
				);

				// Filter data based on user role
				let responseData = data;
				if (request.user.role === "user") {
					responseData = data.map((pricing) => ({
						country: {
							code: pricing.country.code_country,
							name: pricing.country.name,
						},
						service: {
							code: pricing.service.code,
							name: pricing.service.name,
						},
						provider1: pricing.provider1,
						provider2: pricing.provider2,
					}));
				}

				return reply.send({
					state: "200",
					data: responseData,
				});
			} catch (error) {
				console.error(
					"Pricing by service error:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error:
						"Failed to fetch pricing configurations. Please try again.",
				});
			}
		},
	});

	// Get specific pricing configuration
	app.get("/:id", {
		preHandler: requireUser(),
		handler: async (request, reply) => {
			try {
				const { id } = request.params;
				const data = await getOne(parseInt(id));
				if (!data) {
					return reply.status(404).send({
						state: "404",
						error:
							"Pricing configuration not found",
					});
				}

				// Filter data based on user role
				let responseData = data;
				if (request.user.role === "user") {
					responseData = {
						country: {
							code: data.country.code_country,
							name: data.country.name,
						},
						service: {
							code: data.service.code,
							name: data.service.name,
						},
						provider1: data.provider1,
						provider2: data.provider2,
					};
				}

				return reply.send({
					state: "200",
					data: responseData,
				});
			} catch (error) {
				console.error(
					"Pricing fetch error:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error:
						"Failed to fetch pricing configuration. Please try again.",
				});
			}
		},
	});

	// Create new pricing configuration (Admin only)
	app.get("/create", {
		preHandler: requireAdmin(),
		handler: async (request, reply) => {
			try {
				const {
					countryId,
					serviceId,
					priceProvider1,
					priceProvider2,
				} = request.query;

				// Validate required parameters
				if (
					!countryId ||
					!serviceId ||
					!priceProvider1 ||
					!priceProvider2
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"countryId, serviceId, priceProvider1, and priceProvider2 are required",
					});
				}

				// Validate that country exists
				const countryExists =
					await validateCountryExists(
						parseInt(countryId),
					);
				if (!countryExists) {
					return reply.status(400).send({
						state: "400",
						error: `Country with ID ${countryId} does not exist`,
					});
				}

				// Validate that service exists
				const serviceExists =
					await validateServiceExists(
						parseInt(serviceId),
					);
				if (!serviceExists) {
					return reply.status(400).send({
						state: "400",
						error: `Service with ID ${serviceId} does not exist`,
					});
				}

				// Validate price values
				const price1 = parseFloat(priceProvider1);
				const price2 = parseFloat(priceProvider2);

				if (isNaN(price1) || price1 < 0) {
					return reply.status(400).send({
						state: "400",
						error:
							"priceProvider1 must be a valid positive number",
					});
				}

				if (isNaN(price2) || price2 < 0) {
					return reply.status(400).send({
						state: "400",
						error:
							"priceProvider2 must be a valid positive number",
					});
				}

				// Check if pricing already exists for this combination
				const existingPricing =
					await getByCountryAndService(
						parseInt(countryId),
						parseInt(serviceId),
					);

				if (existingPricing) {
					return reply.status(400).send({
						state: "400",
						error:
							"Pricing already exists for this country and service combination",
					});
				}

				// Create single pricing record with all providers
				const pricingData = {
					country: { id: parseInt(countryId) },
					service: { id: parseInt(serviceId) },
					provider1: price1,
					provider2: price2,
				};

				const pricing = await create(pricingData);

				return reply.send({
					state: "200",
					message:
						"Pricing configuration created successfully",
					data: {
						id: pricing.id,
						countryId: parseInt(countryId),
						serviceId: parseInt(serviceId),
						provider1: price1,
						provider2: price2,
					},
				});
			} catch (error) {
				// Log the actual error for debugging but don't expose it to client
				console.error(
					"Pricing creation error:",
					error,
				);

				return reply.status(500).send({
					state: "500",
					error:
						"Failed to create pricing configuration. Please try again.",
				});
			}
		},
	});

	// Update pricing configuration (Admin only)
	app.get("/update", {
		preHandler: requireAdmin(),
		handler: async (request, reply) => {
			try {
				const {
					id,
					priceProvider1,
					priceProvider2,
				} = request.query;

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error:
							"id is required; optionally pass priceProvider1, priceProvider2",
					});
				}

				const data = {};
				if (
					priceProvider1 !== undefined &&
					priceProvider1 !== ""
				) {
					const p = parseFloat(priceProvider1);
					if (isNaN(p) || p < 0) {
						return reply.status(400).send({
							state: "400",
							error:
								"priceProvider1 must be a valid non-negative number",
						});
					}
					data.provider1 = p;
				}
				if (
					priceProvider2 !== undefined &&
					priceProvider2 !== ""
				) {
					const p = parseFloat(priceProvider2);
					if (isNaN(p) || p < 0) {
						return reply.status(400).send({
							state: "400",
							error:
								"priceProvider2 must be a valid non-negative number",
						});
					}
					data.provider2 = p;
				}

				if (Object.keys(data).length === 0) {
					return reply.status(400).send({
						state: "400",
						error:
							"Provide at least one of priceProvider1, priceProvider2",
					});
				}

				const pricing = await update(
					parseInt(id),
					data,
				);

				return reply.send({
					state: "200",
					message:
						"Pricing configuration updated successfully",
					data: pricing,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});

	// Delete pricing configuration (Admin only)
	app.get("/remove", {
		preHandler: requireAdmin(),
		handler: async (request, reply) => {
			try {
				const { id } = request.query;

				if (!id) {
					return reply.status(400).send({
						state: "400",
						error: "id is required",
					});
				}

				const pricing = await remove(
					parseInt(id),
				);

				return reply.send({
					state: "200",
					message:
						"Pricing configuration deleted successfully",
					data: pricing,
				});
			} catch (error) {
				return reply.status(400).send({
					state: "400",
					error: error.message,
				});
			}
		},
	});
};
