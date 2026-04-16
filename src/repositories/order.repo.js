import { AppDataSource } from "../config/database.js";
import secondNumberServices from "../api/second-Number.service.js";
import firstNumberServices from "../api/first-Number.service.js";
import provider3Upstream from "../modules/provider3/services/upstream.service.js";
import OrderModel from "../models/Order.model.js";
import { userRepository } from "./user.repo.js";
import { serviceRepository } from "./service.repo.js";
import { countryRepository } from "./country.repo.js";
import { getByCountryAndService } from "./countryServicePricing.repo.js";
import { getByCountryAndService as getP3Config } from "./provider3CountryService.repo.js";
import { balanceChange } from "./user.repo.js";
import CacheService from "../services/CacheService.js";
export const orderRepository =
	AppDataSource.getRepository(OrderModel);

// crud
export const getAll = async () =>
	await orderRepository.find({
		relations: {
			user: true,
			service: true,
			country: true,
		},
	});
export const getOne = async (id) =>
	await orderRepository.findOne({
		where: { id },
		relations: {
			user: true,
			service: true,
			country: true,
		},
	});
export const getByUserApiKey = async (apiKey) => {
	const user = await userRepository.findOne({
		where: { apiKey },
	});
	if (!user) throw new Error("User not found");
	return await orderRepository.find({
		where: { user: { id: user.id } },
		relations: {
			user: true,
			service: true,
			country: true,
		},
	});
};
export const getByNumberForUser = async (
	apiKey,
	number,
) => {
	const user = await userRepository.findOne({
		where: { apiKey },
	});
	if (!user) throw new Error("User not found");
	const order = await orderRepository.findOne({
		where: { number, user: { id: user.id } },
		relations: {
			user: true,
			service: true,
			country: true,
		},
	});
	if (!order)
		throw new Error(
			"Order not found or has expired",
		);
	return order;
};

export const getByPublicId = async (
	apiKey,
	publicId,
) => {
	const user = await userRepository.findOne({
		where: { apiKey },
	});
	if (!user) throw new Error("User not found");
	const order = await orderRepository.findOne({
		where: { publicId, user: { id: user.id } },
		relations: {
			user: true,
			service: true,
			country: true,
		},
	});
	if (!order)
		throw new Error(
			"Order not found or has expired",
		);
	return order;
};

export const getEmailOrderForUser = async (
	apiKey,
	{ publicId, email },
) => {
	const user = await userRepository.findOne({
		where: { apiKey },
	});
	if (!user) throw new Error("User not found");
	if (!publicId && !email) {
		throw new Error(
			"Order publicId or email must be provided",
		);
	}
	const whereClause = {
		user: { id: user.id },
		typeServe: "email",
		// Allow reordering orders in any status
	};
	if (publicId) {
		whereClause.publicId = publicId;
	}
	if (email) {
		whereClause.email = email;
	}
	const order = await orderRepository.findOne({
		where: whereClause,
		relations: {
			user: true,
			service: true,
			country: true,
		},
	});
	if (!order) {
		throw new Error("Email order not found");
	}
	return order;
};

export const createProvider3Order = async (
	apiKey,
	countryParam,
	serviceParam,
	operatorForThird,
) => {
	try {
		const { user, service, country, cfg, price } =
			await resolveUserCountryServiceP3(
				apiKey,
				countryParam,
				serviceParam,
			);

		if (
			operatorForThird == null ||
			String(operatorForThird).trim() === ""
		) {
			throw new Error(
				"operator is required for provider 3",
			);
		}

		const ccode = cfg.upstreamCountryCode;
		if (!ccode || String(ccode).trim() === "") {
			throw new Error(
				"Provider 3 is not configured for this country and service",
			);
		}

		await checkBalanceDiff(user, { price });

		const number =
			await provider3Upstream.getMobileNumber(
				String(ccode).trim(),
				String(operatorForThird).trim(),
				1,
			);

		const providerId = 3;

		// Create order and atomically deduct balance inside a single transaction
		let savedOrder = null;
		await AppDataSource.transaction(
			async (manager) => {
				// Atomic conditional debit to prevent race conditions
				const debitResult = await manager
					.createQueryBuilder()
					.update("User")
					.set({
						balance: () => "balance - :price",
					})
					.where("id = :id", { id: user.id })
					.andWhere("balance >= :price", {
						price,
					})
					.execute();
				if (!debitResult?.affected) {
					throw new Error(
						"Your balance is insufficient for this purchase",
					);
				}

				const orderRepoTx =
					manager.getRepository(OrderModel);
				const orderEntity = orderRepoTx.create({
					user,
					service,
					country: country,
					price,
					typeServe: "number",
					status: "pending",
					number,
					provider: providerId,
					publicId: generatePublicOrderId(),
				});
				savedOrder = await orderRepoTx.save(
					orderEntity,
				);
			},
		);

		return savedOrder;
	} catch (e) {
		const err = new Error(
			e?.message || String(e),
		);
		if (e?.stack) err.stack = e.stack;
		if (e?.code) err.code = e.code;
		throw err;
	}
};

export const create = async (
	apiKey,
	countryParam,
	serviceParam,
	provider = "second",
) => {
	try {
		const providerNum = provider === "first" ? 1 : 2;
		const { user, service, country, pricing } =
			await resolveUserCountryService(
				apiKey,
				countryParam,
				serviceParam,
				providerNum,
			);

		await checkBalanceDiff(user, pricing);

		let number;
		if (provider === "first") {
			number = await firstNumberServices.getMobileNumber(
				country.provider1,
				service.provider1,
			);
		} else {
			number = await secondNumberServices.getMobileNumber(
				country.provider2,
				service.provider2,
			);
		}

		const price = pricing?.price;

		const providerId = provider === "first" ? 1 : 2;

		let savedOrder = null;
		await AppDataSource.transaction(
			async (manager) => {
				const debitResult = await manager
					.createQueryBuilder()
					.update("User")
					.set({
						balance: () => "balance - :price",
					})
					.where("id = :id", { id: user.id })
					.andWhere("balance >= :price", {
						price,
					})
					.execute();
				if (!debitResult?.affected) {
					throw new Error(
						"Your balance is insufficient for this purchase",
					);
				}

				const orderRepoTx =
					manager.getRepository(OrderModel);
				const orderEntity = orderRepoTx.create({
					user,
					service,
					country: country,
					price,
					typeServe: "number",
					status: "pending",
					number,
					provider: providerId,
					publicId: generatePublicOrderId(),
				});
				savedOrder = await orderRepoTx.save(
					orderEntity,
				);
			},
		);

		return savedOrder;
	} catch (e) {
		const err = new Error(
			e?.message || String(e),
		);
		if (e?.stack) err.stack = e.stack;
		if (e?.code) err.code = e.code;
		throw err;
	}
};

export const update = async (id, data) => {
	const exists = await orderRepository.exist({
		where: { id },
	});
	if (!exists) throw new Error("Order not found");
	await orderRepository.update(id, data);
};
export const remove = async (id) => {
	const order = await getOne(id);
	if (!order) throw new Error("Order not found");
	await orderRepository.delete(id);
};
// utils

const generatePublicOrderId = () => {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "";
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(
			Math.floor(Math.random() * chars.length),
		);
	}
	return result;
};

const resolveUserCountryService = async (
	apiKey,
	countryParam,
	serviceParam,
	provider,
) => {
	// Only user lookup hits database - everything else uses cache
	const user = await userRepository.findOne({
		where: { apiKey },
	});
	if (!user) throw new Error("User not found");

	// Get cached countries and services
	const [countries, services] = await Promise.all(
		[
			CacheService.get(
				"countries:all",
				async () => {
					return await countryRepository.find();
				},
			),
			CacheService.get(
				"services:all",
				async () => {
					return await serviceRepository.find();
				},
			),
		],
	);

	// ✅ FIX: Search by code_country FIRST (most likely input)
	// Then try by name, finally try by ID (least likely)
	let countryFind = countries.find(
		(c) =>
			c.code_country === String(countryParam),
	);
	
	// Then try by name
	if (!countryFind) {
		countryFind = countries.find(
			(c) => c.name === String(countryParam),
		);
	}
	
	// Finally try by ID (least likely)
	if (!countryFind) {
		countryFind = countries.find(
			(c) => c.id === parseInt(countryParam),
		);
	}
	
	if (!countryFind)
		throw new Error("Country not found");

	// Find service by code only from cached data
	let serviceFind = services.find(
		(s) => s.code === String(serviceParam),
	);
	if (!serviceFind)
		throw new Error("Service not found");

	// Get pricing for this country-service combination (uses cache)
	const pricing = await getByCountryAndService(
		countryFind.id,
		serviceFind.id,
	);
	if (!pricing) {
		throw new Error(
			`No pricing found for ${countryParam} - ${serviceParam} combination`,
		);
	}

	let price;
	if (provider === 1) {
		price = pricing.provider1;
	} else {
		price = pricing.provider2;
	}

	return {
		user,
		country: countryFind,
		service: serviceFind,
		pricing: { ...pricing, price },
	};
};

const resolveUserCountryServiceP3 = async (
	apiKey,
	countryParam,
	serviceParam,
) => {
	const user = await userRepository.findOne({
		where: { apiKey },
	});
	if (!user) throw new Error("User not found");

	const [countries, services] = await Promise.all(
		[
			CacheService.get(
				"countries:all",
				async () => {
					return await countryRepository.find();
				},
			),
			CacheService.get(
				"services:all",
				async () => {
					return await serviceRepository.find();
				},
			),
		],
	);

	let countryFind = countries.find(
		(c) =>
			c.code_country === String(countryParam),
	);
	if (!countryFind) {
		countryFind = countries.find(
			(c) => c.name === String(countryParam),
		);
	}
	if (!countryFind) {
		countryFind = countries.find(
			(c) => c.id === parseInt(countryParam),
		);
	}
	if (!countryFind)
		throw new Error("Country not found");

	let serviceFind = services.find(
		(s) => s.code === String(serviceParam),
	);
	if (!serviceFind)
		throw new Error("Service not found");

	const cfg = await getP3Config(
		countryFind.id,
		serviceFind.id,
	);
	if (!cfg) {
		throw new Error(
			"No provider 3 configuration for this country and service",
		);
	}

	const price = parseFloat(cfg.price);
	if (!Number.isFinite(price) || price < 0) {
		throw new Error(
			"Invalid provider 3 price for this country and service",
		);
	}

	return {
		user,
		country: countryFind,
		service: serviceFind,
		cfg,
		price,
	};
};

const checkBalanceDiff = async (
	user,
	pricing,
) => {
	const userBalance = parseFloat(user?.balance);
	const pricePerMessage = parseFloat(
		pricing?.price,
	);

	// Allow equal balance to pass; only throw if balance is less than price
	if (userBalance < pricePerMessage) {
		throw new Error(
			"Your balance is insufficient for this purchase",
		);
	}
};
