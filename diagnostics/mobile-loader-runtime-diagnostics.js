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
  const viewportEvents = [];
  const viewportSamples = [];
  const viewportMetaTimeline = [];
  const iframeTimeline = [];
  const bodyMutationTimeline = [];
  const observers = [];
  const timers = [];
  const bootstrapGlobalNames = [
    "__gymfusionLoaderBootstrapInstalled",
    "__gymfusionLoaderInstalled",
    "__gymfusionLoaderBootstrapTimedOut",
  ];
  const discovery = {
    diagnosticScriptStart: 0,
    bootstrapGlobalFirstObserved: {},
    bootstrapGlobalFirstDefined: {},
    loaderFirstDetected: null,
    productionScriptFirstDetected: null,
    externalStyleFirstDetected: null,
    loaderDetectionTimeout: null,
  };
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
  let viewportTrackingStopped = false;
  let lastViewportSignature = null;
  let lastViewportWidth = null;
  let lastViewportChangeAt = null;
  const viewportEventHandlers = {};
  let viewportDiagnosticsCleanup = null;
  const seenIframes = new WeakSet();
  const viewportMetaNodeState = new WeakMap();

  const now = () => Math.round(performance.now() - startedAt);
  const getNavigationDetails = () => {
    const entry = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
    if (!entry) return null;
    return {
      name: entry.name,
      entryType: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
      type: entry.type,
      redirectCount: entry.redirectCount,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      domInteractive: entry.domInteractive,
      domContentLoadedEventStart: entry.domContentLoadedEventStart,
      domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
      loadEventStart: entry.loadEventStart,
      loadEventEnd: entry.loadEventEnd,
      fetchStart: entry.fetchStart,
      responseStart: entry.responseStart,
      responseEnd: entry.responseEnd,
      workerStart: entry.workerStart,
      activationStart: entry.activationStart,
      nextHopProtocol: entry.nextHopProtocol,
    };
  };
  const getViewportMetaElement = () => document.querySelector('meta[name="viewport"]');
  const describeElement = (element) => {
    if (!element) return null;
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes = element.classList && element.classList.length ? `.${Array.from(element.classList).join(".")}` : "";
    return `${tag}${id}${classes}`;
  };
  const isVisibleElement = (element) => {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const widestVisibleElement = () => {
    let widest = null;
    let widestWidth = -1;
    let widestScrollWidth = -1;
    const elements = document.querySelectorAll("body *");
    elements.forEach((element) => {
      if (!isVisibleElement(element)) return;
      const rect = element.getBoundingClientRect();
      const scrollWidth = element.scrollWidth || 0;
      if (rect.width > widestWidth || (rect.width === widestWidth && scrollWidth > widestScrollWidth)) {
        widest = element;
        widestWidth = rect.width;
        widestScrollWidth = scrollWidth;
      }
    });
    if (!widest) return null;
    const rect = widest.getBoundingClientRect();
    return {
      selector: describeElement(widest),
      tagName: widest.tagName.toLowerCase(),
      id: widest.id || null,
      className: widest.className || null,
      boundingWidth: rect.width,
      boundingHeight: rect.height,
      scrollWidth: widest.scrollWidth || 0,
      exceedsViewport: rect.width > window.innerWidth || (widest.scrollWidth || 0) > window.innerWidth,
    };
  };
  const viewportMetaState = () => {
    const meta = getViewportMetaElement();
    return {
      exists: Boolean(meta),
      content: meta ? meta.getAttribute("content") : null,
    };
  };
  const viewportState = () => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    visualViewportWidth: window.visualViewport ? window.visualViewport.width : null,
    visualViewportHeight: window.visualViewport ? window.visualViewport.height : null,
    visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
    visualViewportOffsetLeft: window.visualViewport ? window.visualViewport.offsetLeft : null,
    visualViewportOffsetTop: window.visualViewport ? window.visualViewport.offsetTop : null,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen ? window.screen.width : null,
    screenHeight: window.screen ? window.screen.height : null,
    screenOrientationType:
      window.screen && window.screen.orientation ? window.screen.orientation.type : null,
    screenOrientationAngle:
      window.screen && window.screen.orientation ? window.screen.orientation.angle : null,
    bodyScrollWidth: document.body ? document.body.scrollWidth : null,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportMeta: viewportMetaState(),
    navigation: getNavigationDetails(),
  });
  const viewportSignature = (state) =>
    JSON.stringify([
      state.innerWidth,
      state.innerHeight,
      state.clientWidth,
      state.clientHeight,
      state.visualViewportWidth,
      state.visualViewportHeight,
      state.visualViewportScale,
      state.visualViewportOffsetLeft,
      state.visualViewportOffsetTop,
      state.devicePixelRatio,
      state.screenWidth,
      state.screenHeight,
      state.screenOrientationType,
      state.screenOrientationAngle,
      state.bodyScrollWidth,
      state.documentScrollWidth,
      state.viewportMeta.exists,
      state.viewportMeta.content,
    ]);
  const captureViewportSample = (reason, detail = {}) => {
    const state = viewportState();
    const signature = viewportSignature(state);
    const changed = signature !== lastViewportSignature;
    const widthChanged = lastViewportWidth !== null && state.innerWidth !== lastViewportWidth;
    const entry = {
      at: now(),
      reason,
      changed,
      detail,
      state,
    };
    if (changed) {
      entry.changedFields = [];
      if (lastViewportSignature) {
        const previous = JSON.parse(lastViewportSignature);
        const current = JSON.parse(signature);
        const labels = [
          "innerWidth",
          "innerHeight",
          "clientWidth",
          "clientHeight",
          "visualViewportWidth",
          "visualViewportHeight",
          "visualViewportScale",
          "visualViewportOffsetLeft",
          "visualViewportOffsetTop",
          "devicePixelRatio",
          "screenWidth",
          "screenHeight",
          "screenOrientationType",
          "screenOrientationAngle",
          "bodyScrollWidth",
          "documentScrollWidth",
          "viewportMeta.exists",
          "viewportMeta.content",
        ];
        labels.forEach((label, index) => {
          if (previous[index] !== current[index]) {
            entry.changedFields.push({ field: label, before: previous[index], after: current[index] });
          }
        });
      }
    }
    if (widthChanged) {
      lastViewportChangeAt = entry.at;
      entry.widestVisibleElement = widestVisibleElement();
      entry.viewportWidthChange = true;
    }
    if (!viewportSamples.length || changed || detail.force || detail.always) {
      viewportSamples.push(entry);
    }
    lastViewportSignature = signature;
    lastViewportWidth = state.innerWidth;
    return entry;
  };
  const recordViewportEvent = (name, event = {}) => {
    const state = viewportState();
    const entry = {
      at: now(),
      event: name,
      persisted: typeof event.persisted === "boolean" ? event.persisted : null,
      state,
      viewportChangedSinceLastEvent:
        lastViewportChangeAt !== null ? now() - lastViewportChangeAt : null,
    };
    if (state.innerWidth !== lastViewportWidth) {
      entry.viewportWidthChange = true;
      entry.widestVisibleElement = widestVisibleElement();
      lastViewportChangeAt = entry.at;
    }
    viewportEvents.push(entry);
    viewportSamples.push({
      at: entry.at,
      reason: `event:${name}`,
      changed: true,
      detail: { persisted: entry.persisted },
      state,
      viewportWidthChange: Boolean(entry.viewportWidthChange),
      widestVisibleElement: entry.widestVisibleElement || null,
    });
    lastViewportSignature = viewportSignature(state);
    lastViewportWidth = state.innerWidth;
    return entry;
  };
  const productionScripts = () =>
    Array.from(document.querySelectorAll("script"))
      .filter((script) => script.src && script.src.includes("gymfusion-loader.js"))
      .map((script) => ({
        id: script.id || null,
        src: script.src,
        async: script.async,
        defer: script.defer,
      }));
  const updateDiscovery = () => {
    const current = now();
    bootstrapGlobalNames.forEach((name) => {
      if (discovery.bootstrapGlobalFirstObserved[name] === undefined) {
        discovery.bootstrapGlobalFirstObserved[name] = current;
      }
      if (
        discovery.bootstrapGlobalFirstDefined[name] === undefined &&
        typeof window[name] !== "undefined"
      ) {
        discovery.bootstrapGlobalFirstDefined[name] = current;
      }
    });
    if (discovery.loaderFirstDetected === null && document.getElementById("gfLoader")) {
      discovery.loaderFirstDetected = current;
    }
    if (discovery.productionScriptFirstDetected === null && productionScripts().length > 0) {
      discovery.productionScriptFirstDetected = current;
    }
    if (discovery.externalStyleFirstDetected === null && document.getElementById("gf-loader-style")) {
      discovery.externalStyleFirstDetected = current;
    }
  };
  const valueOfGlobal = (name) => {
    if (typeof window[name] === "undefined") {
      return null;
    }
    return window[name];
  };
  const bootstrapState = () => {
    updateDiscovery();
    const globals = {};
    bootstrapGlobalNames.forEach((name) => {
      globals[name] = {
        value: valueOfGlobal(name),
        type: typeof window[name],
        firstObservedAt: discovery.bootstrapGlobalFirstObserved[name],
        firstDefinedAt: discovery.bootstrapGlobalFirstDefined[name] ?? null,
      };
    });
    const navigationEntry = performance.getEntriesByType
      ? performance.getEntriesByType("navigation")[0]
      : null;
    return {
      globals,
      documentReadyState: document.readyState,
      navigationType: navigationEntry ? navigationEntry.type : null,
      gfLoaderExists: Boolean(document.getElementById("gfLoader")),
      gfLoaderStyleExists: Boolean(document.getElementById("gf-loader-style")),
      productionScriptPresent: productionScripts().length > 0,
      productionScripts: productionScripts(),
      discovery: {
        diagnosticScriptStart: discovery.diagnosticScriptStart,
        bootstrapGlobalFirstObserved: { ...discovery.bootstrapGlobalFirstObserved },
        bootstrapGlobalFirstDefined: { ...discovery.bootstrapGlobalFirstDefined },
        loaderFirstDetected: discovery.loaderFirstDetected,
        productionScriptFirstDetected: discovery.productionScriptFirstDetected,
        externalStyleFirstDetected: discovery.externalStyleFirstDetected,
        loaderDetectionTimeout: discovery.loaderDetectionTimeout,
      },
    };
  };
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
    productionScriptUrl: productionScripts()[0] ? productionScripts()[0].src : null,
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
    viewportEvents,
    viewportSamples,
    viewportMetaTimeline,
    iframeTimeline,
    bodyMutationTimeline,
    navigationDetails: getNavigationDetails(),
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
      bootstrap: bootstrapState(),
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
    if (viewportDiagnosticsCleanup) {
      viewportDiagnosticsCleanup();
      viewportDiagnosticsCleanup = null;
    }
    observers.splice(0).forEach((observer) => observer.disconnect());
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
    document.getElementById("gf-mobile-loader-diagnostic-style")?.remove();
    panel?.remove();
    panel = null;
    output = null;
    statusNode = null;
    fallbackBox = null;
  };
  const describeAddedNode = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    return {
      selector: describeElement(node),
      tagName: node.tagName.toLowerCase(),
      id: node.id || null,
      className: node.className || null,
    };
  };
  const isViewportMetaNode = (node) =>
    Boolean(node && node.nodeType === Node.ELEMENT_NODE && node.tagName === "META" && node.getAttribute("name") === "viewport");
  const viewportMetaContent = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    try {
      return node.getAttribute("content");
    } catch {
      return null;
    }
  };
  const viewportMetaSnapshot = (node) => {
    const previous = viewportMetaNodeState.get(node) || { content: null, isViewport: false };
    const current = {
      content: viewportMetaContent(node),
      isViewport: isViewportMetaNode(node),
    };
    return { previous, current };
  };
  const storeViewportMetaState = (node) => {
    viewportMetaNodeState.set(node, {
      content: viewportMetaContent(node),
      isViewport: isViewportMetaNode(node),
    });
  };
  const recordViewportMetaTimeline = ({
    changeType,
    node,
    parent,
    previousContent,
    newContent,
    reason,
    timestamp,
  }) => {
    const content = typeof newContent === "string" ? newContent : node ? node.getAttribute("content") : null;
    const entry = {
      at: typeof timestamp === "number" ? timestamp : now(),
      reason,
      changeType,
      exists: Boolean(node && node.isConnected),
      previousContent: previousContent ?? null,
      content: content ?? null,
      newContent: content ?? null,
      mutationTarget: describeElement(node),
      parent: describeElement(parent),
    };
    viewportMetaTimeline.push(entry);
  };
  const recordViewportMetaObservation = (node, parent, reason, timestamp) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "META") return;
    const { previous, current } = viewportMetaSnapshot(node);
    if (current.isViewport) {
      const changeType = previous.isViewport ? (previous.content === current.content ? null : "modified") : "added";
      if (changeType) {
        recordViewportMetaTimeline({
          changeType,
          node,
          parent,
          previousContent: previous.content,
          newContent: current.content,
          reason,
          timestamp,
        });
      }
    } else if (previous.isViewport) {
      recordViewportMetaTimeline({
        changeType: "removed",
        node,
        parent,
        previousContent: previous.content,
        newContent: current.content,
        reason,
        timestamp,
      });
    }
    storeViewportMetaState(node);
  };
  const scanForViewportMeta = (root, parent, reason, timestamp) => {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (isViewportMetaNode(root)) {
      recordViewportMetaObservation(root, parent, reason, timestamp);
      return;
    }
    root.querySelectorAll('meta[name="viewport"]').forEach((meta) => {
      recordViewportMetaObservation(meta, root, reason, timestamp);
    });
  };
  const recordIframeNode = (node, parent, timestamp, reason) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName !== "IFRAME" || seenIframes.has(node)) return;
    seenIframes.add(node);
    iframeTimeline.push({
      at: typeof timestamp === "number" ? timestamp : now(),
      reason,
      added: describeAddedNode(node),
      containingNode: describeAddedNode(parent) || describeElement(parent),
      parent: describeElement(parent),
      src: (() => {
        try {
          return node.getAttribute("src") || node.src || null;
        } catch {
          return null;
        }
      })(),
      state: viewportState(),
      coincidesWithViewportChange:
        lastViewportChangeAt !== null && Math.abs((typeof timestamp === "number" ? timestamp : now()) - lastViewportChangeAt) <= 75,
    });
  };
  const scanForIframes = (root, parent, timestamp, reason) => {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.tagName === "IFRAME") {
      recordIframeNode(root, parent, timestamp, reason);
      return;
    }
    root.querySelectorAll("iframe").forEach((iframe) => {
      recordIframeNode(iframe, root, timestamp, reason);
    });
  };
  const startViewportDiagnostics = () => {
    captureViewportSample("diagnostic start", { force: true });

    const sampleTimer = window.setInterval(() => {
      const at = now();
      if (at > 3000 || viewportTrackingStopped) {
        return;
      }
      captureViewportSample("50ms sample", { always: true });
    }, 50);
    timers.push(sampleTimer);

    const stopTimer = window.setTimeout(() => {
      viewportTrackingStopped = true;
      captureViewportSample("viewport diagnostics stopped", { force: true });
      window.clearInterval(sampleTimer);
      if (viewportDiagnosticsCleanup) {
        viewportDiagnosticsCleanup();
        viewportDiagnosticsCleanup = null;
      }
    }, 3500);
    timers.push(stopTimer);

    viewportEventHandlers.windowResize = (event) => recordViewportEvent("window.resize", event || {});
    viewportEventHandlers.orientationchange = (event) =>
      recordViewportEvent("orientationchange", event || {});
    viewportEventHandlers.pageshow = (event) => recordViewportEvent("pageshow", event || {});
    viewportEventHandlers.domContentLoaded = (event) =>
      recordViewportEvent("DOMContentLoaded", event || {});
    viewportEventHandlers.load = (event) => recordViewportEvent("load", event || {});

    window.addEventListener("resize", viewportEventHandlers.windowResize);
    window.addEventListener("orientationchange", viewportEventHandlers.orientationchange);
    window.addEventListener("pageshow", viewportEventHandlers.pageshow);
    document.addEventListener("DOMContentLoaded", viewportEventHandlers.domContentLoaded);
    window.addEventListener("load", viewportEventHandlers.load);

    if (window.visualViewport) {
      viewportEventHandlers.visualViewportResize = (event) =>
        recordViewportEvent("visualViewport.resize", event || {});
      viewportEventHandlers.visualViewportScroll = (event) =>
        recordViewportEvent("visualViewport.scroll", event || {});
      window.visualViewport.addEventListener("resize", viewportEventHandlers.visualViewportResize);
      window.visualViewport.addEventListener("scroll", viewportEventHandlers.visualViewportScroll);
    }

    const viewportObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const timestamp = now();
        if (mutation.type === "attributes" && mutation.target && mutation.target.tagName === "META") {
          recordViewportMetaObservation(mutation.target, mutation.target.parentElement, "attribute-mutation", timestamp);
        }

        mutation.addedNodes.forEach((node) => {
          const info = describeAddedNode(node);
          if (!info) return;
          if (mutation.target === document.body || document.body.contains(mutation.target)) {
            bodyMutationTimeline.push({
              at: timestamp,
              mutationType: mutation.type,
              added: info,
              parent: describeElement(mutation.target),
              coincidesWithViewportChange:
                lastViewportChangeAt !== null && Math.abs(timestamp - lastViewportChangeAt) <= 75,
              state: viewportState(),
            });
          }
          scanForViewportMeta(node, mutation.target, "mutation-added", timestamp);
          scanForIframes(node, mutation.target, timestamp, "mutation-added");
        });
        mutation.removedNodes.forEach((node) => {
          const info = describeAddedNode(node);
          if (!info) return;
          if (mutation.target === document.body || document.body.contains(mutation.target)) {
            bodyMutationTimeline.push({
              at: timestamp,
              mutationType: mutation.type,
              removed: info,
              parent: describeElement(mutation.target),
              coincidesWithViewportChange:
                lastViewportChangeAt !== null && Math.abs(timestamp - lastViewportChangeAt) <= 75,
              state: viewportState(),
            });
          }
          scanForViewportMeta(node, mutation.target, "mutation-removed", timestamp);
          scanForIframes(node, mutation.target, timestamp, "mutation-removed");
        });
      });
    });
    viewportObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content", "name"],
    });
    observers.push(viewportObserver);

    const initialViewportMeta = getViewportMetaElement();
    viewportMetaTimeline.push({
      at: now(),
      reason: "initial observation",
      changeType: initialViewportMeta ? "observed" : "absent",
      exists: Boolean(initialViewportMeta),
      previousContent: null,
      content: initialViewportMeta ? initialViewportMeta.getAttribute("content") : null,
      newContent: initialViewportMeta ? initialViewportMeta.getAttribute("content") : null,
    });
    if (initialViewportMeta) {
      storeViewportMetaState(initialViewportMeta);
    }

    if (document.readyState !== "loading") {
      viewportEvents.push({
        at: now(),
        event: "DOMContentLoaded",
        synthetic: true,
        reason: "script-start-after-domcontentloaded",
        state: viewportState(),
      });
    }
    if (document.readyState === "complete") {
      viewportEvents.push({
        at: now(),
        event: "load",
        synthetic: true,
        reason: "script-start-after-load",
        state: viewportState(),
      });
    }

    viewportDiagnosticsCleanup = () => {
      window.removeEventListener("resize", viewportEventHandlers.windowResize);
      window.removeEventListener("orientationchange", viewportEventHandlers.orientationchange);
      window.removeEventListener("pageshow", viewportEventHandlers.pageshow);
      document.removeEventListener("DOMContentLoaded", viewportEventHandlers.domContentLoaded);
      window.removeEventListener("load", viewportEventHandlers.load);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          viewportEventHandlers.visualViewportResize
        );
        window.visualViewport.removeEventListener(
          "scroll",
          viewportEventHandlers.visualViewportScroll
        );
      }
    };
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
        discovery.loaderDetectionTimeout = now();
        snapshot("loader detection timed out", { force: true });
        createPanel();
        return;
      }
      const timer = window.setTimeout(poll, 50);
      timers.push(timer);
    };
    poll();
  };

  const discoveryObserver = new MutationObserver(() => {
    updateDiscovery();
  });
  discoveryObserver.observe(document.documentElement, { childList: true, subtree: true });
  observers.push(discoveryObserver);

  snapshot("diagnostic script started", { force: true });
  startViewportDiagnostics();
  waitForLoader();
})();
