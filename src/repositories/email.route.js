import { AppDataSource } from "../config/database.js";
import EmailSite from "../models/EmailSite.model.js";

export const getActiveSites = async () => {
	try {
		const sites = await AppDataSource.getRepository(
			EmailSite,
		)
			.createQueryBuilder("site")
			.where("site.status = :status", { status: true })
			.getMany();

		// صفّي البيانات - أرجع فقط name
		return sites.map((site) => ({
			name: site.name,
		}));
	} catch (error) {
		console.error(
			"Error fetching active sites:",
			error,
		);
		throw error;
	}
};

export const getSiteByName = async (name) => {
	try {
		return await AppDataSource.getRepository(
			EmailSite,
		)
			.createQueryBuilder("site")
			.where("site.name = :name", { name })
			.andWhere("site.status = :status", {
				status: true,
			})
			.getOne();
	} catch (error) {
		console.error(
			"Error fetching site by name:",
			error,
		);
		throw error;
	}
};

export const getAllSites = async () => {
	try {
		return await AppDataSource.getRepository(
			EmailSite,
		)
			.createQueryBuilder("site")
			.orderBy("site.createdAt", "DESC")
			.getMany();
	} catch (error) {
		console.error(
			"Error fetching all sites:",
			error,
		);
		throw error;
	}
};

export const getSiteById = async (id) => {
	try {
		return await AppDataSource.getRepository(
			EmailSite,
		).findOne({ where: { id } });
	} catch (error) {
		console.error(
			"Error fetching site by id:",
			error,
		);
		throw error;
	}
};

export const createSite = async (siteData) => {
	try {
		const site =
			AppDataSource.getRepository(EmailSite).create(
				siteData,
			);
		return await AppDataSource.getRepository(
			EmailSite,
		).save(site);
	} catch (error) {
		console.error("Error creating site:", error);
		throw error;
	}
};

export const updateSite = async (id, siteData) => {
	try {
		await AppDataSource.getRepository(EmailSite)
			.createQueryBuilder()
			.update(EmailSite)
			.set(siteData)
			.where("id = :id", { id })
			.execute();

		return await AppDataSource.getRepository(
			EmailSite,
		).findOne({ where: { id } });
	} catch (error) {
		console.error("Error updating site:", error);
		throw error;
	}
};

export const deleteSite = async (id) => {
	try {
		const result = await AppDataSource.getRepository(
			EmailSite,
		)
			.createQueryBuilder()
			.delete()
			.from(EmailSite)
			.where("id = :id", { id })
			.execute();

		return result.affected > 0;
	} catch (error) {
		console.error("Error deleting site:", error);
		throw error;
	}
};

export const siteExists = async (name) => {
	try {
		const count = await AppDataSource.getRepository(
			EmailSite,
		)
			.createQueryBuilder("site")
			.where("site.name = :name", { name })
			.getCount();

		return count > 0;
	} catch (error) {
		console.error(
			"Error checking site existence:",
			error,
		);
		throw error;
	}
};
