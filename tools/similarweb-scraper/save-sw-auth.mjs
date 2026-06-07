// One-time: log in, click 打开 to get similarweb popup, save BOTH dashboard auth AND the
// similarweb popup's storage state. Next runs can navigate to sim.3ue.co directly.
import { writeFileSync } from "node:fs";
import { loginFresh } from "./lib.mjs";

const { browser, context, page } = await loginFresh({ headless: true });
console.log(`✓ logged in dashboard: ${page.url()}`);
await page.locator("text=打开").nth(1).waitFor({ state: "visible", timeout: 30000 });

const [popup] = await Promise.all([
  context.waitForEvent("page", { timeout: 30000 }),
  page.locator("text=打开").nth(1).click()
]);

await popup.waitForLoadState("domcontentloaded");
await popup.waitForLoadState("networkidle").catch(() => null);
await popup.waitForTimeout(5000);
console.log(`✓ similarweb popup opened: ${popup.url()}`);

// Save full context state (covers cookies for both dash.3ue.co and sim.3ue.co)
await context.storageState({ path: "./.sw-auth.json" });
console.log("✓ storage state saved to ./.sw-auth.json");

// Also note: the popup may have additional cookies. Print them for visibility.
const cookies = await context.cookies();
const swCookies = cookies.filter((c) => /3ue\.co/.test(c.domain));
console.log(`  cookies for *.3ue.co: ${swCookies.length}`);
swCookies.forEach((c) => console.log(`    ${c.domain} ${c.name}`));

await browser.close();
