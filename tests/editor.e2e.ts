import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
let app: ElectronApplication, page: Page, root: string;
async function launch() {
  app = await electron.launch({
    args: ["--no-sandbox", "--disable-gpu", path.resolve(".")],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      BEASTTEXT_DATA: root,
    },
  });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].focus(),
  );
  await page.bringToFront();
  await expect(page.getByText("What will you write today?")).toBeVisible();
}
async function nativeDialog(savePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, savePath);
}
test.beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "beast-e2e-"));
  await launch();
});
test.afterEach(async () => {
  const process = app?.process();
  if (process && process.exitCode === null && process.signalCode === null) {
    const ended = new Promise((r) => process.once("exit", r));
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await ended;
  }
  await fs.rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
});
test("real editor: formatting, structure, image, table, comment, undo, find, native save/reopen", async () => {
  await page.getByRole("button", { name: "New document", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.fill("A remarkable draft");
  await page.keyboard.press("Control+a");
  await page
    .getByRole("button", { name: "Bold (Ctrl+B)", exact: true })
    .click();
  await expect(editor.locator("strong")).toHaveText("A remarkable draft");
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => r())),
  );
  await editor.press("Control+End");
  await editor.press("Enter");
  await expect(editor.locator("p")).toHaveCount(2);
  await page.getByRole("button", { name: "Heading 1", exact: true }).click();
  await page.keyboard.type("A clear direction");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Find the needle. Find the needle.");
  await page.keyboard.press("Control+f");
  await page.getByRole("textbox", { name: "Find text" }).fill("needle");
  await expect(page.getByText("1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("idea");
  await page.getByRole("button", { name: "Replace all", exact: true }).click();
  await expect(editor).toContainText("Find the idea. Find the idea.");
  await page.getByRole("button", { name: "Close find", exact: true }).click();
  await editor.press("Control+z");
  await expect(editor).toContainText("needle");
  await editor.press("Control+y");
  await expect(editor).toContainText("idea");
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  await page
    .getByRole("button", { name: "Insert table", exact: true })
    .last()
    .click();
  await expect(editor.locator("table")).toBeVisible();
  await editor.locator("th").first().click();
  await page.keyboard.type("Owner");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Status");
  const imageFile = path.resolve("resources/beasttext.png");
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, imageFile);
  await page.getByRole("button", { name: "Insert image from file" }).click();
  await expect(editor.locator("img")).toBeVisible();
  await page
    .getByRole("button", { name: "Insert explicit page break" })
    .click();
  await expect(editor.locator("[data-page-break]")).toBeVisible();
  const savePath = path.join(root, "draft café's 🐻.beasttext");
  await nativeDialog(savePath);
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Document saved safely.")).toBeVisible();
  const initial = await fs.readFile(savePath);
  expect(initial.length).toBeGreaterThan(500);
  await page.keyboard.press("Control+w");
  await expect(page.getByText("What will you write today?")).toBeVisible();
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, savePath);
  await page
    .getByRole("button", { name: /Open a document/ })
    .first()
    .click();
  await expect(editor).toContainText("A remarkable draft");
  await expect(editor.locator("strong").first()).toContainText(
    "A remarkable draft",
  );
  await expect(editor.locator("h1")).toContainText("A clear direction");
  await expect(editor.locator("table")).toBeVisible();
  await expect(editor.locator("img")).toBeVisible();
  await expect(editor.locator("[data-page-break]")).toBeVisible();
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });
});
test("native save cancellation, close prompts, external changes and comments", async () => {
  await page.getByRole("button", { name: "New document", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.fill("A comment on this paragraph");
  await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Add comment to selection" }).click();
  await page.getByLabel("Your comment").fill("Keep this detail");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Show comments" }).click();
  await expect(page.getByText("Keep this detail")).toBeVisible();
  const file = path.join(root, "comments.beasttext");
  await nativeDialog(file);
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Document saved safely.")).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" More writing.");
  await fs.writeFile(file, "external content");
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    });
  });
  await page.keyboard.press("Control+s");
  expect(await fs.readFile(file, "utf8")).toBe("external content");
  await page.keyboard.press("Control+w");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor).toBeVisible();
});
test("PDF and DOCX export run through the actual desktop bridge; preview opens", async () => {
  await page.getByRole("button", { name: /Report A clear structure/ }).click();
  const out = path.join(root, "report.pdf");
  await nativeDialog(out);
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect
    .poll(async () =>
      fs
        .stat(out)
        .then((s) => s.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(1000);
  expect((await fs.readFile(out)).subarray(0, 5).toString()).toBe("%PDF-");
  await fs.copyFile(out, "test-results/report.pdf");
  const docx = path.join(root, "report.docx");
  await nativeDialog(docx);
  await page.getByRole("button", { name: "DOCX", exact: true }).click();
  await page
    .getByRole("button", { name: "Export a copy", exact: true })
    .click();
  await expect
    .poll(async () =>
      fs
        .stat(docx)
        .then((s) => s.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(1000);
  await page
    .getByRole("button", { name: "Paginated print preview", exact: true })
    .click();
  await expect.poll(() => app.windows().length).toBe(2);
});
test("recovery survives an unexpected process exit and restores untitled content", async () => {
  await page.getByRole("button", { name: "New document", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.fill("Unsaved words worth recovering 🐻");
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByLabel("Recovery interval (seconds)").fill("5");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        fs
          .readdir(path.join(root, "recovery"))
          .then((ns) => ns.filter((n) => n.endsWith(".beasttext")).length),
      { timeout: 12000 },
    )
    .toBe(1);
  const processToCrash = app.process();
  const crashed = new Promise((resolve) =>
    processToCrash.once("exit", resolve),
  );
  if (process.platform === "win32")
    await promisify(execFile)("taskkill", [
      "/PID",
      String(processToCrash.pid),
      "/T",
      "/F",
    ]);
  else processToCrash.kill("SIGKILL");
  await crashed;
  await launch();
  await expect(page.getByText("Pick up where you left off")).toBeVisible();
  await page.getByRole("button", { name: "Recover as new" }).click();
  await expect(
    page.getByRole("textbox", { name: "Document editor" }),
  ).toContainText("Unsaved words worth recovering 🐻");
});
test("sanitised HTML import, native save cancellation and independent tab history", async () => {
  const file = path.join(root, "untrusted.html");
  await fs.writeFile(
    file,
    '<h1>Imported heading</h1><p><b>Keep formatting</b><script>window.unsafeRan=true</script><a href="javascript:alert(1)">bad link</a><img src="https://example.com/tracker.png"><span style="background-image:url(https://example.com/a)">Safe text</span></p>',
  );
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, file);
  await page
    .getByRole("button", { name: /Open a document/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Continue editing", exact: true })
    .click();
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await expect(editor.locator("h1")).toHaveText("Imported heading");
  await expect(editor.locator("strong")).toHaveText("Keep formatting");
  expect(await page.evaluate(() => (window as any).unsafeRan)).toBeUndefined();
  await expect(editor.locator("script,img")).toHaveCount(0);
  await expect(editor.locator("a")).toHaveCount(0);
  await app.evaluate(({ dialog }) => {
    dialog.showSaveDialog = async () => ({ canceled: true, filePath: "" });
  });
  await page.keyboard.press("Control+s");
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  expect(await fs.readFile(file, "utf8")).toContain("<script>");
  await page.keyboard.press("Control+n");
  const second = page.getByRole("textbox", { name: "Document editor" });
  await second.fill("Separate tab history");
  await page.keyboard.press("Control+Shift+Tab");
  await expect(editor).toContainText("Imported heading");
  await page.keyboard.press("Control+Tab");
  await expect(second).toHaveText("Separate tab history");
  await page.keyboard.press("Control+z");
  await expect(second).toBeEmpty();
});
test("saved comments and resolved state survive native reopen; save-as/copy preserve active destination", async () => {
  await page.getByRole("button", { name: "New document", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.fill("Anchor these words");
  await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: "Add comment to selection" }).click();
  await page.getByLabel("Your comment").fill("Persistent comment");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  const saved = path.join(root, "review.beasttext");
  await nativeDialog(saved);
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Document saved safely.")).toBeVisible();
  await page.keyboard.press("Control+w");
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, saved);
  await page
    .getByRole("button", { name: /Open a document/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Show comments" }).click();
  await expect(
    page.getByText("Persistent comment", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeVisible();
  await expect(editor.locator("[data-comment-id]")).toHaveText(
    "Anchor these words",
  );
  await page.getByRole("button", { name: "File", exact: true }).click();
  const copy = path.join(root, "copy.beasttext");
  await nativeDialog(copy);
  await page.getByRole("button", { name: "Save a Copy", exact: true }).click();
  await expect(page.getByText("A separate copy was saved.")).toBeVisible();
  expect((await fs.stat(copy)).size).toBeGreaterThan(100);
  const originalBytes = await fs.readFile(saved),
    copyBytes = await fs.readFile(copy);
  await editor.press("Control+End");
  await editor.pressSequentially(" Keep saving to the original file.");
  await editor.press("Control+s");
  await expect(page.getByText("Document saved safely.")).toBeVisible();
  expect(await fs.readFile(saved)).not.toEqual(originalBytes);
  expect(await fs.readFile(copy)).toEqual(copyBytes);
});
test("bundled offline spelling initialises and returns local suggestions", async () => {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.beast.bootstrap().then((b) => b.spellingReady),
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  await page.getByRole("button", { name: "New document", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Document editor" });
  // The app builds the real menu and corrections. Only OS popup presentation
  // is replaced, because CDP cannot interact with a Windows native menu.
  await app.evaluate(({ Menu }) => {
    (globalThis as any).__beastSpellingMenu = null;
    Menu.prototype.popup = function () {
      (globalThis as any).__beastSpellingMenu = this;
    };
  });
  await editor.click();
  await editor.pressSequentially("speling ", { delay: 80 });
  const point = await editor.locator("p").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rect = range.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y, { button: "right" });
  await expect
    .poll(() =>
      app.evaluate(() =>
        ((globalThis as any).__beastSpellingMenu?.items ?? []).map(
          (item: any) => item.label.toLowerCase(),
        ),
      ),
    )
    .toContain("spelling");
  await app.evaluate(() => {
    const menu = (globalThis as any).__beastSpellingMenu;
    menu.items
      .find((item: any) => item.label.toLowerCase() === "spelling")
      .click();
  });
  await expect(editor).toHaveText("spelling ");
});
