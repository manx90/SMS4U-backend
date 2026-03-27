import { AppDataSource } from "../config/database.js";
import bcrypt from "bcrypt";

export const userRepository =
	AppDataSource.getRepository("User");

// crud
export const getAll = async () =>
	await userRepository.find();
export const getOne = async (id) =>
	await userRepository.findOne({
		where: { id: parseInt(id) },
	});
export const create = async (data) => {
	const user = await checkUserName(data.name);
	if (user)
		return new Error("User already exists");
	if (data.email) {
		const emailUser = await checkUserEmail(
			data.email,
		);
		if (emailUser)
			return new Error("Email already exists");
	}

	const apikey = Array.from({ length: 20 })
		.map(() =>
			Math.random().toString(36).charAt(2),
		)
		.join("");
	data.apiKey = apikey;
	if (!data.password) {
		return new Error("Password is required");
	}
	const saltRounds = 10;
	data.password = await bcrypt.hash(
		data.password,
		saltRounds,
	);
	return await userRepository.save(data);
};
export const update = async (id, data) => {
	const user = await checkUserId(data.id);
	if (!user) return new Error("User not found");
	if (data.password) {
		const saltRounds = 10;
		data.password = await bcrypt.hash(
			data.password,
			saltRounds,
		);
	}
	await userRepository.update(id, data);
};
export const remove = async (id) => {
	const user = await getOne(id);
	if (!user) return new Error("User not found");
	await userRepository.delete(id);
	return {
		success: true,
		message: "User deleted successfully",
	};
};

// utils
const checkUserName = async (name) =>
	await userRepository.findOne({
		where: { name },
	});
const checkUserEmail = async (email) =>
	await userRepository.findOne({
		where: { email },
	});
const checkUserId = async (id) =>
	await userRepository.findOne({
		where: { id: parseInt(id) },
	});
export const balanceChange = async (
	id,
	amount,
) => {
	const user = await checkUserId(id);
	if (!user) {
		throw new Error(`User not found: ${id}`);
	}
	
	const oldBalance = parseFloat(user.balance) || 0;
	const amountToAdd = parseFloat(amount);
	
	console.log(`💰 Balance change: User ${id}, Old: ${oldBalance}, Adding: ${amountToAdd}`);
	
	// Atomic balance update to avoid race conditions under concurrency
	const result = await userRepository.increment(
		{ id: parseInt(id) },
		"balance",
		amountToAdd,
	);
	
	// Verify increment succeeded
	if (!result || result.affected === 0) {
		throw new Error(`Failed to update balance for user ${id}`);
	}
	
	// Get updated user to verify
	const updatedUser = await checkUserId(id);
	const newBalance = parseFloat(updatedUser.balance) || 0;
	
	console.log(`✅ Balance change successful: User ${id}, New: ${newBalance} (${oldBalance} + ${amountToAdd})`);
	
	return updatedUser;
};
