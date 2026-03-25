/**
 * ALB-29: Mobile report + preview — scrollHeight and screenshot (375x812).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const base = "http://127.0.0.1:3000";
const outDir = path.join("C:", "Shared", "Projects", "output", "ux-screenshots", "2026-03-25");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(base + "/report", { waitUntil: "domcontentloaded", timeout: 120000 });
const previewBtn = page.locator("#preview-btn");
if (await previewBtn.isVisible() && !(await previewBtn.isDisabled())) {
  await previewBtn.click();
  await page.waitForSelector("#preview-content", { state: "visible", timeout: 120000 }).catch(() => {});
}
await page.waitForTimeout(2000);

const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
const h1Style = await page.evaluate(() => {
  const h = document.querySelector("header h1");
  if (!h) return null;
  const cs = getComputedStyle(h);
  return { position: cs.position, width: cs.width, clip: cs.clip };
});

const shot = process.env.UX_ALB29_SHOT || "after-ALB-29-report-mobile.png";
await page.screenshot({ path: path.join(outDir, shot), fullPage: true });
await browser.close();

console.log(JSON.stringify({ issue: "ALB-29", scrollHeight, h1Computed: h1Style, consoleErrors, screenshot: path.join(outDir, shot) }, null, 2));
