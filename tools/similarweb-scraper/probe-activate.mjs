// Poll until the SEO Tools cards render, then dump every text node + button in the cards section.
import { loginFresh } from "./lib.mjs";

const { browser, context, page } = await loginFresh({ headless: true });
console.log(`✓ logged in: ${page.url()}`);

// Poll for activate button — it's the "启用" link/button inside the similarweb card.
console.log("polling for 启用 button…");
let found = false;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  const count = await page.locator("text=启用").count();
  const swCount = await page.evaluate(() => {
    // search img alt + src for similarweb
    const imgs = [...document.querySelectorAll("img")];
    return imgs.filter((i) => /similarweb/i.test(i.alt + " " + i.src)).length;
  });
  if (i % 5 === 0 || count > 0 || swCount > 0) {
    console.log(`  t=${i + 1}s 启用 nodes=${count} similarweb imgs=${swCount}`);
  }
  if (count > 0 && swCount > 0) { found = true; break; }
}

await page.screenshot({ path: "/tmp/dash-home-polled.png", fullPage: true });

if (!found) {
  console.log("✗ never saw activate button + similarweb logo");
  await browser.close();
  process.exit(1);
}

// Get all "启用" elements with full enclosing card context
const targets = await page.evaluate(() => {
  function climb(el, n) {
    let p = el;
    for (let i = 0; i < n && p?.parentElement; i++) p = p.parentElement;
    return p;
  }
  const nodes = [...document.querySelectorAll("*")].filter((el) => {
    const t = (el.textContent || "").trim();
    return t === "启用" && el.children.length === 0;
  });
  return nodes.map((el, idx) => {
    const card = climb(el, 8);
    const cardText = card ? card.textContent.replace(/\s+/g, " ").slice(0, 200) : "";
    const cardImgs = card
      ? [...card.querySelectorAll("img")].map((i) => i.src.split("/").pop()).join(",")
      : "";
    return {
      idx,
      tag: el.tagName,
      class: (el.className || "").toString().slice(0, 60),
      cardText: cardText.slice(0, 120),
      cardImgs
    };
  });
});
console.log("\n启用 nodes (deepest leaf):");
targets.forEach((t) => console.log(`  ${JSON.stringify(t)}`));

await browser.close();
