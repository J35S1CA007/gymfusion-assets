(() => {
  try {
    if (window.__gymfusionLoaderInstalled || window.__gymfusionLoaderBootstrapTimedOut) {
      return;
    }

    window.__gymfusionLoaderInstalled = true;

    const CONFIG = {
      assetBaseUrl: (() => {
        const src = document.currentScript?.src || "";
        return src ? src.replace(/\/scripts\/[^/]+$/, "") : "https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main";
      })(),
      supportedFormats: ["avif", "webp", "png"],
      formatProbeTimeoutMs: 700,
      mobileBreakpointPx: 640,
      desktopBackgroundBase:
        "loaders/desktop loader images/current/gymfusion-neon-dust-loader-desktop-img",
      mobileBackgroundBase:
        "loaders/mobile loader images/current/gf-mobile-loader-img-upscayled",
      titleLogoBase: "loaders/logos/vibrant-title-and-slongan",
      emblemLogoBase: "loaders/logos/vibrant_spiral_transparent",
      desktopBackgroundPosition: "center",
      mobileBackgroundPosition: "center",
    };

    const LOADER_RULES = {
      standard: {
        minVisibleMs: 2400,
        maxVisibleMs: 9000,
        messages: ["POTENTIAL", "STRENGTH", "CONTROL", "CONFIDENCE"],
      },
      embed: {
        minVisibleMs: 3200,
        maxVisibleMs: 15000,
        embedReadyTimeoutMs: 5200,
        messages: [
          "INTERACTIVE CONTENT",
          "EMBED SYSTEMS",
          "PAGE MODULES",
          "LIVE ELEMENTS",
          "FINALISING EXPERIENCE",
        ],
      },
      embedPages: {
        "/": { expectedEmbeds: 4 },
        "/home": { expectedEmbeds: 4 },
        "/eoi": { expectedEmbeds: 1 },
        "/rfm-screening-hub": { expectedEmbeds: 2 },
        "/health-screening": { expectedEmbeds: 2 },
      },
      embedPageRoots: ["/home", "/eoi", "/rfm-screening-hub", "/health-screening"],
    };

    const SHELL_VERSION = "2";
    const MOBILE_LOGO_ART_HEIGHT_PX = 66.5;
    const MOBILE_LOGO_ART_OFFSET_PX = 19.97;
    const MOBILE_FIXED_CONTENT_HEIGHT_PX = 331.5;
    // Provisional values remain selectable until rendered comparisons are approved.
    const MOBILE_BRAND_GAP_PX = 12;
    const MOBILE_PREFERRED_TOP_PX = 85;

    const READY_PROTOCOL = {
      type: "GYMFUSION_READY",
      version: 1,
      iframeFallbackDelayMs: 800,
    };

    const BACKGROUND_FADE_MS = 620;
    const BACKGROUND_FADE_SETTLE_MS = BACKGROUND_FADE_MS + 50;
    const BACKGROUND_VISUAL_BUDGET_MS = 1200;
    const BACKGROUND_PRELOAD_TIMEOUT_MS = 6000;

    const AVIF_PROBE =
      "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAAXBtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAANGlsb2MAAAAAREAAAgABAAAAAAGUAAEAAAAAAAAAGgACAAAAAAGuAAEAAAAAAAAAFAAAADhpaW5mAAAAAAACAAAAFWluZm8CAAAAAAEAAGF2MDEAAAAAFWluZm8CAAAAAAIAAGF2MDEAAAAAr2lwcnAAAACKaXBjbwAAAAxhdjFDgQAMAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAcAAAAAA5waXhpAAAAAAEIAAAAOGF1eEMAAAAAdXJuOm1wZWc6bXBlZ0I6Y2ljcDpzeXN0ZW1zOmF1eGlsaWFyeTphbHBoYQAAAAAdaXBtYQAAAAAAAAACAAEDgQIDAAIEhAIFhgAAABppcmVmAAAAAAAAAA5hdXhsAAIAAQABAAAANm1kYXQSAAoIGAAGCAhoNCAyDBgACiiihAAAsBNL2BIACgQYAAYVMgoYACihAAIhHctg";
    const WEBP_PROBE =
      "data:image/webp;base64,UklGRkAAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAAAAFZQOCAYAAAAMAEAnQEqAQABAAIANCWkAANwAP77/VAA";

    const PAGE_STATE = {
      currentMessageIndex: 0,
      progress: 4,
      startTime: performance.now(),
      messageTimer: 0,
      progressTimer: 0,
      cursor: null,
      shell: null,
      progressFill: null,
      loadingText: null,
      shellVersion: null,
      finished: false,
    };

    const assetUrl = (baseName, format) =>
      encodeURI(`${CONFIG.assetBaseUrl}/${baseName}.${format}`);

    const buildImageSet = (baseName) =>
      `image-set(url("${assetUrl(baseName, "avif")}") type("image/avif"),url("${assetUrl(baseName, "webp")}") type("image/webp"),url("${assetUrl(baseName, "png")}") type("image/png"))`;

    const isValidViewportMetric = (value) => Number.isFinite(value) && value > 0;

    const measureFrozenViewportMetrics = () => {
      const probe = document.createElement("div");
      probe.id = "gfLoaderViewportProbe";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:fixed;left:-10000px;top:0;box-sizing:border-box;width:1px;height:100svh;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;contain:strict;";

      document.documentElement.append(probe);

      let measuredSmallHeight = 0;
      let safeTop = 0;
      try {
        measuredSmallHeight = probe.getBoundingClientRect().height;
        safeTop = Math.max(0, Number.parseFloat(getComputedStyle(probe).paddingTop) || 0);
      } finally {
        probe.remove();
      }

      const fallbackHeights = [
        window.visualViewport?.height,
        window.innerHeight,
        document.documentElement.clientHeight,
      ].filter(isValidViewportMetric);
      const compositionHeight = MOBILE_FIXED_CONTENT_HEIGHT_PX + MOBILE_BRAND_GAP_PX;
      const fallbackHeight = fallbackHeights.length
        ? Math.min(...fallbackHeights)
        : compositionHeight + (2 * safeTop);
      const usesSvh =
        CSS.supports?.("height", "100svh") && isValidViewportMetric(measuredSmallHeight);
      const smallHeight = usesSvh ? measuredSmallHeight : fallbackHeight;
      const entryWidth = document.documentElement.clientWidth || window.innerWidth;
      const entryHeight = document.documentElement.clientHeight || window.innerHeight;
      const centeredTop = Math.floor((smallHeight - compositionHeight) / 2);
      const compositionTop =
        safeTop > MOBILE_PREFERRED_TOP_PX
          ? safeTop
          : Math.max(safeTop, Math.min(centeredTop, MOBILE_PREFERRED_TOP_PX));

      return {
        smallHeight,
        smallHeightSource: usesSvh ? "100svh" : "viewport-fallback",
        safeTop,
        entryWidth,
        entryHeight,
        compositionHeight,
        compositionTop,
      };
    };

    const applyFrozenViewportMetrics = (shell, metrics = measureFrozenViewportMetrics()) => {
      shell.style.setProperty("--gf-entry-width", `${metrics.entryWidth}px`);
      shell.style.setProperty("--gf-entry-height", `${metrics.entryHeight}px`);
      shell.style.setProperty("--gf-small-height", `${metrics.smallHeight}px`);
      shell.style.setProperty("--gf-safe-top", `${metrics.safeTop}px`);
      shell.style.setProperty("--gf-brand-gap", `${MOBILE_BRAND_GAP_PX}px`);
      shell.style.setProperty("--gf-logo-art-height", `${MOBILE_LOGO_ART_HEIGHT_PX}px`);
      shell.style.setProperty("--gf-logo-art-offset", `${MOBILE_LOGO_ART_OFFSET_PX}px`);
      shell.style.setProperty("--gf-composition-height", `${metrics.compositionHeight}px`);
      shell.style.setProperty("--gf-composition-top", `${metrics.compositionTop}px`);
      shell.dataset.gfFrozenMetrics = "true";
      shell.dataset.gfSmallHeightSource = metrics.smallHeightSource;
      return metrics;
    };

    const SCROLL_BLOCK_KEYS = new Set(["Space", "PageDown", "PageUp", "End", "Home", "ArrowDown", "ArrowUp"]);
    let scrollLockState = null;

    const isEditableTarget = (target) => {
      const element = target instanceof Element ? target : null;
      return Boolean(
        element &&
          element.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]')
      );
    };

    const isDiagnosticsPanelTarget = (target) => {
      const element = target instanceof Element ? target : null;
      return Boolean(element && element.closest("#gfMobileLoaderDiagnostics"));
    };

    const preventScrollEvent = (event) => {
      if (isDiagnosticsPanelTarget(event.target)) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const preventScrollKeys = (event) => {
      if (event.defaultPrevented || isEditableTarget(event.target) || isDiagnosticsPanelTarget(event.target)) {
        return;
      }

      if (SCROLL_BLOCK_KEYS.has(event.code) || [" ", "PageDown", "PageUp", "End", "Home", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
      }
    };

    const restoreInlineStyle = (element, snapshot) => {
      for (const [property, value] of Object.entries(snapshot)) {
        if (value) {
          element.style.setProperty(property, value);
        } else {
          element.style.removeProperty(property);
        }
      }
    };

    const lockPageScroll = () => {
      if (scrollLockState || !document.body) {
        return;
      }

      const body = document.body;
      const root = document.documentElement;
      const scrollY = window.scrollY || window.pageYOffset || 0;

      scrollLockState = {
        scrollY,
        body: {
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
          overflow: body.style.overflow,
          "overscroll-behavior": body.style.overscrollBehavior,
          "touch-action": body.style.touchAction,
        },
        root: {
          overflow: root.style.overflow,
          "overscroll-behavior": root.style.overscrollBehavior,
          "touch-action": root.style.touchAction,
        },
      };

      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      body.style.touchAction = "none";
      root.style.overflow = "hidden";
      root.style.overscrollBehavior = "none";
      root.style.touchAction = "none";

      window.addEventListener("wheel", preventScrollEvent, { passive: false });
      window.addEventListener("touchmove", preventScrollEvent, { passive: false });
      window.addEventListener("keydown", preventScrollKeys, true);
    };

    const unlockPageScroll = () => {
      if (!scrollLockState || !document.body) {
        return;
      }

      window.removeEventListener("wheel", preventScrollEvent);
      window.removeEventListener("touchmove", preventScrollEvent);
      window.removeEventListener("keydown", preventScrollKeys, true);

      const { scrollY, body, root } = scrollLockState;
      scrollLockState = null;
      restoreInlineStyle(document.body, body);
      restoreInlineStyle(document.documentElement, root);
      window.scrollTo(0, scrollY);
    };

    const getBackgroundSelection = () =>
      window.matchMedia(`(max-width: ${CONFIG.mobileBreakpointPx}px)`).matches
        ? {
            baseName: CONFIG.mobileBackgroundBase,
            position: CONFIG.mobileBackgroundPosition,
          }
        : {
            baseName: CONFIG.desktopBackgroundBase,
            position: CONFIG.desktopBackgroundPosition,
          };

    const STYLE_ID = "gf-loader-style";

    const buildLoaderStyle = () => `
@font-face{font-family:"GymFusionTitle";src:url("${assetUrl("Inzomniac", "ttf")}") format("truetype");font-display:swap}
@font-face{font-family:"GamuthDisplay";src:url("${assetUrl("Gamuth Font Family/GamuthSansWeb-Bold.display", "woff2")}") format("woff2");font-display:swap}
:root{--gf-black:#050407;--gf-purple:#a230ff;--gf-purple-soft:#c9a6ff;--gf-white:#fff7ee;--gf-galaxy:${buildImageSet(CONFIG.desktopBackgroundBase)};--gf-galaxy-position:${CONFIG.desktopBackgroundPosition}}
@media (max-width:${CONFIG.mobileBreakpointPx}px){:root{--gf-galaxy:${buildImageSet(CONFIG.mobileBackgroundBase)};--gf-galaxy-position:${CONFIG.mobileBackgroundPosition}}}
html.gf-loading-active,html.gf-loading-active body{overflow:hidden!important;overscroll-behavior:none;touch-action:none}
#gfLoader{position:fixed;inset:0;z-index:2147483647;display:grid;grid-template-rows:minmax(160px,33vh) 1fr auto;min-height:100dvh;overflow:hidden;background:var(--gf-black);opacity:1;transform:scale(1);transform-origin:center;transition:opacity 260ms ease 760ms}
#gfLoader.gf-loader-standard-page{background:var(--gf-black)}
#gfLoader.gf-loader-embed-page{background:var(--gf-black)}
.gf-composition,.gf-logo-art{display:contents}
#gfLoader .gf-backdrop{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:1;background:
radial-gradient(circle at 18% 18%,rgba(255,255,255,0.98) 0 1px,transparent 1.2px),
radial-gradient(circle at 82% 28%,rgba(255,255,255,0.70) 0 1px,transparent 1.2px),
radial-gradient(circle at 24% 74%,rgba(255,255,255,0.56) 0 1px,transparent 1.2px),
radial-gradient(circle at 64% 18%,rgba(255,255,255,0.62) 0 1px,transparent 1.2px),
radial-gradient(circle at 14% 58%,rgba(255,255,255,0.44) 0 1px,transparent 1.2px),
radial-gradient(circle at 88% 14%,rgba(255,255,255,0.36) 0 1px,transparent 1.2px),
radial-gradient(circle at 48% 82%,rgba(255,255,255,0.30) 0 1px,transparent 1.2px),
radial-gradient(circle at 30% 36%,rgba(255,255,255,0.22) 0 1px,transparent 1.2px),
radial-gradient(circle at 70% 66%,rgba(255,255,255,0.18) 0 1px,transparent 1.2px),
radial-gradient(circle at 66% 60%,rgba(162,48,255,0.42),transparent 22%),
radial-gradient(circle at 34% 42%,rgba(255,48,48,0.28),transparent 30%),
linear-gradient(180deg,rgba(3,2,7,0.60) 0%,rgba(4,3,10,0.64) 48%,rgba(3,2,7,0.82) 100%);
background-size:220px 220px,260px 260px,300px 300px,320px 320px,360px 360px,240px 240px,280px 280px,340px 340px,400px 400px,auto,auto,cover;background-repeat:repeat,repeat,repeat,repeat,repeat,repeat,repeat,repeat,repeat,no-repeat,no-repeat,no-repeat;background-position:18% 18%,82% 28%,24% 74%,64% 18%,14% 58%,88% 14%,48% 82%,30% 36%,70% 66%,50% 50%,50% 50%,center;background-blend-mode:screen,screen,screen,screen,screen,screen,screen,screen,screen,screen,screen,normal;filter:saturate(1.08) contrast(1.06)}
#gfLoader .gf-backdrop-image{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transform:scale(1.02);transform-origin:center;transition:opacity ${BACKGROUND_FADE_MS}ms cubic-bezier(.22,1,.36,1),transform ${BACKGROUND_FADE_MS}ms cubic-bezier(.22,1,.36,1);background:linear-gradient(180deg,rgba(5,4,7,0.10),rgba(5,4,7,0.20)),var(--gf-galaxy);background-position:center,var(--gf-galaxy-position);background-size:auto,cover;background-repeat:no-repeat,no-repeat;mix-blend-mode:screen;filter:saturate(1.08) contrast(1.04)}
#gfLoader.gf-galaxy-loaded .gf-backdrop-image{opacity:.86;transform:scale(1)}
#gfLoader.gf-loader-embed-page .gf-wheel{box-shadow:0 0 0 1px rgba(255,255,255,0.06),0 0 22px rgba(162,48,255,0.42),0 0 42px rgba(237,0,122,0.24)}
#gfLoader.gf-loader-embed-page .gf-progress-fill{background:linear-gradient(90deg,#7000F7 0%,#9B00FF 15%,#C500D6 30%,#ED007A 50%,#FF0045 68%,#FF4A1C 82%,#FF7A00 92%,#FFA000 100%);box-shadow:0 0 18px rgba(162,48,255,0.58),0 0 28px rgba(255,74,28,0.34)}
#gfLoader.gf-loader-embed-page .gf-loading{text-shadow:0 0 16px rgba(162,48,255,0.52),0 8px 20px rgba(0,0,0,0.72)}
@media (min-width:641px){#gfLoader.gf-loader-standard-page .gf-wheel{box-shadow:0 0 0 1px rgba(255,255,255,0.06),0 0 22px rgba(162,48,255,0.42),0 0 42px rgba(237,0,122,0.24)}#gfLoader.gf-loader-standard-page .gf-progress-fill{background:linear-gradient(90deg,#7000F7 0%,#9B00FF 15%,#C500D6 30%,#ED007A 50%,#FF0045 68%,#FF4A1C 82%,#FF7A00 92%,#FFA000 100%);box-shadow:0 0 18px rgba(162,48,255,0.58),0 0 28px rgba(255,74,28,0.34)}#gfLoader.gf-loader-standard-page .gf-loading{text-shadow:0 0 16px rgba(162,48,255,0.52),0 8px 20px rgba(0,0,0,0.72)}}
#gfLoader::before{content:"";position:absolute;top:0;bottom:0;left:0;width:50.5%;z-index:4;background:var(--gf-black);transform:translateX(-101%);transition:transform 780ms cubic-bezier(.76,0,.24,1);pointer-events:none}
#gfLoader.gf-is-hidden{opacity:0.98;transform:none;filter:none;border-radius:0;pointer-events:none}
#gfLoader.gf-is-hidden::before{transform:translateX(0)}
#gfLoader::after{content:"";position:absolute;top:0;bottom:0;right:0;width:50.5%;z-index:4;background:var(--gf-black);transform:translateX(101%);pointer-events:none;transition:transform 780ms cubic-bezier(.76,0,.24,1)}
#gfLoader.gf-is-hidden::after{transform:translateX(0)}
#gfLoader.gf-is-hidden .gf-brand,#gfLoader.gf-is-hidden .gf-center,#gfLoader.gf-is-hidden .gf-bottom{opacity:0;transform:scale(0.96);transition:opacity 360ms ease,transform 420ms ease}
.gf-brand{position:relative;z-index:2;align-self:end;justify-self:center;width:min(78vw,410px);padding-top:28px;text-align:center}
.gf-emblem{width:clamp(76px,12vw,112px);height:clamp(76px,12vw,112px);margin:48px auto -38px;position:relative;z-index:2;background:image-set(url("${assetUrl(CONFIG.emblemLogoBase, "avif")}") type("image/avif"),url("${assetUrl(CONFIG.emblemLogoBase, "webp")}") type("image/webp"),url("${assetUrl(CONFIG.emblemLogoBase, "png")}") type("image/png")) center / contain no-repeat;filter:drop-shadow(0 0 18px rgba(143,57,255,0.42)) drop-shadow(0 10px 24px rgba(0,0,0,0.48));animation:gfFloat 3.4s ease-in-out infinite}
.gf-logo{display:block;width:min(62vw,310px);margin:0 auto;position:relative;z-index:1;filter:drop-shadow(0 12px 28px rgba(0,0,0,0.5))}
.gf-logo img{display:block;width:100%;height:auto}
.gf-center{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:17px;padding:0 20px 0;transform:translateY(-9vh)}
.gf-wheel{position:relative;width:76px;height:76px;border-radius:999px;background:transparent;border:4px solid var(--gf-black);border-top-color:var(--gf-purple);border-right-color:var(--gf-purple);box-shadow:0 0 0 1px rgba(255,255,255,0.05),0 0 18px rgba(143,57,255,0.22);animation:gfSpin 2.1s linear infinite}
.gf-wheel::after{content:none}
.gf-loading{display:inline-flex;align-items:center;justify-content:center;width:min(90vw,520px);min-height:38px;color:var(--gf-white);font-family:"GamuthDisplay",Georgia,serif;font-size:22px;font-weight:800;letter-spacing:0.1em;line-height:1.35;text-align:center;text-transform:uppercase;text-shadow:0 8px 20px rgba(0,0,0,0.72)}
.gf-loading-word{display:inline-block;margin-left:0.24em;color:transparent;background:linear-gradient(105deg,#c97cff 0%,#e0b5ff 24%,#f0d8ff 48%,#d99aff 72%,#bd63ff 100%);-webkit-background-clip:text;background-clip:text;text-align:center;text-shadow:0 0 12px rgba(224,181,255,0.36),0 0 24px rgba(162,48,255,0.68),0 5px 16px rgba(0,0,0,0.78);transition:opacity 420ms ease,transform 420ms cubic-bezier(.22,1,.36,1)}
.gf-loading-word.gf-exit{opacity:0;transform:translateY(18px)}
.gf-loading-word.gf-enter{opacity:0;transform:translateY(-18px)}
.gf-bottom{position:relative;z-index:2;padding:0 0 max(18px,env(safe-area-inset-bottom));background:var(--gf-black)}
.gf-progress{width:min(calc(100% - 36px),780px);height:10px;margin:0 auto;overflow:hidden;border-radius:0;background:var(--gf-black);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08),0 10px 28px rgba(0,0,0,0.45)}
.gf-progress-fill{width:4%;height:100%;border-radius:0;background:linear-gradient(90deg,#050407 0%,#2a0f43 16%,#a230ff 58%,#c9a6ff 100%);box-shadow:0 0 18px rgba(143,57,255,0.48);transition:width 180ms cubic-bezier(.22,1,.36,1)}
.gf-cursor-canvas{position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;pointer-events:none;mix-blend-mode:screen;opacity:0.95}
@keyframes gfSpin{to{transform:rotate(360deg)}}
@keyframes gfFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@media (max-width:640px){
#gfLoader{display:block;min-height:100dvh}
#gfLoader .gf-backdrop,#gfLoader .gf-backdrop-image{top:0;right:auto;bottom:auto;left:50%;width:var(--gf-entry-width);height:var(--gf-entry-height);transform:translateX(-50%);transform-origin:center top}
#gfLoader.gf-galaxy-loaded .gf-backdrop{opacity:0}
#gfLoader .gf-backdrop-image{background-size:auto,100% auto;background-position:center,center top;transition:opacity ${BACKGROUND_FADE_MS}ms cubic-bezier(.22,1,.36,1)}
#gfLoader.gf-galaxy-loaded .gf-backdrop-image{opacity:.86;transform:translateX(-50%)}
#gfLoader .gf-composition{position:absolute;top:var(--gf-composition-top);left:50%;z-index:2;display:flex;width:284px;height:var(--gf-composition-height);flex-direction:column;align-items:center;transform:translateX(-50%)}
#gfLoader .gf-brand{display:flex;width:262px;padding:0;flex-direction:column;align-items:center;gap:var(--gf-brand-gap);text-align:center}
#gfLoader .gf-emblem{width:64px!important;height:64px!important;margin:0!important;flex:0 0 64px}
#gfLoader .gf-logo-art{display:block;width:218px;height:var(--gf-logo-art-height);overflow:hidden;flex:0 0 var(--gf-logo-art-height);filter:drop-shadow(0 12px 28px rgba(0,0,0,0.5))}
#gfLoader .gf-logo{display:block;width:218px;margin:0;filter:none}
#gfLoader .gf-logo img{display:block;width:218px;height:auto;transform:translateY(calc(-1 * var(--gf-logo-art-offset)))}
#gfLoader .gf-center,#gfLoader .gf-bottom{display:contents}
#gfLoader .gf-wheel{box-sizing:content-box;width:62px;height:62px;margin-top:52px;border-width:3px;animation-duration:1.65s;box-shadow:0 0 0 1px rgba(255,255,255,0.05),0 0 18px rgba(143,57,255,0.22)}
#gfLoader .gf-loading{width:262px;max-width:none;min-height:38px;margin-top:17px;font-size:17px;letter-spacing:0.07em;text-shadow:0 8px 20px rgba(0,0,0,0.72)}
#gfLoader .gf-loading-word{margin-left:0.18em}
#gfLoader .gf-progress{width:284px;height:7px;margin:19px 0 0;opacity:0.82}
#gfLoader .gf-progress-fill{background:linear-gradient(90deg,#7000F7 0%,#9B00FF 15%,#C500D6 30%,#ED007A 50%,#FF0045 68%,#FF4A1C 82%,#FF7A00 92%,#FFA000 100%);box-shadow:0 0 18px rgba(162,48,255,0.58),0 0 28px rgba(255,74,28,0.34)}
}
@media (prefers-reduced-motion: reduce){
#gfLoader .gf-backdrop-image{transform:none;transition:opacity 180ms ease}
#gfLoader.gf-galaxy-loaded .gf-backdrop-image{transform:none}
}
@media (max-width:640px) and (prefers-reduced-motion:reduce){
#gfLoader .gf-backdrop-image,#gfLoader.gf-galaxy-loaded .gf-backdrop-image{transform:translateX(-50%)}
}
@media (max-width:640px){
#gfLoader.gf-loader-standard-page .gf-brand,#gfLoader.gf-loader-embed-page .gf-brand{width:262px}
#gfLoader.gf-loader-standard-page .gf-logo,#gfLoader.gf-loader-embed-page .gf-logo{width:218px}
#gfLoader.gf-loader-standard-page .gf-logo img,#gfLoader.gf-loader-embed-page .gf-logo img{width:218px;height:auto}
#gfLoader.gf-loader-standard-page .gf-loading,#gfLoader.gf-loader-embed-page .gf-loading{width:262px;max-width:none}
#gfLoader.gf-loader-standard-page .gf-progress,#gfLoader.gf-loader-embed-page .gf-progress{width:284px}
}
`;

    const ensureStyleTag = () => {
      if (document.getElementById(STYLE_ID)) return false;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.dataset.gfShellVersion = SHELL_VERSION;
      style.textContent = buildLoaderStyle();
      (document.head || document.documentElement).append(style);
      return true;
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForBody = () =>
      document.body
        ? Promise.resolve()
        : new Promise((resolve) =>
            document.addEventListener("DOMContentLoaded", resolve, { once: true })
          );

    const waitForDomReady = () =>
      document.readyState === "interactive" || document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((resolve) =>
            window.addEventListener("DOMContentLoaded", resolve, { once: true })
          );

    const hasEmbeds = () => {
      try {
        return document.querySelectorAll("iframe").length > 0;
      } catch {
        return false;
      }
    };

    const isDevelopmentMode = () => {
      const host = window.location.hostname;
      return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local") ||
        window.location.protocol === "file:"
      );
    };

    const logReadyProtocol = (level, message, details) => {
      if (!isDevelopmentMode()) {
        return;
      }

      const logger = console[level] || console.log;
      logger.call(console, `[GymFusion Loader] ${message}`, details || "");
    };

    const normalizeEmbedId = (value) => (typeof value === "string" ? value.trim() : "");

    const getIframeEmbedId = (iframe) =>
      normalizeEmbedId(
        iframe?.dataset?.gfEmbedId ||
          iframe?.dataset?.embedId ||
          iframe?.getAttribute("data-gf-embed-id") ||
          iframe?.getAttribute("data-embed-id") ||
          iframe?.id ||
          iframe?.name ||
          ""
      );

    const parseReadyPayload = (rawData) => {
      let data = rawData;

      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return null;
        }
      }

      if (!data || typeof data !== "object") {
        return null;
      }

      if (data.type !== READY_PROTOCOL.type || data.version !== READY_PROTOCOL.version) {
        return null;
      }

      return {
        embedId: normalizeEmbedId(data.embedId),
      };
    };

    const getPath = () => {
      const collapsed =
        new URL(window.location.href).pathname.toLowerCase().replace(/\/{2,}/g, "/") ||
        "/";
      return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
    };

    const isPathAtOrBelow = (path, root) =>
      path === root || (root !== "/" && path.startsWith(`${root}/`));

    const classifyPage = () => {
      const path = getPath();
      if (LOADER_RULES.embedPages[path]) {
        return { path, ...LOADER_RULES.embedPages[path] };
      }

      for (const root of LOADER_RULES.embedPageRoots) {
        if (isPathAtOrBelow(path, root)) {
          return { path, root, expectedEmbeds: 1 };
        }
      }

      return null;
    };

    const preloadImage = (src, resolveOnError = true) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => (resolveOnError ? resolve() : reject(new Error(`Failed to preload ${src}`)));
        image.src = src;
      });

    const createFormatResolver = () => {
      let cachedFormat;
      let pendingFormat;

      const probe = (src) =>
        new Promise((resolve) => {
          const image = new Image();
          let settled = false;

          const finish = (supported) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            image.onload = null;
            image.onerror = null;
            resolve(supported);
          };

          const timeoutId = window.setTimeout(() => finish(false), CONFIG.formatProbeTimeoutMs);

          image.onload = () => finish(image.naturalWidth === 1);
          image.onerror = () => finish(false);
          image.src = src;
        });

      return async () => {
        if (cachedFormat) return cachedFormat;
        if (pendingFormat) return pendingFormat;

        pendingFormat = (async () => {
          try {
            if (await probe(AVIF_PROBE)) {
              return "avif";
            }

            if (await probe(WEBP_PROBE)) {
              return "webp";
            }
          } catch {
            // Fall through to PNG.
          }

          return "png";
        })()
          .then((format) => {
            cachedFormat = format;
            return format;
          })
          .catch(() => {
            cachedFormat = "png";
            return "png";
          });

        return pendingFormat;
      };
    };

    const resolvePreferredFormat = createFormatResolver();

    const preloadSelectedAssets = async () => {
      const format = await resolvePreferredFormat();
      const assetNames = [CONFIG.titleLogoBase, CONFIG.emblemLogoBase];

      await Promise.all(assetNames.map((baseName) => preloadImage(assetUrl(baseName, format))));
    };

    const preloadBackgroundImage = async () => {
      const format = await resolvePreferredFormat();
      const { baseName } = getBackgroundSelection();
      const backgroundUrl = assetUrl(baseName, format);
      await Promise.race([
        preloadImage(backgroundUrl, false),
        sleep(BACKGROUND_PRELOAD_TIMEOUT_MS).then(() => {
          throw new Error("Timed out preloading the GymFusion background image");
        }),
      ]);
    };

    const revealBackgroundImage = () =>
      new Promise((resolve) => {
        const shell = PAGE_STATE.shell;

        if (!shell || PAGE_STATE.finished || !shell.isConnected) {
          resolve(false);
          return;
        }

        shell.classList.remove("gf-galaxy-loaded");

        requestAnimationFrame(() => {
          if (!shell.isConnected || PAGE_STATE.finished) {
            resolve(false);
            return;
          }

          void shell.offsetWidth;

          requestAnimationFrame(() => {
            if (!shell.isConnected || PAGE_STATE.finished) {
              resolve(false);
              return;
            }

            shell.classList.add("gf-galaxy-loaded");

            window.setTimeout(() => {
              resolve(true);
            }, BACKGROUND_FADE_SETTLE_MS);
          });
        });
      });

    const buildLoaderMarkup = () => `
          <div class="gf-backdrop" aria-hidden="true"></div>
          <div class="gf-backdrop-image gf-background-canvas" aria-hidden="true"></div>
          <div class="gf-composition">
            <section class="gf-brand" aria-label="GYMFUSION">
              <div class="gf-emblem" aria-hidden="true"></div>
              <div class="gf-logo-art">
                <picture class="gf-logo">
                  <source srcset="${assetUrl(CONFIG.titleLogoBase, "avif")}" type="image/avif">
                  <source srcset="${assetUrl(CONFIG.titleLogoBase, "webp")}" type="image/webp">
                  <img src="${assetUrl(CONFIG.titleLogoBase, "png")}" alt="GYMFUSION">
                </picture>
              </div>
            </section>
            <section class="gf-center">
              <div class="gf-wheel" aria-hidden="true"></div>
              <div class="gf-loading">
                <span>Loading...</span>
                <span id="gfLoadingText" class="gf-loading-word">${LOADER_RULES.standard.messages[0]}</span>
              </div>
            </section>
            <div class="gf-bottom" aria-hidden="true">
              <div class="gf-progress">
                <div id="gfProgressFill" class="gf-progress-fill"></div>
              </div>
            </div>
          </div>
        `;

    const REQUIRED_LEGACY_SELECTORS = [
      ".gf-backdrop",
      ".gf-backdrop-image",
      ".gf-brand",
      ".gf-wheel",
      ".gf-loading",
      "#gfLoadingText",
      ".gf-progress",
      "#gfProgressFill",
    ];

    const REQUIRED_V2_SELECTORS = [
      ...REQUIRED_LEGACY_SELECTORS,
      ".gf-background-canvas",
      ".gf-composition",
      ".gf-logo-art",
    ];

    const validateShell = (shell, selectors) =>
      selectors.every((selector) => shell.querySelector(selector));

    const ensureLoaderShell = () => {
      let shell = document.getElementById("gfLoader");

      if (!shell) {
        shell = document.createElement("div");
        shell.id = "gfLoader";
        const pageMode = classifyPage() || hasEmbeds() ? "embed" : "standard";
        shell.className = `gf-loader-${pageMode}-page`;
        shell.dataset.gfPageMode = pageMode;
        shell.dataset.gfShellVersion = SHELL_VERSION;
        shell.setAttribute("role", "status");
        shell.setAttribute("aria-live", "polite");
        shell.setAttribute("aria-label", "Loading GYMFUSION");
        shell.innerHTML = buildLoaderMarkup();
        applyFrozenViewportMetrics(shell);
        document.body.prepend(shell);
      }

      const shellVersion = shell.dataset.gfShellVersion || "legacy";
      const requiredSelectors = shellVersion === SHELL_VERSION
        ? REQUIRED_V2_SELECTORS
        : REQUIRED_LEGACY_SELECTORS;

      if (!validateShell(shell, requiredSelectors)) {
        throw new Error(`Unsupported or incomplete GymFusion ${shellVersion} loader shell`);
      }

      PAGE_STATE.shell = shell;
      PAGE_STATE.shellVersion = shellVersion;
      PAGE_STATE.progressFill = shell.querySelector("#gfProgressFill");
      PAGE_STATE.loadingText = shell.querySelector("#gfLoadingText");
      return shell;
    };

    const createCursorEffect = () => {
      if (window.matchMedia("(pointer: coarse)").matches) {
        return { destroy() {} };
      }

      const canvas = document.createElement("canvas");
      canvas.className = "gf-cursor-canvas";
      const context = canvas.getContext("2d");
      const colors = [
        [112, 0, 247],
        [155, 0, 255],
        [197, 0, 214],
        [237, 0, 122],
        [255, 0, 69],
        [255, 74, 28],
        [255, 122, 0],
        [255, 160, 0],
      ];

      let width = 0;
      let height = 0;
      let particles = [];
      let animationId = 0;
      let lastFrameTime = 0;
      let lastX = 0;
      let lastY = 0;

      class Particle {
        constructor(x, y, velocityX, velocityY) {
          this.x = x;
          this.y = y;
          this.color = colors[Math.floor(Math.random() * colors.length)];
          this.finalSize = Math.random() * 2;
          this.size = this.finalSize * 2;
          this.alpha = 1;
          this.velocityX = velocityX * 0.05;
          this.velocityY = 1 + Math.random() + velocityY * 0.05;
          this.gravity = 0.02;
          this.drag = 0.97;
          this.turbulence = () => Math.random() * 0.5 - 0.25;
          this.timeElapsed = 0;
        }

        draw() {
          context.shadowBlur = 14;
          context.shadowColor = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${Math.min(
            1,
            this.alpha * 1.2
          )})`;
          context.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${Math.min(
            1,
            this.alpha * 1.15
          )})`;
          context.beginPath();
          context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          context.fill();
          context.beginPath();
          context.arc(this.x, this.y, Math.max(this.size * 0.45, 0.4), 0, Math.PI * 2);
          context.fillStyle = `rgba(255,255,255,${this.alpha * 0.9})`;
          context.fill();
        }

        update(delta) {
          this.x += this.velocityX + this.turbulence();
          this.velocityX *= this.drag;
          this.y += this.velocityY;
          this.velocityY += this.gravity;
          this.alpha = Math.max(0, this.alpha - 0.005);
          this.timeElapsed += delta;
          this.size =
            this.timeElapsed < 2000
              ? this.finalSize * 2 - (this.finalSize * this.timeElapsed) / 2000
              : this.finalSize;
        }
      }

      const resize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
      };

      const spawn = (event) => {
        const deltaX = event.clientX - lastX;
        const deltaY = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        const velocityX = (Math.random() - 0.5) * 100;
        const velocityY = (Math.random() - 0.5) * 100;
        particles.push(new Particle(event.clientX, event.clientY, deltaX + velocityX, deltaY + velocityY));
      };

      const render = (timestamp = 0) => {
        const delta = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        context.clearRect(0, 0, width, height);
        particles.forEach((particle) => particle.update(delta));
        particles.forEach((particle) => particle.draw());
        particles = particles.filter((particle) => particle.alpha > 0 && particle.y < height && particle.x > 0 && particle.x < width);
        animationId = requestAnimationFrame(render);
      };

      resize();
      document.body.append(canvas);
      canvas.style.zIndex = "2147483647";
      canvas.style.pointerEvents = "none";
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", spawn, { passive: true });
      animationId = requestAnimationFrame(render);

      return {
        destroy() {
          cancelAnimationFrame(animationId);
          window.removeEventListener("resize", resize);
          window.removeEventListener("pointermove", spawn);
          canvas.remove();
        },
      };
    };

    const waitForControlledEmbeds = (expectedCount) => {
      const iframes = Array.from(document.querySelectorAll("iframe"));
      const timeoutMs = LOADER_RULES.embed.embedReadyTimeoutMs;

      if (!iframes.length) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const seen = new WeakSet();
        const seenEmbedIds = new Set();
        let readyCount = 0;
        let finished = false;
        const fallbackTimers = new Set();

        const cleanup = () => {
          window.removeEventListener("message", onMessage);
          window.clearTimeout(timeoutId);
          fallbackTimers.forEach((timerId) => window.clearTimeout(timerId));
          fallbackTimers.clear();
        };

        const done = () => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve();
        };

        const markReady = (iframe, embedId, source) => {
          if (!iframe || seen.has(iframe)) {
            return false;
          }

          const normalizedEmbedId = normalizeEmbedId(embedId || getIframeEmbedId(iframe));
          if (normalizedEmbedId && seenEmbedIds.has(normalizedEmbedId)) {
            return false;
          }

          seen.add(iframe);
          if (normalizedEmbedId) {
            seenEmbedIds.add(normalizedEmbedId);
          }

          readyCount += 1;
          logReadyProtocol("info", "READY accepted", {
            source,
            readyCount,
            expectedCount,
            embedId: normalizedEmbedId || null,
          });

          if (readyCount >= expectedCount) {
            done();
          }

          return true;
        };

        const onMessage = (event) => {
          const payload = parseReadyPayload(event.data);
          if (!payload) {
            return;
          }

          const iframe = iframes.find((node) => node.contentWindow === event.source);
          if (iframe) {
            markReady(iframe, payload.embedId, "message");
            return;
          }

          if (payload.embedId) {
            const embeddedIframe = iframes.find((node) => getIframeEmbedId(node) === payload.embedId);
            if (embeddedIframe) {
              markReady(embeddedIframe, payload.embedId, "message/embedId");
              return;
            }
          }

          logReadyProtocol("warn", "READY message ignored; no matching iframe was found", {
            embedId: payload.embedId || null,
          });
        };

        const timeoutId = window.setTimeout(done, timeoutMs);

        window.addEventListener("message", onMessage);
        iframes.forEach((iframe) => {
          iframe.addEventListener(
            "load",
            () => {
              const loadTimerId = window.setTimeout(() => {
                fallbackTimers.delete(loadTimerId);
                markReady(iframe, getIframeEmbedId(iframe), "load");
              }, READY_PROTOCOL.iframeFallbackDelayMs);

              fallbackTimers.add(loadTimerId);
            },
            { once: true }
          );

          try {
            if (iframe.contentDocument?.readyState === "complete") {
              const syncTimerId = window.setTimeout(() => {
                fallbackTimers.delete(syncTimerId);
                markReady(iframe, getIframeEmbedId(iframe), "already-complete");
              }, 0);

              fallbackTimers.add(syncTimerId);
            }
          } catch {
            // Cross-origin or inaccessible iframe. Fall back to the load/timeout path.
          }
        });
      });
    };

    const updateLoaderMessage = (messages, nextIndex) => {
      const messageNode = PAGE_STATE.loadingText;
      if (!messageNode || nextIndex === PAGE_STATE.currentMessageIndex) {
        return;
      }

      PAGE_STATE.currentMessageIndex = nextIndex;
      messageNode.classList.add("gf-exit");
      window.setTimeout(() => {
        messageNode.textContent = messages[nextIndex];
        messageNode.classList.remove("gf-exit");
        messageNode.classList.add("gf-enter");
        requestAnimationFrame(() => messageNode.classList.remove("gf-enter"));
      }, 420);
    };

    const updateProgress = (nextProgress) => {
      PAGE_STATE.progress = Math.max(PAGE_STATE.progress, Math.min(100, nextProgress));
      if (PAGE_STATE.progressFill) {
        PAGE_STATE.progressFill.style.width = `${PAGE_STATE.progress}%`;
      }
    };

    const finalizeLoader = async (isEmbed) => {
      if (PAGE_STATE.finished) {
        return;
      }

      PAGE_STATE.finished = true;
      window.clearInterval(PAGE_STATE.progressTimer);
      window.clearInterval(PAGE_STATE.messageTimer);
      updateProgress(100);
      updateLoaderMessage(
        isEmbed ? LOADER_RULES.embed.messages : LOADER_RULES.standard.messages,
        (isEmbed ? LOADER_RULES.embed.messages : LOADER_RULES.standard.messages).length - 1
      );
      await sleep(isEmbed ? 380 : 260);
      if (PAGE_STATE.shell) {
        PAGE_STATE.shell.classList.add("gf-is-hidden");
      }
      await sleep(isEmbed ? 920 : 700);
      PAGE_STATE.shell?.remove();
      PAGE_STATE.cursor?.destroy();
      document.documentElement.classList.remove("gf-loading-active");
      unlockPageScroll();
    };

    const failSafe = (error) => {
      if (PAGE_STATE.finished) {
        return;
      }

      if (error) {
        console.warn("[GymFusion Loader] bootstrap failed; removing loader and restoring page.", error);
      }

      PAGE_STATE.finished = true;
      window.clearInterval(PAGE_STATE.progressTimer);
      window.clearInterval(PAGE_STATE.messageTimer);
      PAGE_STATE.cursor?.destroy();
      PAGE_STATE.shell?.remove();
      document.getElementById("gfLoader")?.remove();
      document.documentElement.classList.remove("gf-loading-active");
      unlockPageScroll();
    };

    const run = async () => {
      await waitForBody();

      if (window.__gymfusionLoaderBootstrapTimedOut) {
        return;
      }

      const pageInfo = classifyPage();
      const classifiedIsEmbedPage = Boolean(pageInfo || hasEmbeds());
      const existingShell = document.getElementById("gfLoader");

      if (!existingShell) {
        ensureStyleTag();
      } else if (
        existingShell.dataset.gfShellVersion === SHELL_VERSION &&
        !document.getElementById(STYLE_ID)
      ) {
        throw new Error("GymFusion V2 bootstrap shell is missing its authoritative stylesheet");
      }

      document.documentElement.classList.add("gf-loading-active");
      lockPageScroll();
      const shell = ensureLoaderShell();
      const shellMode = shell.dataset.gfPageMode;
      const isV2Shell = PAGE_STATE.shellVersion === SHELL_VERSION;

      if (
        isV2Shell &&
        (shellMode !== "standard" && shellMode !== "embed")
      ) {
        throw new Error("GymFusion V2 bootstrap shell has no valid frozen page classification");
      }

      const isEmbedPage = isV2Shell ? shellMode === "embed" : classifiedIsEmbedPage;
      const loaderConfig = isEmbedPage ? LOADER_RULES.embed : LOADER_RULES.standard;
      const expectedEmbeds =
        pageInfo?.expectedEmbeds || Math.max(1, document.querySelectorAll("iframe").length);
      const messages = loaderConfig.messages;

      if (
        isV2Shell &&
        !shell.classList.contains(`gf-loader-${shellMode}-page`)
      ) {
        throw new Error("GymFusion V2 bootstrap class and page mode disagree");
      }

      window.dispatchEvent(new CustomEvent("gf-loader-runtime-adopted", {
        detail: { shellVersion: PAGE_STATE.shellVersion, pageMode: shellMode || "legacy" },
      }));
      PAGE_STATE.cursor = isEmbedPage ? createCursorEffect() : { destroy() {} };
      PAGE_STATE.startTime = performance.now();

      const readyPromise = waitForDomReady();
      const embedPromise = isEmbedPage ? waitForControlledEmbeds(expectedEmbeds) : Promise.resolve();
      const fontPromise =
        document.fonts && document.fonts.ready
          ? Promise.race([document.fonts.ready.catch(() => {}), sleep(1200)])
          : Promise.resolve();
      void preloadSelectedAssets().catch(() => {});
      const backgroundVisualPromise = preloadBackgroundImage()
        .then(() => revealBackgroundImage())
        .catch(() => false);
      const boundedBackgroundVisualPromise = Promise.race([
        backgroundVisualPromise,
        sleep(BACKGROUND_VISUAL_BUDGET_MS).then(() => false),
      ]);
      const minVisiblePromise = sleep(loaderConfig.minVisibleMs);
      const maxVisiblePromise = sleep(loaderConfig.maxVisibleMs);

      PAGE_STATE.messageTimer = window.setInterval(() => {
        updateLoaderMessage(messages, (PAGE_STATE.currentMessageIndex + 1) % messages.length);
      }, 1850);

      PAGE_STATE.progressTimer = window.setInterval(() => {
        const elapsed = performance.now() - PAGE_STATE.startTime;
        const nextProgress = isEmbedPage
          ? elapsed < 1800
            ? PAGE_STATE.progress + 2.2
            : PAGE_STATE.progress + 0.95
          : elapsed < 1400
          ? PAGE_STATE.progress + 3
          : PAGE_STATE.progress + 1.2;

        updateProgress(Math.min(isEmbedPage ? 96 : 94, nextProgress));
      }, isEmbedPage ? 150 : 180);

      try {
        await Promise.race([
          Promise.all([
            readyPromise,
            fontPromise,
            embedPromise,
            minVisiblePromise,
            boundedBackgroundVisualPromise,
          ]),
          maxVisiblePromise,
        ]);
      } catch (error) {
        failSafe(error);
        return;
      }

      await finalizeLoader(isEmbedPage);
    };

    run().catch(failSafe);
  } catch (error) {
    if (window.__gymfusionLoaderBootstrapTimedOut) {
      return;
    }

    console.warn("[GymFusion Loader] fatal startup error.", error);
    document.documentElement.classList.remove("gf-loading-active");
    document.getElementById("gfLoader")?.remove();
    unlockPageScroll();
  }
})();
