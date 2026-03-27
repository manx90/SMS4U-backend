import { AppDataSource } from "../config/database.js";
import EmailDomainModel from "../models/EmailDomain.model.js";
import CacheService from "../services/CacheService.js";

export const emailDomainRepository =
	AppDataSource.getRepository(EmailDomainModel);

// Get all email domains
export const getAllDomains = async () => {
	return await emailDomainRepository.find();
};

// Get active email domains
export const getActiveDomains = async () => {
	return await CacheService.get(
		"email:domains",
		async () => {
			return await emailDomainRepository.find({
				where: { status: true },
			});
		},
	);
};

// Get domain by name
export const getDomainByName = async (name) => {
	return await emailDomainRepository.findOne({
		where: { name },
	});
};

// Get domain by id
export const getDomainById = async (id) => {
	return await emailDomainRepository.findOne({
		where: { id },
	});
};

// Create new domain
export const createDomain = async (
	domainData,
) => {
	const domain =
		emailDomainRepository.create(domainData);
	const result = await emailDomainRepository.save(
		domain,
	);

	// Invalidate email cache after creating new domain
	CacheService.invalidatePattern("email:*");

	return result;
};

// Update domain
export const updateDomain = async (
	id,
	domainData,
) => {
	await emailDomainRepository.update(
		id,
		domainData,
	);

	// Invalidate email cache after updating domain
	CacheService.invalidatePattern("email:*");

	return await getDomainById(id);
};

// Delete domain
export const deleteDomain = async (id) => {
	const result =
		await emailDomainRepository.delete(id);

	// Invalidate email cache after deleting domain
	CacheService.invalidatePattern("email:*");

	return result;
};
