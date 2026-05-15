import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const tag = process.env.UX_ALB79_TAG || "before";
const date = process.env.UX_ALB79_DATE || "2026-03-25";
const outDir = path.join("C:", "Shared", "Projects", "output", "ux-screenshots", date);
const outJsonDir = path.join("C:", "Shared", "Projects", "output", "ux-metrics");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(outJsonDir, { recursive: true });

const runCapture = async (viewport, suffix) => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("http://127.0.0.1:3000/report", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1500);

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const visibleText = await page.evaluate(() => (document.body?.innerText || "").trim());
  const navSnapshot = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".mobile-bottom-nav-item"));
    return items.map((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return { text, width: el.getBoundingClientRect().width };
    });
  });

  const screenshotPath = path.join(outDir, `${tag}-ALB-79-report${suffix}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  return { viewport, scrollHeight, consoleErrors, visibleText, navSnapshot, screenshotPath };
};

const desktop = await runCapture({ width: 1280, height: 720 }, "");
const mobile = await runCapture({ width: 375, height: 812 }, "-mobile");

const result = {
  issue: "ALB-79",
  tag,
  date,
  desktop,
  mobile
};

const jsonPath = path.join(outJsonDir, `jira-alb79-${tag}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ jsonPath, desktopHeight: desktop.scrollHeight, mobileHeight: mobile.scrollHeight }, null, 2));
