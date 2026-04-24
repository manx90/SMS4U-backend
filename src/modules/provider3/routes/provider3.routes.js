import { createProvider3Order } from "../../../repositories/order.repo.js";
import {
	replaceSnapshotsForService,
	findOperatorsForCountryWithFallback,
	resolveOperatorByIndex,
	getAccessInfoOperatorCountsForConfiguredService,
} from "../../../repositories/provider3Access.repo.js";
import {
	resolveCountryFilterForProvider3,
	resolveUpstreamServiceNameForP3,
} from "../../../utils/provider3Country.js";
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
	getCatalogServicesPublic,
	getCatalogServicesPublicForCountry,
	create as createP3Config,
	update as updateP3Config,
	remove as removeP3Config,
} from "../../../repositories/provider3CountryService.repo.js";
import {
	getByCode as getP3ServiceByCode,
	getByName as getP3ServiceByName,
	create as createP3ServiceRow,
} from "../../../repositories/p3Service.repo.js";
import {
	create as createP3Country,
	getAll as getAllP3Countries,
	getByCodeCountry as getP3CountryByCode,
	getByName as getP3CountryByName,
} from "../../../repositories/p3Country.repo.js";
import { getAll as getAllP3Services } from "../../../repositories/p3Service.repo.js";
import logger from "../../../utils/logger.js";
import { sendMappedError } from "../../../utils/apiErrorResponse.js";

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
				if (hasRaw) {
					return reply.status(400).send({
						state: "400",
						error:
							"Use server (1, 2, 3, …) for operator index only; raw operator id is not accepted",
					});
				}
				if (!hasIndex) {
					return reply.status(400).send({
						state: "400",
						error:
							"server is required (1 = first operator, 2 = second, …)",
					});
				}
				const countryF =
					await resolveCountryFilterForProvider3(
						country,
						String(serviceCode),
					);
				const upstreamName =
					await resolveUpstreamServiceNameForP3(
						country,
						String(serviceCode),
					);
				resolvedOperatorThird =
					await resolveOperatorByIndex(
						String(serviceCode),
						String(accessInfoInterval),
						countryF,
						serverSlotRaw,
						upstreamName,
					);
			} catch (e) {
				return sendMappedError(
					reply,
					e,
					logger,
					{
						route: "provider3.get-number.resolve-operator",
					},
				);
			}

			if (
				!resolvedOperatorThird ||
				String(resolvedOperatorThird).trim() === ""
			) {
				return reply.status(400).send({
					state: "400",
					error:
						"server is required for provider 3 (1, 2, 3, …)",
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
				const svc = await getP3ServiceByCode(
					String(serviceCode),
				);
				if (!svc) {
					return res.status(404).send({
						state: "404",
						error: "P3 service not found",
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
				return sendMappedError(
					res,
					e,
					logger,
					{ route: "provider3.access-sync" },
				);
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
				return sendMappedError(
					res,
					e,
					logger,
					{ route: "provider3.access-sync-all" },
				);
			}
		},
	});

	app.get("/accessinfo", {
		handler: async (req, res) => {
			try {
				const { serviceCode } = req.query;
				if (
					serviceCode === undefined ||
					serviceCode === null ||
					String(serviceCode).trim() === ""
				) {
					return res.status(400).send({
						state: "400",
						error: "serviceCode is required",
					});
				}
				const data =
					await getAccessInfoOperatorCountsForConfiguredService(
						String(serviceCode),
						undefined,
					);
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				const msg = e?.message || String(e);
				if (
					msg.includes("serviceCode is required") ||
					msg.startsWith("Unknown serviceCode:")
				) {
					return res.status(400).send({
						state: "400",
						error: msg,
					});
				}
				return sendMappedError(
					res,
					e,
					logger,
					{ route: "provider3.accessinfo" },
				);
			}
		},
	});

	app.get("/catalog/countries", {
		handler: async (req, res) => {
			try {
				const data = await getConfiguredCountries();
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return sendMappedError(
					res,
					e,
					logger,
					{ route: "provider3.catalog.countries" },
				);
			}
		},
	});

	app.get("/catalog/services", {
		handler: async (req, res) => {
			try {
				const { countryId } = req.query;
				if (
					countryId !== undefined &&
					countryId !== null &&
					String(countryId).trim() !== ""
				) {
					const data =
						await getCatalogServicesPublicForCountry(
							countryId,
						);
					return res.send({
						state: "200",
						data,
					});
				}
				const data = await getCatalogServicesPublic();
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return sendMappedError(
					res,
					e,
					logger,
					{ route: "provider3.catalog.services" },
				);
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
				const nameTrim = String(country).trim();
				const codeTrim = String(code_country).trim();
				const dupCode =
					await getP3CountryByCode(codeTrim);
				if (dupCode) {
					return res.status(409).send({
						state: "409",
						error:
							"This country code already exists.",
					});
				}
				const dupName =
					await getP3CountryByName(nameTrim);
				if (dupName) {
					return res.status(409).send({
						state: "409",
						error:
							"A country with this name already exists.",
					});
				}
				const row = await createP3Country({
					name: nameTrim,
					code_country: codeTrim,
				});
				return res.status(201).send({
					state: "201",
					data: {
						name: row.name,
						code_country: row.code_country,
						id: row.id,
					},
				});
			} catch (e) {
				return sendMappedError(
					res,
					e,
					logger,
					{
						kind: "p3_country",
						route: "provider3.admin.country-create",
					},
				);
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
				const nameTrim = String(servicename).trim();
				const codeTrim = String(code).trim();
				const dupCode =
					await getP3ServiceByCode(codeTrim);
				if (dupCode) {
					return res.status(409).send({
						state: "409",
						error:
							"This service code already exists.",
					});
				}
				const dupName =
					await getP3ServiceByName(nameTrim);
				if (dupName) {
					return res.status(409).send({
						state: "409",
						error:
							"A service with this name already exists.",
					});
				}
				const row = await createP3ServiceRow({
					name: nameTrim,
					code: codeTrim,
				});
				return res.status(201).send({
					state: "201",
					data: {
						name: row.name,
						code: row.code,
						id: row.id,
					},
				});
			} catch (e) {
				return sendMappedError(
					res,
					e,
					logger,
					{
						kind: "p3_service",
						route: "provider3.admin.service-create",
					},
				);
			}
		},
	});

	app.get("/admin/p3-catalog-countries", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const data = await getAllP3Countries();
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return sendMappedError(
					res,
					e,
					logger,
					{
						route: "provider3.admin.p3-catalog-countries",
					},
				);
			}
		},
	});

	app.get("/admin/p3-catalog-services", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const data = await getAllP3Services();
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

	app.get("/pricing-by-country", {
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
				const accessInfoInterval =
					process.env.PROVIDER3_ACCESS_INFO_INTERVAL ||
					"30min";
				const filtered = all.filter(
					(r) => r.p3Country?.id === cid,
				);
				const data = await Promise.all(
					filtered.map(async (r) => {
						const serviceCode = String(
							r.p3Service?.code || "",
						);
						const cc = String(
							r.p3Country?.code_country || "",
						).trim();
						let operatorCount = 0;
						try {
							const countryFilter =
								await resolveCountryFilterForProvider3(
									cc,
									serviceCode,
								);
							const list =
								await findOperatorsForCountryWithFallback(
									serviceCode,
									accessInfoInterval,
									countryFilter,
									r.upstreamServiceName,
								);
							operatorCount = list.length;
						} catch {
							operatorCount = 0;
						}
						return {
							serviceCode: r.p3Service?.code,
							serviceName: r.p3Service?.name,
							price: r.price,
							operatorCount,
						};
					}),
				);
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return sendMappedError(
					res,
					e,
					logger,
					{ route: "provider3.pricing-by-country" },
				);
			}
		},
	});

	app.get("/config", {
		preHandler: requireAdmin(),
		handler: async (req, res) => {
			try {
				const rows = await getAllWithRelations();
				const data = rows.map((r) => ({
					...r,
					country: r.p3Country ?? null,
					service: r.p3Service ?? null,
				}));
				return res.send({
					state: "200",
					data,
				});
			} catch (e) {
				return sendMappedError(
					res,
					e,
					logger,
					{ route: "provider3.config" },
				);
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
					p3Country: {
						id: parseInt(countryId, 10),
					},
					p3Service: {
						id: parseInt(serviceId, 10),
					},
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
				return sendMappedError(
					res,
					e,
					logger,
					{
						kind: "p3_config",
						route: "provider3.config.create",
					},
				);
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
				return sendMappedError(
					res,
					e,
					logger,
					{
						kind: "p3_config",
						route: "provider3.config.update",
					},
				);
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
				return sendMappedError(
					res,
					e,
					logger,
					{
						kind: "p3_config",
						route: "provider3.config.remove",
					},
				);
			}
		},
	});
};
