import { AppDataSource } from "../config/database.js";
import P3Service from "../models/P3Service.model.js";
import CacheService from "../services/CacheService.js";

export const p3ServiceRepository =
	AppDataSource.getRepository(P3Service);

export const getAll = async () =>
	await p3ServiceRepository.find({
		order: { name: "ASC" },
	});

export const getOne = async (id) =>
	await p3ServiceRepository.findOne({
		where: { id: parseInt(id, 10) },
	});

export const getByCode = async (code) =>
	await p3ServiceRepository.findOne({
		where: { code: String(code ?? "").trim() },
	});

export const getByName = async (name) =>
	await p3ServiceRepository.findOne({
		where: { name: String(name ?? "").trim() },
	});

export const create = async ({ name, code }) => {
	const row = p3ServiceRepository.create({
		name: String(name).trim(),
		code: String(code).trim(),
	});
	const saved = await p3ServiceRepository.save(row);
	CacheService.invalidate("p3_services:all");
	return saved;
};
