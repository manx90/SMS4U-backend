import { AppDataSource } from "../config/database.js";
import P3Country from "../models/P3Country.model.js";
import CacheService from "../services/CacheService.js";

export const p3CountryRepository =
	AppDataSource.getRepository(P3Country);

export const getAll = async () =>
	await p3CountryRepository.find({
		order: { name: "ASC" },
	});

export const getOne = async (id) =>
	await p3CountryRepository.findOne({
		where: { id: parseInt(id, 10) },
	});

export const getByCodeCountry = async (code) =>
	await p3CountryRepository.findOne({
		where: {
			code_country: String(code ?? "").trim(),
		},
	});

export const getByName = async (name) =>
	await p3CountryRepository.findOne({
		where: { name: String(name ?? "").trim() },
	});

export const create = async ({ name, code_country }) => {
	const row = p3CountryRepository.create({
		name: String(name).trim(),
		code_country: String(code_country).trim(),
	});
	const saved = await p3CountryRepository.save(row);
	CacheService.invalidate("p3_countries:all");
	return saved;
};
