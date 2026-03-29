import {
	create,
	getAll,
	getOneById,
	update,
	remove,
	getByCode,
} from "../repositories/service.repo.js";
import {
	replaceSnapshotsForService,
	findOperatorsForCountry,
} from "../repositories/provider3Access.repo.js";
import {
	getOne as getCountryById,
	getByCodeCountry,
} from "../repositories/country.repo.js";
import thirdNumberServices from "../api/third-Number.service.js";
import Provider3AccessSync from "../services/Provider3AccessSync.js";
import {
	requireApiKey,
	requireAdmin,
	requireUser,
} from "../decorator/AuthApi.decorator.js";
import {
	cacheStatic,
	cacheDisabled,
} from "../decorator/cache.decorator.js";
export const druServiceRoute = async (
	app,
	opt,
) => {
	// Get all services (requires authentication)
	app.get("/", {
		preHandler: [requireUser(), cacheStatic()],
		handler: async (req, res) => {
			try {
				// Get data directly from database
				const data = await getAll();

				// Filter data based on user role
				let responseData = data;
				if (req.user.role === "user") {
					responseData = data.map((service) => ({
						code: service.code,
						name: service.name,
					}));
				}
				return res.send({
					state: "200",
					data: responseData,
				});
			} catch (error) {
				console.error("Service error:", error);
				return res.status(500).send({
					state: "500",
					error:
						"Failed to process request. Please try again.",
				});
			}
		},
	});
	// Example: Admin-only route (requires admin role)
	app.get(
		"/create",
		{ preHandler: requireAdmin() },
		async (req, res) => {
			try {
				const {
					servicename,
					code,
					provider1,
					provider2,
					provider3,
				} = req.query;
				const data = {
					name: servicename,
					code: code,
					provider1: provider1,
					provider2: provider2,
					provider3: provider3,
				};
				const service = await create(data);
				// console.log(service);
				return res.status(201).send({
					state: "201",
					msg: "Service created successfully",
					data: service,
				});
			} catch (e) {
				// console.log(e);
				console.error(
					"Service creation error:",
					e,
				);
				return res.status(400).send({
					state: "400",
					msg: "Failed to create service. Please check your input and try again.",
					data: null,
				});
			}
		},
	);
	// Example: User or Admin route (requires any authenticated role)
	app.get(
		"/remove",
		{ preHandler: requireUser() },
		async (req, res) => {
			try {
				const { id } = req.query;
				if (!id)
					throw new Error("ID is required");
				const service = await remove(id);
				if (service) {
					res.status(200).send({
						state: "200",
						data: service,
					});
				}
			} catch (e) {
				console.error(
					"Service removal error:",
					e,
				);
				return res.status(400).send({
					state: "400",
					error:
						"Failed to remove service. Please try again.",
				});
			}
		},
	);
	// Update service (admin only)
	app.get(
		"/update",
		{ preHandler: requireAdmin() },
		async (req, res) => {
			try {
				const {
					id,
					servicename,
					code,
					provider1,
					provider2,
					provider3,
				} = req.query;
				const data = {
					name: servicename,
					code: code,
					provider1: provider1,
					provider2: provider2,
					provider3: provider3,
				};
				const service = await update(id, data);
				return {
					state: "200",
					msg: "Service updated successfully",
					data: service,
				};
			} catch (e) {
				console.error("Service update error:", e);
				return {
					state: "400",
					msg: "Failed to update service. Please try again.",
					data: null,
				};
			}
		},
	);
	// Get one service by ID (requires authentication)
	app.get(
		"/service/:id",
		{
			preHandler: requireUser(),
		},
		async (req, res) => {
			try {
				const { id } = req.params;
				const service = await getOneById(id);

				if (!service) {
					return res.status(404).send({
						state: "404",
						error: "Service not found",
					});
				}

				// Filter data based on user role
				let responseData = service;
				if (req.user.role === "user") {
					responseData = {
						code: service.code,
						name: service.name,
					};
				}

				return res.send({
					state: "200",
					msg: "Service fetched successfully",
					data: responseData,
				});
			} catch (e) {
				console.error("Service fetch error:", e);
				return res.status(500).send({
					state: "500",
					error:
						"Failed to fetch service. Please try again.",
				});
			}
		},
	);

	// Provider 3: fetch /accessinfo and store operator/country rows
	app.get("/provider3/access-sync", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const {
					serviceCode,
					interval = "30min",
					serviceName,
				} = req.query;
				if (!serviceCode) {
					return res.status(400).send({
						state: "400",
						error: "serviceCode is required",
					});
				}
				const svc = await getByCode(
					String(serviceCode),
				);
				if (!svc) {
					return res.status(404).send({
						state: "404",
						error: "Service not found",
					});
				}
				const apiName =
					serviceName ||
					svc.provider3 ||
					svc.name;
				const data =
					await thirdNumberServices.fetchAccessInfo(
						String(apiName),
						String(interval),
					);
				const rows = Array.isArray(data?.data)
					? data.data
					: [];
				const count =
					await replaceSnapshotsForService(
						svc.code,
						String(apiName),
						String(interval),
						rows,
					);
				return res.send({
					state: "200",
					msg: "ok",
					data: {
						rowsInserted: count,
						serviceApiName: apiName,
						service: data?.service,
						status: data?.status,
					},
				});
			} catch (e) {
				console.error(e);
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});

	// Provider 3: run full access sync (same as cron) — all services with provider3 set
	app.get("/provider3/access-sync-all", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const result =
					await Provider3AccessSync.syncAll({
						ignoreDisabled: true,
					});

				if (
					result.reason === "missing_third_env"
				) {
					return res.status(400).send({
						state: "400",
						error:
							"Third provider API is not configured (third_NUMBER_API_KEY / third_NUMBER_API_URL)",
						data: result,
					});
				}

				if (
					result.reason === "already_running"
				) {
					return res.status(409).send({
						state: "409",
						error:
							"A sync is already in progress. Try again shortly.",
						data: result,
					});
				}

				return res.send({
					state: "200",
					msg: result.skipped
						? "No provider3 services to sync"
						: "ok",
					data: result,
				});
			} catch (e) {
				console.error(e);
				return res.status(500).send({
					state: "500",
					error:
						e.message ||
						"Provider 3 full sync failed",
				});
			}
		},
	});

	// Provider 3: operators for a country (from last access-sync)
	app.get("/provider3/operators", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const {
					serviceCode,
					country,
					interval = "30min",
				} = req.query;
				if (!serviceCode || !country) {
					return res.status(400).send({
						state: "400",
						error:
							"serviceCode and country are required",
					});
				}
				let countryFilter = String(country).trim();
				if (/^\d+$/.test(countryFilter)) {
					let cRow = await getCountryById(
						parseInt(countryFilter, 10),
					);
					if (!cRow) {
						cRow = await getByCodeCountry(
							countryFilter,
						);
					}
					if (cRow) {
						const p3 = cRow.provider3?.trim();
						if (p3) countryFilter = p3;
						else if (cRow.code_country?.trim()) {
							countryFilter =
								cRow.code_country.trim();
						}
					}
				}
				const list = await findOperatorsForCountry(
					String(serviceCode),
					String(interval),
					countryFilter,
				);
				return res.send({
					state: "200",
					data: list,
				});
			} catch (e) {
				return res.status(500).send({
					state: "500",
					error: e.message,
				});
			}
		},
	});
};
