import { AppDataSource } from "../config/database.js";
import Provider3AccessSnapshot from "../models/Provider3AccessSnapshot.model.js";
import upstream from "../modules/provider3/services/upstream.service.js";

const liveAccessCache = new Map();
const LIVE_ACCESS_TTL_MS = 60_000;

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

function filterRowsByCountryParam(rows, countryParam) {
	const q = String(countryParam || "").trim();
	let filtered = rows;
	if (q) {
		const upper = q.toUpperCase();
		const isoAlpha2 = /^[A-Za-z]{2}$/.test(q);
		filtered = rows.filter((r) => {
			if (
				r.ccode &&
				r.ccode.toUpperCase() === upper
			) {
				return true;
			}
			if (isoAlpha2) {
				return false;
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
	return filterRowsByCountryParam(rows, countryParam);
};

/**
 * إن لم تُملأ اللقطات بعد access-sync، جلب accessinfo من المزوّد (مع تخزين مؤقت قصير).
 */
export const findOperatorsForCountryWithFallback = async (
	serviceCode,
	interval,
	countryParam,
	upstreamServiceName,
) => {
	const fromDb = await findOperatorsForCountry(
		serviceCode,
		interval,
		countryParam,
	);
	if (fromDb.length > 0) {
		console.log(
			"[P3 operators] snapshot hit",
			`serviceCode=${String(serviceCode)} countryFilter=${String(countryParam)} matched=${fromDb.length}`,
		);
		return fromDb;
	}

	const snapTotal = await findByServiceAndInterval(
		serviceCode,
		interval,
	);
	const apiName = String(
		upstreamServiceName ?? "",
	).trim();
	console.log(
		"[P3 operators] snapshot empty → live accessinfo if possible",
		`serviceCode=${String(serviceCode)} countryFilter=${String(countryParam)} upstreamName="${apiName || "(empty)"}" interval=${String(interval)} snapshotTableRows=${snapTotal.length}`,
	);
	if (!apiName) {
		console.log(
			"[P3 operators] skip live: no upstreamServiceName (check provider3_country_service_config for this country+service)",
		);
		return fromDb;
	}

	try {
		upstream.assertConfigured();
		const cacheKey = `${apiName}|${String(interval)}`;
		let entry = liveAccessCache.get(cacheKey);
		const cacheHit =
			entry &&
			Date.now() - entry.at <= LIVE_ACCESS_TTL_MS;
		if (!cacheHit) {
			const raw = await upstream.fetchAccessInfo(
				apiName,
				interval,
			);
			entry = { raw, at: Date.now() };
			liveAccessCache.set(cacheKey, entry);
		} else {
			console.log(
				"[P3 operators] using cached accessinfo",
				`key=${cacheKey} ageMs=${Date.now() - entry.at}`,
			);
		}
		const arr = Array.isArray(entry.raw?.data)
			? entry.raw.data
			: [];
		const mapped = arr.map((row) => ({
			ccode: String(row.ccode || "").trim(),
			countryName: row.country
				? String(row.country).trim()
				: null,
			operator: String(row.operator || "").trim(),
			accessCount:
				parseInt(row.access_count, 10) || 0,
		}));
		const afterFilter = filterRowsByCountryParam(
			mapped,
			countryParam,
		);
		const sampleCc = [
			...new Set(
				mapped
					.slice(0, 8)
					.map((r) => r.ccode)
					.filter(Boolean),
			),
		].join(",");
		console.log(
			"[P3 operators] after country filter",
			`countryParam="${String(countryParam)}" rawRows=${arr.length} matched=${afterFilter.length} sampleCcodes=[${sampleCc}]`,
		);
		if (afterFilter.length === 0 && arr.length > 0) {
			console.log(
				"[P3 operators] hint: no row for this ccode — check p3 config upstreamCountryCode vs accessinfo ccode (e.g. ET vs 0)",
			);
		}
		return afterFilter;
	} catch (err) {
		console.error(
			"[P3 operators] live accessinfo failed (check third_NUMBER_API_URL must end with /api and token)",
			err?.message || err,
		);
		return fromDb;
	}
};

/**
 * Resolve 1-based index to real operator id for Provider 3 API (same list as findOperatorsForCountry).
 */
export const resolveOperatorByIndex = async (
	serviceCode,
	interval,
	countryParam,
	index1Based,
	upstreamServiceName = null,
) => {
	const list = await findOperatorsForCountryWithFallback(
		serviceCode,
		interval,
		countryParam,
		upstreamServiceName,
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
