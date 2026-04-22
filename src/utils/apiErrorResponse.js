/**
 * استجابات أخطاء موحّدة للـ API: أخطاء MySQL/TypeORM دون تسريب تفاصيل SQL.
 */

function getDriverError(err) {
	if (!err) return null;
	return err.driverError ?? err;
}

function isDuplicateEntry(err) {
	const d = getDriverError(err);
	const code = d?.code ?? err?.code;
	const errno = d?.errno ?? err?.errno;
	const msg = String(
		d?.sqlMessage ?? err?.message ?? err ?? "",
	).toLowerCase();
	return (
		code === "ER_DUP_ENTRY" ||
		errno === 1062 ||
		msg.includes("duplicate entry")
	);
}

function isForeignKeyFail(err) {
	const d = getDriverError(err);
	const code = d?.code ?? err?.code;
	const errno = d?.errno ?? err?.errno;
	return (
		code === "ER_NO_REFERENCED_ROW_2" ||
		errno === 1452 ||
		code === "ER_NO_REFERENCED_ROW"
	);
}

function isReferencedRow(err) {
	const d = getDriverError(err);
	const code = d?.code ?? err?.code;
	const errno = d?.errno ?? err?.errno;
	return (
		code === "ER_ROW_IS_REFERENCED_2" ||
		errno === 1451 ||
		code === "ER_ROW_IS_REFERENCED"
	);
}

function duplicateMessageFromSql(sqlMessage, kind) {
	const msg = String(sqlMessage ?? "");
	if (/p3_services/i.test(msg)) {
		return "This service code is already in use. Choose another code.";
	}
	if (/p3_countries/i.test(msg)) {
		return "This country code is already in use. Choose another code.";
	}
	if (/provider3_country_service/i.test(msg)) {
		return "This country and service pair is already configured.";
	}
	if (kind === "p3_service") {
		return "This service code is already in use.";
	}
	if (kind === "p3_country") {
		return "This country code is already in use.";
	}
	if (kind === "p3_config") {
		return "This configuration already exists or conflicts with an existing row.";
	}
	return "This value already exists (duplicate).";
}

/**
 * @param {unknown} err
 * @param {{ kind?: 'p3_service'|'p3_country'|'p3_config'|'generic' }} [options]
 * @returns {{ status: number, state: string, error: string }}
 */
export function mapErrorToApiResponse(err, options = {}) {
	const { kind = "generic" } = options;
	const d = getDriverError(err);
	const sqlMsg = String(
		d?.sqlMessage ?? err?.message ?? err ?? "",
	);

	if (err?.name === "EntityNotFoundError") {
		return {
			status: 404,
			state: "404",
			error: "Record not found.",
		};
	}

	if (isDuplicateEntry(err)) {
		return {
			status: 409,
			state: "409",
			error: duplicateMessageFromSql(sqlMsg, kind),
		};
	}

	if (isForeignKeyFail(err)) {
		return {
			status: 400,
			state: "400",
			error:
				kind === "p3_config"
					? "Invalid country or service reference (check countryId and serviceId)."
					: "Referenced record does not exist.",
		};
	}

	if (isReferencedRow(err)) {
		return {
			status: 409,
			state: "409",
			error:
				"Cannot remove or change this record because it is still in use.",
		};
	}

	const appMsg =
		err?.message != null
			? String(err.message)
			: String(err ?? "");

	function isProbablySafeAppMessage(msg) {
		const s = String(msg).trim();
		if (!s || s.length > 400) return false;
		if (
			/mysql|duplicate entry|sql|errno|er_|queryfailed|syntax error|connection lost/i.test(
				s,
			)
		) {
			return false;
		}
		return true;
	}

	if (isProbablySafeAppMessage(appMsg)) {
		const safe =
			appMsg.length > 220
				? `${appMsg.slice(0, 217)}…`
				: appMsg.trim();
		return {
			status: 400,
			state: "400",
			error: safe,
		};
	}

	return {
		status: 500,
		state: "500",
		error: "A server error occurred. Please try again later.",
	};
}

/**
 * @param {import('fastify').FastifyReply} resOrReply
 * @param {unknown} err
 * @param {{ error?: Function, warn?: Function }} logger
 * @param {{ kind?: string, route?: string }} [options]
 */
export function sendMappedError(resOrReply, err, logger, options = {}) {
	const mapped = mapErrorToApiResponse(err, options);
	if (mapped.status >= 500) {
		logger?.error?.("API mapped error", {
			route: options.route,
			kind: options.kind,
			underlying: err?.message,
		});
	}
	return resOrReply.status(mapped.status).send({
		state: mapped.state,
		error: mapped.error,
	});
}
