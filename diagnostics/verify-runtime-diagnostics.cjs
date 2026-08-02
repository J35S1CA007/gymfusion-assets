const fs = require("fs");
const { chromium } = require("playwright");

const diagnosticsSource = fs.readFileSync(
  "/Users/ccuser/gymfusion-assets/diagnostics/mobile-loader-runtime-diagnostics.js",
  "utf8"
);
const font = fs.readFileSync(
  "/Users/ccuser/gymfusion-assets/Gamuth Font Family/GamuthSansWeb-Bold.tester.woff2"
);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69vgNwAAAABJRU5ErkJggg==",
  "base64"
);

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script>
    window.__captures = [];
    window.__gfMobileLoaderDiagnosticScreenshotCapture = async (detail) => {
      window.__captures.push(detail);
      return { synthetic: true, name: detail.name };
    };
  </script>
  <script>${diagnosticsSource}</script>
  <style id="gf-loader-style">
    @font-face{font-family:DiagnosticFont;src:url('/diagnostic-font.woff2') format('woff2');font-display:swap}
    :root{--gf-galaxy-position:center top}
    #gfLoader{position:fixed;inset:0;--gf-entry-width:430px;--gf-entry-height:735px;--gf-composition-top:85px;--gf-brand-gap:12px}
    .gf-background-canvas{position:absolute;inset:0;background:url('/loaders/mobile%20loader%20images/current/test.png') center top/100% auto no-repeat;opacity:0}
    #gfLoader.gf-galaxy-loaded .gf-background-canvas{opacity:.86}
    .gf-composition{position:absolute;top:var(--gf-composition-top);left:50%;width:284px;height:343.5px;transform:translateX(-50%)}
    .gf-emblem{width:64px;height:64px}.gf-logo,.gf-logo img{display:block;width:218px;height:100px}
    .gf-wheel{width:62px;height:62px}.gf-loading{width:262px;min-height:38px;font:17px/1.35 DiagnosticFont,serif;letter-spacing:1.19px}
    .gf-progress{width:284px;height:7px}.gf-progress-fill{width:4%;height:100%;transition:width 50ms linear}
  </style>
</head>
<body>
  <script>
    const shell = document.createElement('div');
    shell.id = 'gfLoader';
    shell.className = 'gf-loader-embed-page';
    shell.dataset.gfShellVersion = '2';
    shell.dataset.gfPageMode = 'embed';
    shell.innerHTML = '<div class="gf-background-canvas"></div><div class="gf-composition"><div class="gf-emblem"></div><picture class="gf-logo"><img src="/loaders/logos/test.png" alt=""></picture><div class="gf-wheel"></div><div class="gf-loading">Loading... <span id="gfLoadingText">POTENTIAL</span></div><div class="gf-progress"><div class="gf-progress-fill"></div></div></div>';
    document.body.prepend(shell);

    setTimeout(() => shell.querySelector('.gf-progress-fill').style.width = '42%', 80);
    setTimeout(() => document.getElementById('gfLoadingText').textContent = 'EMBED SYSTEMS', 110);
    setTimeout(() => shell.classList.add('gf-galaxy-loaded'), 140);
    setTimeout(() => shell.style.setProperty('--gf-composition-top', '86px'), 170);
    setTimeout(() => shell.querySelector('.gf-composition').setAttribute('data-test-state', 'changed'), 200);
    setTimeout(() => {
      const iframe = document.createElement('iframe');
      iframe.src = '/frame';
      iframe.id = 'diagnostic-frame';
      document.body.appendChild(iframe);
    }, 230);
    setTimeout(() => document.getElementById('diagnostic-frame')?.remove(), 300);
    setTimeout(() => document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=320,initial-scale=1'), 330);
    setTimeout(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      meta.remove();
      const replacement = document.createElement('meta');
      replacement.name = 'viewport';
      replacement.content = 'width=device-width,initial-scale=1';
      document.head.appendChild(replacement);
    }, 370);
    setTimeout(() => shell.classList.add('gf-is-hidden'), 420);
    setTimeout(() => shell.remove(), 520);
  </script>
</body>
</html>`;

const requiredCategories = [
  "viewport",
  "meta-viewport",
  "fonts",
  "loading-message",
  "geometry",
  "css-variables",
  "background",
  "progress",
  "iframe",
  "resize-observer",
  "loader-mutation",
  "loader",
  "lifecycle-capture",
  "resource",
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 735 } });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "diagnostic.test") return route.abort();
    if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: html });
    if (url.pathname === "/diagnostic-font.woff2") return route.fulfill({ status: 200, contentType: "font/woff2", body: font });
    if (url.pathname.endsWith(".png")) return route.fulfill({ status: 200, contentType: "image/png", body: png });
    if (url.pathname === "/frame") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>frame</title>" });
    return route.fulfill({ status: 404, body: "" });
  });

  await page.goto("http://diagnostic.test/?gfLoaderDiagnostics=1", { waitUntil: "load" });
  await page.waitForTimeout(180);
  await page.setViewportSize({ width: 320, height: 547 });
  await page.waitForTimeout(5400);

  const result = await page.evaluate(() => ({
    report: window.__gfMobileLoaderDiagnosticsReport(),
    captures: window.__captures,
  }));
  const { report, captures } = result;
  const categories = new Set(report.timeline.map((entry) => entry.category));
  requiredCategories.forEach((category) => assert(categories.has(category), `missing timeline category: ${category}`));
  assert(report.schemaVersion === 3, "unexpected report schema version");
  assert(report.animationFrames.length === 300, `expected 300 animation frames, got ${report.animationFrames.length}`);
  assert(report.viewportSamples.some((entry) => entry.changedFields?.some((field) => field.field === "innerWidth")), "viewport width change missing");
  assert(report.viewportMetaTimeline.some((entry) => entry.changeType === "modified"), "viewport modification missing");
  assert(report.viewportMetaTimeline.some((entry) => entry.changeType === "removed"), "viewport removal missing");
  assert(report.viewportMetaTimeline.some((entry) => entry.changeType === "added"), "viewport insertion missing");
  assert(report.messages.some((entry) => entry.previous === "POTENTIAL" && entry.current === "EMBED SYSTEMS"), "message change missing");
  assert(report.progress.some((entry) => entry.state?.inlineValue === "42%"), "progress value missing");
  assert(report.iframeEvents.some((entry) => entry.action === "inserted"), "iframe insertion missing");
  assert(report.iframeEvents.some((entry) => entry.action === "removed"), "iframe removal missing");
  assert(report.background.some((entry) => entry.type === "background-class-applied"), "background class timing missing");
  assert(report.background.some((entry) => entry.type === "diagnostic-decode-complete"), "background decode timing missing");
  assert(report.cssVariables.some((entry) => entry.changes.some((change) => change.property === "--gf-composition-top")), "CSS variable change missing");
  assert(report.lifecycleCaptures.some((entry) => entry.name === "loader removal attempt"), "removal lifecycle capture missing");
  assert(captures.length === report.lifecycleCaptures.length, "external screenshot hook did not receive every lifecycle capture");
  assert(report.dependencyGraph.edges.length > 0, "dependency graph is empty");

  const counts = Object.fromEntries(requiredCategories.map((category) => [category, report.timeline.filter((entry) => entry.category === category).length]));
  process.stdout.write(`${JSON.stringify({ schemaVersion: report.schemaVersion, counts, captures: captures.map((entry) => entry.name), frames: report.animationFrames.length }, null, 2)}\n`);
  await browser.close();
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
