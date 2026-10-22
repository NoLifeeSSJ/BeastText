import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const { version } = JSON.parse(await fs.readFile("package.json", "utf8"));
const file = `BeastText-${version}-win-x64.zip`;
const bytes = await fs.readFile(`release/${file}`);
await fs.writeFile(
  "release/release.json",
  JSON.stringify(
    {
      product: "BeastText",
      version,
      platform: "win32",
      arch: "x64",
      file,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
for (const f of ["Install-BeastText.ps1", "Uninstall-BeastText.ps1"])
  await fs.copyFile(f, `release/${f}`);
console.log(
  "Release metadata and installers saved. Windows signing and Windows acceptance testing are separate steps.",
);
