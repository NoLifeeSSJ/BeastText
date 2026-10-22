import fs from "node:fs/promises";
import path from "node:path";
const rows = [];
async function walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name.startsWith("@")) await walk(p);
    else if (e.isDirectory()) {
      try {
        const d = JSON.parse(
          await fs.readFile(path.join(p, "package.json"), "utf8"),
        );
        rows.push({
          name: d.name,
          version: d.version,
          license: d.license ?? "See package licence",
          repository:
            typeof d.repository === "string" ? d.repository : d.repository?.url,
        });
      } catch {}
    }
  }
}
await walk("node_modules");
await fs.writeFile(
  "docs/THIRD_PARTY.json",
  JSON.stringify(
    rows.sort((a, b) => a.name.localeCompare(b.name)),
    null,
    2,
  ),
);
console.log(rows.length, "package licence records written.");
