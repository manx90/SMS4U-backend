import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function columnExists(conn, table, column) {
	const [rows] = await conn.query(
		`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
		[table, column],
	);
	return Array.isArray(rows) && rows.length > 0;
}

async function getJoinColumnNames(conn, table) {
	const [rows] = await conn.query(
		`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
		[table],
	);
	const names = new Set(
		(rows || []).map((r) => r.COLUMN_NAME),
	);
	let countryCol = names.has("countryId")
		? "countryId"
		: names.has("country_id")
			? "country_id"
			: null;
	let serviceCol = names.has("serviceId")
		? "serviceId"
		: names.has("service_id")
			? "service_id"
			: null;
	return { countryCol, serviceCol };
}

/**
 * Runs before TypeORM synchronize so legacy provider3 data is preserved.
 */
export async function preTypeormMigrateProvider3() {
	const host = process.env.DB_HOST || "localhost";
	const port = parseInt(process.env.DB_PORT, 10) || 3306;
	const user = process.env.DB_USERNAME;
	const password = process.env.DB_PASSWORD;
	const database = process.env.DB_DATABASE;
	if (!user || !database) {
		console.warn(
			"⚠️  preTypeormMigrateProvider3: DB credentials missing, skip",
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
		const hasLegacy = await columnExists(
			conn,
			"countries",
			"provider3",
		);
		if (!hasLegacy) {
			return { skipped: "legacy_already_migrated" };
		}

		await conn.query(
			`CREATE TABLE IF NOT EXISTS provider3_country_service_config (
				id INT NOT NULL AUTO_INCREMENT,
				price FLOAT NOT NULL,
				upstreamCountryCode VARCHAR(255) NOT NULL,
				upstreamServiceName VARCHAR(255) NOT NULL,
				countryId INT NOT NULL,
				serviceId INT NOT NULL,
				createdAt DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
				updatedAt DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				PRIMARY KEY (id),
				UNIQUE INDEX UQ_P3_COUNTRY_SERVICE (countryId, serviceId),
				INDEX IDX_P3_SERVICE (serviceId),
				CONSTRAINT FK_p3cfg_country FOREIGN KEY (countryId) REFERENCES countries(id) ON DELETE CASCADE,
				CONSTRAINT FK_p3cfg_service FOREIGN KEY (serviceId) REFERENCES service(id) ON DELETE CASCADE
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		);

		const { countryCol, serviceCol } =
			await getJoinColumnNames(
				conn,
				"country_service_pricing",
			);
		if (!countryCol || !serviceCol) {
			throw new Error(
				"Could not resolve country_service_pricing FK columns",
			);
		}

		const hasP3Price = await columnExists(
			conn,
			"country_service_pricing",
			"provider3",
		);
		if (!hasP3Price) {
			await conn.query(
				`ALTER TABLE countries DROP COLUMN provider3`,
			);
			const svcHas = await columnExists(
				conn,
				"service",
				"provider3",
			);
			if (svcHas) {
				await conn.query(
					`ALTER TABLE service DROP COLUMN provider3`,
				);
			}
			return { migrated: 0, note: "no_pricing_col" };
		}

		const [existing] = await conn.query(
			`SELECT COUNT(*) AS c FROM provider3_country_service_config`,
		);
		const cnt =
			parseInt(existing?.[0]?.c ?? "0", 10) || 0;
		const safeId = (n) => {
			if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n))
				throw new Error("Invalid SQL identifier");
			return `\`${n}\``;
		};
		const cCol = safeId(countryCol);
		const sCol = safeId(serviceCol);

		if (cnt === 0) {
			await conn.query(
				`INSERT INTO provider3_country_service_config
				 (price, upstreamCountryCode, upstreamServiceName, countryId, serviceId, createdAt, updatedAt)
				 SELECT csp.provider3, c.provider3, s.provider3, csp.${cCol}, csp.${sCol}, NOW(6), NOW(6)
				 FROM country_service_pricing csp
				 INNER JOIN countries c ON c.id = csp.${cCol}
				 INNER JOIN service s ON s.id = csp.${sCol}
				 WHERE csp.provider3 IS NOT NULL
				   AND c.provider3 IS NOT NULL AND TRIM(c.provider3) <> ''
				   AND s.provider3 IS NOT NULL AND TRIM(s.provider3) <> ''`,
			);
		}

		await conn.query(
			`ALTER TABLE country_service_pricing DROP COLUMN provider3`,
		);
		await conn.query(`ALTER TABLE countries DROP COLUMN provider3`);
		await conn.query(
			`ALTER TABLE service DROP COLUMN provider3`,
		);

		console.log(
			"✅ preTypeormMigrateProvider3: legacy provider3 columns migrated and dropped",
		);
		return { migrated: true };
	} catch (e) {
		console.error(
			"❌ preTypeormMigrateProvider3 failed:",
			e?.message || e,
		);
		throw e;
	} finally {
		await conn.end();
	}
}
