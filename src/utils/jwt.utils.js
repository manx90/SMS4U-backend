import jwt from "jsonwebtoken";

const JWT_SECRET =
	process.env.JWT_SECRET || "supersecret";
const ACCESS_TOKEN_EXPIRY = "1h"; // 1 hour for one hour session
const REFRESH_TOKEN_EXPIRY = "1h"; // 1 hour for refresh token

/**
 * Generate an access token for a user
 * @param {Object} user - User object containing id, name, email, role, apiKey
 * @returns {string} JWT access token
 */
export const generateAccessToken = (user) => {
	const payload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		apiKey: user.apiKey,
	};

	return jwt.sign(payload, JWT_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRY,
	});
};

/**
 * Generate a refresh token for a user
 * @param {Object} user - User object containing id
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (user) => {
	const payload = {
		userId: user.id,
		type: "refresh",
	};

	return jwt.sign(payload, JWT_SECRET, {
		expiresIn: REFRESH_TOKEN_EXPIRY,
	});
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing accessToken and refreshToken
 */
export const generateTokens = (user) => {
	return {
		accessToken: generateAccessToken(user),
		refreshToken: generateRefreshToken(user),
	};
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyToken = (token) => {
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch (error) {
		if (error.name === "TokenExpiredError") {
			throw new Error("Token has expired");
		}
		if (error.name === "JsonWebTokenError") {
			throw new Error("Invalid token");
		}
		throw error;
	}
};

/**
 * Decode a token without verifying (useful for checking expiration)
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export const decodeToken = (token) => {
	try {
		return jwt.decode(token);
	} catch (error) {
		return null;
	}
};

/**
 * Check if a token is expired
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired
 */
export const isTokenExpired = (token) => {
	try {
		const decoded = decodeToken(token);
		if (!decoded || !decoded.exp) {
			return true;
		}
		return decoded.exp * 1000 < Date.now();
	} catch (error) {
		return true;
	}
};

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {number|null} Expiration timestamp in milliseconds or null if invalid
 */
export const getTokenExpiration = (token) => {
	try {
		const decoded = decodeToken(token);
		if (!decoded || !decoded.exp) {
			return null;
		}
		return decoded.exp * 1000;
	} catch (error) {
		return null;
	}
};
