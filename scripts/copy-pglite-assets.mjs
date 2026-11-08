import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];
const out = join(root, ".vercel/output");

function walk(dir, acc) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name === "_libs") acc.push(p);
    walk(p, acc);
  }
}

if (!existsSync(out)) {
  console.log("[pglite] no .vercel/output — skip");
} else {
  const dirs = [];
  walk(out, dirs);
  if (dirs.length === 0) {
    console.log("[pglite] no _libs directory in the build — skip");
  } else {
    for (const dir of dirs) {
      for (const file of files) {
        const from = join(srcDir, file);
        if (!existsSync(from)) continue;
        cpSync(from, join(dir, file));
      }
      console.log("[pglite] copied data + wasm next to", dir);
    }
  }
}
