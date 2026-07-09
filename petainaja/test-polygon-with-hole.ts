import * as turf from "@turf/turf";
import { splitPolygon } from "./src/utils/gisOperations.ts";

// A 2km x 2km polygon with a 1km x 1km hole in the middle
const polyWithHole = turf.polygon([
  // Outer ring
  [
    [95.31, 5.54],
    [95.33, 5.54],
    [95.33, 5.56],
    [95.31, 5.56],
    [95.31, 5.54]
  ],
  // Inner ring (hole)
  [
    [95.315, 5.545],
    [95.315, 5.555],
    [95.325, 5.555],
    [95.325, 5.545],
    [95.315, 5.545]
  ]
]);

// Cutter Line completely crossing both outer boundaries and the hole
const cutter = turf.lineString([
  [95.32, 5.53],
  [95.32, 5.57]
]);

console.log("=== Testing splitPolygon with hole ===");
const polyResults = splitPolygon(polyWithHole, cutter);
console.log("Split pieces count:", polyResults.length);
polyResults.forEach((f, i) => {
  console.log(`Piece ${i + 1}: type = ${f.geometry.type}, coordinates rings = ${f.geometry.coordinates.length}`);
});
