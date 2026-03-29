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
 * Stable order so "Server N" / query param `server` always maps to the same row.
 */
function sortOperatorRows(rows) {
	return [...rows].sort((a, b) => {
		const ca = String(a.ccode || "").localeCompare(
			String(b.ccode || ""),
		);
		if (ca !== 0) return ca;
		return String(a.operator || "").localeCompare(
			String(b.operator || ""),
		);
	});
}

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
	let filtered = rows;
	if (q) {
		const upper = q.toUpperCase();
		filtered = rows.filter((r) => {
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
	}
	return sortOperatorRows(filtered);
};

/**
 * Resolve 1-based index to real operator id for Provider 3 API (same list as findOperatorsForCountry).
 */
export const resolveOperatorByIndex = async (
	serviceCode,
	interval,
	countryParam,
	index1Based,
) => {
	const list = await findOperatorsForCountry(
		serviceCode,
		interval,
		countryParam,
	);
	const n = parseInt(String(index1Based), 10);
	if (
		!Number.isFinite(n) ||
		n < 1 ||
		n > list.length
	) {
		throw new Error(
			list.length === 0
				? "No operators available for this country and service (run access sync)"
				: `Invalid operator index (use 1–${list.length})`,
		);
	}
	const op = String(list[n - 1].operator || "").trim();
	if (!op) {
		throw new Error("Operator entry is empty");
	}
	return op;
};
