import { AppDataSource } from "../config/database.js";
import User from "../models/User.model.js";
import { verifyToken } from "../utils/jwt.utils.js";

/**
 * Hybrid authentication decorator supporting both JWT and API Key
 * Tries JWT first (from Authorization header), then falls back to API key (from query params)
 * @param {string[]} allowedRoles - Array of roles that are allowed to access the endpoint
 * @returns {Function} Fastify decorator function
 */
export function requireApiKey(
	allowedRoles = ["user", "admin"],
) {
	return async function (request, reply) {
		try {
			let user = null;
			const userRepository = AppDataSource.getRepository(User);

			// Try JWT authentication first (from Authorization header)
			const authHeader = request.headers.authorization;
			if (authHeader) {
				const parts = authHeader.split(" ");
				if (parts.length === 2 && parts[0] === "Bearer") {
					const token = parts[1];
					try {
						const decoded = verifyToken(token);
						
						// Get user from database
						user = await userRepository.findOne({
							where: { id: decoded.userId },
						});

						if (user) {
							// Attach user to request
							request.user = {
								id: user.id,
								name: user.name,
								role: user.role,
								balance: user.balance,
								apiKey: user.apiKey,
								email: user.email,
							};
						}
					} catch (error) {
						// JWT verification failed, try API key
						console.log("JWT verification failed, trying API key:", error.message);
					}
				}
			}

			// If JWT auth didn't work, try API key authentication
			if (!user) {
				const apiKey = request.query.apiKey;

				if (!apiKey) {
					return reply.status(401).send({
						error: "Unauthorized",
						message: "Authentication required. Provide JWT token or API key",
						code: "MISSING_AUTH",
					});
				}

				// Find user by API key
				user = await userRepository.findOne({
					where: { apiKey: apiKey },
				});

				if (!user) {
					return reply.status(401).send({
						error: "Unauthorized",
						message: "Invalid API key",
						code: "INVALID_API_KEY",
					});
				}

				// Attach user to request
				request.user = {
					id: user.id,
					name: user.name,
					role: user.role,
					balance: user.balance,
					apiKey: user.apiKey,
					email: user.email,
				};
			}

			// Check if user role is allowed
			if (!allowedRoles.includes(user.role)) {
				return reply.status(403).send({
					error: "Forbidden",
					message: `Access denied. Required roles: ${allowedRoles.join(
						", ",
					)}`,
					code: "INSUFFICIENT_PERMISSIONS",
				});
			}
		} catch (error) {
			console.error(
				"Authentication error:",
				error,
			);
			return reply.status(500).send({
				error: "Internal Server Error",
				message: "Authentication service error",
				code: "AUTH_SERVICE_ERROR",
			});
		}
	};
}

/**
 * Convenience decorators for specific roles
 */
export const requireAdmin = () =>
	requireApiKey(["admin"]);
export const requireUser = () =>
	requireApiKey(["user", "admin"]);
export const requireAnyRole = () =>
	requireApiKey(["user", "admin"]);
