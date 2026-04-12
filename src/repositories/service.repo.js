import { AppDataSource } from "../config/database.js";
import Service from "../models/Service.model.js";
import CacheService from "../services/CacheService.js";

export const serviceRepository =
	AppDataSource.getRepository(Service);

export const getAll = async () => {
	return await CacheService.get(
		"services:all",
		async () => {
			return await serviceRepository.find();
		},
	);
};
export const getOneById = async (id) =>
	await serviceRepository.findOneBy({
		id,
	});

export const getByCode = async (code) =>
	await serviceRepository.findOneBy({
		code,
	});

export const create = async (data) => {
	const existsByName = await checkServiceName(
		data.name,
	);
	if (existsByName)
		throw new Error("Service already exists");

	const existsByCode = await checkServiceCode(
		data.code,
	);
	if (existsByCode)
		throw new Error(
			"Service code already exists",
		);

	const existsP1 = data.provider1
		? await checkProvider1(data.provider1)
		: null;
	if (existsP1)
		throw new Error("provider1 already exists");
	const existsP2 = data.provider2
		? await checkProvider2(data.provider2)
		: null;
	if (existsP2)
		throw new Error("provider2 already exists");
	const newService =
		await serviceRepository.create({
			name: data.name,
			code: data.code,
			provider1: data.provider1 || "",
			provider2: data.provider2 || "",
		});
	const result = await serviceRepository.save(
		newService,
	);

	CacheService.invalidate("services:all");

	return result;
};

export const update = async (id, data) => {
	const svc = await getOneById(id);
	if (!svc) return new Error("Service not found");
	const updateData = {};
	if (data.name !== undefined)
		updateData.name = data.name;
	if (data.code !== undefined) {
		const existingService =
			await serviceRepository.findOne({
				where: { code: data.code },
			});
		if (
			existingService &&
			existingService.id !== parseInt(id)
		) {
			throw new Error(
				"Service code already exists",
			);
		}
		updateData.code = data.code;
	}
	if (data.provider1 !== undefined)
		updateData.provider1 = data.provider1;
	if (data.provider2 !== undefined)
		updateData.provider2 = data.provider2;
	await serviceRepository.update(id, updateData);

	CacheService.invalidate("services:all");
};

export const remove = async (id) => {
	try {
		const svc = await getOneById(id);
		if (!svc)
			throw new Error("Service not found");
		const result = await serviceRepository.remove(
			svc,
		);

		CacheService.invalidate("services:all");

		if (result) {
			return "Service removed successfully";
		}
	} catch (e) {
		throw new Error(e.message);
	}
};

const checkServiceName = async (name) =>
	await serviceRepository.findOne({
		where: { name },
	});
const checkServiceCode = async (code) =>
	await serviceRepository.findOne({
		where: { code },
	});
const checkProvider1 = async (provider1) =>
	await serviceRepository.findOne({
		where: { provider1 },
	});
const checkProvider2 = async (provider2) =>
	await serviceRepository.findOne({
		where: { provider2 },
	});
export const getServiceByProviderCode = async (
	provider,
	code,
) => {
	if (provider === "first")
		return await checkProvider1(code);
	return await checkProvider2(code);
};
