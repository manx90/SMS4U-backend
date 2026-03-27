import { AppDataSource } from "../config/database.js";
import EmailSiteModel from "../models/EmailSite.model.js";
import CacheService from "../services/CacheService.js";

export const emailSiteRepository =
	AppDataSource.getRepository(EmailSiteModel);

// Get all email sites
export const getAllSites = async () => {
	return await emailSiteRepository.find();
};

// Get active email sites
export const getActiveSites = async () => {
	return await CacheService.get(
		"email:sites",
		async () => {
			return await emailSiteRepository.find({
				where: { status: true },
			});
		},
	);
};

// Get site by name
export const getSiteByName = async (name) => {
	return await emailSiteRepository.findOne({
		where: { name },
	});
};

// Get site by id
export const getSiteById = async (id) => {
	return await emailSiteRepository.findOne({
		where: { id },
	});
};

// Create new site
export const createSite = async (siteData) => {
	const site =
		emailSiteRepository.create(siteData);
	const result = await emailSiteRepository.save(
		site,
	);

	// Invalidate email cache after creating new site
	CacheService.invalidatePattern("email:*");

	return result;
};

// Update site
export const updateSite = async (
	id,
	siteData,
) => {
	await emailSiteRepository.update(id, siteData);

	// Invalidate email cache after updating site
	CacheService.invalidatePattern("email:*");

	return await getSiteById(id);
};

// Delete site
export const deleteSite = async (id) => {
	const result = await emailSiteRepository.delete(
		id,
	);

	// Invalidate email cache after deleting site
	CacheService.invalidatePattern("email:*");

	return result;
};
