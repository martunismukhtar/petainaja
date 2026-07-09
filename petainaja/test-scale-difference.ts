import * as turf from "@turf/turf";

// A polygon that is 5km across (roughly 0.045 degrees)
const poly = turf.polygon([
  [
    [95.30, 5.50],
    [95.35, 5.50],
    [95.35, 5.55],
    [95.30, 5.55],
    [95.30, 5.50]
  ]
]);

const line = turf.lineString([
  [95.325, 5.49],
  [95.325, 5.56]
]);

const thicknesses = [0.0001, 0.00005, 0.0002, 0.0005, 0.001, 0.005];

for (const thickness of thicknesses) {
  try {
    const thickCutter = turf.buffer(line, thickness, { units: "kilometers" });
    if (!thickCutter) {
      console.log(`Thickness ${thickness}: turf.buffer returned null`);
      continue;
    }
    const cutterFeature = (thickCutter as any).type === "FeatureCollection"
      ? (thickCutter as any).features[0]
      : thickCutter;

    const fc = turf.featureCollection([poly, cutterFeature] as any);
    const diff = turf.difference(fc as any);
    if (!diff) {
      console.log(`Thickness ${thickness}: difference returned null`);
      continue;
    }

    const flattened = turf.flatten(diff);
    console.log(`Thickness ${thickness}: successfully split into ${flattened.features.length} pieces`);
  } catch (err: any) {
    console.log(`Thickness ${thickness}: Threw error: ${err.message}`);
  }
}
