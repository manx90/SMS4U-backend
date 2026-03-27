import cron from "node-cron";
import { AppDataSource } from "../config/database.js";
import Service from "../models/Service.model.js";
import thirdNumberServices from "../api/third-Number.service.js";
import { replaceSnapshotsForService } from "../repositories/provider3Access.repo.js";

/**
 * Periodically syncs provider3 /accessinfo into provider3_access_snapshots
 * for every service that has service.provider3 set.
 */
class Provider3AccessSync {
	constructor() {
		this.isEnabled =
			process.env.PROVIDER3_ACCESS_SYNC_ENABLED !==
			"false";
		/** API query param e.g. 30min */
		this.accessInfoInterval =
			process.env.PROVIDER3_ACCESS_INFO_INTERVAL ||
			"30min";
		/** node-cron expression, default every 30 minutes */
		this.cronExpression =
			process.env.PROVIDER3_ACCESS_SYNC_CRON ||
			"*/30 * * * *";
		this.isSyncing = false;
		this.cronTask = null;
	}

	start() {
		if (!this.isEnabled) {
			console.log(
				"⏸️  Provider3 access sync cron is disabled (set PROVIDER3_ACCESS_SYNC_ENABLED=false)",
			);
			return;
		}

		if (
			!process.env.third_NUMBER_API_KEY ||
			!process.env.third_NUMBER_API_URL
		) {
			console.log(
				"⏸️  Provider3 access sync skipped: third_NUMBER_API_KEY / third_NUMBER_API_URL not set",
			);
			return;
		}

		console.log(
			`🔄 Starting provider3 access sync cron (${this.cronExpression}, interval=${this.accessInfoInterval})`,
		);

		this.syncAll().catch((err) => {
			console.error(
				"❌ Provider3 access sync initial run failed:",
				err,
			);
		});

		this.cronTask = cron.schedule(
			this.cronExpression,
			() => {
				this.syncAll().catch((err) => {
					console.error(
						"❌ Provider3 access sync cron failed:",
						err,
					);
				});
			},
			{
				scheduled: true,
				timezone:
					process.env.PROVIDER3_ACCESS_SYNC_TZ ||
					"UTC",
			},
		);
	}

	stop() {
		if (this.cronTask) {
			this.cronTask.stop();
			this.cronTask = null;
			console.log(
				"⏹️  Provider3 access sync cron stopped",
			);
		}
	}

	async syncAll() {
		if (this.isSyncing) {
			console.log(
				"⏳ Provider3 access sync already running, skipping...",
			);
			return;
		}
		this.isSyncing = true;

		try {
			const repo =
				AppDataSource.getRepository(Service);
			const all = await repo.find();
			const services = all.filter(
				(s) =>
					s.provider3 &&
					String(s.provider3).trim() !== "",
			);

			if (services.length === 0) {
				console.log(
					"📭 Provider3 access sync: no services with provider3 field set",
				);
				return;
			}

			let ok = 0;
			let failed = 0;

			for (const svc of services) {
				const apiName = String(
					svc.provider3 || svc.name,
				).trim();
				try {
					const data =
						await thirdNumberServices.fetchAccessInfo(
							apiName,
							this.accessInfoInterval,
						);
					const rows = Array.isArray(data?.data)
						? data.data
						: [];
					const count =
						await replaceSnapshotsForService(
							svc.code,
							apiName,
							this.accessInfoInterval,
							rows,
						);
					console.log(
						`✅ Provider3 access sync: ${svc.code} (${apiName}) → ${count} rows`,
					);
					ok++;
				} catch (e) {
					failed++;
					console.error(
						`❌ Provider3 access sync failed for ${svc.code}:`,
						e?.message || e,
					);
				}
			}

			console.log(
				`📊 Provider3 access sync done: ${ok} ok, ${failed} failed`,
			);
		} finally {
			this.isSyncing = false;
		}
	}
}

export default new Provider3AccessSync();
