import { AppDataSource } from "../config/database.js";
import User from "../models/User.model.js";
import { getApiKeyFromRequest } from "../utils/requestApiKey.js";

/**
 * API authentication by apiKey only (JWT is for frontend session; clients send apiKey on API calls).
 * @param {string[]} allowedRoles
 */
export function requireApiKey(
	allowedRoles = ["user", "admin"],
) {
	return async function (request, reply) {
		try {
			const userRepository = AppDataSource.getRepository(User);
			const apiKey = getApiKeyFromRequest(request);

			if (!apiKey) {
				return reply.status(401).send({
					error: "Unauthorized",
					message: "apiKey is required",
				});
			}

			const user = await userRepository.findOne({
				where: { apiKey },
			});

			if (!user) {
				return reply.status(401).send({
					error: "Unauthorized",
					message: "Invalid apiKey",
					code: "INVALID_API_KEY",
				});
			}

			request.user = {
				id: user.id,
				name: user.name,
				role: user.role,
				balance: user.balance,
				apiKey: user.apiKey,
				email: user.email,
			};

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

export const requireAdmin = () =>
	requireApiKey(["admin"]);
export const requireUser = () =>
	requireApiKey(["user", "admin"]);
export const requireAnyRole = () =>
	requireApiKey(["user", "admin"]);
