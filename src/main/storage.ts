import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { BeastDocument, validateDocument } from "../shared/model";
export function encodeNative(input: BeastDocument): Uint8Array {
  const d = validateDocument(input);
  const assets: Record<string, any> = {};
  const entries: Record<string, Uint8Array> = {};
  for (const [id, a] of Object.entries(d.assets)) {
    const bytes = Buffer.from(a.data, "base64");
    entries[`assets/${id}`] = bytes;
    assets[id] = {
      mime: a.mime,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
    };
  }
  entries["manifest.json"] = strToU8(
    JSON.stringify({ format: "BeastText", version: 1, assets }),
  );
  entries["document.json"] = strToU8(JSON.stringify({ ...d, assets: {} }));
  return zipSync(entries, { level: 6 });
}
export function decodeNative(bytes: Uint8Array): BeastDocument {
  if (bytes.length > 64 * 1024 * 1024)
    throw new Error("File exceeds the 64 MB native archive limit.");
  let size = 0,
    count = 0;
  const files = unzipSync(bytes, {
    filter: (f) => {
      if (
        ++count > 1000 ||
        !/^((manifest|document)\.json|assets\/[a-f\d-]{36})$/.test(f.name)
      )
        throw new Error("Unsafe or unexpected archive entry.");
      size += f.originalSize;
      if (f.originalSize > 32 * 1024 * 1024 || size > 100 * 1024 * 1024)
        throw new Error("Archive expands beyond the safety limit.");
      return true;
    },
  });
  if (!files["manifest.json"] || !files["document.json"])
    throw new Error("Not a BeastText document: required entries are missing.");
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  if (manifest.format !== "BeastText" || manifest.version !== 1)
    throw new Error(
      "This document version is unsupported. The original file has not been changed.",
    );
  const d = JSON.parse(strFromU8(files["document.json"]));
  if (d.version !== manifest.version || d.format !== manifest.format)
    throw new Error("Document manifest mismatch.");
  d.assets = {};
  for (const [id, a] of Object.entries(manifest.assets ?? {}) as [
    string,
    any,
  ][]) {
    const asset = files[`assets/${id}`];
    if (
      !asset ||
      asset.length !== a.size ||
      createHash("sha256").update(asset).digest("hex") !== a.sha256
    )
      throw new Error("An embedded image is missing or damaged.");
    d.assets[id] = {
      mime: a.mime,
      data: Buffer.from(asset).toString("base64"),
    };
  }
  return validateDocument(d);
}
export async function fingerprint(file: string) {
  try {
    return createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex");
  } catch (e: any) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
export async function atomicWrite(file: string, bytes: Uint8Array | string) {
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(temp, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temp, file);
  } catch (e) {
    await handle?.close();
    await fs.unlink(temp).catch(() => {});
    throw e;
  }
}
export class SafetyStore {
  constructor(public root: string) {}
  async initialise() {
    for (const dir of ["recovery", "backups", "templates", "logs"])
      await fs.mkdir(path.join(this.root, dir), { recursive: true });
  }
  async recover(d: BeastDocument, file: string | null) {
    await atomicWrite(
      path.join(this.root, "recovery", `${d.id}.beasttext`),
      encodeNative(d),
    );
    await atomicWrite(
      path.join(this.root, "recovery", `${d.id}.json`),
      JSON.stringify({ file, title: d.title, modified: d.modified }),
    );
  }
  async recoveries() {
    const result = [];
    for (const name of await fs.readdir(path.join(this.root, "recovery"))) {
      if (!name.endsWith(".beasttext")) continue;
      try {
        const doc = decodeNative(
          await fs.readFile(path.join(this.root, "recovery", name)),
        );
        const info = JSON.parse(
          await fs
            .readFile(
              path.join(
                this.root,
                "recovery",
                name.replace(".beasttext", ".json"),
              ),
              "utf8",
            )
            .catch(() => "{}"),
        );
        result.push({ doc, ...info });
      } catch {
        /* Retain damaged snapshots so the user can inspect them. */
      }
    }
    return result;
  }
  async clearRecovery(id: string) {
    if (!/^[a-f\d-]{36}$/.test(id))
      throw new Error("Invalid recovery identifier");
    await Promise.all(
      ["beasttext", "json"].map((ext) =>
        fs
          .unlink(path.join(this.root, "recovery", `${id}.${ext}`))
          .catch(() => {}),
      ),
    );
  }
  async backup(file: string, id: string, retention: number) {
    if (retention === 0) return;
    const target = path.join(this.root, "backups", id);
    await fs.mkdir(target, { recursive: true });
    try {
      await fs.copyFile(
        file,
        path.join(
          target,
          `${Date.now()}-${randomUUID()}${path.extname(file).toLowerCase() || ".beasttext"}`,
        ),
      );
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    const names = (await fs.readdir(target)).sort().reverse();
    await Promise.all(
      names.slice(retention).map((n) => fs.unlink(path.join(target, n))),
    );
  }
}
