import {
	getOne as getP3CountryById,
	getByCodeCountry as getP3CountryByCode,
	getAll as getAllP3Countries,
} from "../repositories/p3Country.repo.js";
import { getByCode as getP3ServiceByCode } from "../repositories/p3Service.repo.js";
import { getByCountryAndService } from "../repositories/provider3CountryService.repo.js";

/** اسم الخدمة عند المزوّد (مثل WhatsApp) لاستدعاء accessinfo عند غياب اللقطات المحلية */
export async function resolveUpstreamServiceNameForP3(
	countryQuery,
	serviceCode,
) {
	const svc = await getP3ServiceByCode(
		String(serviceCode),
	);
	if (!svc) return "";

	const q = String(countryQuery ?? "").trim();
	if (!q) return "";

	let countryFind =
		(await getP3CountryByCode(q)) ||
		(await getP3CountryByCode(q.toUpperCase()));
	if (!countryFind && /^\d+$/.test(q)) {
		countryFind = await getP3CountryById(
			parseInt(q, 10),
		);
	}
	if (!countryFind) {
		const all = await getAllP3Countries();
		countryFind =
			all.find((c) => c.name === q) ||
			all.find(
				(c) =>
					String(c.name || "").toLowerCase() ===
					q.toLowerCase(),
			);
	}
	if (!countryFind) return "";

	const cfg = await getByCountryAndService(
		countryFind.id,
		svc.id,
	);
	if (!cfg) return "";
	const n = cfg.upstreamServiceName?.trim();
	return n || String(svc.name || "").trim();
}

export async function resolveCountryFilterForProvider3(
	countryQuery,
	serviceCode,
) {
	let countryFilter = String(countryQuery ?? "").trim();
	if (!countryFilter) return countryFilter;

	if (/^\d+$/.test(countryFilter) && serviceCode) {
		const svc = await getP3ServiceByCode(
			String(serviceCode),
		);
		let cRow = await getP3CountryByCode(countryFilter);
		if (!cRow) {
			cRow = await getP3CountryById(
				parseInt(countryFilter, 10),
			);
		}
		if (cRow && svc) {
			const cfg = await getByCountryAndService(
				cRow.id,
				svc.id,
			);
			const p3 = cfg?.upstreamCountryCode?.trim();
			if (p3) countryFilter = p3;
			else if (cRow.code_country?.trim()) {
				countryFilter = cRow.code_country.trim();
			}
		}
	} else if (/^\d+$/.test(countryFilter)) {
		let cRow = await getP3CountryByCode(countryFilter);
		if (!cRow) {
			cRow = await getP3CountryById(
				parseInt(countryFilter, 10),
			);
		}
		if (cRow) {
			if (cRow.code_country?.trim()) {
				countryFilter = cRow.code_country.trim();
			}
		}
	}
	return countryFilter;
}
