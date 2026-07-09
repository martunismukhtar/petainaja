import * as turf from "@turf/turf";
import { splitPolygon } from "./src/utils/gisOperations.ts";

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

console.log("=== Testing splitPolygon in separate test ===");
const polyResults = splitPolygon(poly, cutter);
console.log("Split pieces count:", polyResults.length);
polyResults.forEach((f, i) => {
  console.log(`Piece ${i + 1}: type = ${f.geometry.type}, coordinates = ${JSON.stringify(f.geometry.coordinates)}`);
});
