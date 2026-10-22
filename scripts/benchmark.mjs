import { _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "beast-perf-"));
const app = await electron.launch({
  args: ["--no-sandbox", "--disable-gpu", path.resolve(".")],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":99",
    BEASTTEXT_DATA: root,
  },
});
try {
  const page = await app.firstWindow();
  await page
    .getByRole("button", { name: "New document", exact: true })
    .waitFor();
  await page.screenshot({ path: "docs/start-screen.png" });
  const t = performance.now();
  await app.evaluate(
    ({ BrowserWindow }, f) =>
      BrowserWindow.getAllWindows()[0].webContents.send("beast:open", [f]),
    path.resolve("samples/long-50000-words.beasttext"),
  );
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.waitFor();
  await page
    .getByRole("button", { name: "50,000 words", exact: true })
    .waitFor();
  const openMs = performance.now() - t;
  await editor.press("Control+End");
  await page.evaluate(() => {
    const el = document.querySelector(".tiptap");
    window.__beastTimes = [];
    let start;
    el.addEventListener("keydown", () => {
      start = performance.now();
    });
    new MutationObserver(() => {
      if (start !== undefined) {
        window.__beastTimes.push(performance.now() - start);
        start = undefined;
      }
    }).observe(el, { subtree: true, childList: true, characterData: true });
  });
  await page.keyboard.type(" A careful measurement of everyday typing.", {
    delay: 20,
  });
  const keyTimes = await page.evaluate(() => window.__beastTimes);
  const s = performance.now();
  await page.keyboard.press("Control+f");
  await page.getByRole("textbox", { name: "Find text" }).fill("careful");
  await page.getByText(/^1 of 500[01]$/).waitFor();
  const searchMs = performance.now() - s;
  await page.getByRole("button", { name: "Close find" }).click();
  const paste = await page.evaluate(async () => {
    const editor = document.querySelector(".tiptap").editor;
    const text =
      "Large paste measurement with structured document content. ".repeat(1250);
    const t = performance.now();
    editor
      .chain()
      .focus()
      .insertContent({ type: "paragraph", content: [{ type: "text", text }] })
      .run();
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    return {
      characters: text.length,
      transactionAndTwoFramesMs: performance.now() - t,
    };
  });
  const metrics = await app.evaluate(({ app }) =>
    app.getAppMetrics().map((p) => ({ type: p.type, memory: p.memory })),
  );
  const spelling = await page.evaluate(() =>
    window.beast.bootstrap().then((b) => b.spelling),
  );
  await page.screenshot({ path: "docs/long-document.png" });
  await fs.writeFile(
    "docs/DESKTOP_PERFORMANCE.json",
    JSON.stringify(
      {
        environment: {
          platform: process.platform,
          electron: "45.0.0",
          gpu: "disabled for test",
          display: "Xorg dummy 1440x1000",
        },
        open50000WordsMs: openMs,
        search5000MatchesMs: searchMs,
        typing: {
          samples: keyTimes.length,
          meanKeydownToDomMutationMs:
            keyTimes.reduce((a, b) => a + b, 0) / keyTimes.length,
          maxKeydownToDomMutationMs: Math.max(...keyTimes),
          note: "Instrumented keydown to document DOM mutation; not input-to-paint latency.",
        },
        largePaste: paste,
        processMetrics: metrics,
        bundledSpellingLanguages: spelling,
        notes:
          "One measured Linux run with a repetitive synthetic 500-paragraph document; not a Windows laptop benchmark.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Desktop measurements and screenshots written.");
} finally {
  const ended = new Promise((r) => app.process().once("exit", r));
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await ended;
  await fs.rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
