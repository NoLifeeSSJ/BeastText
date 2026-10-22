import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fromTemplate, p, h } from "../src/shared/templates";
import { newDocument } from "../src/shared/model";
import { encodeNative, decodeNative, SafetyStore } from "../src/main/storage";
import { exportDocx } from "../src/main/conversion";
async function main() {
  await fs.mkdir("samples", { recursive: true });
  const docs = [
    ["short-letter", fromTemplate("letter")],
    ["report", fromTemplate("report")],
    ["several-tables", fromTemplate("minutes")],
    ["Unicode café’s 🐻", fromTemplate("journal")],
  ] as const;
  const report = docs[1][1];
  const asset = crypto.randomUUID();
  const bytes = await fs.readFile("resources/beasttext.png");
  report.assets[asset] = { mime: "image/png", data: bytes.toString("base64") };
  report.content.content!.splice(6, 0, {
    type: "image",
    attrs: {
      src: `beast-asset:${asset}`,
      alt: "BeastText application identity",
      width: 220,
      height: 220,
    },
  });
  docs[2][1].content.content!.push(
    ...structuredClone(
      docs[2][1].content.content!.filter((n) => n.type === "table"),
    ),
  );
  const long = newDocument("A long document — 50,000 words");
  const sentence =
    "Careful writing brings clear ideas into focus for every reader.";
  long.content.content = Array.from({ length: 500 }, (_, i) =>
    p(Array.from({ length: 10 }, () => sentence).join(" ")),
  );
  for (const [name, d] of [...docs, ["long-50000-words", long] as const])
    await fs.writeFile(`samples/${name}.beasttext`, encodeNative(d));
  const memory = process.memoryUsage().rss;
  const t = performance.now(),
    native = encodeNative(long),
    encoded = performance.now();
  decodeNative(native);
  const decoded = performance.now();
  const docx = await exportDocx(long),
    exported = performance.now();
  const store = new SafetyStore("/tmp/beasttext-benchmark");
  await store.initialise();
  await store.recover(long, null);
  const recovered = performance.now();
  await fs.writeFile(
    "docs/PERFORMANCE.json",
    JSON.stringify(
      {
        environment: {
          platform: process.platform,
          arch: process.arch,
          node: process.version,
        },
        document: {
          words: 50000,
          paragraphs: 500,
          nativeBytes: native.length,
          docxBytes: docx.length,
        },
        milliseconds: {
          nativeEncode: encoded - t,
          nativeDecode: decoded - encoded,
          docxExport: exported - decoded,
          recoveryWrite: recovered - exported,
        },
        processRssBytes: process.memoryUsage().rss,
        processRssDeltaBytes: process.memoryUsage().rss - memory,
        notes:
          "Single measured run, warm Node process. Desktop typing/search/render measurements are recorded separately. These measurements are not Windows performance claims.",
      },
      null,
      2,
    ) + "\n",
  );
  await fs.rm("/tmp/beasttext-benchmark", { recursive: true, force: true });
  console.log("Five sample documents and measured timings generated.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
