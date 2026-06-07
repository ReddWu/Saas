// Just click 打开 and observe everything — events, new pages, URL changes, alerts.
import { loginFresh } from "./lib.mjs";

const { browser, context, page } = await loginFresh({ headless: true });
console.log(`✓ logged in: ${page.url()}`);
await page.locator("text=打开").nth(1).waitFor({ state: "visible", timeout: 30000 });

context.on("page", (p) => {
  console.log(`[event] new page: ${p.url()}`);
});
page.on("popup", (p) => {
  console.log(`[event] popup: ${p.url()}`);
});
page.on("dialog", (d) => {
  console.log(`[event] dialog type=${d.type()} message=${d.message()}`);
});
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log(`[event] main nav: ${f.url()}`);
});

console.log("→ clicking 打开 nth(1)");
const target = page.locator("text=打开").nth(1);

// Check the element's href / tag / onclick to understand the trigger
const info = await target.evaluate((el) => {
  let p = el;
  const attrs = {};
  for (let i = 0; i < 5 && p; i++) {
    if (p.tagName === "A") attrs.href = p.getAttribute("href") || "";
    if (p.tagName === "BUTTON") attrs.button = true;
    if (p.getAttribute && p.getAttribute("target")) attrs.target = p.getAttribute("target");
    p = p.parentElement;
  }
  return { tag: el.tagName, attrs, html: el.outerHTML.slice(0, 200) };
});
console.log(`  element info:`, JSON.stringify(info));

await target.click();
console.log("→ clicked, waiting 10s for events");
await page.waitForTimeout(10000);

console.log(`\nFinal state:`);
console.log(`  page.url: ${page.url()}`);
console.log(`  context.pages: ${context.pages().length}`);
context.pages().forEach((p, i) => console.log(`    [${i}] ${p.url()}`));

await page.screenshot({ path: "/tmp/after-open-click.png", fullPage: true });

await browser.close();
