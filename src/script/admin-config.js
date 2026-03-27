import { userRepository } from "../repositories/user.repo.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

/**
 * Setup default admin user from environment variables
 * Runs automatically on server startup
 */
export async function setupDefaultAdmin() {
	try {
		// Check if environment variables are set
		const adminName =
			process.env.ADMIN_NAME || "admin";
		const adminPassword =
			process.env.ADMIN_PASSWORD || "admin123";
		const adminEmail =
			process.env.ADMIN_EMAIL ||
			"admin@example.com";

		// Check if admin user already exists
		const existingAdmin =
			await userRepository.findOne({
				where: { role: "admin" },
			});

		if (existingAdmin) {
			console.log(
				`✅ Admin user already exists: ${existingAdmin.name}`,
			);
			return {
				success: true,
				message: "Admin already exists",
				admin: {
					id: existingAdmin.id,
					name: existingAdmin.name,
					email: existingAdmin.email,
				},
			};
		}

		// Check if user with admin email already exists
		const existingUserByEmail =
			await userRepository.findOne({
				where: { email: adminEmail },
			});

		if (existingUserByEmail) {
			console.log(
				`⚠️  User with email '${adminEmail}' exists. Upgrading to admin role...`,
			);
			// Upgrade existing user to admin
			await userRepository.update(
				existingUserByEmail.id,
				{
					role: "admin",
				},
			);
			console.log(
				`✅ User '${existingUserByEmail.name}' upgraded to admin`,
			);
			return {
				success: true,
				message: "User upgraded to admin",
				admin: {
					id: existingUserByEmail.id,
					name: existingUserByEmail.name,
					email: existingUserByEmail.email,
				},
			};
		}

		// Check if username already exists (as regular user)
		const existingUser =
			await userRepository.findOne({
				where: { name: adminName },
			});

		if (existingUser) {
			console.log(
				`⚠️  User '${adminName}' exists but is not admin. Upgrading to admin role...`,
			);
			// Upgrade existing user to admin
			await userRepository.update(
				existingUser.id,
				{
					role: "admin",
				},
			);
			console.log(
				`✅ User '${adminName}' upgraded to admin`,
			);
			return {
				success: true,
				message: "User upgraded to admin",
				admin: {
					id: existingUser.id,
					name: existingUser.name,
					email: existingUser.email,
				},
			};
		}

		// Create new admin user
		console.log(
			`📝 Creating default admin user: ${adminName}`,
		);

		// Generate API key
		const apiKey = Array.from({ length: 20 })
			.map(() =>
				Math.random().toString(36).charAt(2),
			)
			.join("");

		// Hash password
		const saltRounds = 10;
		const hashedPassword = await bcrypt.hash(
			adminPassword,
			saltRounds,
		);

		// Create admin user
		const admin = userRepository.create({
			name: adminName,
			email: adminEmail,
			password: hashedPassword,
			role: "admin",
			balance: 0,
			apiKey: apiKey,
		});

		try {
			const savedAdmin = await userRepository.save(
				admin,
			);

			console.log(
				`✅ Default admin user created successfully!`,
			);
			console.log(`   Name: ${savedAdmin.name}`);
			console.log(`   Email: ${savedAdmin.email}`);
			console.log(
				`   API Key: ${savedAdmin.apiKey}`,
			);
			console.log(
				`   ⚠️  Please change the default password immediately!`,
			);

			return {
				success: true,
				message: "Admin created successfully",
				admin: {
					id: savedAdmin.id,
					name: savedAdmin.name,
					email: savedAdmin.email,
					apiKey: savedAdmin.apiKey,
				},
			};
		} catch (saveError) {
			// Handle duplicate entry error gracefully
			if (
				saveError.code === "ER_DUP_ENTRY" ||
				saveError.errno === 1062
			) {
				console.log(
					`⚠️  User with email '${adminEmail}' or name '${adminName}' already exists. Checking existing user...`,
				);
				// Try to find the existing user by email first (most likely duplicate)
				let existingUser =
					await userRepository.findOne({
						where: { email: adminEmail },
					});

				// If not found by email, try by name
				if (!existingUser) {
					existingUser =
						await userRepository.findOne({
							where: { name: adminName },
						});
				}

				if (existingUser) {
					await userRepository.update(
						existingUser.id,
						{
							role: "admin",
						},
					);
					console.log(
						`✅ Existing user '${existingUser.name}' upgraded to admin`,
					);
					return {
						success: true,
						message: "User upgraded to admin",
						admin: {
							id: existingUser.id,
							name: existingUser.name,
							email: existingUser.email,
						},
					};
				}
			}
			// Re-throw if it's not a duplicate entry error
			throw saveError;
		}
	} catch (error) {
		console.error(
			`❌ Error setting up default admin:`,
			error,
		);
		// Don't throw error to prevent server crash
		// Just log and return failure
		return {
			success: false,
			message: "Failed to setup default admin",
			error: error.message,
		};
	}
}

/**
 * Get admin user
 */
export async function getAdminUser() {
	try {
		const admin = await userRepository.findOne({
			where: { role: "admin" },
		});
		return admin;
	} catch (error) {
		console.error(
			"Error getting admin user:",
			error,
		);
		throw error;
	}
}

/**
 * Check if admin exists
 */
export async function adminExists() {
	try {
		const admin = await getAdminUser();
		return !!admin;
	} catch (error) {
		return false;
	}
}
