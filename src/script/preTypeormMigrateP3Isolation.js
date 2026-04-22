import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

/** Avoid ER_CANT_AGGREGATE_2COLLATIONS when joining legacy vs p3_* varchar columns. */
const UC = "utf8mb4_unicode_ci";

async function columnExists(conn, table, column) {
	const [rows] = await conn.query(
		`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
		[table, column],
	);
	return Array.isArray(rows) && rows.length > 0;
}

async function tableExists(conn, table) {
	const [rows] = await conn.query(
		`SELECT 1 FROM INFORMATION_SCHEMA.TABLES
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
		[table],
	);
	return Array.isArray(rows) && rows.length > 0;
}

async function dropForeignKeyIfExists(
	conn,
	table,
	column,
) {
	const [rows] = await conn.query(
		`SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
		   AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
		[table, column],
	);
	const seen = new Set();
	for (const r of rows || []) {
		const name = r?.CONSTRAINT_NAME;
		if (!name || seen.has(name)) continue;
		seen.add(name);
		try {
			await conn.query(
				`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``,
			);
		} catch (e) {
			// 1091: already dropped, or name mismatch after partial migration
			if (e?.errno === 1091) continue;
			throw e;
		}
	}
}

/** يعيد مزامنة TypeORM (synchronize) إنشاء القيود بأسماء ثابتة دون أخطاء DROP لأسماء قديمة. */
async function dropAllForeignKeysOnTable(conn, table) {
	const [rows] = await conn.query(
		`SELECT CONSTRAINT_NAME
		 FROM information_schema.REFERENTIAL_CONSTRAINTS
		 WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
		[table],
	);
	for (const r of rows || []) {
		const name = r?.CONSTRAINT_NAME;
		if (!name) continue;
		try {
			await conn.query(
				`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``,
			);
		} catch (e) {
			if (e?.errno === 1091) continue;
			throw e;
		}
	}
}

export async function preTypeormMigrateP3Isolation() {
	const host = process.env.DB_HOST || "localhost";
	const port = parseInt(process.env.DB_PORT, 10) || 3306;
	const user = process.env.DB_USERNAME;
	const password = process.env.DB_PASSWORD;
	const database = process.env.DB_DATABASE;
	if (!user || !database) {
		console.warn(
			"⚠️  preTypeormMigrateP3Isolation: DB credentials missing, skip",
		);
		return { skipped: "no_db_env" };
	}

	const conn = await mysql.createConnection({
		host,
		port,
		user,
		password,
		database,
	});

	try {
		await conn.query(`
			CREATE TABLE IF NOT EXISTS p3_countries (
				id INT NOT NULL AUTO_INCREMENT,
				name VARCHAR(255) NOT NULL,
				code_country VARCHAR(10) NOT NULL,
				PRIMARY KEY (id),
				UNIQUE INDEX IDX_P3_COUNTRY_CODE (code_country)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${UC}
		`);
		await conn.query(`
			CREATE TABLE IF NOT EXISTS p3_services (
				id INT NOT NULL AUTO_INCREMENT,
				name VARCHAR(255) NOT NULL,
				code VARCHAR(50) NOT NULL,
				PRIMARY KEY (id),
				UNIQUE INDEX IDX_P3_SERVICE_CODE (code)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${UC}
		`);

		const cfgTable = "provider3_country_service_config";
		if (!(await tableExists(conn, cfgTable))) {
			return { skipped: "no_config_table" };
		}

		const hasLegacyCountry = await columnExists(
			conn,
			cfgTable,
			"countryId",
		);
		const hasP3Country = await columnExists(
			conn,
			cfgTable,
			"p3CountryId",
		);

		if (hasLegacyCountry && !hasP3Country) {
			console.log(
				"📦 preTypeormMigrateP3Isolation: migrating P3 config to p3_countries / p3_services…",
			);

			await conn.query(`
				INSERT IGNORE INTO p3_countries (name, code_country)
				SELECT DISTINCT c.name, c.code_country
				FROM ${cfgTable} cfg
				INNER JOIN countries c ON c.id = cfg.countryId
			`);
			await conn.query(`
				INSERT IGNORE INTO p3_services (name, code)
				SELECT DISTINCT s.name, s.code
				FROM ${cfgTable} cfg
				INNER JOIN service s ON s.id = cfg.serviceId
			`);

			await conn.query(`
				ALTER TABLE ${cfgTable}
				ADD COLUMN p3CountryId INT NULL,
				ADD COLUMN p3ServiceId INT NULL
			`);

			await conn.query(`
				UPDATE ${cfgTable} cfg
				INNER JOIN countries c ON cfg.countryId = c.id
				INNER JOIN p3_countries p3c ON p3c.code_country COLLATE ${UC} = c.code_country COLLATE ${UC}
				INNER JOIN service s ON cfg.serviceId = s.id
				INNER JOIN p3_services p3s ON p3s.code COLLATE ${UC} = s.code COLLATE ${UC}
				SET cfg.p3CountryId = p3c.id, cfg.p3ServiceId = p3s.id
			`);

			await dropForeignKeyIfExists(
				conn,
				cfgTable,
				"countryId",
			);
			await dropForeignKeyIfExists(
				conn,
				cfgTable,
				"serviceId",
			);
			await conn.query(
				`ALTER TABLE ${cfgTable} DROP COLUMN countryId, DROP COLUMN serviceId`,
			);

			await conn.query(`
				ALTER TABLE ${cfgTable}
				MODIFY p3CountryId INT NOT NULL,
				MODIFY p3ServiceId INT NOT NULL
			`);
			await conn.query(`
				ALTER TABLE ${cfgTable}
				ADD CONSTRAINT FK_p3cfg_p3country FOREIGN KEY (p3CountryId) REFERENCES p3_countries(id) ON DELETE CASCADE,
				ADD CONSTRAINT FK_p3cfg_p3service FOREIGN KEY (p3ServiceId) REFERENCES p3_services(id) ON DELETE CASCADE
			`);

			console.log(
				"✅ preTypeormMigrateP3Isolation: provider3_country_service_config migrated",
			);
		}

		if (await tableExists(conn, "orders")) {
			if (!(await columnExists(conn, "orders", "p3CountryId"))) {
				await conn.query(`
					ALTER TABLE orders
					ADD COLUMN p3CountryId INT NULL,
					ADD COLUMN p3ServiceId INT NULL
				`);
			}

			if (await columnExists(conn, "orders", "countryId")) {
				await dropForeignKeyIfExists(
					conn,
					"orders",
					"countryId",
				);
				await dropForeignKeyIfExists(
					conn,
					"orders",
					"serviceId",
				);
				await conn.query(`
					ALTER TABLE orders
					MODIFY countryId INT NULL,
					MODIFY serviceId INT NULL
				`);

				await conn.query(`
					UPDATE orders o
					INNER JOIN countries c ON o.countryId = c.id
					INNER JOIN p3_countries p3c ON p3c.code_country COLLATE ${UC} = c.code_country COLLATE ${UC}
					INNER JOIN service s ON o.serviceId = s.id
					INNER JOIN p3_services p3s ON p3s.code COLLATE ${UC} = s.code COLLATE ${UC}
					SET o.p3CountryId = p3c.id, o.p3ServiceId = p3s.id
					WHERE o.provider = 3
				`);
				await conn.query(`
					UPDATE orders SET countryId = NULL, serviceId = NULL WHERE provider = 3
				`);
			}
		}

		// TypeORM: بعد إسقاط FK يدويًا تبقى أسماء فهارس/قيود مُتوقّعة اختلافيًا (ER 1091).
		if (process.env.ORDERS_FK_REBUILD !== "false") {
			if (await tableExists(conn, "orders")) {
				await dropAllForeignKeysOnTable(conn, "orders");
			}
		}

		return { ok: true };
	} catch (e) {
		console.error(
			"❌ preTypeormMigrateP3Isolation failed:",
			e,
		);
		throw e;
	} finally {
		await conn.end();
	}
}
