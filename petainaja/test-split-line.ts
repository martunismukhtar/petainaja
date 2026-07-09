import * as turf from "@turf/turf";

function isFeatureValid(f: any): boolean {
  if (!f || f.type !== "Feature" || !f.geometry) return false;
  const geom = f.geometry;
  if (!geom.type || !geom.coordinates) return false;
  return true;
}

function extendCutterLine(lineFeature: any, extensionDist: number = 0.5): any {
  if (!lineFeature || !lineFeature.geometry || lineFeature.geometry.type !== "LineString") {
    return lineFeature;
  }
  const coords = lineFeature.geometry.coordinates;
  if (coords.length < 2) return lineFeature;

  const p0 = coords[0];
  const p1 = coords[1];
  const pn_1 = coords[coords.length - 2];
  const pn = coords[coords.length - 1];

  const dxStart = p0[0] - p1[0];
  const dyStart = p0[1] - p1[1];
  const lenStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
  let extendedStart = p0;
  if (lenStart > 0) {
    const extLng = p0[0] + (dxStart / lenStart) * extensionDist;
    const extLat = p0[1] + (dyStart / lenStart) * extensionDist;
    extendedStart = [extLng, extLat];
  }

  const dxEnd = pn[0] - pn_1[0];
  const dyEnd = pn[1] - pn_1[1];
  const lenEnd = Math.sqrt(dxEnd * dxEnd + dyEnd * dyEnd);
  let extendedEnd = pn;
  if (lenEnd > 0) {
    const extLng = pn[0] + (dxEnd / lenEnd) * extensionDist;
    const extLat = pn[1] + (dyEnd / lenEnd) * extensionDist;
    extendedEnd = [extLng, extLat];
  }

  const extendedCoords = [...coords];
  extendedCoords[0] = extendedStart;
  extendedCoords[extendedCoords.length - 1] = extendedEnd;

  return {
    ...lineFeature,
    geometry: {
      ...lineFeature.geometry,
      coordinates: extendedCoords
    }
  };
}

export function splitLine(lineFeature: any, splitterFeature: any): any[] {
  if (!lineFeature || !splitterFeature) return [];

  try {
    const bbox = turf.bbox(lineFeature);
    const dx = bbox[2] - bbox[0];
    const dy = bbox[3] - bbox[1];
    const diagonal = Math.sqrt(dx * dx + dy * dy);
    const extensionDist = Math.max(diagonal * 2, 0.5);

    const extendedSplitter = extendCutterLine(splitterFeature, extensionDist);
    const splitCollection = turf.lineSplit(lineFeature, extendedSplitter);
    if (!splitCollection || !splitCollection.features || splitCollection.features.length === 0) {
      return [lineFeature];
    }

    const results = splitCollection.features.map((f, index) => {
      return turf.feature(f.geometry, {
        ...lineFeature.properties,
        split_id: index + 1,
      });
    });

    const validResults = results.filter(isFeatureValid);
    return validResults.length > 0 ? validResults : [lineFeature];
  } catch (err) {
    console.error("Error splitting line:", err);
    return [lineFeature];
  }
}

const line = turf.lineString([
  [120.0, 5.0],
  [120.1, 5.0]
]);

const splitter = turf.lineString([
  [120.05, 4.95],
  [120.05, 5.05]
]);

console.log("Running splitLine test...");
const pieces = splitLine(line, splitter);
console.log("Pieces count:", pieces.length);
if (pieces.length > 0) {
  pieces.forEach((p, idx) => {
    console.log(`Piece ${idx}: type = ${p.geometry?.type}, coords = ${JSON.stringify(p.geometry?.coordinates)}`);
  });
}
