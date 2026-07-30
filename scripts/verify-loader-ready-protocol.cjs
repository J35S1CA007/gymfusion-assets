const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

const runtime = fs.readFileSync(
  new URL("./gymfusion-loader.js", `file://${__dirname}/`),
  "utf8"
);

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const controlledEmbed = (embedId, delayMs) => `
  <script>
    (() => {
      let ready = false;
      const emit = () => {
        if (!ready) return;
        parent.postMessage({ type: "GYMFUSION_READY", version: 1, embedId: "${embedId}" }, "*");
      };
      addEventListener("message", (event) => {
        if (event.data?.type === "GYMFUSION_READY_REQUEST" && event.data.version === 1) emit();
      });
      setTimeout(() => { ready = true; emit(); }, ${delayMs});
    })();
  <\/script>
`;

const sample = (page) =>
  page.evaluate(() => {
    const loader = document.getElementById("gfLoader");
    return {
      connected: Boolean(loader?.isConnected),
      hidden: Boolean(loader?.classList.contains("gf-is-hidden")),
    };
  });

const isDismissed = (state) => state.hidden || !state.connected;

const sampleLayout = (page) =>
  page.evaluate(() => {
    const background = document.querySelector(".gf-background-canvas").getBoundingClientRect();
    const brand = document.querySelector(".gf-brand").getBoundingClientRect();
    const center = document.querySelector(".gf-center").getBoundingClientRect();
    const progress = document.querySelector(".gf-progress").getBoundingClientRect();

    return {
      brandTopInset: brand.top - background.top,
      brandHorizontalCenterDelta:
        brand.left + brand.width / 2 - (background.left + background.width / 2),
      centerHorizontalCenterDelta:
        center.left + center.width / 2 - (background.left + background.width / 2),
      centerVerticalCenterDelta:
        center.top + center.height / 2 - (background.top + background.height / 2),
      progressHorizontalCenterDelta:
        progress.left + progress.width / 2 - (background.left + background.width / 2),
      progressBottomInset: background.bottom - progress.bottom,
      progressInsideComposition: document
        .querySelector(".gf-composition")
        .contains(document.querySelector(".gf-progress")),
      loadingWord: document.getElementById("gfLoadingText").textContent,
    };
  });

async function runScenario(browser, embedHtmls, pageMarkup = "") {
  const page = await browser.newPage({ viewport: { width: 430, height: 735 } });
  await page.route("http://runtime.test/**", (route) => {
    if (route.request().url().endsWith("/scripts/gymfusion-loader.js")) {
      return route.fulfill({ contentType: "text/javascript", body: runtime });
    }
    return route.fulfill({ contentType: "image/png", body: transparentPng });
  });

  const iframes = embedHtmls.map((embedHtml) => {
    const srcdoc = embedHtml.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    return `<iframe srcdoc="${srcdoc}"></iframe>`;
  }).join("");
  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        ${pageMarkup}
        ${iframes}
        <script src="http://runtime.test/scripts/gymfusion-loader.js"></script>
      </body>
    </html>
  `);
  await page.waitForSelector("#gfLoader");
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const controlled = await runScenario(browser, [
      controlledEmbed("controlled-first", 1000),
      controlledEmbed("controlled-second", 4000),
    ]);
    await controlled.waitForSelector("#gfLoader.gf-galaxy-loaded");
    const layout = await sampleLayout(controlled);
    assert.ok(
      Math.abs(layout.brandHorizontalCenterDelta) <= 1,
      "the brand must be horizontally centered within the background"
    );
    assert.equal(layout.brandTopInset, 40, "the mobile brand must sit in the top area");
    assert.ok(
      Math.abs(layout.centerHorizontalCenterDelta) <= 1,
      "the spinner and loading text must be horizontally centered within the background"
    );
    assert.ok(
      Math.abs(layout.centerVerticalCenterDelta) <= 1,
      "the spinner and loading text must be vertically centered within the background"
    );
    assert.ok(
      Math.abs(layout.progressHorizontalCenterDelta) <= 1,
      "the progress bar must be horizontally aligned with the background"
    );
    assert.ok(
      Math.abs(layout.progressBottomInset - 24) <= 1,
      "the mobile progress bar must sit 24px above the background's bottom edge"
    );
    assert.equal(
      layout.progressInsideComposition,
      false,
      "the progress bar must remain independent from the centered composition"
    );
    assert.equal(layout.loadingWord, "POTENTIAL", "embed pages must use the standard word sequence");
    await controlled.waitForTimeout(3800);
    assert.deepEqual(
      await sample(controlled),
      { connected: true, hidden: false },
      "the first READY must not dismiss while another controlled embed is pending"
    );
    await controlled.waitForTimeout(1700);
    assert.equal(isDismissed(await sample(controlled)), true, "valid READY should allow dismissal");
    await controlled.close();

    const legacy = await runScenario(browser, ["<p>Legacy embed</p>"]);
    await legacy.waitForTimeout(3800);
    assert.deepEqual(
      await sample(legacy),
      { connected: true, hidden: false },
      "legacy iframe load must wait for the readiness fail-open timeout"
    );
    await legacy.waitForTimeout(3000);
    assert.equal(isDismissed(await sample(legacy)), true, "legacy embed should fail open after timeout");
    await legacy.waitForTimeout(1100);
    assert.equal((await sample(legacy)).connected, false, "loader should complete removal");
    await legacy.close();

    const lateMenuEmbed = JSON.stringify(controlledEmbed("late-menu-button", 0)).replaceAll(
      "</script>",
      "<\\/script>"
    );
    const settling = await runScenario(
      browser,
      [controlledEmbed("settling-embed", 1000)],
      `<main class="wixui-page" style="width:300px;height:1200px"></main>
       <script>
         setTimeout(() => {
           document.querySelector('.wixui-page').style.width = '410px';
           const iframe = document.createElement('iframe');
           iframe.srcdoc = ${lateMenuEmbed};
           document.body.append(iframe);
         }, 4200);
       <\/script>`
    );
    await settling.waitForTimeout(4100);
    assert.deepEqual(
      await sample(settling),
      { connected: true, hidden: false },
      "loader must remain visible while the Wix page width is unsettled"
    );
    await settling.waitForTimeout(1900);
    assert.equal(
      isDismissed(await sample(settling)),
      true,
      "loader should dismiss after the settled Wix width remains quiet"
    );
    await settling.close();

    console.log("Loader READY protocol verification passed.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
