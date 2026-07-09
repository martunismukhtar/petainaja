import * as turf from "@turf/turf";

const poly = turf.polygon([
  [
    [95.31, 5.54],
    [95.33, 5.54],
    [95.33, 5.56],
    [95.31, 5.56],
    [95.31, 5.54]
  ]
]);

try {
  const clean = turf.cleanCoords(poly);
  console.log("Clean coords output type:", clean.type);
  const buf = turf.buffer(clean, 0);
  console.log("Buffer by 0 output type:", buf ? (buf as any).type : "null/undefined");
  if (buf) {
    console.log("Buffer by 0 coordinates length:", (buf as any).geometry?.coordinates?.[0]?.length);
  }
} catch (err: any) {
  console.error("Buffer by 0 failed:", err.message);
}
