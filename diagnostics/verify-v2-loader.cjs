const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const sharp = require("sharp");
const { PNG } = require("pngjs");
const pixelmatchModule = require("pixelmatch");
const pixelmatch = pixelmatchModule.default || pixelmatchModule;

const assetsRepo = "/Users/ccuser/gymfusion-assets";
const embedsRepo = "/Users/ccuser/gymfusion-embeds";
const bootstrapPath = "loaders/GYMFUSION – Dynamic Site Loader.md";
const runtimePath = "scripts/gymfusion-loader.js";
const outputDir = path.join(assetsRepo, "diagnostics", "v2-loader-evidence");

fs.mkdirSync(outputDir, { recursive: true });

const readVersion = (repo, relativePath, version) =>
  version === "new"
    ? fs.readFileSync(path.join(repo, relativePath), "utf8")
    : execFileSync("git", ["show", `HEAD:${relativePath}`], { cwd: repo, encoding: "utf8" });

const bootstraps = {
  old: readVersion(embedsRepo, bootstrapPath, "old"),
  new: readVersion(embedsRepo, bootstrapPath, "new"),
};
const runtimes = {
  old: readVersion(assetsRepo, runtimePath, "old"),
  new: readVersion(assetsRepo, runtimePath, "new"),
};

const mimeTypes = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".js": "text/javascript",
};

const instrumentation = `
<script>
window.__gymfusionLoaderRuntimeUrl = "http://runtime.test/scripts/gymfusion-loader.js";
window.__gfEvidence = { snapshots: [], shellIds: [], classHistory: [], childMutations: 0, events: [] };
(() => {
  const evidence = window.__gfEvidence;
  const shellIds = new WeakMap();
  const styleIds = new WeakMap();
  let nextShellId = 1;
  let nextStyleId = 1;
  let firstShell = null;

  const getShellId = (shell) => {
    if (!shell) return null;
    if (!shellIds.has(shell)) shellIds.set(shell, nextShellId++);
    return shellIds.get(shell);
  };

  const getStyleId = (style) => {
    if (!style) return null;
    if (!styleIds.has(style)) styleIds.set(style, nextStyleId++);
    return styleIds.get(style);
  };

  const rect = (selector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { top: box.top, left: box.left, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
  };

  window.__gfRecord = (label) => {
    const shell = document.getElementById("gfLoader");
    const fill = document.getElementById("gfProgressFill");
    const loadingWord = document.getElementById("gfLoadingText");
    const fillStyle = fill ? getComputedStyle(fill) : null;
    const canvas = document.querySelector(".gf-backdrop-image");
    const canvasStyle = canvas ? getComputedStyle(canvas) : null;
    const snapshot = {
      label,
      time: performance.now(),
      viewport: { width: innerWidth, height: innerHeight },
      shellId: getShellId(shell),
      styleId: getStyleId(document.getElementById("gf-loader-style")),
      shellConnected: Boolean(shell?.isConnected),
      shellVersion: shell?.dataset.gfShellVersion || "legacy",
      frozenMetrics: shell?.dataset.gfFrozenMetrics || null,
      smallHeightSource: shell?.dataset.gfSmallHeightSource || null,
      metricProbePresent: Boolean(document.getElementById("gfLoaderViewportProbe")),
      className: shell?.className || null,
      pageMode: shell?.dataset.gfPageMode || null,
      compositionTop: shell ? getComputedStyle(shell).getPropertyValue("--gf-composition-top").trim() : null,
      smallHeight: shell ? getComputedStyle(shell).getPropertyValue("--gf-small-height").trim() : null,
      logo: (() => {
        const art = rect(".gf-logo-art");
        return art?.width ? art : rect(".gf-logo");
      })(),
      loading: rect(".gf-loading"),
      progress: rect(".gf-progress"),
      wheel: rect(".gf-wheel"),
      canvas: rect(".gf-backdrop-image"),
      canvasStyle: canvasStyle ? {
        backgroundSize: canvasStyle.backgroundSize,
        backgroundPosition: canvasStyle.backgroundPosition,
        transform: canvasStyle.transform,
        opacity: canvasStyle.opacity,
      } : null,
      progressStyle: fillStyle ? {
        backgroundImage: fillStyle.backgroundImage,
        boxShadow: fillStyle.boxShadow,
        inlineWidth: fill.style.width,
      } : null,
      loadingText: loadingWord?.textContent || null,
      scroll: {
        y: scrollY,
        bodyPosition: document.body ? getComputedStyle(document.body).position : null,
        bodyOverflow: document.body ? getComputedStyle(document.body).overflow : null,
        rootOverflow: getComputedStyle(document.documentElement).overflow,
      },
    };
    evidence.snapshots.push(snapshot);
    return snapshot;
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        const shell = document.getElementById("gfLoader");
        if (shell && !firstShell) {
          firstShell = shell;
          evidence.shellIds.push(getShellId(shell));
          requestAnimationFrame(() => window.__gfRecord("first-visible-bootstrap"));
        }
        if (firstShell && record.target instanceof Node && firstShell.contains(record.target)) {
          evidence.childMutations += record.addedNodes.length + record.removedNodes.length;
        }
        for (const removed of record.removedNodes) {
          if (removed === firstShell) evidence.events.push("initial-shell-removed");
        }
      }
      if (record.type === "attributes" && record.target.id === "gfLoader" && record.attributeName === "class") {
        evidence.classHistory.push(record.target.className);
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("gf-loader-runtime-adopted", () => window.__gfRecord("runtime-adoption"));
})();
</script>
<style>
.gf-wheel,.gf-emblem{animation:none!important}
</style>`;

const makeHtml = (bootstrap, options = {}) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${instrumentation}
<style>html,body{margin:0;min-height:2200px;background:#111}main{height:2200px}</style></head>
<body><main aria-hidden="true"></main>${options.preBootstrap || ""}${bootstrap}</body></html>`;

const localAssetPath = (requestUrl) => {
  const url = new URL(requestUrl);
  let relative = decodeURIComponent(url.pathname);
  const marker = "/gymfusion-assets@";
  if (relative.includes(marker)) {
    relative = relative.slice(relative.indexOf("/", relative.indexOf(marker) + marker.length) + 1);
  } else {
    relative = relative.replace(/^\//, "");
  }
  const candidate = path.join(assetsRepo, relative);
  return candidate.startsWith(assetsRepo) ? candidate : null;
};

async function configurePage(page, { bootstrapVersion, runtimeVersion, pathname = "/home/example", runtimeDelayMs = 0, preBootstrap = "" }) {
  const html = makeHtml(bootstraps[bootstrapVersion], { preBootstrap });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "loader.test") {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
      return;
    }
    if (url.pathname.endsWith("/scripts/gymfusion-loader.js")) {
      if (runtimeDelayMs) await new Promise((resolve) => setTimeout(resolve, runtimeDelayMs));
      await route.fulfill({ status: 200, contentType: "text/javascript", body: runtimes[runtimeVersion] });
      return;
    }
    const assetPath = localAssetPath(route.request().url());
    if (assetPath && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      await route.fulfill({
        status: 200,
        contentType: mimeTypes[path.extname(assetPath).toLowerCase()] || "application/octet-stream",
        body: fs.readFileSync(assetPath),
      });
      return;
    }
    await route.abort();
  });
  await page.goto(`http://loader.test${pathname}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#gfLoader", { state: "attached" });
}

const waitFrames = (page, count = 2) =>
  page.evaluate((frames) => new Promise((resolve) => {
    const next = () => frames-- > 0 ? requestAnimationFrame(next) : resolve();
    requestAnimationFrame(next);
  }), count);

const record = (page, label) => page.evaluate((name) => window.__gfRecord(name), label);

async function compositionScreenshot(page, filePath) {
  const clip = await page.evaluate(() => {
    const selectors = [".gf-emblem", ".gf-logo-art", ".gf-logo", ".gf-wheel", ".gf-loading", ".gf-progress"];
    const boxes = selectors.map((selector) => document.querySelector(selector)?.getBoundingClientRect()).filter(Boolean);
    const top = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.top)) - 8));
    const bottom = Math.ceil(Math.max(...boxes.map((box) => box.bottom)) + 8);
    return { x: 0, y: top, width: innerWidth, height: bottom - top };
  });
  await page.screenshot({ path: filePath, clip });
}

function comparePngBuffers(firstBuffer, secondBuffer) {
  const first = PNG.sync.read(firstBuffer);
  const second = PNG.sync.read(secondBuffer);
  if (first.width !== second.width || first.height !== second.height) {
    return { comparable: false, first: [first.width, first.height], second: [second.width, second.height] };
  }
  const diff = new PNG({ width: first.width, height: first.height });
  const pixels = pixelmatch(first.data, second.data, diff.data, first.width, first.height, { threshold: 0.1 });
  return { comparable: true, pixels, ratio: pixels / (first.width * first.height), diff: PNG.sync.write(diff) };
}

async function runTransition(browser) {
  const page = await browser.newPage({ viewport: { width: 430, height: 735 }, deviceScaleFactor: 1 });
  await configurePage(page, { bootstrapVersion: "new", runtimeVersion: "new", runtimeDelayMs: 700 });
  await page.waitForFunction(() => window.__gfEvidence.snapshots.some((item) => item.label === "first-visible-bootstrap"));
  const pre = await record(page, "pre-settlement");
  await page.screenshot({ path: path.join(outputDir, "transition-pre-settlement.png") });
  await page.setViewportSize({ width: 320, height: 547 });
  await waitFrames(page);
  const post = await record(page, "post-settlement");
  await page.screenshot({ path: path.join(outputDir, "transition-post-settlement.png") });
  await page.waitForFunction(() => window.__gymfusionLoaderInstalled === true);
  await page.waitForFunction(() => window.__gfEvidence.snapshots.some((item) => item.label === "runtime-adoption"));
  const adoption = await record(page, "runtime-adoption-confirmed");
  await page.waitForFunction(() => document.getElementById("gfLoader")?.classList.contains("gf-galaxy-loaded"), null, { timeout: 5000 });
  await page.waitForTimeout(700);
  const background = await record(page, "background-loaded");
  const preExit = await record(page, "pre-exit");
  await page.screenshot({ path: path.join(outputDir, "transition-background-loaded.png") });
  const evidence = await page.evaluate(() => window.__gfEvidence);
  await page.close();
  return { pre, post, adoption, background, preExit, evidence };
}

async function runCompatibility(browser, bootstrapVersion, runtimeVersion) {
  const page = await browser.newPage({ viewport: { width: 320, height: 547 }, deviceScaleFactor: 1 });
  await configurePage(page, { bootstrapVersion, runtimeVersion, runtimeDelayMs: 1200 });
  await page.waitForFunction(() => window.__gfEvidence.snapshots.some((item) => item.label === "first-visible-bootstrap"));
  await page.addStyleTag({ content: "#gfLoader .gf-backdrop-image{display:none!important}#gfLoader .gf-backdrop{opacity:1!important}" });
  await page.waitForTimeout(100);
  const before = await record(page, "compat-before-runtime");
  const beforePath = path.join(outputDir, `compat-${bootstrapVersion}-${runtimeVersion}-before.png`);
  await compositionScreenshot(page, beforePath);
  await page.waitForFunction(() => window.__gymfusionLoaderInstalled === true);
  if (runtimeVersion === "new") {
    await page.waitForFunction(() => window.__gfEvidence.snapshots.some((item) => item.label === "runtime-adoption"));
  } else {
    await page.waitForTimeout(30);
  }
  const after = runtimeVersion === "new"
    ? await page.evaluate(() => window.__gfEvidence.snapshots.find((item) => item.label === "runtime-adoption"))
    : await record(page, "compat-after-runtime");
  const afterPath = path.join(outputDir, `compat-${bootstrapVersion}-${runtimeVersion}-after.png`);
  await compositionScreenshot(page, afterPath);
  const imageComparison = comparePngBuffers(fs.readFileSync(beforePath), fs.readFileSync(afterPath));
  if (imageComparison.diff) {
    fs.writeFileSync(path.join(outputDir, `compat-${bootstrapVersion}-${runtimeVersion}-diff.png`), imageComparison.diff);
  }
  const evidence = await page.evaluate(() => ({
    ...window.__gfEvidence,
    currentShellId: (() => {
      const shell = document.getElementById("gfLoader");
      const snapshot = window.__gfRecord("compat-final");
      return snapshot.shellId;
    })(),
  }));
  await page.close();
  return {
    combination: `${bootstrapVersion}-bootstrap + ${runtimeVersion}-runtime`,
    before,
    after,
    shellReplaced: before.shellId !== after.shellId || evidence.events.includes("initial-shell-removed"),
    styleAdded: before.styleId === null && after.styleId !== null,
    styleReplaced: before.styleId !== null && after.styleId !== null && before.styleId !== after.styleId,
    layoutChanged: ["logo", "loading", "progress"].some((key) =>
      Math.abs((after[key]?.top || 0) - (before[key]?.top || 0)) > 1 ||
      Math.abs((after[key]?.width || 0) - (before[key]?.width || 0)) > 0
    ),
    pageClassChanged:
      before.className.match(/gf-loader-(?:standard|embed)-page/)?.[0] !==
      after.className.match(/gf-loader-(?:standard|embed)-page/)?.[0],
    progressCssChanged:
      before.progressStyle?.backgroundImage !== after.progressStyle?.backgroundImage ||
      before.progressStyle?.boxShadow !== after.progressStyle?.boxShadow,
    progressReset: Boolean(before.progressStyle?.inlineWidth) && !after.progressStyle?.inlineWidth,
    loadingTextReset: before.loadingText !== after.loadingText,
    childMutations: evidence.childMutations,
    visibleFlashPixels: imageComparison.pixels,
    visibleFlashRatio: imageComparison.ratio,
  };
}

async function addGuides(page, label) {
  await page.evaluate((caption) => {
    document.querySelectorAll(".gf-diagnostic-guide,.gf-diagnostic-label").forEach((node) => node.remove());
    const shell = document.getElementById("gfLoader");
    const emblem = document.querySelector(".gf-emblem").getBoundingClientRect();
    const logo = document.querySelector(".gf-logo-art").getBoundingClientRect();
    const wheel = document.querySelector(".gf-wheel").getBoundingClientRect();
    const lines = [
      { y: emblem.top + emblem.height * ((6 + 234) / 250), color: "#00f5ff", text: "emblem alpha bottom" },
      { y: logo.top, color: "#ffe600", text: "logo art top" },
      { y: logo.bottom, color: "#ff4dcb", text: "logo art bottom" },
      { y: wheel.top, color: "#52ff6a", text: "spinner top" },
    ];
    for (const line of lines) {
      const guide = document.createElement("div");
      guide.className = "gf-diagnostic-guide";
      guide.style.cssText = `position:fixed;z-index:2147483647;left:18px;right:18px;top:${line.y}px;border-top:1px solid ${line.color};pointer-events:none`;
      const text = document.createElement("span");
      text.textContent = line.text;
      text.style.cssText = `position:absolute;right:0;top:-14px;color:${line.color};font:10px monospace;background:#050407cc;padding:1px 3px`;
      guide.append(text);
      shell.append(guide);
    }
    const badge = document.createElement("div");
    badge.className = "gf-diagnostic-label";
    badge.textContent = caption;
    badge.style.cssText = "position:fixed;z-index:2147483647;left:8px;top:8px;color:white;background:#050407dd;border:1px solid #fff;padding:5px 7px;font:12px monospace";
    shell.append(badge);
  }, label);
}

async function renderComparison(browser, { gap, top, name }) {
  const page = await browser.newPage({ viewport: { width: 320, height: 547 }, deviceScaleFactor: 1 });
  await configurePage(page, { bootstrapVersion: "new", runtimeVersion: "new", runtimeDelayMs: 6000, pathname: "/standard" });
  await page.evaluate(({ gapValue, topValue }) => {
    const shell = document.getElementById("gfLoader");
    shell.style.setProperty("--gf-brand-gap", `${gapValue}px`);
    shell.style.setProperty("--gf-composition-height", `${331.5 + gapValue}px`);
    shell.style.setProperty("--gf-composition-top", `${topValue}px`);
  }, { gapValue: gap, topValue: top });
  await page.waitForFunction(() => document.querySelector(".gf-logo img")?.complete);
  await waitFrames(page);
  await addGuides(page, `gap ${gap}px / top ${top}px`);
  const snapshot = await record(page, `comparison-${name}`);
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file });
  await page.close();
  return { file, snapshot };
}

async function contactSheet(files, outputName) {
  const width = 320 * files.length;
  await sharp({ create: { width, height: 547, channels: 4, background: "#050407" } })
    .composite(files.map((file, index) => ({ input: file, left: index * 320, top: 0 })))
    .png()
    .toFile(path.join(outputDir, outputName));
}

async function runBackgroundPixelTest(browser) {
  const page = await browser.newPage({ viewport: { width: 430, height: 735 }, deviceScaleFactor: 1 });
  await configurePage(page, { bootstrapVersion: "new", runtimeVersion: "new", pathname: "/standard" });
  await page.waitForFunction(() => document.getElementById("gfLoader")?.classList.contains("gf-galaxy-loaded"), null, { timeout: 5000 });
  await page.waitForTimeout(700);
  await page.addStyleTag({ content: ".gf-composition{visibility:hidden!important}#gfLoader::before,#gfLoader::after{display:none!important}" });
  const initialGeometry = await record(page, "background-pixel-initial");
  const initialPath = path.join(outputDir, "background-initial-430x735.png");
  await page.screenshot({ path: initialPath });
  const croppedPath = path.join(outputDir, "background-initial-central-320x547.png");
  await sharp(initialPath).extract({ left: 55, top: 0, width: 320, height: 547 }).toFile(croppedPath);
  await page.setViewportSize({ width: 320, height: 547 });
  await waitFrames(page);
  const finalGeometry = await record(page, "background-pixel-final");
  const finalPath = path.join(outputDir, "background-final-320x547.png");
  await page.screenshot({ path: finalPath });
  const comparison = comparePngBuffers(fs.readFileSync(croppedPath), fs.readFileSync(finalPath));
  if (comparison.diff) fs.writeFileSync(path.join(outputDir, "background-pixel-diff.png"), comparison.diff);
  await page.close();
  return { initialGeometry, finalGeometry, pixels: comparison.pixels, ratio: comparison.ratio };
}

async function runDesktopRegression(browser) {
  const screenshots = {};
  const snapshots = {};
  for (const version of ["old", "new"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await configurePage(page, { bootstrapVersion: version, runtimeVersion: version, runtimeDelayMs: 6000, pathname: "/standard" });
    await page.waitForFunction(() => document.querySelector(".gf-logo img")?.complete);
    await page.addStyleTag({ content: ".gf-wheel,.gf-emblem{animation:none!important}" });
    await waitFrames(page);
    snapshots[version] = await record(page, `desktop-${version}`);
    screenshots[version] = path.join(outputDir, `desktop-${version}.png`);
    await page.screenshot({ path: screenshots[version] });
    await page.close();
  }
  const comparison = comparePngBuffers(fs.readFileSync(screenshots.old), fs.readFileSync(screenshots.new));
  if (comparison.diff) fs.writeFileSync(path.join(outputDir, "desktop-diff.png"), comparison.diff);
  return { snapshots, pixels: comparison.pixels, ratio: comparison.ratio };
}

async function runScrollLock(browser) {
  const page = await browser.newPage({ viewport: { width: 320, height: 547 }, deviceScaleFactor: 1 });
  const preBootstrap = "<script>scrollTo(0,300)</script>";
  await configurePage(page, { bootstrapVersion: "new", runtimeVersion: "new", pathname: "/standard", preBootstrap });
  await page.waitForFunction(() => getComputedStyle(document.body).position === "fixed");
  const lockedBefore = await page.evaluate(() => ({ y: scrollY, bodyTop: getComputedStyle(document.body).top, overflow: getComputedStyle(document.documentElement).overflow }));
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(100);
  const lockedAfter = await page.evaluate(() => ({ y: scrollY, bodyTop: getComputedStyle(document.body).top, overflow: getComputedStyle(document.documentElement).overflow }));
  await page.waitForFunction(() => !document.getElementById("gfLoader"), null, { timeout: 7000 });
  const unlocked = await page.evaluate(() => ({ y: scrollY, bodyPosition: getComputedStyle(document.body).position, overflow: getComputedStyle(document.documentElement).overflow }));
  await page.close();
  return { lockedBefore, lockedAfter, unlocked };
}

async function runSvhFallback(browser) {
  const page = await browser.newPage({ viewport: { width: 320, height: 547 }, deviceScaleFactor: 1 });
  const preBootstrap = "<script>Object.defineProperty(CSS,'supports',{configurable:true,value:()=>false})</script>";
  await configurePage(page, { bootstrapVersion: "new", runtimeVersion: "new", pathname: "/standard", runtimeDelayMs: 6000, preBootstrap });
  await page.waitForFunction(() => window.__gfEvidence.snapshots.some((item) => item.label === "first-visible-bootstrap"));
  const snapshot = await record(page, "svh-fallback");
  await page.close();
  return snapshot;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const transition = await runTransition(browser);
    const compatibility = [];
    for (const bootstrapVersion of ["old", "new"]) {
      for (const runtimeVersion of ["old", "new"]) {
        compatibility.push(await runCompatibility(browser, bootstrapVersion, runtimeVersion));
      }
    }

    const gapComparisons = [];
    for (const gap of [10, 12, 14]) {
      gapComparisons.push(await renderComparison(browser, { gap, top: 85, name: `brand-gap-${gap}px` }));
    }
    await contactSheet(gapComparisons.map((item) => item.file), "brand-gap-comparison.png");

    const topComparisons = [];
    for (const top of [80, 85, 90]) {
      topComparisons.push(await renderComparison(browser, { gap: 12, top, name: `composition-top-${top}px` }));
    }
    await contactSheet(topComparisons.map((item) => item.file), "composition-top-comparison.png");

    const backgroundPixels = await runBackgroundPixelTest(browser);
    const desktop = await runDesktopRegression(browser);
    const scrollLock = await runScrollLock(browser);
    const svhFallback = await runSvhFallback(browser);
    const resolveTop = (safeTop, smallHeight, compositionHeight, preferredTop) =>
      safeTop > preferredTop
        ? safeTop
        : Math.max(safeTop, Math.min(Math.floor((smallHeight - compositionHeight) / 2), preferredTop));
    const topRuleCases = [
      { safeTop: 0, smallHeight: 735, compositionHeight: 343.5, preferredTop: 85 },
      { safeTop: 100, smallHeight: 735, compositionHeight: 343.5, preferredTop: 85 },
      { safeTop: 20, smallHeight: 400, compositionHeight: 343.5, preferredTop: 85 },
    ].map((item) => ({ ...item, result: resolveTop(item.safeTop, item.smallHeight, item.compositionHeight, item.preferredTop) }));
    const report = { transition, compatibility, gapComparisons, topComparisons, backgroundPixels, desktop, scrollLock, svhFallback, topRuleCases };
    fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
