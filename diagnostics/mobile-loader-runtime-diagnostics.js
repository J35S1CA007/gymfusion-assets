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
    loaderRoot: "#gfLoader",
    composition: ".gf-composition",
    wheel: ".gf-wheel",
    loadingText: ".gf-loading",
    emblem: ".gf-emblem",
    logo: ".gf-logo",
    logoImage: ".gf-logo img",
    loadingBar: ".gf-progress",
    progressFill: ".gf-progress-fill",
    backgroundContainer: ".gf-background-canvas, .gf-backdrop-image",
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
  const eventTimeline = [];
  const fontTimeline = [];
  const messageTimeline = [];
  const geometryTimeline = [];
  const cssVariableTimeline = [];
  const backgroundTimeline = [];
  const progressTimeline = [];
  const iframeEvents = [];
  const resizeTimeline = [];
  const loaderMutationTimeline = [];
  const animationFrames = [];
  const lifecycleCaptures = [];
  const resourceTimeline = [];
  const dependencyEdges = [];
  const eventIndex = new Map();
  const limitations = [
    "Page JavaScript cannot capture Safari screen pixels without an external automation hook.",
    "CSS background decode completion is measured by a diagnostic Image.decode probe, not the production loader Image instance.",
    "Browsers do not expose per-element paint completion; the first requestAnimationFrame after a class change is a paint-boundary proxy.",
  ];
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
  let backgroundClassRecorded = false;
  let lastViewportSignature = null;
  let lastViewportWidth = null;
  let lastViewportChangeAt = null;
  const viewportEventHandlers = {};
  let viewportDiagnosticsCleanup = null;
  const seenIframes = new WeakSet();
  const viewportMetaNodeState = new WeakMap();
  const cleanupFunctions = [];
  const lastGeometryState = new Map();
  const lastCssVariableState = new Map();
  const lastResizeState = new Map();
  const resizeNotifiedTargets = new Set();
  const iframeState = new WeakMap();
  const decodedBackgroundUrls = new Set();
  let eventSequence = 0;
  let frameSequence = 0;
  let geometryMonitoringActive = false;
  let productionRemovalAttempted = false;
  let firstIframeCaptured = false;
  let lastMessageText = null;
  let lastProgressState = null;
  let lastMutationEventId = null;
  let lastViewportEventId = null;
  let lastFontEventId = null;
  let lastMessageEventId = null;
  let lastBackgroundEventId = null;
  let lastProgressEventId = null;
  let safeAreaProbe = null;

  const now = () => Math.round(performance.now() - startedAt);
  const atForPerformanceTime = (timestamp) => Math.round(timestamp - startedAt);
  const recordEvent = (category, type, detail = {}, options = {}) => {
    const entry = {
      id: `event-${++eventSequence}`,
      at: typeof options.at === "number" ? options.at : now(),
      category,
      type,
      detail,
    };
    eventTimeline.push(entry);
    eventIndex.set(entry.id, entry);
    return entry;
  };
  const addDependency = (from, to, relation, confidence = "direct") => {
    const fromId = typeof from === "string" ? from : from?.id;
    const toId = typeof to === "string" ? to : to?.id;
    if (!fromId || !toId) return;
    dependencyEdges.push({ from: fromId, to: toId, relation, confidence });
  };
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
  const installSafeAreaProbe = () => {
    if (safeAreaProbe) return;
    safeAreaProbe = document.createElement("div");
    safeAreaProbe.id = "gfDiagnosticSafeAreaProbe";
    safeAreaProbe.setAttribute("aria-hidden", "true");
    safeAreaProbe.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;visibility:hidden;pointer-events:none;contain:strict;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);";
    document.documentElement.appendChild(safeAreaProbe);
    cleanupFunctions.push(() => safeAreaProbe?.remove());
  };
  const safeAreaState = () => {
    if (!safeAreaProbe) return null;
    const style = getComputedStyle(safeAreaProbe);
    return {
      top: style.paddingTop,
      right: style.paddingRight,
      bottom: style.paddingBottom,
      left: style.paddingLeft,
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
    orientation:
      window.screen && window.screen.orientation ? window.screen.orientation.type : null,
    screenOrientationType:
      window.screen && window.screen.orientation ? window.screen.orientation.type : null,
    screenOrientationAngle:
      window.screen && window.screen.orientation ? window.screen.orientation.angle : null,
    bodyScrollWidth: document.body ? document.body.scrollWidth : null,
    documentScrollWidth: document.documentElement.scrollWidth,
    safeAreaInsets: safeAreaState(),
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
      state.safeAreaInsets?.top ?? null,
      state.safeAreaInsets?.right ?? null,
      state.safeAreaInsets?.bottom ?? null,
      state.safeAreaInsets?.left ?? null,
    ]);
  const viewportFieldLabels = [
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
    "safeAreaInsets.top",
    "safeAreaInsets.right",
    "safeAreaInsets.bottom",
    "safeAreaInsets.left",
  ];
  const visualViewportMetricFields = new Set([
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
    "safeAreaInsets.top",
    "safeAreaInsets.right",
    "safeAreaInsets.bottom",
    "safeAreaInsets.left",
  ]);
  const viewportChanges = (previousSignature, currentSignature) => {
    if (!previousSignature) return [];
    const previous = JSON.parse(previousSignature);
    const current = JSON.parse(currentSignature);
    return viewportFieldLabels.flatMap((field, index) =>
      previous[index] === current[index]
        ? []
        : [{ field, before: previous[index], after: current[index] }]
    );
  };
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
      entry.changedFields = viewportChanges(lastViewportSignature, signature);
      const event = recordEvent("viewport", "metrics-changed", {
        reason,
        changedFields: entry.changedFields,
        state,
      });
      lastViewportEventId = event.id;
      if (lastViewportSignature && entry.changedFields.some(({ field }) => visualViewportMetricFields.has(field))) {
        requestLifecycleCapture("viewport changed", event, { reason, changedFields: entry.changedFields });
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
    const signature = viewportSignature(state);
    const metricsChanged = lastViewportSignature !== null && signature !== lastViewportSignature;
    const changedFields = metricsChanged ? viewportChanges(lastViewportSignature, signature) : [];
    const entry = {
      at: now(),
      event: name,
      persisted: typeof event.persisted === "boolean" ? event.persisted : null,
      state,
      changedFields,
      viewportChangedSinceLastEvent:
        lastViewportChangeAt !== null ? now() - lastViewportChangeAt : null,
    };
    if (changedFields.some(({ field }) => visualViewportMetricFields.has(field))) {
      lastViewportChangeAt = entry.at;
    }
    if (state.innerWidth !== lastViewportWidth) {
      entry.viewportWidthChange = true;
      entry.widestVisibleElement = widestVisibleElement();
      lastViewportChangeAt = entry.at;
    }
    viewportEvents.push(entry);
    const timelineEvent = recordEvent("viewport", name, { state, persisted: entry.persisted, changedFields });
    lastViewportEventId = timelineEvent.id;
    if (changedFields.some(({ field }) => visualViewportMetricFields.has(field))) {
      requestLifecycleCapture("viewport changed", timelineEvent, { reason: `event:${name}`, state, changedFields });
    }
    viewportSamples.push({
      at: entry.at,
      reason: `event:${name}`,
      changed: true,
      detail: { persisted: entry.persisted },
      state,
      changedFields,
      viewportWidthChange: Boolean(entry.viewportWidthChange),
      widestVisibleElement: entry.widestVisibleElement || null,
    });
    lastViewportSignature = signature;
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
  const trackedCssVariables = new Set([
    "--gf-loader-vw",
    "--gf-loader-vh",
    "--gf-loader-svh",
    "--gf-entry-width",
    "--gf-entry-height",
    "--gf-small-height",
    "--gf-safe-top",
    "--gf-composition-height",
    "--gf-composition-top",
    "--gf-brand-gap",
    "--gf-logo-art-height",
    "--gf-logo-art-offset",
    "--gf-logo-size",
    "--gf-galaxy",
    "--gf-galaxy-position",
  ]);
  const discoverCssVariables = () => {
    const inspectRules = (rules) => {
      Array.from(rules || []).forEach((rule) => {
        if (rule.style) {
          Array.from(rule.style).forEach((name) => {
            if (name.startsWith("--gf-")) trackedCssVariables.add(name);
          });
        }
        if (rule.cssRules) inspectRules(rule.cssRules);
      });
    };
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        inspectRules(sheet.cssRules);
      } catch {
        // Cross-origin stylesheets cannot be inspected; configured variables remain covered.
      }
    });
  };
  const cssVariableState = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    const values = {};
    Array.from(trackedCssVariables).sort().forEach((name) => {
      values[name] = style.getPropertyValue(name).trim();
    });
    return values;
  };
  const geometryState = (element) => {
    if (!element || !element.isConnected) return null;
    const style = getComputedStyle(element);
    return {
      rect: rectOf(element),
      computedWidth: style.width,
      computedHeight: style.height,
      transform: style.transform,
      opacity: style.opacity,
      display: style.display,
      position: style.position,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationDelay: style.animationDelay,
      animationPlayState: style.animationPlayState,
      backgroundImage: style.backgroundImage,
      backgroundPosition: style.backgroundPosition,
      backgroundSize: style.backgroundSize,
    };
  };
  const changedProperties = (previous, current) => {
    if (!previous || !current) {
      return [{ property: "state", previous: previous ?? null, current: current ?? null }];
    }
    const changes = [];
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    keys.forEach((key) => {
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changes.push({ property: key, previous: previous[key] ?? null, current: current[key] ?? null });
      }
    });
    return changes;
  };
  const currentDiagnosticState = () => ({
    viewport: viewportState(),
    loader: loaderState(),
    components: components(),
    cssVariables: {
      root: cssVariableState(document.documentElement),
      loader: cssVariableState(loader),
    },
    fontsStatus: document.fonts ? document.fonts.status : "unsupported",
  });
  const requestLifecycleCapture = (name, triggerEvent, detail = {}) => {
    const entry = {
      id: `capture-${lifecycleCaptures.length + 1}`,
      at: now(),
      name,
      triggerEventId: triggerEvent?.id || null,
      detail,
      state: currentDiagnosticState(),
      screenshot: {
        status: "external-hook-required",
        reason: "Browser page JavaScript has no permission to capture Safari screen pixels.",
      },
    };
    lifecycleCaptures.push(entry);
    const captureEvent = recordEvent("lifecycle-capture", name, {
      captureId: entry.id,
      triggerEventId: entry.triggerEventId,
    });
    if (triggerEvent) addDependency(triggerEvent, captureEvent, "triggered-capture");

    const requestDetail = {
      captureId: entry.id,
      name,
      at: entry.at,
      triggerEventId: entry.triggerEventId,
    };
    window.dispatchEvent(new CustomEvent("gf-loader-diagnostic-screenshot-request", { detail: requestDetail }));
    const hook = window.__gfMobileLoaderDiagnosticScreenshotCapture;
    if (typeof hook === "function") {
      entry.screenshot.status = "requested";
      Promise.resolve(hook(requestDetail))
        .then((result) => {
          entry.screenshot = { status: "captured", result: result ?? null };
        })
        .catch((error) => {
          entry.screenshot = { status: "failed", error: String(error) };
        });
    }
    return entry;
  };
  const recordCssVariableChanges = (targetName, element) => {
    const current = cssVariableState(element);
    const previous = lastCssVariableState.get(targetName) || null;
    if (JSON.stringify(previous) === JSON.stringify(current)) return;
    const changes = changedProperties(previous, current);
    const entry = { at: now(), target: targetName, changes };
    cssVariableTimeline.push(entry);
    const event = recordEvent("css-variables", "changed", entry);
    if (lastMutationEventId) addDependency(lastMutationEventId, event, "temporally-preceded-by", "correlation-only");
    lastCssVariableState.set(targetName, current);
  };
  const progressState = () => {
    const fill = loader?.querySelector(".gf-progress-fill");
    if (!fill) return null;
    const style = getComputedStyle(fill);
    const rect = fill.getBoundingClientRect();
    return {
      inlineValue: fill.style.width || null,
      displayedWidth: rect.width,
      displayedHeight: rect.height,
      transform: style.transform,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationDelay: style.animationDelay,
      animationPlayState: style.animationPlayState,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
    };
  };
  const recordProgressChanges = (reason) => {
    const current = progressState();
    if (JSON.stringify(current) === JSON.stringify(lastProgressState)) return;
    const entry = {
      at: now(),
      reason,
      changes: changedProperties(lastProgressState, current),
      state: current,
    };
    progressTimeline.push(entry);
    const event = recordEvent("progress", "changed", entry);
    lastProgressEventId = event.id;
    lastProgressState = current;
  };
  const recordGeometry = (reason) => {
    Object.entries(componentSelectors).forEach(([name, selector]) => {
      const element = name === "loaderRoot" ? loader : loader?.querySelector(selector);
      const current = geometryState(element);
      const previous = lastGeometryState.get(name) || null;
      if (JSON.stringify(previous) === JSON.stringify(current)) return;
      const entry = {
        at: now(),
        reason,
        target: name,
        selector,
        changes: changedProperties(previous, current),
        previous,
        current,
      };
      geometryTimeline.push(entry);
      const event = recordEvent("geometry", "changed", {
        target: name,
        reason,
        changes: entry.changes,
      });
      [
        [lastMutationEventId, 1000],
        [lastViewportEventId, 250],
        [lastFontEventId, 250],
        [lastMessageEventId, 500],
        [lastBackgroundEventId, 700],
        [lastProgressEventId, 250],
      ].forEach(([sourceId, windowMs]) => {
        const source = eventIndex.get(sourceId);
        if (source && event.at - source.at >= 0 && event.at - source.at <= windowMs) {
          addDependency(source, event, "temporally-preceded-by", "correlation-only");
        }
      });
      lastGeometryState.set(name, current);
    });
    recordCssVariableChanges("documentElement", document.documentElement);
    recordCssVariableChanges("loader", loader);
    recordProgressChanges(reason);
  };
  const startAnimationFrameDiagnostics = () => {
    if (geometryMonitoringActive) return;
    geometryMonitoringActive = true;
    let previousTimestamp = null;
    let animationFrameId = 0;
    const sample = (timestamp) => {
      frameSequence += 1;
      if (frameSequence <= 300) {
        animationFrames.push({
          frame: frameSequence,
          at: atForPerformanceTime(timestamp),
          timestamp,
          delta: previousTimestamp === null ? null : timestamp - previousTimestamp,
        });
      }
      previousTimestamp = timestamp;
      if (!productionRemovalAttempted) recordGeometry("requestAnimationFrame");
      if (frameSequence < 300 || (!productionRemovalAttempted && loader?.isConnected)) {
        animationFrameId = requestAnimationFrame(sample);
      } else {
        geometryMonitoringActive = false;
      }
    };
    animationFrameId = requestAnimationFrame(sample);
    cleanupFunctions.push(() => cancelAnimationFrame(animationFrameId));
  };
  const report = () => ({
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    snapshots,
    classHistory,
    viewportEvents,
    viewportSamples,
    viewportMetaTimeline,
    iframeTimeline,
    iframeEvents,
    bodyMutationTimeline,
    timeline: [...eventTimeline].sort((a, b) => a.at - b.at || Number(a.id.slice(6)) - Number(b.id.slice(6))),
    dependencyGraph: {
      nodeSource: "timeline",
      edges: dependencyEdges,
      relationPolicy: "Only direct instrumentation links are causal; temporally-preceded-by edges are correlation-only.",
    },
    fonts: fontTimeline,
    messages: messageTimeline,
    geometry: geometryTimeline,
    cssVariables: cssVariableTimeline,
    background: backgroundTimeline,
    progress: progressTimeline,
    resizeObserver: resizeTimeline,
    mutations: loaderMutationTimeline,
    animationFrames,
    lifecycleCaptures,
    resources: resourceTimeline,
    limitations,
    determination: {
      status: "requires-captured-run",
      rule: "Do not attribute a visual change unless a direct dependency edge or uniquely identifying event sequence supports it.",
    },
    navigationDetails: getNavigationDetails(),
  });
  const render = () => {
    if (!output) return;
    output.textContent = JSON.stringify({
      generatedAt: new Date().toISOString(),
      counts: {
        timeline: eventTimeline.length,
        geometry: geometryTimeline.length,
        viewport: viewportSamples.length,
        fonts: fontTimeline.length,
        background: backgroundTimeline.length,
        progress: progressTimeline.length,
        frames: animationFrames.length,
        captures: lifecycleCaptures.length,
      },
      latestEvents: eventTimeline.slice(-8),
    }, null, 2);
    if (statusNode) statusNode.textContent = frozen ? "Measurements frozen" : "Measurements live";
  };
  window.__gfMobileLoaderDiagnosticsReport = report;
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
    addButton(controls, "Copy JSON", copyReport);
    addButton(controls, "Continue to Website", continueToWebsite);
    addButton(controls, "Close diagnostics", closeDiagnostics);
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
  const loadingTextFontState = () => {
    const element = loader?.querySelector(".gf-loading");
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
    };
  };
  const fontFacesFromEvent = (event) =>
    Array.from(event?.fontfaces || []).map((font) => ({
      family: font.family,
      status: font.status,
      style: font.style,
      weight: font.weight,
      stretch: font.stretch,
      display: font.display,
    }));
  const recordFontEvent = (type, event = null) => {
    const entry = {
      at: now(),
      type,
      status: document.fonts ? document.fonts.status : "unsupported",
      fontfaces: fontFacesFromEvent(event),
      loadingText: loadingTextFontState(),
    };
    fontTimeline.push(entry);
    const timelineEvent = recordEvent("fonts", type, entry);
    lastFontEventId = timelineEvent.id;
    return timelineEvent;
  };
  const startFontDiagnostics = () => {
    if (!document.fonts) {
      recordFontEvent("unsupported");
      return;
    }
    recordFontEvent("initial-status");
    let loadingCycle = 0;
    if (typeof document.fonts.addEventListener !== "function") {
      limitations.push("FontFaceSet loading events are not supported by this browser; document.fonts.ready remains recorded.");
    }
    ["loading", "loadingdone", "loadingerror"].forEach((type) => {
      const handler = (event) => {
        recordFontEvent(type, event);
        if (type === "loading") {
          const cycle = ++loadingCycle;
          document.fonts.ready.then(() => {
            if (cycle !== loadingCycle) return;
            const readyEvent = recordFontEvent("ready-after-loading-cycle");
            requestLifecycleCapture("fonts ready", readyEvent, { cycle });
            recordGeometry("fonts-ready-after-loading-cycle");
          });
        }
      };
      if (typeof document.fonts.addEventListener === "function") {
        document.fonts.addEventListener(type, handler);
        cleanupFunctions.push(() => document.fonts.removeEventListener(type, handler));
      }
    });
    document.fonts.ready.then(() => {
      const event = recordFontEvent("ready");
      requestLifecycleCapture("fonts ready", event);
      recordGeometry("fonts-ready");
    });
  };
  const startMessageDiagnostics = () => {
    const messageNode = loader?.querySelector("#gfLoadingText");
    if (!messageNode) return;
    lastMessageText = messageNode.textContent || "";
    const initial = {
      at: now(),
      previous: null,
      current: lastMessageText,
      reason: "initial",
      font: loadingTextFontState(),
    };
    messageTimeline.push(initial);
    lastMessageEventId = recordEvent("loading-message", "initial", initial).id;
    const observer = new MutationObserver(() => {
      const current = messageNode.textContent || "";
      if (current === lastMessageText) return;
      const entry = {
        at: now(),
        previous: lastMessageText,
        current,
        reason: "character-data-or-child-list-mutation",
        font: loadingTextFontState(),
      };
      messageTimeline.push(entry);
      const event = recordEvent("loading-message", "changed", entry);
      lastMessageEventId = event.id;
      lastMessageText = current;
      requestAnimationFrame(() => recordGeometry("loading-message-change"));
    });
    observer.observe(messageNode, { subtree: true, childList: true, characterData: true });
    observers.push(observer);
  };
  const startProgressDiagnostics = () => {
    const fill = loader?.querySelector(".gf-progress-fill");
    if (!fill) return;
    recordProgressChanges("initial");
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName !== "style") return;
        recordProgressChanges("inline-style-mutation");
        requestAnimationFrame(() => recordProgressChanges("frame-after-inline-style-mutation"));
      });
    });
    observer.observe(fill, { attributes: true, attributeFilter: ["style"], attributeOldValue: true });
    observers.push(observer);
  };
  const startResizeDiagnostics = () => {
    if (typeof ResizeObserver !== "function") {
      recordEvent("resize-observer", "unsupported");
      return;
    }
    const targets = {
      html: document.documentElement,
      body: document.body,
      loaderRoot: loader,
      composition: loader?.querySelector(".gf-composition"),
    };
    const names = new Map();
    Object.entries(targets).forEach(([name, element]) => {
      if (!element) return;
      names.set(element, name);
      const rect = element.getBoundingClientRect();
      lastResizeState.set(name, { width: rect.width, height: rect.height });
    });
    const observer = new ResizeObserver((entries) => {
      entries.forEach((resizeEntry) => {
        const target = names.get(resizeEntry.target) || describeElement(resizeEntry.target);
        const rect = resizeEntry.target.getBoundingClientRect();
        const current = { width: rect.width, height: rect.height };
        const previous = lastResizeState.get(target) || null;
        if (resizeNotifiedTargets.has(target) && JSON.stringify(previous) === JSON.stringify(current)) return;
        const entry = { at: now(), target, previous, current };
        resizeTimeline.push(entry);
        recordEvent("resize-observer", "resize", entry);
        lastResizeState.set(target, current);
        resizeNotifiedTargets.add(target);
      });
    });
    names.forEach((name, element) => observer.observe(element));
    observers.push(observer);
  };
  const startLoaderMutationDiagnostics = () => {
    const targets = {
      loaderRoot: loader,
      composition: loader?.querySelector(".gf-composition"),
    };
    Object.entries(targets).forEach(([targetName, element]) => {
      if (!element) return;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          const newValue = mutation.target.getAttribute(mutation.attributeName);
          const entry = {
            at: now(),
            target: targetName,
            attribute: mutation.attributeName,
            previous: mutation.oldValue,
            current: newValue,
          };
          loaderMutationTimeline.push(entry);
          const event = recordEvent("loader-mutation", "attribute-changed", entry);
          lastMutationEventId = event.id;
          if (mutation.attributeName === "style") {
            recordCssVariableChanges(targetName, mutation.target);
          }
          if (mutation.attributeName === "class" && targetName === "loaderRoot") {
            if (loader.classList.contains("gf-galaxy-loaded") && !backgroundClassRecorded) {
              backgroundClassRecorded = true;
              const backgroundEntry = {
                at: now(),
                type: "background-class-applied",
                className: loader.className,
              };
              backgroundTimeline.push(backgroundEntry);
              const backgroundEvent = recordEvent("background", "class-applied", backgroundEntry);
              lastBackgroundEventId = backgroundEvent.id;
              requestAnimationFrame((firstFrame) => {
                const firstEntry = {
                  at: atForPerformanceTime(firstFrame),
                  type: "first-animation-frame-after-class",
                  frameTimestamp: firstFrame,
                };
                backgroundTimeline.push(firstEntry);
                const firstEvent = recordEvent("background", "first-animation-frame-after-class", firstEntry);
                addDependency(backgroundEvent, firstEvent, "scheduled-next-animation-frame");
                requestAnimationFrame((afterPaintFrame) => {
                  const paintEntry = {
                    at: atForPerformanceTime(afterPaintFrame),
                    type: "first-frame-after-possible-paint",
                    frameTimestamp: afterPaintFrame,
                  };
                  backgroundTimeline.push(paintEntry);
                  const paintEvent = recordEvent("background", "first-frame-after-possible-paint", paintEntry);
                  addDependency(firstEvent, paintEvent, "next-frame-paint-boundary-proxy", "inferred");
                });
              });
            }
            if (loader.classList.contains("gf-is-hidden")) {
              requestLifecycleCapture("loader hidden", event, { className: loader.className });
            }
          }
          requestAnimationFrame(() => recordGeometry("loader-attribute-mutation"));
        });
      });
      observer.observe(element, { attributes: true, attributeOldValue: true });
      observers.push(observer);
    });
  };
  const relevantResourceType = (url) => {
    if (/\/loaders\/(mobile|desktop)%?20loader%?20images\//i.test(url) || /\/loaders\/(mobile|desktop) loader images\//i.test(decodeURI(url))) return "background-image";
    if (/\/loaders\/logos\//i.test(url)) return "logo-image";
    if (/\.(woff2?|ttf)(?:$|\?)/i.test(url)) return "font";
    if (/gymfusion-loader\.js(?:$|\?)/i.test(url)) return "loader-script";
    return null;
  };
  const probeBackgroundDecode = (url, responseEvent) => {
    if (decodedBackgroundUrls.has(url)) return;
    decodedBackgroundUrls.add(url);
    const image = new Image();
    const startEntry = { at: now(), type: "diagnostic-decode-probe-start", url };
    backgroundTimeline.push(startEntry);
    const startEvent = recordEvent("background", "diagnostic-decode-probe-start", startEntry);
    if (responseEvent) addDependency(responseEvent, startEvent, "identified-resource-for-decode-probe");
    image.onload = async () => {
      const loadEntry = {
        at: now(),
        type: "diagnostic-image-load",
        url,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      };
      backgroundTimeline.push(loadEntry);
      const loadEvent = recordEvent("background", "diagnostic-image-load", loadEntry);
      addDependency(startEvent, loadEvent, "image-load-completed");
      try {
        if (typeof image.decode === "function") await image.decode();
        const decodeEntry = { at: now(), type: "diagnostic-decode-complete", url };
        backgroundTimeline.push(decodeEntry);
        const decodeEvent = recordEvent("background", "diagnostic-decode-complete", decodeEntry);
        addDependency(loadEvent, decodeEvent, "decode-resolved");
        requestLifecycleCapture("background decoded", decodeEvent, { url, scope: "diagnostic-probe" });
      } catch (error) {
        const errorEntry = { at: now(), type: "diagnostic-decode-error", url, error: String(error) };
        backgroundTimeline.push(errorEntry);
        recordEvent("background", "diagnostic-decode-error", errorEntry);
      }
    };
    image.onerror = () => {
      const entry = { at: now(), type: "diagnostic-image-error", url };
      backgroundTimeline.push(entry);
      recordEvent("background", "diagnostic-image-error", entry);
    };
    image.src = url;
  };
  const startResourceDiagnostics = () => {
    const seenEntries = new Set();
    const recordResource = (entry) => {
      const resourceType = relevantResourceType(entry.name);
      if (!resourceType) return;
      const signature = `${entry.name}|${entry.startTime}|${entry.responseEnd}`;
      if (seenEntries.has(signature)) return;
      seenEntries.add(signature);
      const item = {
        name: entry.name,
        resourceType,
        initiatorType: entry.initiatorType,
        startTime: entry.startTime,
        requestStart: entry.requestStart,
        responseStart: entry.responseStart,
        responseEnd: entry.responseEnd,
        duration: entry.duration,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      };
      resourceTimeline.push(item);
      const requestEvent = recordEvent("resource", "request-start", item, {
        at: atForPerformanceTime(entry.requestStart || entry.startTime),
      });
      const responseEvent = recordEvent("resource", "response-received", item, {
        at: atForPerformanceTime(entry.responseStart || entry.responseEnd),
      });
      const completeEvent = recordEvent("resource", "response-complete", item, {
        at: atForPerformanceTime(entry.responseEnd),
      });
      addDependency(requestEvent, responseEvent, "network-response-started");
      addDependency(responseEvent, completeEvent, "network-response-completed");
      if (resourceType === "background-image") probeBackgroundDecode(entry.name, completeEvent);
    };
    performance.getEntriesByType?.("resource").forEach(recordResource);
    if (typeof PerformanceObserver !== "function") {
      recordEvent("resource", "performance-observer-unsupported");
      return;
    }
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach(recordResource));
      observer.observe({ type: "resource", buffered: true });
      cleanupFunctions.push(() => observer.disconnect());
    } catch (error) {
      recordEvent("resource", "performance-observer-error", { error: String(error) });
    }
  };
  const stopDiagnostics = () => {
    if (viewportDiagnosticsCleanup) {
      viewportDiagnosticsCleanup();
      viewportDiagnosticsCleanup = null;
    }
    observers.splice(0).forEach((observer) => observer.disconnect());
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
    cleanupFunctions.splice(0).forEach((cleanup) => cleanup());
  };
  const closeDiagnostics = () => {
    stopDiagnostics();
    panel?.remove();
    document.getElementById("gf-mobile-loader-diagnostic-style")?.remove();
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
    const content = changeType === "removed"
      ? null
      : typeof newContent === "string"
      ? newContent
      : node
      ? node.getAttribute("content")
      : null;
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
    recordEvent("meta-viewport", changeType, entry);
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
  const recordRemovedViewportMeta = (node, parent, reason, timestamp) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "META") return;
    const previous = viewportMetaNodeState.get(node) || {
      content: viewportMetaContent(node),
      isViewport: isViewportMetaNode(node),
    };
    if (!previous.isViewport && !isViewportMetaNode(node)) return;
    recordViewportMetaTimeline({
      changeType: "removed",
      node,
      parent,
      previousContent: previous.content,
      newContent: null,
      reason,
      timestamp,
    });
  };
  const scanForRemovedViewportMeta = (root, parent, reason, timestamp) => {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.tagName === "META") recordRemovedViewportMeta(root, parent, reason, timestamp);
    root.querySelectorAll("meta").forEach((meta) => {
      recordRemovedViewportMeta(meta, root, reason, timestamp);
    });
  };
  const recordIframeNode = (node, parent, timestamp, reason) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName !== "IFRAME" || seenIframes.has(node)) return;
    seenIframes.add(node);
    const source = (() => {
      try {
        return node.getAttribute("src") || node.src || null;
      } catch {
        return null;
      }
    })();
    const iframeEntry = {
      at: typeof timestamp === "number" ? timestamp : now(),
      reason,
      added: describeAddedNode(node),
      containingNode: describeAddedNode(parent) || describeElement(parent),
      parent: describeElement(parent),
      src: source,
      iframeCount: document.querySelectorAll("iframe").length,
      state: viewportState(),
      coincidesWithViewportChange:
        lastViewportChangeAt !== null && Math.abs((typeof timestamp === "number" ? timestamp : now()) - lastViewportChangeAt) <= 75,
    };
    iframeTimeline.push(iframeEntry);
    iframeState.set(node, { src: source, parent: describeElement(parent) });
    const eventEntry = {
      at: iframeEntry.at,
      action: "inserted",
      iframeCount: iframeEntry.iframeCount,
      src: source,
      parent: iframeEntry.parent,
      reason,
    };
    iframeEvents.push(eventEntry);
    const event = recordEvent("iframe", "inserted", eventEntry);
    if (!firstIframeCaptured) {
      firstIframeCaptured = true;
      requestLifecycleCapture("first iframe inserted", event, eventEntry);
    }
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
  const recordIframeRemoval = (node, parent, timestamp, reason) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "IFRAME") return;
    const previous = iframeState.get(node) || {};
    const entry = {
      at: typeof timestamp === "number" ? timestamp : now(),
      action: "removed",
      iframeCount: document.querySelectorAll("iframe").length,
      src: previous.src || node.getAttribute("src") || null,
      parent: previous.parent || describeElement(parent),
      reason,
    };
    iframeEvents.push(entry);
    recordEvent("iframe", "removed", entry);
  };
  const scanForRemovedIframes = (root, parent, timestamp, reason) => {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.tagName === "IFRAME") {
      recordIframeRemoval(root, parent, timestamp, reason);
      return;
    }
    root.querySelectorAll("iframe").forEach((iframe) => {
      recordIframeRemoval(iframe, root, timestamp, reason);
    });
  };
  const startViewportDiagnostics = () => {
    captureViewportSample("diagnostic start", { force: true });

    const sampleTimer = window.setInterval(() => {
      captureViewportSample("50ms change poll");
    }, 50);
    timers.push(sampleTimer);

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
          scanForRemovedViewportMeta(node, mutation.target, "mutation-removed", timestamp);
          scanForRemovedIframes(node, mutation.target, timestamp, "mutation-removed");
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

    const initialViewportMetas = Array.from(document.querySelectorAll('meta[name="viewport"]'));
    if (!initialViewportMetas.length) {
      const entry = {
        at: now(),
        reason: "initial observation",
        changeType: "absent",
        exists: false,
        previousContent: null,
        content: null,
        newContent: null,
      };
      viewportMetaTimeline.push(entry);
      recordEvent("meta-viewport", "absent", entry);
    }
    initialViewportMetas.forEach((initialViewportMeta) => {
      const entry = {
        at: now(),
        reason: "initial observation",
        changeType: "observed",
        exists: true,
        previousContent: null,
        content: initialViewportMeta.getAttribute("content"),
        newContent: initialViewportMeta.getAttribute("content"),
        mutationTarget: describeElement(initialViewportMeta),
        parent: describeElement(initialViewportMeta.parentElement),
      };
      viewportMetaTimeline.push(entry);
      recordEvent("meta-viewport", "observed", entry);
      storeViewportMetaState(initialViewportMeta);
    });
    scanForIframes(document.documentElement, document.documentElement, now(), "initial-scan");

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
    stopDiagnostics();
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
      productionRemovalAttempted = true;
      const removalEvent = recordEvent("loader", "removal-attempt", {
        className: loader.className,
        connected: loader.isConnected,
      });
      requestLifecycleCapture("loader removal attempt", removalEvent);
      recordGeometry("loader-removal-attempt");
      recordClass("final mode before production removal", true);
      snapshot("loader-removal attempt intercepted", { force: true });
      loader.classList.remove("gf-is-hidden");
    };
  };
  const observeLoader = () => {
    if (!loader) return;
    recordClass("initial bootstrap class observed", true);
    const classificationEvent = recordEvent("loader", "classified", {
      className: loader.className,
      mode: modeOf(loader.className),
      pathname: window.location.pathname,
    });
    requestLifecycleCapture("loader classified", classificationEvent);
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
    const createdEvent = recordEvent("loader", "created", {
      className: loader.className,
      shellVersion: loader.dataset.gfShellVersion || null,
      pageMode: loader.dataset.gfPageMode || null,
    });
    discoverCssVariables();
    recordCssVariableChanges("documentElement", document.documentElement);
    recordCssVariableChanges("loader", loader);
    startMessageDiagnostics();
    startProgressDiagnostics();
    startResizeDiagnostics();
    startLoaderMutationDiagnostics();
    recordGeometry("loader-created");
    startAnimationFrameDiagnostics();
    requestLifecycleCapture("loader created", createdEvent);
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

  installSafeAreaProbe();
  snapshot("diagnostic script started", { force: true });
  startViewportDiagnostics();
  startFontDiagnostics();
  startResourceDiagnostics();
  waitForLoader();
})();
