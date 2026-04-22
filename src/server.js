import Fastify from "fastify";
import cluster from "cluster";
import os from "os";
import fastifyCompress from "@fastify/compress";
import fastifyCaching from "@fastify/caching";
import { AppDataSource } from "./config/database.js";
import fastifyJwt from "@fastify/jwt";
import dotenv from "dotenv";
import { Route } from "./routes/index.js";
import {
	userRoute,
	authRoute,
} from "./routes/user.js";
import BackgroundService from "./services/BackgroundService.js";
import { setupDefaultAdmin } from "./script/admin-config.js";
import { preTypeormMigrateProvider3 } from "./script/preTypeormMigrateProvider3.js";
import { preTypeormMigrateP3Isolation } from "./script/preTypeormMigrateP3Isolation.js";
import cors from "@fastify/cors";
import { injectApiKeyIntoQuery } from "./utils/requestApiKey.js";
dotenv.config();
const app = Fastify({ logger: false });

app.addHook("preHandler", async (request) => {
	injectApiKeyIntoQuery(request);
});
app.register(fastifyCompress, {
	global: true,
	encodings: ["br", "gzip", "deflate"],
	threshold: 0,
});
// Global HTTP caching removed - using per-route caching instead
// app.register(fastifyCaching, {
// 	privacy: "public",
// 	expiresIn: 60_000,
// });
app.register(fastifyJwt, {
	secret: process.env.JWT_SECRET || "supersecret",
});

// Global cache control - set no-cache by default
// Individual routes can override with specific cache decorators
app.addHook(
	"onSend",
	async (request, reply, payload) => {
		// Only set default cache headers if not already set by route decorators
		if (!reply.getHeader("Cache-Control")) {
			reply.header(
				"Cache-Control",
				"no-cache, no-store, must-revalidate",
			);
			reply.header("Pragma", "no-cache");
			reply.header("Expires", "0");
		}
		return payload;
	},
);

// Minimal request/response console logging with color
app.addHook(
	"onSend",
	async (request, reply, payload) => {
		const statusCode = reply.statusCode;
		const ok =
			statusCode >= 200 && statusCode < 400;
		const ip =
			request.ip ||
			request.socket?.remoteAddress ||
			(request.headers &&
			typeof request.headers[
				"x-forwarded-for"
			] === "string"
				? request.headers["x-forwarded-for"]
						.split(",")[0]
						.trim()
				: "");
		const ua =
			(request.headers &&
				request.headers["user-agent"]) ||
			"";
		let body = "";
		try {
			if (typeof payload === "string")
				body = payload;
			else if (Buffer.isBuffer(payload))
				body = payload.toString("utf8");
			else if (payload !== undefined)
				body = JSON.stringify(payload);
		} catch {}
		const preview =
			body && body.length > 200
				? body.slice(0, 200) + "..."
				: body;
		const green = "\x1b[32m";
		const yellow = "\x1b[33m";
		const red = "\x1b[31m";
		const cyan = "\x1b[36m";
		const reset = "\x1b[0m";
		const color =
			statusCode >= 500
				? red
				: statusCode >= 400
				? yellow
				: statusCode >= 300
				? cyan
				: green;
		console.log(
			`${color}[${ok ? "OK" : "ERR"}] ${ip} ${
				request.method
			} ${
				request.url
			} -> ${statusCode}${reset} ua="${ua}" ${
				preview || ""
			}`,
		);
		return payload;
	},
);

// Disable cluster mode when running under PM2 or if DISABLE_CLUSTER is set
// PM2 already handles process management, so we don't need cluster mode
const isRunningUnderPM2 = process.env.pm_id !== undefined || process.env.PM2_HOME !== undefined;
const shouldUseCluster = !isRunningUnderPM2 && process.env.DISABLE_CLUSTER !== "true" && process.env.NODE_ENV !== "production";

const isPrimary = shouldUseCluster ? cluster.isPrimary : false;

// Setup graceful shutdown for both primary and worker processes
process.on("SIGTERM", () =>
	gracefulShutdown("SIGTERM"),
);
process.on("SIGINT", () =>
	gracefulShutdown("SIGINT"),
);
async function gracefulShutdown(signal) {
	console.log(
		`\n🛑 Received ${signal}. Starting graceful shutdown...`,
	);
	try {
		// Stop background services
		BackgroundService.stop();
		console.log("✅ Background services stopped");

		if (AppDataSource?.isInitialized) {
			await AppDataSource.destroy();
			console.log(
				"✅ Database connection closed",
			);
		}

		await app.close();
		console.log("✅ Fastify server closed");

		process.exit(0);
	} catch (error) {
		console.error(
			"❌ Error during shutdown:",
			error,
		);
		process.exit(1);
	}
}
async function startServer() {
	try {
		await app.register(cors, {
			origin: "*",
			credentials: true,
		});

		await preTypeormMigrateProvider3();
		await preTypeormMigrateP3Isolation();

		// Initialize database first
		await AppDataSource.initialize();
		console.log(
			"✅ Database connection established successfully",
		);

		// Check if migrations need to be run
		const pendingMigrations =
			await AppDataSource.showMigrations();
		if (pendingMigrations) {
			console.log(
				"📋 Running pending migrations...",
			);
			await AppDataSource.runMigrations();
			console.log("✅ Migrations completed");
		}

		// Setup default admin user
		await setupDefaultAdmin();

		// Register routes
		await app.register(Route, {
			prefix: "/api/v1",
		});
		await app.register(userRoute, {
			prefix: "/api/v1/users",
		});
		await app.register(authRoute, {
			prefix: "/api/v1/auth",
		});
		console.log(
			"✅ Routes registered successfully",
		);

		// Start the server
		await app.listen({
			port: process.env.PORT || 3000,
			host: process.env.HOST || "0.0.0.0",
		});

		// اطبع كل الـ routes بعد التشغيل
		console.log("\n📌 Available Routes:");
		console.log(app.printRoutes());

		console.log(
			`🚀 SMS API Server listening at http://localhost:${
				process.env.PORT || 3000
			}`,
		);

		// Background jobs (cron, order expiry, provider3 access sync, etc.) — only in this process.
		// When Node cluster is enabled, the primary process runs BackgroundService before workers fork.
		if (!shouldUseCluster) {
			await BackgroundService.start();
			console.log(
				"✅ Background services started (single-process mode)",
			);
		}
	} catch (error) {
		console.error(
			"❌ Failed to start server:",
			error,
		);
		process.exit(1);
	}
}

if (isPrimary && shouldUseCluster) {
	const numCPUs =
		parseInt(process.env.WEB_CONCURRENCY) ||
		os.cpus().length;
	console.log(
		`🧵 Starting cluster with ${numCPUs} workers`,
	);

	// Initialize database and start background services in primary process
	preTypeormMigrateProvider3()
		.then(() => preTypeormMigrateP3Isolation())
		.then(() => AppDataSource.initialize())
		.then(async () => {
			console.log(
				"✅ Database connection established in primary process",
			);
			// Start background services in primary process only
			await BackgroundService.start();
			console.log(
				"✅ Background services started in primary process",
			);
		})
		.catch((error) => {
			console.error(
				"❌ Failed to initialize database in primary process:",
				error,
			);
		});

	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}
	cluster.on("online", () => {});
	cluster.on("listening", () => {});
	cluster.on("exit", () => {
		cluster.fork();
	});
} else {
	// Running as single process (PM2 mode or cluster disabled)
	if (isRunningUnderPM2) {
		console.log("📦 Running under PM2 - cluster mode disabled");
	}
	startServer();
}
