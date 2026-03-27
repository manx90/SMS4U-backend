import { requireAdmin } from "../decorator/AuthApi.decorator.js";
import bcrypt from "bcrypt";
import {
	getAll as getAllUsers,
	getOne as getOneUser,
	create as createUser,
	update as updateUser,
	remove as removeUser,
	userRepository,
} from "../repositories/user.repo.js";
import {
	generateTokens,
	verifyToken,
} from "../utils/jwt.utils.js";

export const userRoute = async (app) => {
	// Admin: list all users
	app.get("/all", {
		preHandler: requireAdmin(),
		handler: async (_request, reply) => {
			try {
				const data = await getAllUsers();
				console.log(data);
				return reply.send({ state: "200", data });
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Admin: get single user
	app.get("/:id", {
		preHandler: requireAdmin(),
		handler: async (request, reply) => {
			try {
				const { id } = request.params;
				const data = await getOneUser(id);
				if (!data) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}
				return reply.send({ state: "200", data });
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Admin: create user
	app.get("/create", {
		preHandler: requireAdmin(),
		handler: async (request, reply) => {
			try {
				const {
					name,
					role = "user",
					balance = 0,
					password,
					email,
				} = request.query;
				if (!name) {
					return reply.status(400).send({
						state: "400",
						error: "name is required",
					});
				}
				if (!password) {
					return reply.status(400).send({
						state: "400",
						error: "password is required",
					});
				}
				const data = await createUser({
					name,
					role,
					balance: parseFloat(balance),
					password,
					email,
				});
				if (data instanceof Error) {
					return reply.status(400).send({
						state: "400",
						error: data.message,
					});
				}
				const { password: _pw, ...rest } = data;
				return reply.send({
					state: "200",
					data: rest,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Admin: update user
	app.get("/update/:id", {
		preHandler: requireAdmin(),
		handler: async (request, reply) => {
			try {
				const { id } = request.params;
				const { name, role, balance, password } =
					request.query;
				const updateData = {};
				if (name) updateData.name = name;
				if (role) updateData.role = role;
				if (balance !== undefined)
					updateData.balance =
						parseFloat(balance);
				if (password)
					updateData.password = password;
				updateData.id = id; // align with repository check
				const result = await updateUser(
					id,
					updateData,
				);
				if (result instanceof Error) {
					return reply.status(400).send({
						state: "400",
						error: result.message,
					});
				}
				return reply.send({
					state: "200",
					message: "User updated",
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Admin: delete user
	app.get("/delete", {
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
				const result = await removeUser(id);
				if (result instanceof Error) {
					return reply.status(404).send({
						state: "404",
						error: result.message,
					});
				}
				return reply.send({
					state: "200",
					message: "User deleted successfully",
				});
			} catch (error) {
				// Check if it's a foreign key constraint error
				if (
					error.message &&
					error.message.includes(
						"foreign key constraint",
					)
				) {
					return reply.status(400).send({
						state: "400",
						error:
							"Cannot delete user with existing orders. Please delete or reassign user's orders first.",
					});
				}
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// User balance endpoint
	app.get("/balance", {
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				if (!apiKey) {
					return reply.status(400).send({
						state: "400",
						error: "apiKey is required",
					});
				}

				const user = await userRepository.findOne(
					{
						where: { apiKey },
					},
				);
				if (!user) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}

				return reply.send({
					state: "200",
					data: {
						balance: user.balance,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// User info endpoint
	app.get("/info", {
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				if (!apiKey) {
					return reply.status(400).send({
						state: "400",
						error: "apiKey is required",
					});
				}

				const user = await userRepository.findOne(
					{
						where: { apiKey },
					},
				);
				if (!user) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}

				return reply.send({
					state: "200",
					data: {
						name: user.name,
						email: user.email,
						balance: user.balance,
						createdAt: user.createdAt,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// User orders endpoint
	app.get("/orders", {
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				if (!apiKey) {
					return reply.status(400).send({
						state: "400",
						error: "apiKey is required",
					});
				}

				const user = await userRepository.findOne(
					{
						where: { apiKey },
					},
				);
				if (!user) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}

				// Get user's orders with relations
				const { getByUserApiKey } = await import(
					"../repositories/order.repo.js"
				);
				const orders = await getByUserApiKey(
					apiKey,
				);

				return reply.send({
					state: "200",
					data: orders,
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

export const authRoute = async (app) => {
	// Register new user
	app.get("/register", {
		handler: async (request, reply) => {
			try {
				const { name, password, email } =
					request.query;
				if (!name) {
					return reply.status(400).send({
						state: "400",
						error: "name is required",
					});
				}
				if (!password) {
					return reply.status(400).send({
						state: "400",
						error: "password is required",
					});
				}
				const data = await createUser({
					name,
					password,
					email,
				});
				if (data instanceof Error) {
					return reply.status(400).send({
						state: "400",
						error: data.message,
					});
				}

				// Generate JWT tokens
				const tokens = generateTokens(data);

				const { password: _pw, ...rest } = data;
				return reply.send({
					state: "200",
					data: {
						...rest,
						...tokens,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Login by name + password
	app.get("/login", {
		handler: async (request, reply) => {
			try {
				const { name, password } = request.query;
				if (!name || !password) {
					return reply.status(400).send({
						state: "400",
						error:
							"name and password are required",
					});
				}
				const user = await userRepository.findOne(
					{ where: { name } },
				);
				if (!user) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}
				const ok = await bcrypt.compare(
					password,
					user.password,
				);
				if (!ok) {
					return reply.status(401).send({
						state: "401",
						error: "Invalid credentials",
					});
				}

				// Generate JWT tokens
				const tokens = generateTokens(user);

				const { password: _pw, ...rest } = user;
				return reply.send({
					state: "200",
					data: {
						...rest,
						...tokens,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Login using only apiKey (no password)
	app.get("/login-with-key", {
		handler: async (request, reply) => {
			try {
				const { apiKey } = request.query;
				if (!apiKey) {
					return reply.status(400).send({
						state: "400",
						error: "apiKey is required",
					});
				}
				const user = await userRepository.findOne(
					{
						where: { apiKey },
					},
				);
				if (!user) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}
				const { password: _pw, ...rest } = user;
				return reply.send({
					state: "200",
					data: rest,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// API Key regeneration endpoint
	app.get("/regenerate-apikey", {
		handler: async (request, reply) => {
			try {
				const { apiKey, password } =
					request.query;
				if (!apiKey || !password) {
					return reply.status(400).send({
						state: "400",
						error:
							"apiKey and password are required",
					});
				}

				const user = await userRepository.findOne(
					{
						where: { apiKey },
					},
				);
				if (!user) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}

				const isPasswordValid =
					await bcrypt.compare(
						password,
						user.password,
					);
				if (!isPasswordValid) {
					return reply.status(401).send({
						state: "401",
						error: "Invalid password",
					});
				}

				// Generate new API key
				const newApiKey = Array.from({
					length: 20,
				})
					.map(() =>
						Math.random().toString(36).charAt(2),
					)
					.join("");

				// Update user with new API key
				await userRepository.update(user.id, {
					apiKey: newApiKey,
				});

				return reply.send({
					state: "200",
					message:
						"API key regenerated successfully",
					data: {
						apiKey: newApiKey,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Refresh access token using refresh token
	app.post("/refresh-token", {
		handler: async (request, reply) => {
			try {
				const { refreshToken } =
					request.body || {};

				if (!refreshToken) {
					return reply.status(400).send({
						state: "400",
						error: "refreshToken is required",
					});
				}

				// Verify the refresh token
				let decoded;
				try {
					decoded = verifyToken(refreshToken);
				} catch (error) {
					return reply.status(401).send({
						state: "401",
						error:
							"Invalid or expired refresh token",
					});
				}

				// Check if it's a refresh token
				if (decoded.type !== "refresh") {
					return reply.status(401).send({
						state: "401",
						error: "Invalid token type",
					});
				}

				// Get user from database
				const user = await userRepository.findOne(
					{
						where: { id: decoded.userId },
					},
				);

				if (!user) {
					return reply.status(404).send({
						state: "404",
						error: "User not found",
					});
				}

				// Generate new tokens
				const tokens = generateTokens(user);

				return reply.send({
					state: "200",
					data: tokens,
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// Verify if a token is valid
	app.get("/verify-token", {
		handler: async (request, reply) => {
			try {
				const authHeader =
					request.headers.authorization;

				if (!authHeader) {
					return reply.status(401).send({
						state: "401",
						error:
							"No authorization token provided",
						valid: false,
					});
				}

				const parts = authHeader.split(" ");
				if (
					parts.length !== 2 ||
					parts[0] !== "Bearer"
				) {
					return reply.status(401).send({
						state: "401",
						error: "Invalid authorization format",
						valid: false,
					});
				}

				const token = parts[1];

				// Verify the token
				let decoded;
				try {
					decoded = verifyToken(token);
				} catch (error) {
					return reply.send({
						state: "200",
						valid: false,
						error: error.message,
					});
				}

				// Verify user still exists
				const user = await userRepository.findOne(
					{
						where: { id: decoded.userId },
					},
				);

				if (!user) {
					return reply.send({
						state: "200",
						valid: false,
						error: "User not found",
					});
				}

				return reply.send({
					state: "200",
					valid: true,
					data: {
						userId: decoded.userId,
						name: decoded.name,
						email: decoded.email,
						role: decoded.role,
					},
				});
			} catch (error) {
				return reply.status(500).send({
					state: "500",
					error: error.message,
				});
			}
		},
	});

	// removed: login-with-password (now consolidated into /login)
};
