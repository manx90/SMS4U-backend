import { AppDataSource } from "../config/database.js";
import CountryServicePricingModel from "../models/CountryServicePricing.model.js";
import Country from "../models/Country.model.js";
import Service from "../models/Service.model.js";
import CacheService from "../services/CacheService.js";

export const countryServicePricingRepository =
	AppDataSource.getRepository(
		CountryServicePricingModel,
	);

// CRUD operations
export const getAll = async (page = 1, limit = 50) => {
	// Convert to numbers and ensure they are positive
	const pageNum = Math.max(1, parseInt(page) || 1);
	const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 50)); // Max 100 items per page
	const skip = (pageNum - 1) * limitNum;

	// Don't use cache for paginated requests as cache key would be different for each page
	const data = await countryServicePricingRepository.find({
		relations: {
			country: true,
			service: true,
		},
		skip: skip,
		take: limitNum,
		order: {
			id: "ASC", // Order by ID for consistent pagination
		},
	});

	return data;
};

// Get total count of pricing records
export const getCount = async () => {
	return await countryServicePricingRepository.count();
};

export const getOne = async (id) =>
	await countryServicePricingRepository.findOne({
		where: { id },
		relations: {
			country: true,
			service: true,
		},
	});

export const getByCountryAndService = async (
	countryId,
	serviceId,
) => {
	const cacheKey = `pricing:country:${countryId}:service:${serviceId}`;
	return await CacheService.get(
		cacheKey,
		async () => {
			return await countryServicePricingRepository.findOne(
				{
					where: {
						country: { id: countryId },
						service: { id: serviceId },
					},
					relations: {
						country: true,
						service: true,
					},
				},
			);
		},
	);
};

export const getByCountry = async (countryId) => {
	const cacheKey = `pricing:country:${countryId}`;
	return await CacheService.get(
		cacheKey,
		async () => {
			return await countryServicePricingRepository.find(
				{
					where: { country: { id: countryId } },
					relations: {
						country: true,
						service: true,
					},
				},
			);
		},
	);
};

export const getByService = async (serviceId) => {
	const cacheKey = `pricing:service:${serviceId}`;
	return await CacheService.get(
		cacheKey,
		async () => {
			return await countryServicePricingRepository.find(
				{
					where: { service: { id: serviceId } },
					relations: {
						country: true,
						service: true,
					},
				},
			);
		},
	);
};

export const create = async (data) => {
	try {
		const pricing =
			countryServicePricingRepository.create(
				data,
			);
		const result =
			await countryServicePricingRepository.save(
				pricing,
			);

		// Invalidate pricing cache after creating new pricing
		CacheService.invalidatePattern("pricing:*");

		return result;
	} catch (error) {
		throw new Error(
			`Failed to create pricing: ${error.message}`,
		);
	}
};

export const update = async (id, data) => {
	const pricing = await getOne(id);
	if (!pricing)
		throw new Error("Pricing not found");

	await countryServicePricingRepository.update(
		id,
		data,
	);

	// Invalidate pricing cache after updating pricing
	CacheService.invalidatePattern("pricing:*");

	return await getOne(id);
};

export const remove = async (id) => {
	const pricing = await getOne(id);
	if (!pricing)
		throw new Error("Pricing not found");

	await countryServicePricingRepository.delete(
		id,
	);

	// Invalidate pricing cache after removing pricing
	CacheService.invalidatePattern("pricing:*");

	return pricing;
};

export const removeByCountryAndService = async (
	countryId,
	serviceId,
) => {
	const pricing = await getByCountryAndService(
		countryId,
		serviceId,
	);
	if (!pricing)
		throw new Error("Pricing not found");

	await countryServicePricingRepository.delete(
		pricing.id,
	);

	// Invalidate pricing cache after removing pricing
	CacheService.invalidatePattern("pricing:*");

	return pricing;
};

// Validation functions
export const validateCountryExists = async (
	countryId,
) => {
	try {
		const countryRepository =
			AppDataSource.getRepository(Country);
		const country =
			await countryRepository.findOne({
				where: { id: countryId },
			});
		return !!country;
	} catch (error) {
		console.error(
			"Error validating country:",
			error,
		);
		return false;
	}
};

export const validateServiceExists = async (
	serviceId,
) => {
	try {
		const serviceRepository =
			AppDataSource.getRepository(Service);
		const service =
			await serviceRepository.findOne({
				where: { id: serviceId },
			});
		return !!service;
	} catch (error) {
		console.error(
			"Error validating service:",
			error,
		);
		return false;
	}
};
