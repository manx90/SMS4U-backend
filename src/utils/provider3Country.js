import {
	getOne as getCountryById,
	getByCodeCountry,
} from "../repositories/country.repo.js";

/**
 * Resolve query `country` the same way as /service/provider3/operators
 * (numeric id → provider3 or code_country).
 */
export async function resolveCountryFilterForProvider3(
	countryQuery,
) {
	let countryFilter = String(countryQuery ?? "").trim();
	if (!countryFilter) return countryFilter;

	if (/^\d+$/.test(countryFilter)) {
		let cRow = await getCountryById(
			parseInt(countryFilter, 10),
		);
		if (!cRow) {
			cRow = await getByCodeCountry(countryFilter);
		}
		if (cRow) {
			const p3 = cRow.provider3?.trim();
			if (p3) countryFilter = p3;
			else if (cRow.code_country?.trim()) {
				countryFilter = cRow.code_country.trim();
			}
		}
	}
	return countryFilter;
}
