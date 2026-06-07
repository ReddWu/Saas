// Now in similarweb popup, navigate to keyword research, search a test keyword, find KD/volume.
import { loginFresh, openSimilarweb } from "./lib.mjs";

const TEST_KW = "ai visibility tools";

const { browser, context, page } = await loginFresh({ headless: true });
console.log(`✓ logged in dashboard`);

const sw = await openSimilarweb(context, page);
console.log(`✓ similarweb open at ${sw.url()}`);

// Navigate to keyword research home (the "关键词研究" nav item)
await sw.locator("text=关键词研究").first().click();
await sw.waitForTimeout(4000);
await sw.waitForLoadState("networkidle").catch(() => null);
console.log(`  at ${sw.url()}`);
await sw.screenshot({ path: "/tmp/sw-kw-home.png", fullPage: true });

// Dump all visible inputs
const allInputs = await sw.$$eval("input, textarea", (els) =>
  els.map((el, i) => {
    const r = el.getBoundingClientRect();
    return {
      i,
      type: el.tagName + (el.type ? "/" + el.type : ""),
      placeholder: el.placeholder || "",
      aria: el.getAttribute("aria-label") || "",
      class: (el.className || "").toString().slice(0, 60),
      visible: r.width > 50 && r.height > 10,
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width)
    };
  })
);
console.log("All inputs on keyword research home:");
allInputs.forEach((i) => console.log(`  [${i.i}]`, JSON.stringify(i)));

// Choose the widest visible input that's NOT support/knowledge
const candidates = allInputs.filter((i) => i.visible && !/知识中心|EducationBar/.test(i.placeholder + " " + i.class));
const candidate = candidates.sort((a, b) => b.w - a.w)[0];
if (!candidate) {
  console.log("✗ no candidate input");
  await browser.close();
  process.exit(1);
}
console.log(`→ using input nth(${candidate.i})`);

const searchBox = sw.locator("input, textarea").nth(candidate.i);
await searchBox.scrollIntoViewIfNeeded();
await searchBox.click();
await searchBox.fill(TEST_KW);
await sw.waitForTimeout(2500);
await sw.screenshot({ path: "/tmp/sw-typed.png", fullPage: true });
await searchBox.press("Enter");
await sw.waitForTimeout(6000);
await sw.waitForLoadState("networkidle").catch(() => null);
await sw.waitForTimeout(2000);

console.log(`\nAfter search:`);
console.log(`  URL: ${sw.url()}`);
console.log(`  title: ${await sw.title()}`);
await sw.screenshot({ path: "/tmp/sw-result.png", fullPage: true });

const body = await sw.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 2500));
console.log("\nBody snippet:");
console.log(body);

await browser.close();
