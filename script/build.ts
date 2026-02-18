import { build as esbuild } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildServer() {
  console.log("📦 Building server...");
  
  const outfile = path.resolve(__dirname, "../dist/index.cjs");
  
  try {
    await esbuild({
      entryPoints: [path.resolve(__dirname, "../server/index.ts")],
      bundle: true,
      platform: "node",
      target: "node20",
      format: "cjs",
      outfile,
      external: [
        "express",
        "pg",
        "postgres",
        "drizzle-orm",
        "@anthropic-ai/sdk",
        "exa-js",
        "node-cron",
        "lightningcss",
        "esbuild"
      ],
      sourcemap: false,
      minify: false,
    });
    
    if (fs.existsSync(outfile)) {
      const stats = fs.statSync(outfile);
      console.log(`✅ Server built successfully: ${outfile} (${stats.size} bytes)`);
    } else {
      console.error(`❌ Build claimed success but file not found: ${outfile}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Server build failed:", error);
    process.exit(1);
  }
}

buildServer();
