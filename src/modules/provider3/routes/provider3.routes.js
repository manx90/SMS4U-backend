import { createProvider3Order } from "../../../repositories/order.repo.js";
import {
	replaceSnapshotsForService,
	findOperatorsForCountry,
	resolveOperatorByIndex,
	findByServiceAndInterval,
} from "../../../repositories/provider3Access.repo.js";
import { resolveCountryFilterForProvider3 } from "../../../utils/provider3Country.js";
import upstream from "../services/upstream.service.js";
import { handleProvider3GetMessage } from "../services/orderMessage.service.js";
import Provider3AccessSync from "../../../services/Provider3AccessSync.js";
import {
	requireUser,
	requireAdmin,
} from "../../../decorator/AuthApi.decorator.js";
import {
	getAllWithRelations,
	getDistinctServicesForAccessSync,
	getConfiguredCountries,
	getConfiguredServicesForCountry,
	create as createP3Config,
	update as updateP3Config,
	remove as removeP3Config,
} from "../../../repositories/provider3CountryService.repo.js";
import {
	getByCode as getServiceByCode,
	create as createServiceEntity,
} from "../../../repositories/service.repo.js";
import { create as createCountry } from "../../../repositories/country.repo.js";
import logger from "../../../utils/logger.js";

export const provider3Route = async (app) => {
	app.get("/get-message", {
		preHandler: [requireUser()],
		handler: handleProvider3GetMessage,
	});

	app.get("/get-number", {
		preHandler: [requireUser()],
		handler: async (request, reply) => {
			const {
				apiKey,
				country,
				serviceCode,
				operator,
				operatorIndex,
				server,
			} = request.query;

			const accessInfoInterval =
				process.env.PROVIDER3_ACCESS_INFO_INTERVAL ||
				"30min";

			const serverSlotRaw =
				server !== undefined &&
				server !== null &&
				String(server).trim() !== ""
					? server
					: operatorIndex;

			if (
				!apiKey ||
				country === undefined ||
				country === null ||
				country === "" ||
				serviceCode === undefined ||
				serviceCode === null ||
				serviceCode === ""
			) {
				return reply.status(400).send({
					state: "400",
					error:
						"apiKey, country, serviceCode are required",
				});
			}

			const isAdmin = request.user?.role === "admin";
			const hasRaw =
				operator !== undefined &&
				operator !== null &&
				String(operator).trim() !== "";
			const hasIndex =
				serverSlotRaw !== undefined &&
				serverSlotRaw !== null &&
				String(serverSlotRaw).trim() !== "";

			let resolvedOperatorThird = null;
			try {
				if (isAdmin) {
					if (hasRaw) {
						resolvedOperatorThird =
							String(operator).trim();
					} else if (hasIndex) {
						const countryF =
							await resolveCountryFilterForProvider3(
								country,
								String(serviceCode),
							);
						resolvedOperatorThird =
							await resolveOperatorByIndex(
								String(serviceCode),
								String(accessInfoInterval),
								countryF,
								serverSlotRaw,
							);
					}
				} else {
					if (hasRaw) {
						return reply.status(400).send({
							state: "400",
							error:
								"Use server (1, 2, 3, …) for provider 3; raw operator is not accepted for client requests",
						});
					}
					if (!hasIndex) {
						return reply.status(400).send({
							state: "400",
							error:
								"server is required (1 = Server 1, 2 = Server 2, …)",
						});
					}
					const countryF =
						await resolveCountryFilterForProvider3(
							country,
							String(serviceCode),
						);
					resolvedOperatorThird =
						await resolveOperatorByIndex(
							String(serviceCode),
							String(accessInfoInterval),
							countryF,
							serverSlotRaw,
						);
				}
			} catch (e) {
				return reply.status(400).send({
					state: "400",
					error: e.message || "Invalid operator selection",
				});
			}

			if (
				!resolvedOperatorThird ||
				String(resolvedOperatorThird).trim() === ""
			) {
				return reply.status(400).send({
					state: "400",
					error: isAdmin
						? "operator or server is required for provider 3"
						: "server is required when provider is 3 (1, 2, 3, …)",
				});
			}

			try {
				const order = await createProvider3Order(
					apiKey,
					country,
					serviceCode,
					resolvedOperatorThird,
				);
				return reply.send({
					state: "200",
					msg: "success",
					data: {
						number: order.number,
						orderId: order.publicId,
					},
				});
			} catch (error) {
				const errorMessage =
					error?.message ||
					(typeof error === "string"
						? error
						: String(error));
				const errorMessageLower =
					errorMessage?.toLowerCase() || "";

				const netCodes = [
					"ECONNRESET",
					"ECONNREFUSED",
					"ETIMEDOUT",
					"ENOTFOUND",
					"ECONNABORTED",
					"EPIPE",
				];
				const isProviderError =
					netCodes.includes(error?.code) ||
					errorMessageLower?.includes(
						"provider",
					) ||
					errorMessageLower?.includes(
						"failed to get mobile number",
					) ||
					errorMessageLower?.includes(
						"no operator found",
					) ||
					errorMessageLower?.includes(
						"service provider",
					) ||
					errorMessageLower?.includes(
						"network",
					) ||
					errorMessageLower?.includes(
						"timeout",
					) ||
					errorMessageLower?.includes(
						"connection",
					) ||
					errorMessageLower?.includes(
						"temporarily unavailable",
					) ||
					errorMessageLower?.includes(
						"repeated failures",
					) ||
					errorMessageLower?.includes(
						"request failed",
					) ||
					errorMessageLower?.includes(
						"status code",
					) ||
					errorMessageLower?.includes(
						"socket hang up",
					) ||
					errorMessageLower?.includes(
						"getaddrinfo",
					) ||
					errorMessageLower?.includes(
						"econn",
					) ||
					error?.stack?.includes(
						"Number.service",
					) ||
					error?.stack?.includes(
						"upstream.service",
					) ||
					error?.stack?.includes(
						"Provider3Upstream",
					) ||
					error?.code === "NO_OPERATOR";

				const internalErrors = [
					"user not found",
					"balance is insufficient",
					"country not found",
					"service not found",
					"no pricing found",
					"not configured for provider 3",
					"operator is required for provider 3",
					"no provider 3 configuration",
					"provider 3 is not configured",
				];
				const isInternalError =
					internalErrors.some((err) =>
						errorMessageLower?.includes(err),
					);

				if (isInternalError) {
					logger.error(
						"Internal error during provider3 order:",
						{
							error,
							message: errorMessage,
							apiKey,
						},
					);
					if (
						errorMessageLower?.includes(
							"user not found",
						)
					) {
						return reply.status(401).send({
							state: "401",
							error:
								"Authentication failed. Invalid API key.",
						});
					}
					if (
						errorMessageLower?.includes(
							"balance is insufficient",
						)
					) {
						return reply.status(400).send({
							state: "400",
							error:
								"Your balance is insufficient for this purchase.",
						});
					}
					return reply.status(400).send({
						state: "400",
						error: errorMessage,
					});
				}
				if (isProviderError) {
					logger.providerError(
						"Provider error (provider3 order):",
						{
							error,
							message: errorMessage,
							apiKey,
							country,
							serviceCode,
						},
					);
					return reply.status(500).send({
						state: "500",
						error:
							"Failed to create order. Please try again later.",
					});
				}
				logger.error(
					"Unknown error during provider3 order:",
					{ error, message: errorMessage },
				);
				return reply.status(500).send({
					state: "500",
					error:
						"An error occurred while creating the order. Please try again later.",
				});
			}
		},
	});

	app.get("/access-sync", {
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
				const svc = await getServiceByCode(
					String(serviceCode),
				);
				if (!svc) {
					return res.status(404).send({
						state: "404",
						error: "Service not found",
					});
				}
				const distinct =
					await getDistinctServicesForAccessSync();
				const row = distinct.find(
					(d) => d.serviceCode === svc.code,
				);
				const apiNameResolved =
					serviceName ||
					row?.upstreamServiceName ||
					svc.name;
				const data =
					await upstream.fetchAccessInfo(
						String(apiNameResolved),
						String(interval),
					);
				const rows = Array.isArray(data?.data)
					? data.data
					: [];
				const count =
					await replaceSnapshotsForService(
						svc.code,
						String(apiNameResolved),
						String(interval),
						rows,
					);
				return res.send({
					state: "200",
					msg: "ok",
					data: {
						rowsInserted: count,
						serviceApiName: apiNameResolved,
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

	app.get("/access-sync-all", {
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
						? "No provider3 configs to sync"
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

	app.get("/countries-by-service", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const { serviceCode, interval } =
					req.query;
				if (!serviceCode) {
					return res.status(400).send({
						state: "400",
						error:
							"serviceCode is required",
					});
				}
				const snapshotInterval =
					interval != null &&
					String(interval).trim() !== ""
						? String(interval).trim()
						: process.env
								.PROVIDER3_ACCESS_INFO_INTERVAL ||
							"30min";
				const rows =
					await findByServiceAndInterval(
						String(serviceCode),
						snapshotInterval,
					);
				const data = rows.map((r) => ({
					country: r.countryName,
					ccode: r.ccode,
					operator: r.operator,
					accessCount: r.accessCount,
				}));
				return res.send({
					state: "200",
					data,
					interval: snapshotInterval,
				});
			} catch (e) {
				return res.status(500).send({
					state: "500",
					error: e.message,
				});
			}
		},
	});

	app.get("/catalog/countries", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const data = await getConfiguredCountries();
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return res.status(500).send({
					state: "500",
					error: e.message,
				});
			}
		},
	});

	app.get("/catalog/services", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const { countryId } = req.query;
				if (!countryId) {
					return res.status(400).send({
						state: "400",
						error: "countryId is required",
					});
				}
				const data =
					await getConfiguredServicesForCountry(
						countryId,
					);
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});

	app.get("/admin/country-create", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const { country, code_country } = req.query;
				if (
					!country ||
					String(country).trim() === "" ||
					!code_country ||
					String(code_country).trim() === ""
				) {
					return res.status(400).send({
						state: "400",
						error:
							"country and code_country are required (P3-only: no provider1/2)",
					});
				}
				const row = await createCountry({
					country: String(country).trim(),
					code_country: String(
						code_country,
					).trim(),
					provider1: null,
					provider2: null,
				});
				return res.status(201).send({
					state: "201",
					msg: "Country created (Provider 3 path — no P1/P2 fields)",
					data: row,
				});
			} catch (e) {
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});

	app.get("/admin/service-create", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const { servicename, code } = req.query;
				if (
					!servicename ||
					String(servicename).trim() === "" ||
					!code ||
					String(code).trim() === ""
				) {
					return res.status(400).send({
						state: "400",
						error:
							"servicename and code are required (P3-only: empty P1/P2)",
					});
				}
				const row = await createServiceEntity({
					name: String(servicename).trim(),
					code: String(code).trim(),
					provider1: "",
					provider2: "",
				});
				return res.status(201).send({
					state: "201",
					msg: "Service created (Provider 3 path — no P1/P2 ids)",
					data: row,
				});
			} catch (e) {
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});

	app.get("/operators", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const { serviceCode, country, interval } =
					req.query;
				if (!serviceCode || !country) {
					return res.status(400).send({
						state: "400",
						error:
							"serviceCode and country are required",
					});
				}
				const snapshotInterval =
					interval != null &&
					String(interval).trim() !== ""
						? String(interval).trim()
						: process.env
								.PROVIDER3_ACCESS_INFO_INTERVAL ||
							"30min";
				const countryFilter =
					await resolveCountryFilterForProvider3(
						country,
						String(serviceCode),
					);
				const list = await findOperatorsForCountry(
					String(serviceCode),
					snapshotInterval,
					countryFilter,
				);
				const isAdmin = req.user?.role === "admin";
				const data = isAdmin
					? list
					: list.map((_, i) => ({
							label: `Server ${i + 1}`,
							index: i + 1,
						}));
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return res.status(500).send({
					state: "500",
					error: e.message,
				});
			}
		},
	});

	app.get("/operators-count", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const { serviceCode, country, interval } =
					req.query;
				if (!serviceCode || !country) {
					return res.status(400).send({
						state: "400",
						error:
							"serviceCode and country are required",
					});
				}
				const snapshotInterval =
					interval != null &&
					String(interval).trim() !== ""
						? String(interval).trim()
						: process.env
								.PROVIDER3_ACCESS_INFO_INTERVAL ||
							"30min";
				const countryFilter =
					await resolveCountryFilterForProvider3(
						country,
						String(serviceCode),
					);
				const list = await findOperatorsForCountry(
					String(serviceCode),
					snapshotInterval,
					countryFilter,
				);
				return res.send({
					state: "200",
					data: { count: list.length },
				});
			} catch (e) {
				return res.status(500).send({
					state: "500",
					error: e.message,
				});
			}
		},
	});

	app.get("/operator", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const { serviceCode, country, server, interval } =
					req.query;
				if (
					!serviceCode ||
					!country ||
					server == null ||
					String(server).trim() === ""
				) {
					return res.status(400).send({
						state: "400",
						error:
							"serviceCode, country, and server are required",
					});
				}
				const snapshotInterval =
					interval != null &&
					String(interval).trim() !== ""
						? String(interval).trim()
						: process.env
								.PROVIDER3_ACCESS_INFO_INTERVAL ||
							"30min";
				const countryFilter =
					await resolveCountryFilterForProvider3(
						country,
						String(serviceCode),
					);
				const index1 = parseInt(String(server), 10);
				if (!Number.isFinite(index1) || index1 < 1) {
					return res.status(400).send({
						state: "400",
						error: "Invalid server index",
					});
				}
				const operator = await resolveOperatorByIndex(
					String(serviceCode),
					snapshotInterval,
					countryFilter,
					index1,
				);
				return res.send({
					state: "200",
					data: { operator, index: index1 },
				});
			} catch (e) {
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});

	app.get("/pricing-by-country", {
		preHandler: requireUser(),
		handler: async (req, res) => {
			try {
				const { countryId } = req.query;
				if (!countryId) {
					return res.status(400).send({
						state: "400",
						error: "countryId is required",
					});
				}
				const all = await getAllWithRelations();
				const cid = parseInt(countryId, 10);
				const data = all
					.filter((r) => r.country?.id === cid)
					.map((r) => ({
						serviceCode: r.service?.code,
						serviceName: r.service?.name,
						price: r.price,
					}));
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return res.status(500).send({
					state: "500",
					error: e.message,
				});
			}
		},
	});

	app.get("/config", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const rows = await getAllWithRelations();
				return res.send({
					state: "200",
					data: rows,
				});
			} catch (e) {
				return res.status(500).send({
					state: "500",
					error: e.message,
				});
			}
		},
	});

	app.get("/config/create", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const {
					countryId,
					serviceId,
					price,
					upstreamCountryCode,
					upstreamServiceName,
				} = req.query;
				if (
					!countryId ||
					!serviceId ||
					price === undefined ||
					!upstreamCountryCode ||
					!upstreamServiceName
				) {
					return res.status(400).send({
						state: "400",
						error:
							"countryId, serviceId, price, upstreamCountryCode, upstreamServiceName are required",
					});
				}
				const p = parseFloat(price);
				if (isNaN(p) || p < 0) {
					return res.status(400).send({
						state: "400",
						error: "Invalid price",
					});
				}
				const row = await createP3Config({
					country: { id: parseInt(countryId, 10) },
					service: { id: parseInt(serviceId, 10) },
					price: p,
					upstreamCountryCode: String(
						upstreamCountryCode,
					).trim(),
					upstreamServiceName: String(
						upstreamServiceName,
					).trim(),
				});
				return res.status(201).send({
					state: "201",
					data: row,
				});
			} catch (e) {
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});

	app.get("/config/update", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const {
					id,
					price,
					upstreamCountryCode,
					upstreamServiceName,
				} = req.query;
				if (!id) {
					return res.status(400).send({
						state: "400",
						error: "id is required",
					});
				}
				const data = {};
				if (price !== undefined && price !== "") {
					const p = parseFloat(price);
					if (isNaN(p) || p < 0) {
						return res.status(400).send({
							state: "400",
							error: "Invalid price",
						});
					}
					data.price = p;
				}
				if (upstreamCountryCode !== undefined) {
					data.upstreamCountryCode = String(
						upstreamCountryCode,
					).trim();
				}
				if (upstreamServiceName !== undefined) {
					data.upstreamServiceName = String(
						upstreamServiceName,
					).trim();
				}
				if (Object.keys(data).length === 0) {
					return res.status(400).send({
						state: "400",
						error: "No fields to update",
					});
				}
				const row = await updateP3Config(id, data);
				return res.send({
					state: "200",
					data: row,
				});
			} catch (e) {
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});

	app.get("/config/remove", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const { id } = req.query;
				if (!id) {
					return res.status(400).send({
						state: "400",
						error: "id is required",
					});
				}
				const row = await removeP3Config(id);
				return res.send({
					state: "200",
					data: row,
				});
			} catch (e) {
				return res.status(400).send({
					state: "400",
					error: e.message,
				});
			}
		},
	});
};
