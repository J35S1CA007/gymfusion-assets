(() => {
  "use strict";

  if (new URLSearchParams(window.location.search).get("gfReloadProbe") !== "1") return;
  if (window.__gfLoaderReloadProbe) return;

  const SCHEMA_VERSION = 1;
  const PROBE_VERSION = "1.0.0";
  const WRAPPER_VERSION = "1.0.0";
  const BOOTSTRAP_HASH = "95f312a41bc5e1cc7e17f7dcdcedd3dbe3b08642e31a6df4272b52bee35570c9";
  const STORAGE_PREFIX = "gf-loader-reload-reports-v1";
  const startedAt = performance.now();
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const observers = [];
  const cleanup = [];
  const resourceEntries = new Map();
  const backgroundCandidates = new Set();
  let shell = null;
  let classObserver = null;
  let viewportBaseline = null;
  let lastMaterialViewport = null;
  let quietTimer = 0;
  let maximumTimer = 0;
  let settledCaptured = false;
  let firstIframeCaptured = false;
  let finalized = false;
  let storageAvailable = true;

  const at = () => Math.round((performance.now() - startedAt) * 100) / 100;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const orientation = () => window.screen?.orientation?.type || null;
  const viewport = () => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    visualViewportWidth: window.visualViewport?.width ?? null,
    visualViewportHeight: window.visualViewport?.height ?? null,
    visualViewportScale: window.visualViewport?.scale ?? null,
    visualViewportOffsetLeft: window.visualViewport?.offsetLeft ?? null,
    visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    orientation: orientation(),
  });
  const runtimeSha = (url) => url?.match(/gymfusion-assets@([0-9a-f]{7,40})\/scripts\/gymfusion-loader\.js/i)?.[1] || null;
  const report = {
    schemaVersion: SCHEMA_VERSION,
    probeVersion: PROBE_VERSION,
    wrapperVersion: WRAPPER_VERSION,
    bootstrapHash: BOOTSTRAP_HASH,
    runId,
    generatedAt: new Date().toISOString(),
    url: window.location.href,
    pathname: window.location.pathname,
    timeOrigin: performance.timeOrigin,
    probeStartedAt: 0,
    bootstrapObservedAt: null,
    bootstrapPrecision: "wrapper-boundary",
    runtimeURL: null,
    runtimeSHA: null,
    shellVersion: null,
    initialPageClass: null,
    pageMode: null,
    lifecycle: {},
    samples: {},
    backgroundCandidates: [],
    backgroundResources: [],
    finalState: null,
    storage: { available: true, key: null, error: null },
    limitations: [
      "CSS background decode completion is not exposed to page JavaScript.",
      "Lifecycle timestamps are observer or event delivery times, not browser paint timestamps.",
      "Resource Timing fields may be restricted for cross-origin or cached resources.",
    ],
  };

  const rect = (element) => {
    if (!element?.isConnected) return null;
    const value = element.getBoundingClientRect();
    return {
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
      top: value.top,
      right: value.right,
      bottom: value.bottom,
      left: value.left,
    };
  };
  const inlineLockState = (element) => {
    const style = element?.style;
    return {
      className: element?.className || "",
      overflow: style?.overflow || "",
      overflowX: style?.overflowX || "",
      overflowY: style?.overflowY || "",
      position: style?.position || "",
      top: style?.top || "",
      left: style?.left || "",
      right: style?.right || "",
      width: style?.width || "",
      height: style?.height || "",
      touchAction: style?.touchAction || "",
      overscrollBehavior: style?.overscrollBehavior || "",
    };
  };
  const normalizeUrl = (value) => {
    try {
      const url = new URL(value, document.baseURI);
      url.hash = "";
      return url.href;
    } catch {
      return null;
    }
  };
  const discoverBackgroundCandidates = (backgroundImage) => {
    const expression = /url\(["']?([^"')]+)["']?\)/g;
    let match;
    while ((match = expression.exec(backgroundImage || ""))) {
      const normalized = normalizeUrl(match[1]);
      if (normalized) backgroundCandidates.add(normalized);
    }
    report.backgroundCandidates = [...backgroundCandidates].sort();
  };
  const resourceRecord = (entry) => ({
    url: normalizeUrl(entry.name),
    initiatorType: entry.initiatorType || null,
    startTime: entry.startTime,
    responseStart: entry.responseStart,
    responseEnd: entry.responseEnd,
    transferSize: entry.transferSize,
    decodedBodySize: entry.decodedBodySize,
    predatesProbeStartup: entry.startTime < startedAt,
    timingRestricted: entry.responseStart === 0 || (entry.transferSize === 0 && entry.decodedBodySize === 0),
    cacheLikely: entry.transferSize === 0 && entry.decodedBodySize > 0,
  });
  const refreshBackgroundResources = () => {
    report.backgroundResources = [...resourceEntries.values()]
      .filter((entry) => entry.url && backgroundCandidates.has(entry.url))
      .sort((a, b) => a.startTime - b.startTime);
  };
  const rememberResources = (entries) => {
    for (const entry of entries || []) {
      if (!entry?.name) continue;
      const item = resourceRecord(entry);
      const key = `${item.url}|${item.initiatorType}|${item.startTime}|${item.responseEnd}`;
      resourceEntries.set(key, item);
    }
    refreshBackgroundResources();
  };
  const backgroundState = () => {
    const element = shell?.querySelector(".gf-background-canvas, .gf-backdrop-image");
    if (!element?.isConnected) return { present: false };
    const style = getComputedStyle(element);
    discoverBackgroundCandidates(style.backgroundImage);
    refreshBackgroundResources();
    return {
      present: true,
      galaxyClassApplied: shell.classList.contains("gf-galaxy-loaded"),
      rect: rect(element),
      backgroundImage: style.backgroundImage,
      backgroundPosition: style.backgroundPosition,
      backgroundSize: style.backgroundSize,
      opacity: style.opacity,
      transform: style.transform,
      decodeState: "not-observable-css-background",
    };
  };
  const layoutSample = (checkpoint) => {
    if (!shell?.isConnected) return null;
    const targets = {
      loader: shell,
      composition: shell.querySelector(".gf-composition"),
      emblem: shell.querySelector(".gf-emblem"),
      logoArtwork: shell.querySelector(".gf-logo-art, .gf-logo"),
      logoImage: shell.querySelector(".gf-logo img"),
      spinner: shell.querySelector(".gf-wheel"),
      loadingText: shell.querySelector(".gf-loading"),
      progressTrack: shell.querySelector(".gf-progress"),
      progressFill: shell.querySelector(".gf-progress-fill"),
      background: shell.querySelector(".gf-background-canvas, .gf-backdrop-image"),
    };
    const rects = Object.fromEntries(Object.entries(targets).map(([name, element]) => [name, rect(element)]));
    const trackWidth = rects.progressTrack?.width || 0;
    const fillWidth = rects.progressFill?.width || 0;
    const sample = {
      at: at(),
      checkpoint,
      viewport: viewport(),
      pageClass: shell.className,
      rects,
      progress: {
        inlineWidth: targets.progressFill?.style.width || null,
        displayedPercent: trackWidth ? (fillWidth / trackWidth) * 100 : null,
      },
      background: backgroundState(),
    };
    report.samples[checkpoint] = sample;
    persist();
    return sample;
  };
  const lifecycle = (name, extra = {}) => {
    const entry = { at: at(), viewport: viewport(), ...extra };
    report.lifecycle[name] = entry;
    persist();
    return entry;
  };
  const identityReady = () => report.runtimeSHA && report.shellVersion;
  const storageKey = () => [
    STORAGE_PREFIX,
    `s${SCHEMA_VERSION}`,
    encodeURIComponent(report.pathname),
    report.runtimeSHA,
    report.shellVersion,
  ].join("|");
  function persist() {
    if (!storageAvailable || !identityReady()) return;
    try {
      const key = storageKey();
      const stored = JSON.parse(sessionStorage.getItem(key) || "[]");
      const records = Array.isArray(stored) ? stored.filter((item) => item?.runId !== runId) : [];
      records.push(clone(report));
      sessionStorage.setItem(key, JSON.stringify(records.slice(-4)));
      report.storage = { available: true, key, error: null };
    } catch (error) {
      storageAvailable = false;
      report.storage = { available: false, key: null, error: String(error) };
    }
  }
  const detectRuntimeScript = (root = document) => {
    const scripts = root.matches?.("script[src]") ? [root] : root.querySelectorAll?.("script[src]") || [];
    for (const script of scripts) {
      const source = script.src;
      const sha = runtimeSha(source);
      if (!sha) continue;
      report.runtimeURL = source;
      report.runtimeSHA = sha;
      persist();
      return true;
    }
    return false;
  };
  const iframeDetails = (iframe, observed) => ({
    observed,
    src: iframe.getAttribute("src") || null,
    id: iframe.id || null,
    name: iframe.getAttribute("name") || null,
    parent: iframe.parentElement?.tagName?.toLowerCase() || null,
    classification: "first-document-iframe",
  });
  const detectIframe = (root, observed = "inserted") => {
    if (firstIframeCaptured || !root) return;
    const iframe = root.matches?.("iframe") ? root : root.querySelector?.("iframe");
    if (!iframe) return;
    firstIframeCaptured = true;
    lifecycle("firstWixIframe", iframeDetails(iframe, observed));
  };
  const materialChanges = (previous, current) => {
    if (!previous) return [];
    const checks = [
      ["innerWidth", 2], ["clientWidth", 2], ["visualViewportWidth", 2],
      ["innerHeight", 4], ["clientHeight", 4], ["visualViewportHeight", 4],
      ["visualViewportScale", 0.01],
    ];
    const changes = checks.flatMap(([field, minimum]) => {
      const before = previous[field];
      const after = current[field];
      return typeof before === "number" && typeof after === "number" && Math.abs(after - before) >= minimum
        ? [{ field, before, after, delta: after - before, minimum }]
        : [];
    });
    if (previous.orientation !== current.orientation) {
      changes.push({ field: "orientation", before: previous.orientation, after: current.orientation });
    }
    return changes;
  };
  const clearSettlementTimers = () => {
    if (quietTimer) window.clearTimeout(quietTimer);
    if (maximumTimer) window.clearTimeout(maximumTimer);
    quietTimer = 0;
    maximumTimer = 0;
  };
  const captureSettled = (settlement) => {
    if (settledCaptured || !shell?.isConnected) return;
    settledCaptured = true;
    clearSettlementTimers();
    lifecycle("settledViewport", { settlement });
    layoutSample("settledViewport");
  };
  const scheduleSettlement = () => {
    if (quietTimer) window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(() => captureSettled("quiet-250ms"), 250);
    if (!maximumTimer) maximumTimer = window.setTimeout(() => captureSettled("timeout-1500ms"), 1500);
  };
  const handleViewportEvent = (source) => {
    if (!shell?.isConnected || settledCaptured) return;
    const current = viewport();
    const changes = materialChanges(lastMaterialViewport || viewportBaseline, current);
    if (!changes.length) return;
    lastMaterialViewport = current;
    if (!report.lifecycle.firstMaterialViewportChange) {
      lifecycle("firstMaterialViewportChange", { source, changes });
      layoutSample("firstMaterialViewportChange");
    }
    scheduleSettlement();
  };
  const observeShell = (found) => {
    if (shell) return;
    shell = found;
    report.shellVersion = shell.dataset.gfShellVersion || "legacy";
    report.pageMode = shell.dataset.gfPageMode || null;
    report.initialPageClass = shell.className;
    viewportBaseline = viewport();
    lastMaterialViewport = viewportBaseline;
    lifecycle("loaderInserted");
    layoutSample("bootstrap");
    classObserver = new MutationObserver(() => {
      if (!report.lifecycle.galaxyLoaded && shell.classList.contains("gf-galaxy-loaded")) {
        lifecycle("galaxyLoaded", { background: backgroundState() });
      }
      if (!report.lifecycle.loaderHiddenObserved && shell.classList.contains("gf-is-hidden")) {
        lifecycle("loaderHiddenObserved", { className: shell.className });
        layoutSample("loaderHiddenObserved");
        if (!settledCaptured) captureSettled("loader-hidden-fallback");
      }
    });
    classObserver.observe(shell, { attributes: true, attributeFilter: ["class"] });
    observers.push(classObserver);
    persist();
  };
  const removalState = () => ({
    loaderConnected: Boolean(shell?.isConnected),
    html: inlineLockState(document.documentElement),
    body: inlineLockState(document.body),
    htmlLoadingActive: document.documentElement.classList.contains("gf-loading-active"),
    bodyLoadingActive: document.body?.classList.contains("gf-loading-active") || false,
    windowScrollY: window.scrollY,
  });
  const finish = () => {
    if (finalized) return;
    finalized = true;
    clearSettlementTimers();
    report.finalState = { at: at(), ...removalState() };
    lifecycle("loaderRemoved", report.finalState);
    rememberResources(performance.getEntriesByType?.("resource") || []);
    persist();
    observers.splice(0).forEach((observer) => observer.disconnect());
    cleanup.splice(0).forEach((remove) => remove());
  };

  rememberResources(performance.getEntriesByType?.("resource") || []);
  if (typeof PerformanceObserver === "function") {
    try {
      const observer = new PerformanceObserver((list) => rememberResources(list.getEntries()));
      observer.observe({ type: "resource", buffered: true });
      observers.push(observer);
    } catch (error) {
      report.limitations.push(`PerformanceObserver unavailable: ${String(error)}`);
    }
  }

  const runtimeHandler = (event) => {
    detectRuntimeScript();
    if (!shell) observeShell(document.getElementById("gfLoader"));
    if (shell) {
      report.shellVersion = event.detail?.shellVersion || report.shellVersion;
      report.pageMode = event.detail?.pageMode || report.pageMode;
    }
    lifecycle("runtimeAdopted", { detail: event.detail || null });
    layoutSample("runtimeAdopted");
  };
  window.addEventListener("gf-loader-runtime-adopted", runtimeHandler, { once: true });
  cleanup.push(() => window.removeEventListener("gf-loader-runtime-adopted", runtimeHandler));

  const viewportHandlers = [
    [window, "resize", () => handleViewportEvent("window.resize")],
    [window, "orientationchange", () => handleViewportEvent("orientationchange")],
  ];
  if (window.visualViewport) {
    viewportHandlers.push([window.visualViewport, "resize", () => handleViewportEvent("visualViewport.resize")]);
  }
  viewportHandlers.forEach(([target, name, handler]) => {
    target.addEventListener(name, handler, { passive: true });
    cleanup.push(() => target.removeEventListener(name, handler));
  });

  const discoveryObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        detectRuntimeScript(node);
        if (!shell) {
          const found = node.id === "gfLoader" ? node : node.querySelector?.("#gfLoader");
          if (found) observeShell(found);
        }
        detectIframe(node);
      }
      if (shell && !shell.isConnected) {
        finish();
        return;
      }
    }
  });
  discoveryObserver.observe(document.documentElement, { childList: true, subtree: true });
  observers.push(discoveryObserver);

  detectRuntimeScript();
  detectIframe(document, "existing-at-probe-start");
  const existingShell = document.getElementById("gfLoader");
  if (existingShell) observeShell(existingShell);

  const api = Object.freeze({
    latest: () => clone(report),
    latestJSON: () => JSON.stringify(report, null, 2),
    stored: () => {
      if (!report.storage.key || !storageAvailable) return [clone(report)];
      try {
        return JSON.parse(sessionStorage.getItem(report.storage.key) || "[]");
      } catch {
        return [clone(report)];
      }
    },
  });
  window.__gfLoaderReloadProbe = api;
  report.bootstrapObservedAt = at();
  report.lifecycle.bootstrap = { at: report.bootstrapObservedAt, viewport: viewport() };
})();
