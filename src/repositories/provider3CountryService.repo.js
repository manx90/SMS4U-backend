import { AppDataSource } from "../config/database.js";
import Provider3CountryServiceConfig from "../models/Provider3CountryServiceConfig.model.js";
import CacheService from "../services/CacheService.js";

export const provider3ConfigRepository =
	AppDataSource.getRepository(
		Provider3CountryServiceConfig,
	);

const cacheKey = (countryId, serviceId) =>
	`p3config:${countryId}:${serviceId}`;

export const getByCountryAndService = async (
	countryId,
	serviceId,
) => {
	const key = cacheKey(countryId, serviceId);
	return await CacheService.get(key, async () => {
		return await provider3ConfigRepository.findOne({
			where: {
				country: { id: countryId },
				service: { id: serviceId },
			},
			relations: { country: true, service: true },
		});
	});
};

export const getAllWithRelations = async () => {
	return await provider3ConfigRepository.find({
		relations: { country: true, service: true },
		order: { id: "ASC" },
	});
};

export const getOne = async (id) =>
	await provider3ConfigRepository.findOne({
		where: { id: parseInt(id, 10) },
		relations: { country: true, service: true },
	});

export const create = async (data) => {
	const row = provider3ConfigRepository.create(data);
	const saved = await provider3ConfigRepository.save(
		row,
	);
	CacheService.invalidatePattern("p3config:*");
	return saved;
};

export const update = async (id, data) => {
	const existing = await getOne(id);
	if (!existing) throw new Error("Config not found");
	await provider3ConfigRepository.update(
		parseInt(id, 10),
		data,
	);
	CacheService.invalidatePattern("p3config:*");
	return await getOne(id);
};

export const remove = async (id) => {
	const row = await getOne(id);
	if (!row) throw new Error("Config not found");
	await provider3ConfigRepository.delete(
		parseInt(id, 10),
	);
	CacheService.invalidatePattern("p3config:*");
	return row;
};

/** One upstream service name per service code for /accessinfo cron. */
export const getDistinctServicesForAccessSync =
	async () => {
		const raw = await provider3ConfigRepository
			.createQueryBuilder("cfg")
			.select("srv.id", "serviceId")
			.addSelect("srv.code", "serviceCode")
			.addSelect(
				"MIN(cfg.upstreamServiceName)",
				"upstreamServiceName",
			)
			.innerJoin("cfg.service", "srv")
			.groupBy("srv.id")
			.addGroupBy("srv.code")
			.getRawMany();
		return raw.map((r) => ({
			serviceId: r.serviceId,
			serviceCode: r.serviceCode,
			upstreamServiceName: String(
				r.upstreamServiceName || "",
			).trim(),
		}));
	};
