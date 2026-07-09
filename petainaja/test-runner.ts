import * as turf from "@turf/turf";
import { splitPolygon, splitLine } from "./src/utils/gisOperations.ts";

// Sample Polygon
const poly = turf.polygon([
  [
    [95.31, 5.54],
    [95.33, 5.54],
    [95.33, 5.56],
    [95.31, 5.56],
    [95.31, 5.54]
  ]
]);

// Cutter Line completely crossing the polygon
const cutter = turf.lineString([
  [95.32, 5.53],
  [95.32, 5.57]
]);

console.log("=== Testing splitPolygon ===");
const polyResults = splitPolygon(poly, cutter);
console.log("Input valid:", !!poly);
console.log("Split pieces count:", polyResults.length);
polyResults.forEach((f, i) => {
  console.log(`Piece ${i + 1}: type = ${f.geometry.type}, coordinates count = ${f.geometry.coordinates.length}`);
});

// Sample Line
const line = turf.lineString([
  [95.31, 5.55],
  [95.33, 5.55]
]);

console.log("\n=== Testing splitLine ===");
const lineResults = splitLine(line, cutter);
console.log("Split segments count:", lineResults.length);
lineResults.forEach((f, i) => {
  console.log(`Segment ${i + 1}: coordinates =`, f.geometry.coordinates);
});
