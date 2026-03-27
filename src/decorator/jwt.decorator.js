import { verifyToken } from "../utils/jwt.utils.js";
import { userRepository } from "../repositories/user.repo.js";

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header
 * Attaches user data to request object
 */
export const requireJWT = () => {
	return async (request, reply) => {
		try {
			// Get token from Authorization header
			const authHeader = request.headers.authorization;

			if (!authHeader) {
				return reply.status(401).send({
					state: "401",
					error: "No authorization token provided",
				});
			}

			// Check if it's a Bearer token
			const parts = authHeader.split(" ");
			if (parts.length !== 2 || parts[0] !== "Bearer") {
				return reply.status(401).send({
					state: "401",
					error: "Invalid authorization format. Use: Bearer <token>",
				});
			}

			const token = parts[1];

			// Verify the token
			let decoded;
			try {
				decoded = verifyToken(token);
			} catch (error) {
				if (error.message === "Token has expired") {
					return reply.status(401).send({
						state: "401",
						error: "Token has expired",
						expired: true,
					});
				}
				return reply.status(401).send({
					state: "401",
					error: "Invalid token",
				});
			}

			// Verify user still exists and is active
			const user = await userRepository.findOne({
				where: { id: decoded.userId },
			});

			if (!user) {
				return reply.status(401).send({
					state: "401",
					error: "User not found",
				});
			}

			// Attach user data to request
			request.user = {
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				apiKey: user.apiKey,
				balance: user.balance,
			};
		} catch (error) {
			console.error("JWT verification error:", error);
			return reply.status(500).send({
				state: "500",
				error: "Authentication failed",
			});
		}
	};
};

/**
 * Optional JWT Authentication
 * Tries to verify JWT but doesn't fail if token is missing
 * Used for endpoints that work with or without authentication
 */
export const optionalJWT = () => {
	return async (request, reply) => {
		try {
			const authHeader = request.headers.authorization;

			if (!authHeader) {
				return; // No token, continue without user
			}

			const parts = authHeader.split(" ");
			if (parts.length !== 2 || parts[0] !== "Bearer") {
				return; // Invalid format, continue without user
			}

			const token = parts[1];

			try {
				const decoded = verifyToken(token);

				// Verify user exists
				const user = await userRepository.findOne({
					where: { id: decoded.userId },
				});

				if (user) {
					request.user = {
						id: user.id,
						name: user.name,
						email: user.email,
						role: user.role,
						apiKey: user.apiKey,
						balance: user.balance,
					};
				}
			} catch (error) {
				// Token verification failed, continue without user
				console.log("Optional JWT verification failed:", error.message);
			}
		} catch (error) {
			console.error("Optional JWT middleware error:", error);
			// Don't fail the request, just continue without user
		}
	};
};

/**
 * Require Admin Role (works with JWT)
 * Must be used after requireJWT()
 */
export const requireAdminJWT = () => {
	return async (request, reply) => {
		if (!request.user) {
			return reply.status(401).send({
				state: "401",
				error: "Authentication required",
			});
		}

		if (request.user.role !== "admin") {
			return reply.status(403).send({
				state: "403",
				error: "Admin access required",
			});
		}
	};
};

