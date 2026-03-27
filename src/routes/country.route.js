import {
	create,
	getAll,
	getOne,
	remove,
	update,
} from "../repositories/country.repo.js";
import {
	requireAdmin,
	requireUser,
} from "../decorator/AuthApi.decorator.js";
import {
	cacheStatic,
	cacheDisabled,
} from "../decorator/cache.decorator.js";

export const countryRoute = (app) => {
	// Get all countries
	app.get("/", {
		preHandler: [requireUser(), cacheStatic()],
		handler: async (request, reply) => {
			try {
				// Get data directly from database
				const data = await getAll();

				// Filter data based on user role
				let responseData = data;
				if (request.user.role === "user") {
					responseData = data.map((country) => ({
						id: country.id,
						name: country.name,
						code: country.code_country,
					}));
				}

				return reply.send({
					state: "200",
					data: responseData,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Create new country
	app.get("/create", {
		preHandler: [requireAdmin(), cacheDisabled()],
		handler: async (request, reply) => {
			try {
				const {
					country,
					code_country,
					provider1,
					provider2,
					provider3,
				} = request.query;

				console.log("Received parameters:", {
					country,
					code_country,
					provider1,
					provider2,
					provider3,
				});

				if (
					country === undefined ||
					country === null ||
					country === "" ||
					code_country === undefined ||
					code_country === null ||
					code_country === "" ||
					provider1 === undefined ||
					provider1 === null ||
					provider1 === "" ||
					provider2 === undefined ||
					provider2 === null ||
					provider2 === ""
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"country, code_country, provider1, and provider2 are required",
						received: {
							country,
							code_country,
							provider1,
							provider2,
						},
					});
				}

				const dataCreate = {
					country,
					code_country,
					provider1,
					provider2,
					provider3,
				};

				const data = await create(dataCreate);

				if (data instanceof Error) {
					return reply.status(400).send({
						state: "400",
						error: data.message,
					});
				}

				return reply.send({
					state: "200",
					data,
				});
			} catch (error) {
				console.error(
					"Country creation error:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Update country
	app.get("/update", {
		preHandler: [requireAdmin(), cacheDisabled()],
		handler: async (request, reply) => {
			try {
				const {
					id,
					country,
					code_country,
					provider1,
					provider2,
					provider3,
				} = request.query;

				if (
					id === undefined ||
					id === null ||
					id === "" ||
					country === undefined ||
					country === null ||
					country === "" ||
					code_country === undefined ||
					code_country === null ||
					code_country === "" ||
					provider1 === undefined ||
					provider1 === null ||
					provider1 === "" ||
					provider2 === undefined ||
					provider2 === null ||
					provider2 === ""
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"id, country, code_country, provider1, and provider2 are required",
					});
				}

				const data = await update(id, {
					country,
					code_country,
					provider1,
					provider2,
					provider3,
				});

				return reply.send({
					state: "200",
					data,
				});
			} catch (error) {
				console.error(
					"Country update error:",
					error,
				);
				const msg = error?.message || String(error);
				if (
					msg === "Country not found" ||
					msg.includes("already exists")
				) {
					return reply.status(400).send({
						state: "400",
						error: msg,
					});
				}
				return reply.status(500).send({
					state: "500",
					error: msg,
				});
			}
		},
	});

	// Delete country
	app.get("/remove", {
		preHandler: requireAdmin(),
		handler: async (request, reply) => {
			try {
				const { id } = request.query;

				const result = await remove(id);

				return reply.send({
					state: "200",
					message: "Country deleted successfully",
					data: result,
				});
			} catch (error) {
				// خطأ "الدولة غير موجودة"
				if (
					error.message === "Country not found"
				) {
					return reply.status(404).send({
						state: "404",
						error: error.message,
						data: null,
					});
				}

				// خطأ "id غير صالح"
				if (error.message === "Invalid ID") {
					return reply.status(400).send({
						state: "400",
						error: error.message,
						data: null,
					});
				}

				// باقي الأخطاء
				console.error(
					"Country deletion error:",
					error,
				);
				return reply.status(500).send({
					state: "500",
					error:
						"Failed to delete country. Please try again.",
				});
			}
		},
	});

	// Get one country by ID (after static /create, /update, /remove)
	app.get("/:id", {
		preHandler: [requireUser(), cacheStatic()],
		handler: async (request, reply) => {
			try {
				const { id } = request.params;
				const data = await getOne(id);
				if (!data) {
					return reply.status(404).send({
						state: "404",
						error: "Country not found",
					});
				}

				let responseData = data;
				if (request.user.role === "user") {
					responseData = {
						name: data.name,
						code: data.code_country,
					};
				}

				return reply.send({
					state: "200",
					data: responseData,
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
