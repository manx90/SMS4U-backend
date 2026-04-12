import { AppDataSource } from "../config/database.js";
import Country from "../models/Country.model.js";
import CacheService from "../services/CacheService.js";

export const countryRepository =
	AppDataSource.getRepository(Country);

export const getAll = async () => {
	return await CacheService.get(
		"countries:all",
		async () => {
			return await countryRepository.find();
		},
	);
};
export const getOne = async (id) =>
	await countryRepository.findOne({
		where: { id: parseInt(id) },
	});

export const getByCodeCountry = async (code_country) =>
	await countryRepository.findOne({
		where: {
			code_country: String(code_country ?? "").trim(),
		},
	});

export const create = async ({
	country,
	code_country,
	provider1,
	provider2,
}) => {
	const existingByName = await checkCountryName(
		country,
	);
	if (existingByName)
		throw new Error(
			"Country name already exists",
		);

	const existingByCode = await checkCountryCode(
		code_country,
	);
	if (existingByCode)
		throw new Error(
			"Country code already exists",
		);

	if (provider1) {
		const existingP1 =
			await checkCountryProvider1(provider1);
		if (existingP1)
			throw new Error(
				"provider1 already exists for another country",
			);
	}

	if (provider2) {
		const existingP2 =
			await checkCountryProvider2(provider2);
		if (existingP2)
			throw new Error(
				"provider2 already exists for another country",
			);
	}

	const dataCreate = {
		name: country,
		code_country,
		provider1,
		provider2,
	};

	const result = await countryRepository.save(
		dataCreate,
	);

	CacheService.invalidate("countries:all");

	return result;
};

export const update = async (
	id,
	{ country, code_country, provider1, provider2 },
) => {
	const existing = await getOne(id);
	if (!existing)
		throw new Error("Country not found");

	const parsedId = parseInt(id, 10);

	if (
		country !== undefined &&
		country !== null &&
		String(country).trim() !== existing.name
	) {
		const other = await countryRepository.findOne({
			where: { name: String(country).trim() },
		});
		if (other && other.id !== parsedId)
			throw new Error(
				"Country name already exists",
			);
	}

	if (
		code_country !== undefined &&
		code_country !== null &&
		String(code_country).trim() !==
			existing.code_country
	) {
		const other = await countryRepository.findOne({
			where: {
				code_country: String(
					code_country,
				).trim(),
			},
		});
		if (other && other.id !== parsedId)
			throw new Error(
				"Country code already exists",
			);
	}

	if (
		provider1 !== undefined &&
		provider1 !== null &&
		String(provider1) !== String(existing.provider1)
	) {
		const other =
			await checkCountryProvider1(provider1);
		if (other && other.id !== parsedId)
			throw new Error(
				"provider1 already exists for another country",
			);
	}

	if (
		provider2 !== undefined &&
		provider2 !== null &&
		String(provider2) !== String(existing.provider2)
	) {
		const other =
			await checkCountryProvider2(provider2);
		if (other && other.id !== parsedId)
			throw new Error(
				"provider2 already exists for another country",
			);
	}

	const updateData = {};
	if (country !== undefined)
		updateData.name = String(country).trim();
	if (code_country !== undefined)
		updateData.code_country =
			String(code_country).trim();
	if (provider1 !== undefined)
		updateData.provider1 = provider1;
	if (provider2 !== undefined)
		updateData.provider2 = provider2;

	await countryRepository.update(parsedId, updateData);

	CacheService.invalidate("countries:all");

	return { ...existing, ...updateData };
};

export const remove = async (id) => {
	const parsedId = Number(id);
	if (Number.isNaN(parsedId)) {
		throw new Error("Invalid ID");
	}

	const country = await countryRepository.findOne(
		{
			where: { id: parsedId },
		},
	);

	if (!country) {
		throw new Error("Country not found");
	}

	await countryRepository.remove(country);

	CacheService.invalidate("countries:all");

	return country;
};

const checkCountryName = async (CountryName) =>
	await countryRepository.findOne({
		where: { name: CountryName },
	});
const checkCountryProvider1 = async (provider1) =>
	await countryRepository.findOne({
		where: { provider1 },
	});
const checkCountryProvider2 = async (provider2) =>
	await countryRepository.findOne({
		where: { provider2 },
	});
const checkCountryCode = async (code_country) =>
	await countryRepository.findOne({
		where: { code_country },
	});

export const getCountryByProviderCode = async (
	provider,
	code,
) => {
	if (provider === "first") {
		return await checkCountryProvider1(code);
	}
	return await checkCountryProvider2(code);
};
