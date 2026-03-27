/**
 * Logger utility for the SMS backend
 * Saves logs to files instead of console output
 */

import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs");

class Logger {
	constructor() {
		this.logDir = LOG_DIR;
		this.ensureLogDirectory();
	}

	/**
	 * Ensure the logs directory exists
	 */
	ensureLogDirectory() {
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, {
				recursive: true,
			});
		}
	}

	/**
	 * Get current timestamp for log entries
	 */
	getTimestamp() {
		return new Date().toISOString();
	}

	/**
	 * Get log file path for today
	 */
	getLogFilePath(type = "app") {
		const today = new Date()
			.toISOString()
			.split("T")[0];
		return path.join(
			this.logDir,
			`${type}-${today}.log`,
		);
	}

	/**
	 * Write log entry to file
	 */
	writeLog(type, level, message, data = null) {
		const timestamp = this.getTimestamp();
		const logFile = this.getLogFilePath(type);

		let logEntry = `[${timestamp}] [${level}] ${message}`;

		if (data) {
			if (typeof data === "object") {
				logEntry += `\n${JSON.stringify(
					data,
					null,
					2,
				)}`;
			} else {
				logEntry += ` ${data}`;
			}
		}

		logEntry += "\n";

		// Write to file asynchronously
		fs.appendFile(logFile, logEntry, (err) => {
			if (err) {
				console.error(
					"Failed to write log:",
					err,
				);
			}
		});
	}

	/**
	 * Log info messages
	 */
	info(message, data = null) {
		this.writeLog("app", "INFO", message, data);
	}

	/**
	 * Log warning messages
	 */
	warn(message, data = null) {
		this.writeLog("app", "WARN", message, data);
	}

	/**
	 * Log error messages
	 */
	error(message, data = null) {
		this.writeLog("app", "ERROR", message, data);
	}

	/**
	 * Log provider-specific errors to a separate file
	 */
	providerError(message, data = null) {
		this.writeLog("provider", "ERROR", message, data);
	}

	/**
	 * Log debug messages
	 */
	debug(message, data = null) {
		this.writeLog("app", "DEBUG", message, data);
	}

	/**
	 * Log order expiration specific messages
	 */
	orderExpiration(message, data = null) {
		this.writeLog(
			"order-expiration",
			"INFO",
			message,
			data,
		);
	}

	/**
	 * Log background service messages
	 */
	backgroundService(message, data = null) {
		this.writeLog(
			"background-service",
			"INFO",
			message,
			data,
		);
	}

	/**
	 * Log API requests
	 */
	apiRequest(message, data = null) {
		this.writeLog(
			"api-requests",
			"INFO",
			message,
			data,
		);
	}

	/**
	 * Log database operations
	 */
	database(message, data = null) {
		this.writeLog(
			"database",
			"INFO",
			message,
			data,
		);
	}

	/**
	 * Get log file contents for a specific date
	 */
	getLogContents(type = "app", date = null) {
		const logDate =
			date ||
			new Date().toISOString().split("T")[0];
		const logFile = path.join(
			this.logDir,
			`${type}-${logDate}.log`,
		);

		try {
			if (fs.existsSync(logFile)) {
				return fs.readFileSync(logFile, "utf8");
			}
			return "Log file not found";
		} catch (error) {
			return `Error reading log file: ${error.message}`;
		}
	}

	/**
	 * Clean old log files (older than 30 days)
	 */
	cleanOldLogs() {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(
			thirtyDaysAgo.getDate() - 30,
		);

		try {
			const files = fs.readdirSync(this.logDir);
			files.forEach((file) => {
				const filePath = path.join(
					this.logDir,
					file,
				);
				const stats = fs.statSync(filePath);

				if (stats.mtime < thirtyDaysAgo) {
					fs.unlinkSync(filePath);
					this.info(
						`Cleaned old log file: ${file}`,
					);
				}
			});
		} catch (error) {
			this.error(
				"Error cleaning old logs:",
				error.message,
			);
		}
	}
}

export default new Logger();
