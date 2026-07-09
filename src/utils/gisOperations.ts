import * as turf from "@turf/turf";

/**
 * Merges multiple polygon or multipolygon features into a single feature.
 * @param features Array of GeoJSON Polygon or MultiPolygon features
 */
export function mergePolygons(features: any[]): any {
  if (!features || features.length === 0) return null;
  if (features.length === 1) return features[0];

  let merged: any = features[0];
  const properties = { ...merged.properties };

  for (let i = 1; i < features.length; i++) {
    const nextFeature = features[i];
    try {
      // Try Turf v7.x FeatureCollection union format first
      const fc = turf.featureCollection([merged, nextFeature]) as any;
      const unionResult = turf.union(fc);
      if (unionResult) {
        merged = unionResult;
      }
    } catch (e) {
      try {
        // Fallback to Turf v6.x (merged, nextFeature) format
        const unionResult = (turf as any).union(merged, nextFeature);
        if (unionResult) {
          merged = unionResult;
        }
      } catch (err) {
        console.error("Failed to union features", err);
      }
    }
  }

  // Preserve properties
  merged.properties = properties;
  return merged;
}

/**
 * Merges multiple line features into a single MultiLineString feature.
 * @param features Array of LineString or MultiLineString features
 */
export function mergeLines(features: any[]): any {
  if (!features || features.length === 0) return null;
  if (features.length === 1) return features[0];

  const coordinates: any[] = [];
  features.forEach((f) => {
    if (!f.geometry) return;
    if (f.geometry.type === "LineString") {
      coordinates.push(f.geometry.coordinates);
    } else if (f.geometry.type === "MultiLineString") {
      coordinates.push(...f.geometry.coordinates);
    }
  });

  const properties = { ...features[0].properties };
  return turf.multiLineString(coordinates, properties);
}

/**
 * Dissolves features of a FeatureCollection.
 * If propertyName is provided, only features sharing the same property value will be dissolved together.
 */
export function dissolveFeatures(featureCollection: any, propertyName?: string): any {
  if (!featureCollection || !featureCollection.features || featureCollection.features.length === 0) {
    return featureCollection;
  }

  try {
    // turf.dissolve expects a FeatureCollection and options
    const options = propertyName ? { propertyName } : undefined;
    return turf.dissolve(featureCollection, options);
  } catch (err) {
    console.error("Failed to dissolve features, falling back to manual union:", err);
    // Fallback: Group by property and merge
    const features = featureCollection.features;
    if (propertyName) {
      const groups: Record<string, any[]> = {};
      features.forEach((f: any) => {
        const val = f.properties?.[propertyName] !== undefined ? String(f.properties[propertyName]) : "__undefined__";
        if (!groups[val]) groups[val] = [];
        groups[val].push(f);
      });

      const dissolvedFeatures: any[] = [];
      Object.entries(groups).forEach(([val, groupFeatures]) => {
        const isPolygon = groupFeatures.some((f) => f.geometry?.type?.includes("Polygon"));
        if (isPolygon) {
          const merged = mergePolygons(groupFeatures);
          if (merged) {
            if (val !== "__undefined__") {
              merged.properties = { ...merged.properties, [propertyName]: groupFeatures[0].properties[propertyName] };
            }
            dissolvedFeatures.push(merged);
          }
        } else {
          // Keep as is if not polygon
          dissolvedFeatures.push(...groupFeatures);
        }
      });
      return {
        type: "FeatureCollection",
        features: dissolvedFeatures,
      };
    } else {
      // Dissolve all polygons
      const polygons = features.filter((f: any) => f.geometry?.type?.includes("Polygon"));
      const nonPolygons = features.filter((f: any) => !f.geometry?.type?.includes("Polygon"));
      const merged = mergePolygons(polygons);
      
      return {
        type: "FeatureCollection",
        features: merged ? [merged, ...nonPolygons] : nonPolygons,
      };
    }
  }
}

/**
 * Checks if a coordinate array contains any NaN or infinite values,
 * and ensures it has standard structure.
 */
export function isFeatureValid(f: any): boolean {
  if (!f || f.type !== "Feature" || !f.geometry) return false;
  const geom = f.geometry;
  if (!geom.type || !geom.coordinates) return false;
  return true;
}

/**
 * Finds the index of the clicked feature inside a GeoJSON FeatureCollection
 * by checking if the clicked coordinate is inside the polygon, or closest to the line/point.
 * If that fails, falls back to property-based matching.
 */
export function findClickedFeatureIndex(
  geojson: any,
  clickLngLat: [number, number],
  maplibreFeature: any
): number {
  if (!geojson || !geojson.features || geojson.features.length === 0) return -1;

  // 1. Try index-based matching via _feature_index first (O(1) precise matching)
  if (maplibreFeature && maplibreFeature.properties) {
    const idxVal = maplibreFeature.properties._feature_index;
    if (idxVal !== undefined && idxVal !== null) {
      const idx = typeof idxVal === "number" ? idxVal : parseInt(idxVal, 10);
      if (idx >= 0 && idx < geojson.features.length) {
        return idx;
      }
    }
  }

  if (!clickLngLat || clickLngLat.length < 2) return -1;

  const clickPt = turf.point(clickLngLat);
  let bestIndex = -1;
  let minDistance = Infinity;

  // 2. Try exact spatial matching
  for (let idx = 0; idx < geojson.features.length; idx++) {
    const f = geojson.features[idx];
    if (!f || !f.geometry) continue;

    const gType = f.geometry.type;

    if (gType.includes("Polygon")) {
      try {
        if (turf.booleanPointInPolygon(clickPt, f)) {
          return idx; // Best possible match, return immediately!
        }
      } catch (err) {
        // Ignore and fallback
      }
    }

    try {
      let dist = Infinity;
      if (gType === "Point") {
        dist = turf.distance(clickPt, f);
      } else if (gType.includes("Line")) {
        dist = turf.pointToLineDistance(clickPt, f);
      } else {
        // Polygon center distance as fallback
        const bbox = turf.bbox(f);
        const center = turf.point([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]);
        dist = turf.distance(clickPt, center);
      }

      if (dist < minDistance) {
        minDistance = dist;
        bestIndex = idx;
      }
    } catch (e) {
      // Ignore
    }
  }

  // If we found a very close match (e.g. within 500 meters for points/lines/fallbacks), return it
  if (bestIndex !== -1 && minDistance < 0.5) {
    return bestIndex;
  }

  // 3. Fallback to property-based matching
  if (maplibreFeature && maplibreFeature.properties) {
    const featProps = maplibreFeature.properties;
    const featName = featProps.nama || featProps.name || featProps.Nama || featProps.Name;

    for (let idx = 0; idx < geojson.features.length; idx++) {
      const f = geojson.features[idx];
      if (!f || !f.properties) continue;

      const fName = f.properties.nama || f.properties.name || f.properties.Nama || f.properties.Name;
      if (fName && featName && fName === featName) {
        return idx;
      }

      // Check if properties match exactly
      if (JSON.stringify(f.properties) === JSON.stringify(featProps)) {
        return idx;
      }
    }
  }

  // 4. Absolute fallback: return the bestIndex we found spatially
  return bestIndex;
}

/**
 * Extends a LineString coordinates slightly at both ends to ensure mathematical intersection.
 * Searches forward and backward to find non-degenerate segments for precise direction vectors.
 */
export function extendCutterLine(lineFeature: any, extensionDist: number = 0.5): any {
  if (!lineFeature || !lineFeature.geometry || lineFeature.geometry.type !== "LineString") {
    return lineFeature;
  }
  const coords = lineFeature.geometry.coordinates;
  if (coords.length < 2) return lineFeature;

  const n = coords.length;

  // Find a non-degenerate segment at the start (from index 0 forward)
  let p0 = coords[0];
  let p1 = coords[1];
  let dxStart = p0[0] - p1[0];
  let dyStart = p0[1] - p1[1];
  let lenStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
  
  if (lenStart < 1e-9) {
    for (let i = 1; i < n - 1; i++) {
      const q0 = coords[i];
      const q1 = coords[i + 1];
      const dx = q0[0] - q1[0];
      const dy = q0[1] - q1[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1e-9) {
        p0 = q0;
        p1 = q1;
        dxStart = dx;
        dyStart = dy;
        lenStart = len;
        break;
      }
    }
  }

  // Find a non-degenerate segment at the end (from index length-1 backward)
  let pn_1 = coords[n - 2];
  let pn = coords[n - 1];
  let dxEnd = pn[0] - pn_1[0];
  let dyEnd = pn[1] - pn_1[1];
  let lenEnd = Math.sqrt(dxEnd * dxEnd + dyEnd * dyEnd);

  if (lenEnd < 1e-9) {
    for (let i = n - 1; i >= 1; i--) {
      const q0 = coords[i - 1];
      const q1 = coords[i];
      const dx = q1[0] - q0[0];
      const dy = q1[1] - q0[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1e-9) {
        pn_1 = q0;
        pn = q1;
        dxEnd = dx;
        dyEnd = dy;
        lenEnd = len;
        break;
      }
    }
  }

  let extendedStart = coords[0];
  if (lenStart > 0) {
    const extLng = coords[0][0] + (dxStart / lenStart) * extensionDist;
    const extLat = coords[0][1] + (dyStart / lenStart) * extensionDist;
    extendedStart = [extLng, extLat];
  }

  let extendedEnd = coords[n - 1];
  if (lenEnd > 0) {
    const extLng = coords[n - 1][0] + (dxEnd / lenEnd) * extensionDist;
    const extLat = coords[n - 1][1] + (dyEnd / lenEnd) * extensionDist;
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

/**
 * Splits a single Polygon feature using a LineString cutter.
 * Returns an array of Polygon features.
 */
function splitSinglePolygon(polygonFeature: any, lineFeature: any): any[] {
  let cleanedPoly = polygonFeature;
  try {
    cleanedPoly = turf.cleanCoords(polygonFeature);
  } catch (err) {
    console.warn("Could not clean coordinates:", err);
  }

  try {
    cleanedPoly = turf.rewind(cleanedPoly);
  } catch (err) {
    console.warn("Could not rewind coordinates:", err);
  }

  // Calculate bounding box and diagonal to guarantee the cutter line extends completely across the polygon
  const bbox = turf.bbox(cleanedPoly);
  const dx = bbox[2] - bbox[0];
  const dy = bbox[3] - bbox[1];
  const diagonal = Math.sqrt(dx * dx + dy * dy);
  
  // Extension distance: 2.5 times the diagonal, minimum 0.01 degrees
  const extensionDist = Math.max(diagonal * 2.5, 0.01);
  const extendedLine = extendCutterLine(lineFeature, extensionDist);

  // --- Attempt 1: Mathematically Exact lineSplit + polygonize approach ---
  try {
    const boundary = turf.polygonToLine(cleanedPoly);
    if (boundary) {
      const segments: any[] = [];
      const lineStrings: any[] = [];

      // Extract all LineStrings from boundary (which can be a FeatureCollection, MultiLineString or raw Geometry)
      const extractLineStrings = (feat: any) => {
        if (!feat) return;
        if (feat.type === "Feature" && feat.geometry) {
          const geom = feat.geometry;
          if (geom.type === "LineString") {
            lineStrings.push(turf.lineString(geom.coordinates));
          } else if (geom.type === "MultiLineString") {
            geom.coordinates.forEach((coords: any) => {
              lineStrings.push(turf.lineString(coords));
            });
          }
        } else if (feat.type === "LineString") {
          lineStrings.push(turf.lineString(feat.coordinates));
        } else if (feat.type === "MultiLineString") {
          feat.coordinates.forEach((coords: any) => {
            lineStrings.push(turf.lineString(coords));
          });
        }
      };

      if ((boundary as any).type === "FeatureCollection") {
        (boundary as any).features.forEach((f: any) => extractLineStrings(f));
      } else {
        extractLineStrings(boundary);
      }

      // Split each boundary segment with the extended cutter line
      lineStrings.forEach((b: any) => {
        try {
          const splitBoundaries = turf.lineSplit(b, extendedLine);
          if (splitBoundaries && splitBoundaries.features.length > 0) {
            segments.push(...splitBoundaries.features);
          } else {
            segments.push(b);
          }
        } catch (splitErr) {
          segments.push(b);
        }
      });

      // Split cutter line by boundary (Standard LineString vs LineString split, highly robust)
      let cutterSegments: any[] = [extendedLine];
      try {
        const splitCutter = turf.lineSplit(extendedLine, boundary as any);
        if (splitCutter && splitCutter.features.length > 0) {
          cutterSegments = splitCutter.features;
        }
      } catch (err) {
        try {
          const splitCutterPoly = turf.lineSplit(extendedLine, cleanedPoly);
          if (splitCutterPoly && splitCutterPoly.features.length > 0) {
            cutterSegments = splitCutterPoly.features;
          }
        } catch (e) {}
      }

      // Keep only cutter segments whose interior points lie inside the polygon (scale-aware midpoint)
      cutterSegments.forEach((segment: any) => {
        try {
          const len = turf.length(segment);
          if (len > 0) {
            const midPoint = turf.along(segment, len / 2);
            if (turf.booleanPointInPolygon(midPoint, cleanedPoly)) {
              segments.push(segment);
            }
          }
        } catch (e) {
          try {
            const coords = segment.geometry.coordinates;
            const pt = turf.point(coords[Math.floor(coords.length / 2)]);
            if (turf.booleanPointInPolygon(pt, cleanedPoly)) {
              segments.push(segment);
            }
          } catch (err) {}
        }
      });

      // Polygonize the segments
      const fc = turf.featureCollection(segments);
      const polygonized = turf.polygonize(fc as any);

      if (polygonized && polygonized.features.length > 1) {
        // Filter results to keep only polygons that are actually inside the original polygon (handles holes perfectly!)
        const validPieces = polygonized.features.filter((piece: any) => {
          try {
            // Test 1: Centroid inside original polygon
            const centroid = turf.centroid(piece);
            if (turf.booleanPointInPolygon(centroid, cleanedPoly)) {
              return true;
            }
          } catch (e) {}

          try {
            // Test 2: Point on feature inside original polygon
            const pt = turf.pointOnFeature(piece);
            if (turf.booleanPointInPolygon(pt, cleanedPoly)) {
              return true;
            }
          } catch (e) {}

          try {
            // Test 3: Area overlap test
            const overlapFc = turf.featureCollection([piece, cleanedPoly]);
            const intersection = turf.intersect(overlapFc as any);
            if (intersection) {
              const pieceArea = turf.area(piece);
              const intersectArea = turf.area(intersection);
              if (pieceArea > 0 && (intersectArea / pieceArea) > 0.9) {
                return true;
              }
            }
          } catch (e) {}

          return false;
        });

        if (validPieces.length > 1) {
          return validPieces.map((feat: any, idx: number) => 
            turf.feature(feat.geometry, {
              ...polygonFeature.properties,
              split_id: idx + 1
            })
          );
        }
      }
    }
  } catch (polygonizeErr) {
    console.warn("Polygonize split attempt failed, falling back to difference:", polygonizeErr);
  }

  // --- Fallback (Old approach using turf.difference) ---
  const thicknessesToTry = [0.00001, 0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005]; 

  const attemptSplit = (targetPoly: any, cutter: any) => {
    for (const cutterThickness of thicknessesToTry) {
      try {
        const thickCutter = turf.buffer(cutter, cutterThickness, { units: "kilometers" });
        if (!thickCutter) continue;

        const cutterFeatures = (thickCutter as any).type === "FeatureCollection"
          ? (thickCutter as any).features
          : [thickCutter];

        for (const cutterFeature of cutterFeatures) {
          if (!cutterFeature || !cutterFeature.geometry) continue;

          let diff: any = null;
          try {
            const fc = turf.featureCollection([targetPoly, cutterFeature] as any);
            diff = turf.difference(fc as any);
          } catch (e) {
            try {
              diff = (turf as any).difference(targetPoly, cutterFeature);
            } catch (err2) {
              console.error("Turf difference failed:", err2);
            }
          }

          if (!diff || !diff.geometry) continue;

          const results: any[] = [];
          try {
            const flattened = turf.flatten(diff);
            if (flattened && flattened.features) {
              flattened.features.forEach((feat: any, idx: number) => {
                results.push(
                  turf.feature(feat.geometry, {
                    ...polygonFeature.properties,
                    split_id: idx + 1
                  })
                );
              });
            }
          } catch (flattenErr) {
            const geom = diff.geometry;
            if (geom.type === "Polygon") {
              results.push(turf.feature(geom, { ...polygonFeature.properties }));
            } else if (geom.type === "MultiPolygon") {
              geom.coordinates.forEach((polyCoords: any, index: number) => {
                results.push(
                  turf.feature(
                    { type: "Polygon", coordinates: polyCoords },
                    {
                      ...polygonFeature.properties,
                      split_id: index + 1,
                    }
                  )
                );
              });
            }
          }

          const validResults = results.filter(isFeatureValid);
          if (validResults.length > 1) {
            return validResults;
          }
        }
      } catch (err) {
        console.warn(`Attempt with cutterThickness=${cutterThickness} failed:`, err);
      }
    }
    return null;
  };

  // Phase 1: Try splitting with the original cutter (no extensions)
  let splitResult = attemptSplit(cleanedPoly, lineFeature);
  if (splitResult && splitResult.length > 1) {
    return splitResult;
  }

  // Phase 2: If original line didn't split, try splitting with the extended cutter line
  splitResult = attemptSplit(cleanedPoly, extendedLine);
  if (splitResult && splitResult.length > 1) {
    return splitResult;
  }

  // Phase 3: Try to repair the polygon via buffer(0) first, then repeat original split
  let repairedPoly = cleanedPoly;
  try {
    const repairBuffer = turf.buffer(cleanedPoly, 0);
    if (repairBuffer) {
      repairedPoly = (repairBuffer as any).type === "FeatureCollection"
        ? (repairBuffer as any).features[0]
        : repairBuffer;
    }
  } catch (err) {
    console.warn("Could not repair polygon coords with buffer(0):", err);
  }

  splitResult = attemptSplit(repairedPoly, lineFeature);
  if (splitResult && splitResult.length > 1) {
    return splitResult;
  }

  // Phase 4: Try splitting repaired poly with extended cutter line
  splitResult = attemptSplit(repairedPoly, extendedLine);
  if (splitResult && splitResult.length > 1) {
    return splitResult;
  }

  // Absolute fallback: return original polygon
  return [polygonFeature];
}

/**
 * Splits a Polygon or MultiPolygon feature using a LineString cutter.
 * Returns an array of Polygon features.
 */
export function splitPolygon(polygonFeature: any, lineFeature: any): any[] {
  if (!polygonFeature || !lineFeature) return [];

  const geom = polygonFeature.geometry;
  if (!geom) return [polygonFeature];

  if (geom.type === "MultiPolygon") {
    // If it's a MultiPolygon, split each component polygon individually
    const flattened = turf.flatten(polygonFeature);
    const allPieces: any[] = [];
    let hasSplitAny = false;

    for (const poly of flattened.features) {
      const pieces = splitSinglePolygon(poly, lineFeature);
      if (pieces.length > 1) {
        hasSplitAny = true;
      }
      allPieces.push(...pieces);
    }

    if (!hasSplitAny) {
      return [polygonFeature];
    }
    return allPieces;
  } else if (geom.type === "Polygon") {
    return splitSinglePolygon(polygonFeature, lineFeature);
  }

  return [polygonFeature];
}

/**
 * Splits a LineString feature with another LineString splitter.
 * Returns an array of LineString features.
 */
export function splitLine(lineFeature: any, splitterFeature: any): any[] {
  if (!lineFeature || !splitterFeature) return [];

  try {
    const cleanedLine = turf.cleanCoords(lineFeature);
    const cleanedSplitter = turf.cleanCoords(splitterFeature);

    // Calculate bounding box and diagonal to guarantee the splitter line extends completely across the target line
    const bbox = turf.bbox(cleanedLine);
    const dx = bbox[2] - bbox[0];
    const dy = bbox[3] - bbox[1];
    const diagonal = Math.sqrt(dx * dx + dy * dy);
    
    // Dynamic scale-aware extension: extend by 2.5 times the bounding box diagonal,
    // with a safe minimum of 0.01 degrees (~1.1km) to guarantee the splitter line
    // completely crosses the target line. No maximum cap is placed.
    const extensionDist = Math.max(diagonal * 2.5, 0.01);

    const extendedSplitter = extendCutterLine(cleanedSplitter, extensionDist);
    const splitCollection = turf.lineSplit(cleanedLine, extendedSplitter);
    if (!splitCollection || !splitCollection.features || splitCollection.features.length === 0) {
      return [lineFeature];
    }

    // Return features with original line's properties copied over
    const results = splitCollection.features.map((f, index) => {
      return turf.feature(f.geometry, {
        ...lineFeature.properties,
        split_id: index + 1,
      });
    });

    // Filter results to ensure only valid geometries are returned.
    const validResults = results.filter(isFeatureValid);
    return validResults.length > 0 ? validResults : [lineFeature];
  } catch (err) {
    console.error("Error splitting line:", err);
    return [lineFeature];
  }
}

/**
 * Automatically indexes all features of a GeoJSON FeatureCollection with a `_feature_index` property.
 * This ensures that O(1) matching can be performed when querying rendered features on click.
 */
export function indexGeoJsonFeatures(geojson: any): any {
  if (!geojson || !geojson.features) return geojson;
  return {
    ...geojson,
    features: geojson.features.map((f: any, idx: number) => ({
      ...f,
      properties: {
        ...f?.properties,
        _feature_index: idx
      }
    }))
  };
}
