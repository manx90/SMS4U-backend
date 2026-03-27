import { AppDataSource } from "../config/database.js";
import Provider3AccessSnapshot from "../models/Provider3AccessSnapshot.model.js";

export const provider3AccessRepository =
	AppDataSource.getRepository(Provider3AccessSnapshot);

/**
 * Replace all snapshot rows for a service + interval with fresh accessinfo data.
 */
export const replaceSnapshotsForService = async (
	serviceCode,
	serviceApiName,
	interval,
	dataRows,
) => {
	await provider3AccessRepository.delete({
		serviceCode,
		snapshotInterval: interval,
	});

	if (!dataRows?.length) return 0;

	const entities = dataRows.map((row) =>
		provider3AccessRepository.create({
			serviceCode,
			serviceApiName: serviceApiName || null,
			snapshotInterval: interval,
			ccode: String(row.ccode || "").trim(),
			countryName: row.country
				? String(row.country).trim()
				: null,
			operator: String(row.operator || "").trim(),
			accessCount:
				parseInt(row.access_count, 10) || 0,
		}),
	);

	const saved = await provider3AccessRepository.save(
		entities,
	);
	return saved.length;
};

export const findByServiceAndInterval = async (
	serviceCode,
	interval,
) => {
	return await provider3AccessRepository.find({
		where: {
			serviceCode,
			snapshotInterval: interval,
		},
		order: { accessCount: "DESC" },
	});
};

/**
 * @param {string} countryParam - ISO ccode (IT), partial country name, or resolved provider3 from country id (see service.route)
 */
export const findOperatorsForCountry = async (
	serviceCode,
	interval,
	countryParam,
) => {
	const rows = await findByServiceAndInterval(
		serviceCode,
		interval,
	);
	const q = String(countryParam || "").trim();
	if (!q) return rows;

	const upper = q.toUpperCase();
	return rows.filter((r) => {
		if (
			r.ccode &&
			r.ccode.toUpperCase() === upper
		) {
			return true;
		}
		if (
			r.countryName &&
			r.countryName
				.toLowerCase()
				.includes(q.toLowerCase())
		) {
			return true;
		}
		return false;
	});
};
