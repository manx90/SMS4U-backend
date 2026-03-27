import { AppDataSource } from "../config/database.js";
import EmailPriceModel from "../models/EmailPrice.model.js";
import CacheService from "../services/CacheService.js";

export const emailPriceRepository =
	AppDataSource.getRepository(EmailPriceModel);

// Get all email prices
export const getAllPrices = async () => {
	return await emailPriceRepository.find();
};

// Get active email prices
export const getActivePrices = async () => {
	return await emailPriceRepository.find({
		where: { active: true },
	});
};

// Get price by site and domain
export const getPriceBySiteAndDomain = async (
	site,
	domain = null,
) => {
	const cacheKey = `email:price:${site}:${
		domain || "default"
	}`;
	return await CacheService.get(
		cacheKey,
		async () => {
			const query = {
				where: {
					site,
					active: true,
				},
			};

			if (domain) {
				query.where.domain = domain;
			} else {
				query.where.domain = null;
			}

			return await emailPriceRepository.findOne(
				query,
			);
		},
	);
};

// Get price by id
export const getPriceById = async (id) => {
	return await emailPriceRepository.findOne({
		where: { id },
	});
};

// Create new price
export const createPrice = async (priceData) => {
	const price =
		emailPriceRepository.create(priceData);
	const result = await emailPriceRepository.save(
		price,
	);

	// Invalidate email cache after creating new price
	CacheService.invalidatePattern("email:*");

	return result;
};

// Update price
export const updatePrice = async (
	id,
	priceData,
) => {
	await emailPriceRepository.update(
		id,
		priceData,
	);

	// Invalidate email cache after updating price
	CacheService.invalidatePattern("email:*");

	return await getPriceById(id);
};

// Delete price
export const deletePrice = async (id) => {
	const result =
		await emailPriceRepository.delete(id);

	// Invalidate email cache after deleting price
	CacheService.invalidatePattern("email:*");

	return result;
};

// Get prices by site
export const getPricesBySite = async (site) => {
	return await emailPriceRepository.find({
		where: { site, active: true },
	});
};

// Update price availability count
export const updateAvailability = async (
	id,
	count,
) => {
	const result =
		await emailPriceRepository.update(id, {
			available_count: count,
			last_synced_at: new Date(),
		});

	// Invalidate email cache after updating availability
	CacheService.invalidatePattern("email:*");

	return result;
};

// Decrement availability count after ordering
export const decrementAvailability = async (
	site,
	domain = null,
) => {
	const priceRecord =
		await getPriceBySiteAndDomain(site, domain);

	if (priceRecord && priceRecord.available_count > 0) {
		const newCount = Math.max(
			0,
			priceRecord.available_count - 1,
		);
		await emailPriceRepository.update(
			priceRecord.id,
			{
				available_count: newCount,
				last_synced_at: new Date(),
			},
		);

		// Invalidate email cache after decrementing availability
		CacheService.invalidatePattern("email:*");

		console.log(
			`📉 Decremented availability for ${site}${
				domain ? `:${domain}` : ""
			} (${priceRecord.available_count} → ${newCount})`,
		);
	}
};

// Increment availability count after cancelling
export const incrementAvailability = async (
	site,
	domain = null,
) => {
	const priceRecord =
		await getPriceBySiteAndDomain(site, domain);

	if (priceRecord) {
		const newCount =
			priceRecord.available_count + 1;
		await emailPriceRepository.update(
			priceRecord.id,
			{
				available_count: newCount,
				last_synced_at: new Date(),
			},
		);

		// Invalidate email cache after incrementing availability
		CacheService.invalidatePattern("email:*");

		console.log(
			`📈 Incremented availability for ${site}${
				domain ? `:${domain}` : ""
			} (${priceRecord.available_count} → ${newCount})`,
		);
	}
};