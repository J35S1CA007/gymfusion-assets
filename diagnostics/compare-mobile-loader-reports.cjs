const fs = require("fs");

const [, , firstPath, secondPath] = process.argv;
if (!firstPath || !secondPath) {
  process.stderr.write("Usage: node compare-mobile-loader-reports.cjs run-1.json run-2.json\n");
  process.exit(1);
}

const readReport = (file) => {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(parsed)) return parsed.at(-1);
  return parsed;
};
const a = readReport(firstPath);
const b = readReport(secondPath);
const requiredIdentity = ["schemaVersion", "wrapperVersion", "bootstrapHash", "runtimeSHA"];
const incompatible = requiredIdentity.flatMap((field) =>
  a[field] === b[field] ? [] : [{ field, run1: a[field] ?? null, run2: b[field] ?? null }]
);
if (incompatible.length) {
  process.stderr.write(`${JSON.stringify({ status: "refused-incompatible-reports", incompatible }, null, 2)}\n`);
  process.exit(2);
}

const warnings = [];
for (const field of ["probeVersion", "shellVersion", "pathname"]) {
  if (a[field] !== b[field]) warnings.push({ field, run1: a[field] ?? null, run2: b[field] ?? null });
}
const lifecycleOrder = (report) => Object.entries(report.lifecycle || {})
  .map(([name, value]) => ({ name, at: value.at }))
  .sort((left, right) => left.at - right.at);
const orderA = lifecycleOrder(a);
const orderB = lifecycleOrder(b);
const namesA = orderA.map((entry) => entry.name);
const namesB = orderB.map((entry) => entry.name);
const allLifecycleNames = [...new Set([...namesA, ...namesB])];
const lifecycleTiming = allLifecycleNames.map((name) => ({
  event: name,
  run1At: a.lifecycle?.[name]?.at ?? null,
  run2At: b.lifecycle?.[name]?.at ?? null,
  deltaMs:
    typeof a.lifecycle?.[name]?.at === "number" && typeof b.lifecycle?.[name]?.at === "number"
      ? b.lifecycle[name].at - a.lifecycle[name].at
      : null,
}));
const firstTimestampDivergence = lifecycleTiming
  .filter((entry) => entry.deltaMs !== null && entry.deltaMs !== 0)
  .sort((left, right) => Math.min(left.run1At, left.run2At) - Math.min(right.run1At, right.run2At))[0] || null;

const difference = (left, right, path = "") => {
  if (Object.is(left, right)) return [];
  if (typeof left === "number" && typeof right === "number") {
    return [{ field: path, run1: left, run2: right, delta: right - left }];
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    return [{ field: path, run1: left ?? null, run2: right ?? null }];
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys.flatMap((key) => difference(left[key], right[key], path ? `${path}.${key}` : key));
};
const checkpointNames = [
  "bootstrap",
  "runtimeAdopted",
  "firstMaterialViewportChange",
  "settledViewport",
  "loaderHiddenObserved",
];
const layoutDifferences = checkpointNames.flatMap((checkpoint) =>
  difference(a.samples?.[checkpoint]?.rects, b.samples?.[checkpoint]?.rects, checkpoint)
);
const progressDifferences = checkpointNames.flatMap((checkpoint) =>
  difference(a.samples?.[checkpoint]?.progress, b.samples?.[checkpoint]?.progress, checkpoint)
);
const viewportDifferences = ["firstMaterialViewportChange", "settledViewport"].flatMap((checkpoint) =>
  difference(a.lifecycle?.[checkpoint]?.viewport, b.lifecycle?.[checkpoint]?.viewport, checkpoint)
);
const backgroundDifferences = [
  ...difference(a.backgroundCandidates, b.backgroundCandidates, "backgroundCandidates"),
  ...difference(a.backgroundResources, b.backgroundResources, "backgroundResources"),
  ...checkpointNames.flatMap((checkpoint) =>
    difference(a.samples?.[checkpoint]?.background, b.samples?.[checkpoint]?.background, `samples.${checkpoint}.background`)
  ),
];
const lifecycleStateDifferences = allLifecycleNames.flatMap((name) =>
  difference(
    { ...a.lifecycle?.[name], at: undefined },
    { ...b.lifecycle?.[name], at: undefined },
    `lifecycle.${name}`
  )
);
const orderedStateDifferences = allLifecycleNames
  .map((name) => ({
    event: name,
    earliestAt: Math.min(a.lifecycle?.[name]?.at ?? Infinity, b.lifecycle?.[name]?.at ?? Infinity),
    differences: difference(
      { ...a.lifecycle?.[name], at: undefined },
      { ...b.lifecycle?.[name], at: undefined },
      `lifecycle.${name}`
    ),
  }))
  .filter((entry) => entry.differences.length)
  .sort((left, right) => left.earliestAt - right.earliestAt);
const firstDivergence = namesA.join("|") !== namesB.join("|")
  ? { type: "lifecycle-order", run1: namesA, run2: namesB }
  : orderedStateDifferences[0]
    ? { type: "captured-state", event: orderedStateDifferences[0].event, differences: orderedStateDifferences[0].differences }
    : null;

const output = {
  status: "compared",
  interpretation: "Differences show ordering, timing, or captured state only. Temporal proximity is not causation.",
  identities: {
    schemaVersion: a.schemaVersion,
    wrapperVersion: a.wrapperVersion,
    bootstrapHash: a.bootstrapHash,
    runtimeSHA: a.runtimeSHA,
  },
  warnings,
  firstTimestampDivergence,
  firstDivergence,
  lifecycleOrdering: {
    run1: namesA,
    run2: namesB,
    identical: namesA.join("|") === namesB.join("|"),
  },
  lifecycleTiming,
  viewportDifferences,
  backgroundDifferences,
  layoutDifferences,
  progressDifferences,
  lifecycleStateDifferences,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
