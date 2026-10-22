// Desktop launcher for this isolated Linux cloud container only.
// Production Windows launches use the installed EXE and retain the outer sandbox.
import { _electron as electron, expect } from "@playwright/test";
import path from "node:path";
const app = await electron.launch({
  args: ["--no-sandbox", "--disable-gpu", path.resolve(".")],
  env: { ...process.env, BEASTTEXT_DATA: "/workspace/.local/BeastText" },
});
const page = await app.firstWindow();
if (!(await page.locator(".beast-editor:visible").count()))
  await page.getByRole("button", { name: "New document", exact: true }).click();
await expect(
  page.getByRole("textbox", { name: "Document editor" }),
).toBeEditable();
console.log(
  "BeastText is running. The desktop document editor is ready for input.",
);
await new Promise((resolve) => app.process().once("exit", resolve));
