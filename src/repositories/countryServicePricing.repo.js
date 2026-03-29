import { Brackets } from "typeorm";
import { AppDataSource } from "../config/database.js";
import CountryServicePricingModel from "../models/CountryServicePricing.model.js";
import Country from "../models/Country.model.js";
import Service from "../models/Service.model.js";
import CacheService from "../services/CacheService.js";

export const countryServicePricingRepository =
	AppDataSource.getRepository(
		CountryServicePricingModel,
	);

/**
 * Strip LIKE wildcards so user input cannot broaden matches unintentionally.
 */
function sanitizeSearchInput(raw) {
	if (raw == null || typeof raw !== "string") return "";
	return raw.trim().replace(/[%_]/g, "");
}

function applyPricingSearchFilter(qb, search) {
	const term = sanitizeSearchInput(search);
	if (!term) return;

	const pattern = `%${term}%`;
	qb.andWhere(
		new Brackets((sub) => {
			sub
				.where("country.name LIKE :pattern", {
					pattern,
				})
				.orWhere("country.code_country LIKE :pattern", {
					pattern,
				})
				.orWhere("service.name LIKE :pattern", {
					pattern,
				})
				.orWhere("service.code LIKE :pattern", {
					pattern,
				})
				.orWhere("CAST(csp.provider1 AS CHAR) LIKE :pattern", {
					pattern,
				})
				.orWhere("CAST(csp.provider2 AS CHAR) LIKE :pattern", {
					pattern,
				})
				.orWhere("CAST(csp.provider3 AS CHAR) LIKE :pattern", {
					pattern,
				});
		}),
	);
}

// CRUD operations
export const getAll = async (
	page = 1,
	limit = 50,
	search = "",
) => {
	// Convert to numbers and ensure they are positive
	const pageNum = Math.max(1, parseInt(page) || 1);
	const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 50)); // Max 100 items per page
	const skip = (pageNum - 1) * limitNum;

	const qb = countryServicePricingRepository
		.createQueryBuilder("csp")
		.leftJoinAndSelect("csp.country", "country")
		.leftJoinAndSelect("csp.service", "service")
		.orderBy("csp.id", "ASC")
		.skip(skip)
		.take(limitNum);

	applyPricingSearchFilter(qb, search);

	return qb.getMany();
};

// Get total count of pricing records (optionally filtered)
export const getCount = async (search = "") => {
	const qb = countryServicePricingRepository
		.createQueryBuilder("csp")
		.leftJoin("csp.country", "country")
		.leftJoin("csp.service", "service");

	applyPricingSearchFilter(qb, search);

	return qb.getCount();
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
