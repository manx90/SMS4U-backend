import cron from "node-cron";
import provider3Upstream from "../modules/provider3/services/upstream.service.js";
import { replaceSnapshotsForService } from "../repositories/provider3Access.repo.js";
import { getDistinctServicesForAccessSync } from "../repositories/provider3CountryService.repo.js";
import { getByCode } from "../repositories/service.repo.js";

class Provider3AccessSync {
	constructor() {
		this.isEnabled =
			process.env.PROVIDER3_ACCESS_SYNC_ENABLED !==
			"false";
		this.accessInfoInterval =
			process.env.PROVIDER3_ACCESS_INFO_INTERVAL ||
			"30min";
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
			const distinct =
				await getDistinctServicesForAccessSync();

			if (distinct.length === 0) {
				console.log(
					"📭 Provider3 access sync: no provider3_country_service_config rows",
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

			for (const item of distinct) {
				const svc = await getByCode(
					item.serviceCode,
				);
				if (!svc) {
					failed++;
					continue;
				}
				const apiName = String(
					item.upstreamServiceName || svc.name,
				).trim();
				try {
					const data =
						await provider3Upstream.fetchAccessInfo(
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
