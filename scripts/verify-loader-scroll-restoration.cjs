const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const runtimePath = path.join(__dirname, "gymfusion-loader.js");
const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const blockStart = runtimeSource.indexOf("    const SCROLL_BLOCK_KEYS");
const blockEnd = runtimeSource.indexOf("    const getBackgroundSelection", blockStart);

if (blockStart < 0 || blockEnd < 0) {
  throw new Error("Unable to locate production scroll-lock implementation");
}

const scrollLockSource = `${runtimeSource.slice(blockStart, blockEnd)}
return { lockPageScroll, unlockPageScroll };`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectedSnapshotKeys = {
  '"overscroll-behavior": body.style.overscrollBehavior': 1,
  '"touch-action": body.style.touchAction': 1,
  '"overscroll-behavior": root.style.overscrollBehavior': 1,
  '"touch-action": root.style.touchAction': 1,
};

for (const [source, expectedCount] of Object.entries(expectedSnapshotKeys)) {
  assert(runtimeSource.split(source).length - 1 === expectedCount, `Unexpected snapshot key count: ${source}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body><main></main></body></html>");

  const result = await page.evaluate(
    ({ source }) => {
      const api = Function(source)();
      const roots = [document.documentElement, document.body];
      const read = () => {
        const state = {};
        for (const [name, element] of [["html", roots[0]], ["body", roots[1]]]) {
          state[name] = {
            touchAction: element.style.getPropertyValue("touch-action"),
            overscrollBehavior: element.style.getPropertyValue("overscroll-behavior"),
          };
        }
        return state;
      };

      document.documentElement.style.touchAction = "pan-x";
      document.documentElement.style.overscrollBehavior = "contain";
      document.body.style.touchAction = "manipulation";
      document.body.style.overscrollBehavior = "auto";
      const preExistingBefore = read();
      api.lockPageScroll();
      const preExistingLocked = read();
      api.unlockPageScroll();
      const preExistingAfter = read();

      for (const element of roots) {
        element.style.removeProperty("touch-action");
        element.style.removeProperty("overscroll-behavior");
      }
      const absentBefore = read();
      api.lockPageScroll();
      const absentLocked = read();
      api.unlockPageScroll();
      const absentAfter = read();

      return { preExistingBefore, preExistingLocked, preExistingAfter, absentBefore, absentLocked, absentAfter };
    },
    { source: scrollLockSource }
  );

  assert(JSON.stringify(result.preExistingAfter) === JSON.stringify(result.preExistingBefore), "Pre-existing inline values were not restored");
  assert(Object.values(result.preExistingLocked).every((state) => state.touchAction === "none" && state.overscrollBehavior === "none"), "Lock values were not applied to both roots");
  assert(Object.values(result.absentBefore).every((state) => state.touchAction === "" && state.overscrollBehavior === ""), "Absent-value setup failed");
  assert(Object.values(result.absentLocked).every((state) => state.touchAction === "none" && state.overscrollBehavior === "none"), "Absent values were not locked on both roots");
  assert(Object.values(result.absentAfter).every((state) => state.touchAction === "" && state.overscrollBehavior === ""), "Initially absent properties were not removed from both roots");

  process.stdout.write(`${JSON.stringify({ status: "passed", ...result }, null, 2)}\n`);
  await browser.close();
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
