import { build } from "vite";
import { build as esbuild } from "esbuild";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Building client...");
  await build({
    root: path.resolve(__dirname, "../client"),
    build: {
      outDir: path.resolve(__dirname, "../dist/public"),
      emptyOutDir: true,
    },
  });

  console.log("Building server...");
  await esbuild({
    entryPoints: [path.resolve(__dirname, "../server/index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: path.resolve(__dirname, "../dist/index.cjs"),
    external: ["express", "pg", "drizzle-orm", "@anthropic-ai/sdk", "exa-js", "node-cron"],
  });

  console.log("Build complete!");
}

main().catch(console.error);
