import { AppDataSource } from "../config/database.js";
import Provider3CountryServiceConfig from "../models/Provider3CountryServiceConfig.model.js";
import CacheService from "../services/CacheService.js";

export const provider3ConfigRepository =
	AppDataSource.getRepository(
		Provider3CountryServiceConfig,
	);

const cacheKey = (p3CountryId, p3ServiceId) =>
	`p3config:${p3CountryId}:${p3ServiceId}`;

export const getByCountryAndService = async (
	p3CountryId,
	p3ServiceId,
) => {
	const key = cacheKey(p3CountryId, p3ServiceId);
	return await CacheService.get(key, async () => {
		return await provider3ConfigRepository.findOne({
			where: {
				p3Country: { id: p3CountryId },
				p3Service: { id: p3ServiceId },
			},
			relations: { p3Country: true, p3Service: true },
		});
	});
};

export const getAllWithRelations = async () => {
	return await provider3ConfigRepository.find({
		relations: { p3Country: true, p3Service: true },
		order: { id: "ASC" },
	});
};

export const getOne = async (id) =>
	await provider3ConfigRepository.findOne({
		where: { id: parseInt(id, 10) },
		relations: { p3Country: true, p3Service: true },
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

export const getConfiguredCountries = async () => {
	const all = await getAllWithRelations();
	const byId = new Map();
	for (const row of all) {
		const c = row.p3Country;
		if (c?.id == null) continue;
		if (!byId.has(c.id)) {
			byId.set(c.id, {
				id: c.id,
				name: c.name,
				code_country: c.code_country,
			});
		}
	}
	return Array.from(byId.values()).sort((a, b) =>
		String(a.name || "").localeCompare(
			String(b.name || ""),
		),
	);
};

export const getConfiguredServicesForCountry = async (
	countryId,
) => {
	const cid = parseInt(countryId, 10);
	if (!Number.isFinite(cid)) {
		throw new Error("Invalid countryId");
	}
	const all = await getAllWithRelations();
	return all
		.filter((r) => r.p3Country?.id === cid)
		.map((r) => ({
			configId: r.id,
			serviceId: r.p3Service?.id,
			serviceCode: r.p3Service?.code,
			serviceName: r.p3Service?.name,
			price: r.price,
			upstreamCountryCode: r.upstreamCountryCode,
			upstreamServiceName: r.upstreamServiceName,
		}));
};

/** Every P3 service with all countries where it is configured (pricing rows). */
export const getCatalogServicesGroupedByService = async () => {
	const all = await getAllWithRelations();
	const byServiceId = new Map();
	for (const r of all) {
		const svc = r.p3Service;
		const c = r.p3Country;
		if (!svc?.id || !c?.id) continue;
		if (!byServiceId.has(svc.id)) {
			byServiceId.set(svc.id, {
				serviceId: svc.id,
				serviceCode: svc.code,
				serviceName: svc.name,
				countries: [],
			});
		}
		byServiceId.get(svc.id).countries.push({
			countryId: c.id,
			countryName: c.name,
			code_country: c.code_country,
			configId: r.id,
			price: r.price,
			upstreamCountryCode: r.upstreamCountryCode,
			upstreamServiceName: r.upstreamServiceName,
		});
	}
	const list = Array.from(byServiceId.values());
	for (const item of list) {
		item.countries.sort((a, b) =>
			String(a.countryName || "").localeCompare(
				String(b.countryName || ""),
			),
		);
	}
	return list.sort((a, b) =>
		String(a.serviceName || "").localeCompare(
			String(b.serviceName || ""),
		),
	);
};

/** Public catalog: only serviceCode + countryName + code_country per row. */
export const getCatalogServicesPublic = async () => {
	const all = await getAllWithRelations();
	const byServiceCode = new Map();
	for (const r of all) {
		const svc = r.p3Service;
		const c = r.p3Country;
		if (!svc?.code || !c) continue;
		const sc = String(svc.code).trim();
		if (!byServiceCode.has(sc)) {
			byServiceCode.set(sc, {
				serviceCode: sc,
				countries: [],
			});
		}
		const bucket = byServiceCode.get(sc);
		const cc = String(c.code_country || "").trim();
		const exists = bucket.countries.some(
			(x) =>
				String(x.code_country || "")
					.toLowerCase() === cc.toLowerCase(),
		);
		if (!exists) {
			bucket.countries.push({
				countryName: String(c.name || "").trim(),
				code_country: cc,
			});
		}
	}
	const list = Array.from(byServiceCode.values());
	for (const item of list) {
		item.countries.sort((a, b) =>
			String(a.countryName || "").localeCompare(
				String(b.countryName || ""),
			),
		);
	}
	return list.sort((a, b) =>
		String(a.serviceCode || "").localeCompare(
			String(b.serviceCode || ""),
		),
	);
};

export const getCatalogServicesPublicForCountry = async (
	countryId,
) => {
	const cid = parseInt(countryId, 10);
	if (!Number.isFinite(cid)) {
		throw new Error("Invalid countryId");
	}
	const all = await getAllWithRelations();
	const byServiceCode = new Map();
	for (const r of all) {
		if (r.p3Country?.id !== cid) continue;
		const svc = r.p3Service;
		const c = r.p3Country;
		if (!svc?.code || !c) continue;
		const sc = String(svc.code).trim();
		if (!byServiceCode.has(sc)) {
			byServiceCode.set(sc, {
				serviceCode: sc,
				countries: [],
			});
		}
		const bucket = byServiceCode.get(sc);
		const cc = String(c.code_country || "").trim();
		const exists = bucket.countries.some(
			(x) =>
				String(x.code_country || "")
					.toLowerCase() === cc.toLowerCase(),
		);
		if (!exists) {
			bucket.countries.push({
				countryName: String(c.name || "").trim(),
				code_country: cc,
			});
		}
	}
	return Array.from(byServiceCode.values()).sort((a, b) =>
		String(a.serviceCode || "").localeCompare(
			String(b.serviceCode || ""),
		),
	);
};

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
			.innerJoin("cfg.p3Service", "srv")
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
