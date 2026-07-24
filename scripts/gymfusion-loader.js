(() => {
  try {
    if (window.__gymfusionLoaderInstalled || window.__gymfusionLoaderBootstrapTimedOut) {
      return;
    }

    window.__gymfusionLoaderInstalled = true;

    const CONFIG = {
      assetBaseUrl: "https://raw.githubusercontent.com/J35S1CA007/gymfusion-assets/main",
      supportedFormats: ["avif", "webp", "png"],
      formatProbeTimeoutMs: 700,
      mobileBreakpointPx: 640,
      desktopBackgroundBase: "galaxy-loading-screen-gymfusion",
      mobileBackgroundBase: "gf-mobile-loader-img",
      desktopBackgroundPosition: "center",
      mobileBackgroundPosition: "center",
    };

    const LOADER_RULES = {
      standard: {
        minVisibleMs: 1100,
        maxVisibleMs: 9000,
        messages: ["POTENTIAL", "STRENGTH", "CONTROL", "CONFIDENCE"],
      },
      embed: {
        minVisibleMs: 1600,
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
      embedPagePrefixes: ["/home/", "/eoi/", "/rfm-screening-hub/", "/health-screening/"],
    };

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
      finished: false,
    };

    const assetUrl = (baseName, format) =>
      `${CONFIG.assetBaseUrl}/${baseName}.${format}`;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForBody = () =>
      document.body
        ? Promise.resolve()
        : new Promise((resolve) =>
            document.addEventListener("DOMContentLoaded", resolve, { once: true })
          );

    const waitForWindowLoad = () =>
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));

    const hasEmbeds = () => {
      try {
        return document.querySelectorAll("iframe").length > 0;
      } catch {
        return false;
      }
    };

    const getPath = () =>
      new URL(window.location.href).pathname.toLowerCase().replace(/\/{2,}/g, "/") ||
      "/";

    const classifyPage = () => {
      const path = getPath();
      const normalized = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

      if (LOADER_RULES.embedPages[path]) {
        return { path, ...LOADER_RULES.embedPages[path] };
      }

      if (LOADER_RULES.embedPages[normalized]) {
        return { path: normalized, ...LOADER_RULES.embedPages[normalized] };
      }

      for (const prefix of LOADER_RULES.embedPagePrefixes) {
        if (path.startsWith(prefix)) {
          return { path: prefix, expectedEmbeds: 1 };
        }
      }

      return null;
    };

    const preloadImage = (src) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = image.onerror = () => resolve();
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
      const assetNames = [
        "galaxy-loading-screen-gymfusion",
        "vibrant-title-and-slongan",
        "vibrant_spiral_transparent",
      ];

      await Promise.all(assetNames.map((baseName) => preloadImage(assetUrl(baseName, format))));
    };

    const ensureLoaderShell = () => {
      let shell = document.getElementById("gfLoader");

      if (!shell) {
        shell = document.createElement("div");
        shell.id = "gfLoader";
        shell.className = "gf-loader-standard-page";
        shell.setAttribute("role", "status");
        shell.setAttribute("aria-live", "polite");
        shell.setAttribute("aria-label", "Loading GYMFUSION");
        shell.innerHTML = `
          <section class="gf-brand" aria-label="GYMFUSION">
            <div class="gf-emblem" aria-hidden="true"></div>
            <picture class="gf-logo">
              <source srcset="${assetUrl("vibrant-title-and-slongan", "avif")}" type="image/avif">
              <source srcset="${assetUrl("vibrant-title-and-slongan", "webp")}" type="image/webp">
              <img src="${assetUrl("vibrant-title-and-slongan", "png")}" alt="GYMFUSION">
            </picture>
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
        `;
        document.body.prepend(shell);
      }

      PAGE_STATE.shell = shell;
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
        let readyCount = 0;
        let finished = false;

        const cleanup = () => {
          window.removeEventListener("message", onMessage);
          window.clearTimeout(timeoutId);
        };

        const done = () => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve();
        };

        const markReady = (iframe) => {
          if (!iframe || seen.has(iframe)) return;
          seen.add(iframe);
          readyCount += 1;
          if (readyCount >= expectedCount) {
            done();
          }
        };

        const onMessage = (event) => {
          if (!event.data || event.data.type !== "GYMFUSION_READY") {
            return;
          }

          const iframe = iframes.find((node) => node.contentWindow === event.source);
          if (iframe) {
            markReady(iframe);
          }
        };

        const timeoutId = window.setTimeout(done, timeoutMs);

        window.addEventListener("message", onMessage);
        iframes.forEach((iframe) => {
          iframe.addEventListener(
            "load",
            () => {
              window.setTimeout(() => markReady(iframe), 800);
            },
            { once: true }
          );
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
    };

    const run = async () => {
      await waitForBody();

      if (window.__gymfusionLoaderBootstrapTimedOut) {
        return;
      }

      const pageInfo = classifyPage();
      const isEmbedPage = Boolean(pageInfo || hasEmbeds());
      const loaderConfig = isEmbedPage ? LOADER_RULES.embed : LOADER_RULES.standard;
      const expectedEmbeds =
        pageInfo?.expectedEmbeds || Math.max(1, document.querySelectorAll("iframe").length);
      const messages = loaderConfig.messages;

      document.documentElement.classList.add("gf-loading-active");
      const shell = ensureLoaderShell();
      shell.classList.toggle("gf-loader-embed-page", isEmbedPage);
      shell.classList.toggle("gf-loader-standard-page", !isEmbedPage);
      PAGE_STATE.cursor = isEmbedPage ? createCursorEffect() : { destroy() {} };
      PAGE_STATE.startTime = performance.now();

      const readyPromise = waitForWindowLoad();
      const embedPromise = isEmbedPage ? waitForControlledEmbeds(expectedEmbeds) : Promise.resolve();
      const fontPromise =
        document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
      const preloadPromise = preloadSelectedAssets();
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
          Promise.all([readyPromise, fontPromise, preloadPromise, embedPromise, minVisiblePromise]),
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
  }
})();
