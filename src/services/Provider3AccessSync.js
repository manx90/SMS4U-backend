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

	/**
	 * Same job as the cron: refresh /accessinfo snapshots for every service with provider3 set.
	 * @param {{ ignoreDisabled?: boolean }} options — admin manual run may pass ignoreDisabled: true to run even when PROVIDER3_ACCESS_SYNC_ENABLED=false
	 * @returns {Promise<{ ok: number; failed: number; skipped?: boolean; reason?: string }>}
	 */
	async syncAll(options = {}) {
		const ignoreDisabled = options.ignoreDisabled === true;

		if (!ignoreDisabled && !this.isEnabled) {
			console.log(
				"⏸️  Provider3 access sync skipped (cron disabled)",
			);
			return {
				ok: 0,
				failed: 0,
				skipped: true,
				reason: "sync_disabled",
			};
		}

		if (
			!process.env.third_NUMBER_API_KEY ||
			!process.env.third_NUMBER_API_URL
		) {
			return {
				ok: 0,
				failed: 0,
				skipped: true,
				reason: "missing_third_env",
			};
		}

		if (this.isSyncing) {
			console.log(
				"⏳ Provider3 access sync already running, skipping...",
			);
			return {
				ok: 0,
				failed: 0,
				skipped: true,
				reason: "already_running",
			};
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
				return {
					ok: 0,
					failed: 0,
					skipped: true,
					reason: "no_provider3_services",
				};
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
			return { ok, failed };
		} finally {
			this.isSyncing = false;
		}
	}
}

export default new Provider3AccessSync();
