import {
	getOne as getCountryById,
	getByCodeCountry,
} from "../repositories/country.repo.js";
import { getByCode as getServiceByCode } from "../repositories/service.repo.js";
import { getByCountryAndService } from "../repositories/provider3CountryService.repo.js";

export async function resolveCountryFilterForProvider3(
	countryQuery,
	serviceCode,
) {
	let countryFilter = String(countryQuery ?? "").trim();
	if (!countryFilter) return countryFilter;

	if (/^\d+$/.test(countryFilter) && serviceCode) {
		const svc = await getServiceByCode(
			String(serviceCode),
		);
		let cRow = await getByCodeCountry(countryFilter);
		if (!cRow) {
			cRow = await getCountryById(
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
		let cRow = await getByCodeCountry(countryFilter);
		if (!cRow) {
			cRow = await getCountryById(
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
