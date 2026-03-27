import { AppDataSource } from "../config/database.js";
import EmailDomain from "../models/EmailDomain.model.js";

export const getActiveDomains = async () => {
	try {
		const domains = await AppDataSource.getRepository(
			EmailDomain,
		)
			.createQueryBuilder("domain")
			.where("domain.status = :status", {
				status: true,
			})
			.getMany();

		// صفّي البيانات - أرجع فقط name
		return domains.map((domain) => ({
			name: domain.name,
		}));
	} catch (error) {
		console.error(
			"Error fetching active domains:",
			error,
		);
		throw error;
	}
};

export const getDomainByName = async (name) => {
	try {
		return await AppDataSource.getRepository(
			EmailDomain,
		)
			.createQueryBuilder("domain")
			.where("domain.name = :name", { name })
			.andWhere("domain.status = :status", {
				status: true,
			})
			.getOne();
	} catch (error) {
		console.error(
			"Error fetching domain by name:",
			error,
		);
		throw error;
	}
};

export const getAllDomains = async () => {
	try {
		return await AppDataSource.getRepository(
			EmailDomain,
		)
			.createQueryBuilder("domain")
			.orderBy("domain.createdAt", "DESC")
			.getMany();
	} catch (error) {
		console.error(
			"Error fetching all domains:",
			error,
		);
		throw error;
	}
};

export const getDomainById = async (id) => {
	try {
		return await AppDataSource.getRepository(
			EmailDomain,
		).findOne({ where: { id } });
	} catch (error) {
		console.error(
			"Error fetching domain by id:",
			error,
		);
		throw error;
	}
};

export const createDomain = async (domainData) => {
	try {
		const domain =
			AppDataSource.getRepository(EmailDomain).create(
				domainData,
			);
		return await AppDataSource.getRepository(
			EmailDomain,
		).save(domain);
	} catch (error) {
		console.error("Error creating domain:", error);
		throw error;
	}
};

export const updateDomain = async (id, domainData) => {
	try {
		await AppDataSource.getRepository(EmailDomain)
			.createQueryBuilder()
			.update(EmailDomain)
			.set(domainData)
			.where("id = :id", { id })
			.execute();

		return await AppDataSource.getRepository(
			EmailDomain,
		).findOne({ where: { id } });
	} catch (error) {
		console.error("Error updating domain:", error);
		throw error;
	}
};

export const deleteDomain = async (id) => {
	try {
		const result = await AppDataSource.getRepository(
			EmailDomain,
		)
			.createQueryBuilder()
			.delete()
			.from(EmailDomain)
			.where("id = :id", { id })
			.execute();

		return result.affected > 0;
	} catch (error) {
		console.error("Error deleting domain:", error);
		throw error;
	}
};

export const domainExists = async (name) => {
	try {
		const count = await AppDataSource.getRepository(
			EmailDomain,
		)
			.createQueryBuilder("domain")
			.where("domain.name = :name", { name })
			.getCount();

		return count > 0;
	} catch (error) {
		console.error(
			"Error checking domain existence:",
			error,
		);
		throw error;
	}
};
