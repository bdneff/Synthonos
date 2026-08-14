import { chromium } from "playwright-core";
import { preview } from "vite";

const server = await preview({ preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.mouse.move(640, 790);
await page.waitForTimeout(1600);
await page.screenshot({ path: ".impeccable/review/desktop.png" });

await page.click(".describe-input");
await page.keyboard.type("a warm wide pad with slow movement");
await page.click(".glass");
await page.mouse.move(640, 790);
await page.keyboard.down("a");
await page.keyboard.down("d");
await page.keyboard.down("g");
await page.waitForTimeout(1400);
await page.screenshot({ path: ".impeccable/review/desktop-live.png" });
await page.keyboard.up("a");
await page.keyboard.up("d");
await page.keyboard.up("g");

await page.click(".advanced-toggle");
await page.mouse.move(640, 790);
await page.waitForTimeout(600);
await page.screenshot({ path: ".impeccable/review/desktop-rack.png" });
await browser.close();
await server.httpServer.close();
process.exit(0);
