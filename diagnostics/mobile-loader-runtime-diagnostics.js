(function () {
  "use strict";

  if (new URLSearchParams(window.location.search).get("gfLoaderDiagnostics") !== "1") {
    return;
  }

  if (window.__gfMobileLoaderDiagnosticsActive) {
    return;
  }

  window.__gfMobileLoaderDiagnosticsActive = true;

  const startedAt = performance.now();
  const componentSelectors = {
    wheel: ".gf-wheel",
    loadingText: ".gf-loading",
    emblem: ".gf-emblem",
    logo: ".gf-logo",
    logoImage: ".gf-logo img",
    loadingBar: ".gf-progress",
  };
  const highlightLabels = {
    wheel: "Wheel",
    loadingText: "Loading Text",
    emblem: "Emblem",
    logo: "Logo",
    loadingBar: "Loading Bar",
  };
  const snapshots = [];
  const classHistory = [];
  const observers = [];
  const timers = [];
  let loader = null;
  let originalLoaderRemove = null;
  let panel = null;
  let output = null;
  let statusNode = null;
  let freezeButton = null;
  let fallbackBox = null;
  let frozen = false;
  let removalIntercepted = false;
  let lastClassName = null;
  let galaxySeen = false;

  const now = () => Math.round(performance.now() - startedAt);
  const modeOf = (className) => {
    if (!className) return "none";
    if (className.includes("gf-loader-embed-page")) return "embed";
    if (className.includes("gf-loader-standard-page")) return "standard";
    return "unknown";
  };
  const rectOf = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    };
  };
  const cssOf = (element) => {
    if (!element) return null;
    const style = window.getComputedStyle(element);
    return {
      computedWidth: style.width,
      computedHeight: style.height,
      rect: rectOf(element),
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      transform: style.transform,
      position: style.position,
      margin: style.margin,
      padding: style.padding,
      opacity: style.opacity,
      display: style.display,
    };
  };
  const environment = () => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    visualViewportWidth: window.visualViewport ? window.visualViewport.width : null,
    visualViewportHeight: window.visualViewport ? window.visualViewport.height : null,
    visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen ? window.screen.width : null,
    screenHeight: window.screen ? window.screen.height : null,
    orientation: window.screen && window.screen.orientation ? window.screen.orientation.type : null,
    pathname: window.location.pathname,
    query: window.location.search,
    iframeCount: document.querySelectorAll("iframe").length,
  });
  const loaderState = () => ({
    className: loader ? loader.className : null,
    mode: loader ? modeOf(loader.className) : "none",
    hasExternalStyle: Boolean(document.getElementById("gf-loader-style")),
    productionScriptUrl: document.getElementById("gf-loader-external-script")
      ? document.getElementById("gf-loader-external-script").src
      : null,
    galaxyLoaded: Boolean(loader && loader.classList.contains("gf-galaxy-loaded")),
  });
  const components = () => {
    const result = {};
    Object.keys(componentSelectors).forEach((key) => {
      result[key] = cssOf(document.querySelector(componentSelectors[key]));
    });
    return result;
  };
  const report = () => ({
    generatedAt: new Date().toISOString(),
    snapshots,
    classHistory,
  });
  const render = () => {
    if (!output) return;
    output.textContent = JSON.stringify(report(), null, 2);
    if (statusNode) statusNode.textContent = frozen ? "Measurements frozen" : "Measurements live";
  };
  const snapshot = (stage, options = {}) => {
    if (frozen && !options.force) return null;
    const entry = {
      at: now(),
      stage,
      environment: environment(),
      loader: loaderState(),
      components: components(),
    };
    snapshots.push(entry);
    render();
    return entry;
  };
  const recordClass = (stage, force) => {
    if (!loader) return;
    const className = loader.className;
    if (!force && className === lastClassName) return;
    lastClassName = className;
    classHistory.push({
      at: now(),
      stage,
      className,
      mode: modeOf(className),
      iframeCount: document.querySelectorAll("iframe").length,
      pathname: window.location.pathname,
    });
    snapshot(stage, { force: Boolean(force) });
  };
  const injectDiagnosticStyle = () => {
    if (document.getElementById("gf-mobile-loader-diagnostic-style")) return;
    const style = document.createElement("style");
    style.id = "gf-mobile-loader-diagnostic-style";
    style.textContent = [
      "#gfMobileLoaderDiagnostics{position:fixed;top:8px;right:8px;z-index:2147483647;width:min(430px,48vw);max-height:82vh;overflow:auto;background:rgba(0,0,0,.78);color:#fff;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:10px;box-shadow:0 12px 40px rgba(0,0,0,.45)}",
      "#gfMobileLoaderDiagnostics h2{font-size:12px;margin:0 0 6px}",
      "#gfMobileLoaderDiagnostics button{margin:2px;padding:4px 6px;border:1px solid #777;background:#111;color:#fff;border-radius:6px;font:inherit}",
      "#gfMobileLoaderDiagnostics pre{white-space:pre-wrap;margin:6px 0 0}",
      "#gfMobileLoaderDiagnostics textarea{width:100%;min-height:160px;margin-top:6px;background:#050505;color:#fff;border:1px solid #777;font:inherit}",
      ".gf-mobile-diagnostic-outline{outline:3px solid #00d5ff!important;outline-offset:4px!important}",
    ].join("");
    document.head.appendChild(style);
  };
  const compareIntegrity = (before, after) => {
    const fields = [
      ["environment", "innerWidth"],
      ["environment", "innerHeight"],
      ["environment", "visualViewportWidth"],
      ["environment", "visualViewportHeight"],
      ["environment", "visualViewportScale"],
    ];
    const componentsToCompare = ["wheel", "emblem", "logo", "logoImage", "loadingText", "loadingBar"];
    const changes = [];
    fields.forEach(([group, key]) => {
      if (before[group][key] !== after[group][key]) {
        changes.push({ target: `${group}.${key}`, before: before[group][key], after: after[group][key] });
      }
    });
    componentsToCompare.forEach((key) => {
      const beforeRect = before.components[key] && before.components[key].rect;
      const afterRect = after.components[key] && after.components[key].rect;
      if (JSON.stringify(beforeRect) !== JSON.stringify(afterRect)) {
        changes.push({ target: `${key}.rect`, before: beforeRect, after: afterRect });
      }
    });
    snapshots.push({
      at: now(),
      stage: "diagnostic panel measurement-integrity comparison",
      changed: changes.length > 0,
      changes,
    });
  };
  const addButton = (container, label, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    container.appendChild(button);
    return button;
  };
  const createPanel = () => {
    if (panel) return;
    const before = snapshot("immediately before diagnostic panel insertion", { force: true });
    injectDiagnosticStyle();
    panel = document.createElement("aside");
    panel.id = "gfMobileLoaderDiagnostics";
    panel.innerHTML = '<h2>GYMFUSION Mobile Loader Diagnostics</h2><div id="gfDiagControls"></div><div id="gfDiagStatus"></div><pre id="gfDiagOutput"></pre>';
    document.documentElement.appendChild(panel);
    const controls = panel.querySelector("#gfDiagControls");
    statusNode = panel.querySelector("#gfDiagStatus");
    output = panel.querySelector("#gfDiagOutput");
    freezeButton = addButton(controls, "Freeze Measurements", () => {
      if (!frozen) {
        snapshot("manual freeze snapshot", { force: true });
        frozen = true;
        freezeButton.textContent = "Unfreeze Measurements";
      } else {
        frozen = false;
        freezeButton.textContent = "Freeze Measurements";
        snapshot("manual unfreeze snapshot", { force: true });
      }
      render();
    });
    addButton(controls, "Copy Diagnostic Report", copyReport);
    addButton(controls, "Continue to Website", continueToWebsite);
    Object.keys(highlightLabels).forEach((key) => {
      addButton(controls, `Highlight ${highlightLabels[key]}`, () => highlight(componentSelectors[key]));
    });
    const after = snapshot("immediately after diagnostic panel insertion", { force: true });
    if (before && after) compareIntegrity(before, after);
    render();
  };
  const copyReport = async () => {
    const text = JSON.stringify(report(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      if (statusNode) statusNode.textContent = "Diagnostic report copied";
    } catch (error) {
      if (!fallbackBox) {
        fallbackBox = document.createElement("textarea");
        panel.appendChild(fallbackBox);
      }
      fallbackBox.value = text;
      fallbackBox.focus();
      fallbackBox.select();
      if (statusNode) statusNode.textContent = "Clipboard failed. Select and copy the JSON below.";
    }
  };
  const highlight = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.classList.add("gf-mobile-diagnostic-outline");
    const timer = window.setTimeout(() => {
      element.classList.remove("gf-mobile-diagnostic-outline");
    }, 1500);
    timers.push(timer);
  };
  const clearDiagnostics = () => {
    observers.splice(0).forEach((observer) => observer.disconnect());
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
    document.getElementById("gf-mobile-loader-diagnostic-style")?.remove();
    panel?.remove();
    panel = null;
    output = null;
    statusNode = null;
    fallbackBox = null;
  };
  const continueToWebsite = () => {
    clearDiagnostics();
    if (loader && originalLoaderRemove) {
      loader.remove = originalLoaderRemove;
      originalLoaderRemove = null;
      if (loader.isConnected) {
        loader.remove();
      }
    }
    document.documentElement.classList.remove("gf-loading-active");
  };
  const interceptRemoval = () => {
    if (!loader || originalLoaderRemove) return;
    originalLoaderRemove = loader.remove.bind(loader);
    loader.remove = function () {
      removalIntercepted = true;
      recordClass("final mode before production removal", true);
      snapshot("loader-removal attempt intercepted", { force: true });
      loader.classList.remove("gf-is-hidden");
    };
  };
  const observeLoader = () => {
    if (!loader) return;
    recordClass("initial bootstrap class observed", true);
    interceptRemoval();
    const classObserver = new MutationObserver(() => {
      recordClass("loader class mutation observed");
      if (!galaxySeen && loader.classList.contains("gf-galaxy-loaded")) {
        galaxySeen = true;
        snapshot("background-loaded class observed");
      }
    });
    classObserver.observe(loader, { attributes: true, attributeFilter: ["class"] });
    observers.push(classObserver);

    const styleObserver = new MutationObserver(() => {
      if (document.getElementById("gf-loader-style")) {
        snapshot("production external style detected");
        styleObserver.disconnect();
      }
    });
    styleObserver.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(styleObserver);
    if (document.getElementById("gf-loader-style")) {
      snapshot("production external style detected");
      styleObserver.disconnect();
    }

    [250, 750, 1500, 2500, 4000].forEach((delay) => {
      const timer = window.setTimeout(() => {
        recordClass(`classification stability sample ${delay}ms`, true);
      }, delay);
      timers.push(timer);
    });
  };
  const attachToLoader = (foundLoader) => {
    if (loader || !foundLoader) return;
    loader = foundLoader;
    createPanel();
    snapshot("loader first detected", { force: true });
    observeLoader();
  };
  const waitForLoader = () => {
    const existing = document.getElementById("gfLoader");
    if (existing) {
      attachToLoader(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const found = document.getElementById("gfLoader");
      if (found) {
        observer.disconnect();
        attachToLoader(found);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(observer);
    const started = performance.now();
    const poll = () => {
      const found = document.getElementById("gfLoader");
      if (found) {
        observer.disconnect();
        attachToLoader(found);
        return;
      }
      if (performance.now() - started > 6000) {
        observer.disconnect();
        snapshot("loader detection timed out", { force: true });
        createPanel();
        return;
      }
      const timer = window.setTimeout(poll, 50);
      timers.push(timer);
    };
    poll();
  };

  snapshot("diagnostic script started", { force: true });
  waitForLoader();
})();
