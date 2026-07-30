const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright");

const assetsRoot = "/Users/ccuser/gymfusion-assets";
const embedsRoot = "/Users/ccuser/gymfusion-embeds";
const probePath = path.join(assetsRoot, "diagnostics/mobile-loader-reload-probe.js");
const wrapperPath = path.join(embedsRoot, "diagnostics/GYMFUSION – Mobile Loader Reload Probe.md");
const bootstrapPath = path.join(embedsRoot, "loaders/GYMFUSION – Dynamic Site Loader.md");
const comparatorPath = path.join(assetsRoot, "diagnostics/compare-mobile-loader-reports.cjs");
const probeSource = fs.readFileSync(probePath, "utf8");
const wrapper = fs.readFileSync(wrapperPath, "utf8").trimEnd();
const authoritativeBootstrap = fs.readFileSync(bootstrapPath, "utf8").split(/\r?\n/)[0];
const wrapperLines = wrapper.split(/\r?\n/);
const embeddedBootstrap = wrapperLines.at(-1);
const bootstrapBody = authoritativeBootstrap.match(/^<script>([\s\S]*)<\/script>$/)?.[1];
const bootstrapHash = crypto.createHash("sha256").update(bootstrapBody).digest("hex");
const expectedRuntimeUrl = "https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@2019374d8420daee658b2c20a3ac5a5c1569d411/scripts/gymfusion-loader.js";
const backgroundUrl = "https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@2019374d8420daee658b2c20a3ac5a5c1569d411/loaders/mobile%20loader%20images/current/test.png";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69vgNwAAAABJRU5ErkJggg==", "base64");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(embeddedBootstrap === authoritativeBootstrap, "embedded loader bootstrap is not byte-identical");
assert(bootstrapHash === "95f312a41bc5e1cc7e17f7dcdcedd3dbe3b08642e31a6df4272b52bee35570c9", "bootstrap body hash changed");
assert(Buffer.byteLength(wrapper) < 15000, "Wix wrapper exceeds 15,000 bytes");
for (const [pattern, label] of [
  [/requestAnimationFrame\s*\(/, "requestAnimationFrame"],
  [/setInterval\s*\(/, "setInterval"],
  [/new\s+Image\s*\(/, "diagnostic Image"],
  [/\.classList\.(?:add|remove|toggle)\s*\(/, "class mutation"],
  [/\.style\.setProperty\s*\(/, "CSS variable mutation"],
  [/\.remove\s*=/, "remove override"],
]) {
  assert(!pattern.test(probeSource), `probe contains forbidden ${label}`);
}
assert(probeSource.indexOf('get("gfReloadProbe") !== "1"') < probeSource.indexOf("window.__gfLoaderReloadProbe = api"), "activation guard is not first");

const instrumentation = `<script>
window.__observerConstructors={MutationObserver:0,PerformanceObserver:0};
window.__observerCallbacks={MutationObserver:0,PerformanceObserver:0};
window.__timerCalls=0;
const __nativeSetTimeout=window.setTimeout;
window.setTimeout=function(...args){window.__timerCalls++;return __nativeSetTimeout.apply(this,args)};
window.__storageCalls={get:0,set:0};
const __nativeStorageGet=Storage.prototype.getItem;
const __nativeStorageSet=Storage.prototype.setItem;
Storage.prototype.getItem=function(...args){window.__storageCalls.get++;return __nativeStorageGet.apply(this,args)};
Storage.prototype.setItem=function(...args){window.__storageCalls.set++;return __nativeStorageSet.apply(this,args)};
for(const name of Object.keys(window.__observerConstructors)){
  const Native=window[name];if(typeof Native!=="function")continue;
  window[name]=class extends Native{constructor(callback){window.__observerConstructors[name]++;super((...args)=>{window.__observerCallbacks[name]++;return callback(...args)})}};
}
</script>`;
const pageHtml = `${instrumentation}${wrapper}<script>window.__postWrapperTimerCalls=window.__timerCalls;window.__postWrapperStorageCalls={...window.__storageCalls};</script><style>html,body{margin:0;min-height:2200px}</style>`;
const syntheticRuntime = `(() => {
  window.__runtimeExecutions=(window.__runtimeExecutions||0)+1;
  const savedY=120;
  window.scrollTo(0,savedY);
  document.documentElement.classList.add("gf-loading-active");
  document.documentElement.style.overflow="hidden";
  document.body.style.overflow="hidden";
  document.body.style.position="fixed";
  document.body.style.top=-savedY+"px";
  document.body.style.width="100%";
  const shell=document.createElement("div");
  shell.id="gfLoader";
  shell.className="gf-loader-embed-page";
  shell.dataset.gfShellVersion="2";
  shell.dataset.gfPageMode="embed";
  shell.innerHTML='<div class="gf-backdrop-image gf-background-canvas"></div><div class="gf-composition"><div class="gf-emblem"></div><div class="gf-logo-art"><picture class="gf-logo"><img alt=""></picture></div><div class="gf-wheel"></div><div class="gf-loading">LOADING</div><div class="gf-progress"><div class="gf-progress-fill"></div></div></div>';
  const style=document.createElement("style");
  style.textContent='#gfLoader{position:fixed;inset:0}.gf-background-canvas{position:absolute;inset:0;background-image:url("${backgroundUrl}");background-position:center top;background-size:100% auto;opacity:0}.gf-composition{position:absolute;top:85px;left:50%;width:284px;height:377px;transform:translateX(-50%)}.gf-emblem{width:64px;height:64px}.gf-logo-art{width:218px;height:67px}.gf-logo img{width:218px;height:100px}.gf-wheel{width:62px;height:62px}.gf-loading{width:262px;height:38px}.gf-progress{width:284px;height:7px}.gf-progress-fill{width:4%;height:7px}#gfLoader.gf-galaxy-loaded .gf-background-canvas{opacity:.86}';
  document.head.appendChild(style);
  document.body.prepend(shell);
  window.__removeIdentityAtInsertion=shell.remove===Element.prototype.remove;
  window.dispatchEvent(new CustomEvent("gf-loader-runtime-adopted",{detail:{shellVersion:"2",pageMode:"embed"}}));
  setTimeout(()=>shell.querySelector(".gf-progress-fill").style.width="42%",40);
  setTimeout(()=>shell.classList.add("gf-galaxy-loaded"),80);
  setTimeout(()=>{const frame=document.createElement("iframe");frame.src="/wix-frame";document.body.appendChild(frame)},120);
  setTimeout(()=>shell.classList.add("gf-is-hidden"),700);
  setTimeout(()=>{
    window.__removeIdentityAtRemoval=shell.remove===Element.prototype.remove;
    shell.remove();
    document.documentElement.classList.remove("gf-loading-active");
    document.documentElement.style.overflow="";
    document.body.style.overflow="";
    document.body.style.position="";
    document.body.style.top="";
    document.body.style.width="";
    window.scrollTo(0,savedY);
  },900);
})();`;

const metric = (values, name) => values.find((item) => item.name === name)?.value || 0;
const run = async (browser, active, storageFailure = false) => {
  const page = await browser.newPage({ viewport: { width: 430, height: 735 } });
  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  const requests = { runtime: 0, background: 0, runtimeDetails: [] };
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const parsedUrl = new URL(url);
    if (parsedUrl.origin === "http://reload-probe.test" && parsedUrl.pathname === "/home") {
      return route.fulfill({ status: 200, contentType: "text/html", body: pageHtml });
    }
    if (url === expectedRuntimeUrl) {
      requests.runtime++;
      requests.runtimeDetails.push({ method: route.request().method(), resourceType: route.request().resourceType() });
      return route.fulfill({ status: 200, contentType: "application/javascript", body: syntheticRuntime });
    }
    if (url === backgroundUrl) {
      requests.background++;
      return route.fulfill({ status: 200, contentType: "image/png", body: png });
    }
    if (url.endsWith("/wix-frame")) return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html>" });
    return route.abort();
  });
  if (storageFailure) {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error("storage blocked"); };
      Storage.prototype.setItem = () => { throw new Error("storage blocked"); };
    });
  }
  const before = (await session.send("Performance.getMetrics")).metrics;
  await page.goto(`http://reload-probe.test/home${active ? "?gfReloadProbe=1" : ""}`, { waitUntil: "load" });
  if (active) {
    await page.waitForTimeout(170);
    await page.setViewportSize({ width: 320, height: 547 });
  }
  await page.waitForTimeout(1100);
  const after = (await session.send("Performance.getMetrics")).metrics;
  const result = await page.evaluate(() => ({
    hasProbe: Object.prototype.hasOwnProperty.call(window, "__gfLoaderReloadProbe"),
    report: window.__gfLoaderReloadProbe?.latest() || null,
    runtimeExecutions: window.__runtimeExecutions,
    runtimeScriptCount: document.querySelectorAll('script[src*="gymfusion-loader.js"]').length,
    loaderConnected: Boolean(document.getElementById("gfLoader")),
    removeIdentityAtInsertion: window.__removeIdentityAtInsertion,
    removeIdentityAtRemoval: window.__removeIdentityAtRemoval,
    htmlClass: document.documentElement.className,
    htmlStyle: document.documentElement.getAttribute("style") || "",
    bodyStyle: document.body.getAttribute("style") || "",
    scrollY: window.scrollY,
    observerConstructors: window.__observerConstructors,
    observerCallbacks: window.__observerCallbacks,
    postWrapperTimerCalls: window.__postWrapperTimerCalls,
    postWrapperStorageCalls: window.__postWrapperStorageCalls,
    storageKeys: Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)),
  }));
  result.requests = requests;
  result.performance = {
    scriptDurationMs: (metric(after, "ScriptDuration") - metric(before, "ScriptDuration")) * 1000,
    taskDurationMs: (metric(after, "TaskDuration") - metric(before, "TaskDuration")) * 1000,
    layoutDurationMs: (metric(after, "LayoutDuration") - metric(before, "LayoutDuration")) * 1000,
    recalcStyleDurationMs: (metric(after, "RecalcStyleDuration") - metric(before, "RecalcStyleDuration")) * 1000,
  };
  await page.close();
  return result;
};

const verifyComparator = (report) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gf-reload-probe-"));
  const first = path.join(directory, "first.json");
  const second = path.join(directory, "second.json");
  fs.writeFileSync(first, JSON.stringify(report));
  fs.writeFileSync(second, JSON.stringify({ ...report, wrapperVersion: "different" }));
  const accepted = spawnSync(process.execPath, [comparatorPath, first, first], { encoding: "utf8" });
  const refused = spawnSync(process.execPath, [comparatorPath, first, second], { encoding: "utf8" });
  fs.rmSync(directory, { recursive: true, force: true });
  const acceptedReport = JSON.parse(accepted.stdout);
  assert(accepted.status === 0 && acceptedReport.status === "compared", "comparator rejected compatible reports");
  assert(Object.prototype.hasOwnProperty.call(acceptedReport, "firstTimestampDivergence"), "comparator omitted first timestamp divergence");
  assert(refused.status === 2, "comparator did not refuse incompatible reports");
  return { compatibleExit: accepted.status, incompatibleExit: refused.status };
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const inactive = await run(browser, false);
  const active = await run(browser, true);
  const blockedStorage = await run(browser, true, true);
  await browser.close();

  assert(inactive.runtimeExecutions === 1 && active.runtimeExecutions === 1, "runtime executed more than once");
  assert(inactive.runtimeScriptCount === 1 && active.runtimeScriptCount === 1, "runtime script injected more than once");
  assert(
    inactive.requests.runtime === 1 && active.requests.runtime === 1,
    `runtime request count changed: inactive=${JSON.stringify(inactive.requests)}, active=${JSON.stringify(active.requests)}`
  );
  assert(inactive.requests.background === active.requests.background, "probe created an additional background request");
  assert(!inactive.hasProbe, "inactive visit created diagnostic global");
  assert(inactive.observerConstructors.MutationObserver === 0, "inactive visit created MutationObserver");
  assert(inactive.observerConstructors.PerformanceObserver === 0, "inactive visit created PerformanceObserver");
  assert(inactive.postWrapperTimerCalls === 0, "inactive wrapper created a timer");
  assert(inactive.postWrapperStorageCalls.get === 0 && inactive.postWrapperStorageCalls.set === 0, "inactive wrapper accessed storage");
  assert(!inactive.storageKeys.some((key) => key?.startsWith("gf-loader-reload-reports")), "inactive visit wrote diagnostic storage");
  assert(active.hasProbe, "active visit did not initialize probe");
  assert(active.removeIdentityAtInsertion && active.removeIdentityAtRemoval, "probe changed loader.remove identity");
  assert(!active.loaderConnected && !inactive.loaderConnected, "loader did not complete normal removal");
  assert(active.htmlClass === "" && inactive.htmlClass === "", "scroll-lock class was not restored");
  assert(active.htmlStyle === "" && active.bodyStyle === "", "active scroll-lock inline styles were not restored");
  assert(inactive.htmlStyle === "" && inactive.bodyStyle === "", "inactive scroll-lock inline styles were not restored");
  assert(active.scrollY === 120 && inactive.scrollY === 120, "scroll position was not restored");
  assert(active.report.finalState.loaderConnected === false, "report did not observe disconnected loader");
  assert(active.report.finalState.htmlLoadingActive === false, "report observed html still locked");
  assert(active.report.finalState.html.overflow === "" && active.report.finalState.body.position === "", "report observed unrestored inline locks");
  assert(active.report.finalState.windowScrollY === 120, "report did not capture restored scrollY");
  for (const event of ["bootstrap", "loaderInserted", "runtimeAdopted", "galaxyLoaded", "firstWixIframe", "firstMaterialViewportChange", "settledViewport", "loaderHiddenObserved", "loaderRemoved"]) {
    assert(active.report.lifecycle[event], `missing lifecycle event: ${event}`);
  }
  for (const sample of ["bootstrap", "runtimeAdopted", "firstMaterialViewportChange", "settledViewport", "loaderHiddenObserved"]) {
    assert(active.report.samples[sample], `missing geometry sample: ${sample}`);
  }
  assert(active.report.backgroundResources.length === 1, "production background resource was not matched exactly once");
  assert(active.report.backgroundResources[0].url === backgroundUrl, "wrong background resource matched");
  assert(active.report.runtimeURL === expectedRuntimeUrl, "runtime URL identity missing");
  assert(active.report.runtimeSHA === "2019374d8420daee658b2c20a3ac5a5c1569d411", "runtime SHA identity missing");
  assert(active.report.shellVersion === "2", "shell version identity missing");
  assert(blockedStorage.report.storage.available === false, "storage failure did not use memory fallback");
  assert(blockedStorage.report.lifecycle.loaderRemoved, "memory fallback lost final report");

  const comparator = verifyComparator(active.report);
  const overhead = {
    scriptDurationMs: active.performance.scriptDurationMs - inactive.performance.scriptDurationMs,
    taskDurationMs: active.performance.taskDurationMs - inactive.performance.taskDurationMs,
    layoutDurationMs: active.performance.layoutDurationMs - inactive.performance.layoutDurationMs,
    recalcStyleDurationMs: active.performance.recalcStyleDurationMs - inactive.performance.recalcStyleDurationMs,
  };
  process.stdout.write(`${JSON.stringify({
    bootstrap: { hash: bootstrapHash, byteIdentical: true, wrapperBytes: Buffer.byteLength(wrapper) },
    inactive: {
      hasProbe: inactive.hasProbe,
      observerConstructors: inactive.observerConstructors,
      postWrapperTimerCalls: inactive.postWrapperTimerCalls,
      postWrapperStorageCalls: inactive.postWrapperStorageCalls,
      storageKeys: inactive.storageKeys,
      runtimeExecutions: inactive.runtimeExecutions,
      runtimeRequests: inactive.requests.runtime,
      backgroundRequests: inactive.requests.background,
      loaderConnected: inactive.loaderConnected,
      scrollY: inactive.scrollY,
    },
    active: {
      observerConstructors: active.observerConstructors,
      observerCallbacks: active.observerCallbacks,
      runtimeExecutions: active.runtimeExecutions,
      runtimeRequests: active.requests.runtime,
      backgroundRequests: active.requests.background,
      reportBytes: Buffer.byteLength(JSON.stringify(active.report)),
      lifecycle: Object.keys(active.report.lifecycle),
      samples: Object.keys(active.report.samples),
      finalState: active.report.finalState,
    },
    chromiumPerformance: { inactive: inactive.performance, active: active.performance, approximateProbeDelta: overhead },
    comparator,
  }, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
