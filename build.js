import * as esbuild from "esbuild";
import { readdirSync, statSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Build configuration
const buildOptions = {
	entryPoints: ["src/server.js"],
	bundle: true,
	outfile: "dist/server.cjs",
	platform: "node",
	target: "node20",
	format: "cjs",
	external: [
		// Node.js built-ins
		"fs",
		"path",
		"os",
		"cluster",
		"crypto",
		"http",
		"https",
		"stream",
		"util",
		"events",
		"buffer",
		"url",
		"querystring",
		"zlib",
		"child_process",
		// Dependencies that should not be bundled
		"mysql2",
		"typeorm",
		"bcrypt",
		"jsonwebtoken",
		"@fastify/jwt",
		"@fastify/cors",
		"@fastify/compress",
		"@fastify/caching",
		"axios",
		"dotenv",
		"node-cron",
		"dayjs",
		"html-entities",
		"yaml",
	],
	banner: {
		js: "// Built with esbuild",
	},
	minify: false, // Keep readable for debugging
	sourcemap: true,
	logLevel: "info",
};

async function build() {
	try {
		console.log("🔨 Starting build process...");

		// Create dist directory if it doesn't exist
		if (!existsSync("dist")) {
			mkdirSync("dist", { recursive: true });
			console.log("✅ Created dist directory");
		}

		// Build the project
		console.log("📦 Bundling with esbuild...");
		await esbuild.build(buildOptions);

		console.log("✅ Build completed successfully!");
		console.log("📁 Output: dist/server.cjs");
	} catch (error) {
		console.error("❌ Build failed:", error);
		process.exit(1);
	}
}

build();

