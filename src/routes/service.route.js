import {
	create,
	getAll,
	getOneById,
	update,
	remove,
	getByCode,
} from "../repositories/service.repo.js";
import {
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
				} = req.query;
				const data = {
					name: servicename,
					code: code,
					provider1: provider1,
					provider2: provider2,
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
				} = req.query;
				const data = {
					name: servicename,
					code: code,
					provider1: provider1,
					provider2: provider2,
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
};
