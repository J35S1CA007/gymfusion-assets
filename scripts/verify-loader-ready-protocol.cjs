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
    const emblem = document.querySelector(".gf-emblem").getBoundingClientRect();
    const logo = document.querySelector(".gf-logo").getBoundingClientRect();
    const logoArtwork = document.querySelector(".gf-logo-art").getBoundingClientRect();
    const center = document.querySelector(".gf-center").getBoundingClientRect();
    const wheel = document.querySelector(".gf-wheel");
    const progress = document.querySelector(".gf-progress").getBoundingClientRect();

    return {
      brandTopInset: brand.top - background.top,
      brandHorizontalCenterDelta:
        brand.left + brand.width / 2 - (background.left + background.width / 2),
      emblemWidth: emblem.width,
      emblemHeight: emblem.height,
      logoWidth: logo.width,
      logoArtworkWidth: logoArtwork.width,
      logoArtworkHeight: logoArtwork.height,
      centerHorizontalCenterDelta:
        center.left + center.width / 2 - (background.left + background.width / 2),
      centerVerticalCenterDelta:
        center.top + center.height / 2 - (background.top + background.height / 2),
      progressHorizontalCenterDelta:
        progress.left + progress.width / 2 - (background.left + background.width / 2),
      progressWidth: progress.width,
      progressHeight: progress.height,
      progressBottomInset: background.bottom - progress.bottom,
      progressInsideComposition: document
        .querySelector(".gf-composition")
        .contains(document.querySelector(".gf-progress")),
      wheelComputedWidth: getComputedStyle(wheel).width,
      wheelComputedHeight: getComputedStyle(wheel).height,
      loadingWord: document.getElementById("gfLoadingText").textContent,
      loadingFontFamily: getComputedStyle(document.querySelector(".gf-loading")).fontFamily,
    };
  });

async function runScenario(
  browser,
  embedHtmls,
  pageMarkup = "",
  viewport = { width: 430, height: 735 }
) {
  const page = await browser.newPage({ viewport });
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
    assert.equal(layout.logoArtworkWidth, 228, "the mobile logo artwork must be 228px wide");
    assert.ok(
      Math.abs(layout.logoArtworkHeight - 69.55) <= 0.1,
      "the mobile logo artwork crop must scale proportionally"
    );
    assert.ok(
      Math.abs(layout.centerHorizontalCenterDelta) <= 1,
      "the spinner and loading text must be horizontally centered within the background"
    );
    assert.ok(
      Math.abs(layout.centerVerticalCenterDelta - 8) <= 1,
      "the spinner and loading text must sit 8px below the background's vertical center"
    );
    assert.ok(
      Math.abs(layout.progressHorizontalCenterDelta) <= 1,
      `the progress bar must be horizontally aligned with the background (${layout.progressHorizontalCenterDelta}px)`
    );
    assert.equal(layout.progressWidth, 320, "the mobile progress bar must be 320px wide");
    assert.equal(layout.progressHeight, 9, "the mobile progress bar must be 9px high");
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
    assert.equal(
      layout.loadingFontFamily,
      "GamuthDisplay, Impact",
      "loading text must use GamuthDisplay with Impact as its sole fallback"
    );
    await controlled.waitForTimeout(3800);
    assert.deepEqual(
      await sample(controlled),
      { connected: true, hidden: false },
      "the first READY must not dismiss while another controlled embed is pending"
    );
    await controlled.waitForTimeout(1700);
    assert.equal(isDismissed(await sample(controlled)), true, "valid READY should allow dismissal");
    await controlled.close();

    const desktop = await runScenario(
      browser,
      [controlledEmbed("desktop-layout", 4000)],
      "",
      { width: 1440, height: 900 }
    );
    await desktop.waitForSelector("#gfLoader.gf-galaxy-loaded");
    await desktop.waitForTimeout(700);
    const desktopLayout = await sampleLayout(desktop);
    assert.equal(desktopLayout.brandTopInset, 30, "the desktop brand must sit 30px from the top");
    assert.equal(desktopLayout.emblemWidth, 80, "the desktop emblem must be 80px wide");
    assert.equal(desktopLayout.emblemHeight, 80, "the desktop emblem must be 80px high");
    assert.equal(desktopLayout.logoWidth, 345, "the desktop logo artwork must be 345px wide");
    assert.ok(
      Math.abs(desktopLayout.centerHorizontalCenterDelta) <= 1,
      "the desktop spinner and loading text must remain horizontally centered"
    );
    assert.ok(
      Math.abs(desktopLayout.centerVerticalCenterDelta - 10) <= 1,
      "the desktop spinner and loading text must sit 10px below vertical center"
    );
    assert.equal(desktopLayout.wheelComputedWidth, "86px", "the desktop spinner must be 86px wide");
    assert.equal(desktopLayout.wheelComputedHeight, "86px", "the desktop spinner must be 86px high");
    assert.ok(
      Math.abs(desktopLayout.progressHorizontalCenterDelta) <= 1,
      "the desktop progress bar must remain horizontally centered"
    );
    assert.equal(desktopLayout.progressWidth, 780, "the desktop progress bar must be 780px wide");
    assert.equal(desktopLayout.progressHeight, 15, "the desktop progress bar must be 15px high");
    assert.equal(
      desktopLayout.progressBottomInset,
      12,
      "the desktop progress bar must sit 12px above the bottom"
    );
    assert.equal(
      desktopLayout.loadingFontFamily,
      "GamuthDisplay, Impact",
      "desktop loading text must use Impact as the sole fallback"
    );
    await desktop.close();

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
