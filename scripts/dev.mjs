import { spawn } from "node:child_process";
import { build } from "esbuild";
import { createServer } from "vite";
await import("./build-main.mjs");
const server = await createServer();
await server.listen();
const child = spawn("node_modules/.bin/electron", ["."], {
  stdio: "inherit",
  env: { ...process.env, BEASTTEXT_DEV_URL: "http://127.0.0.1:5173" },
});
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
