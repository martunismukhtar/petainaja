export function parseCsvToGeoJson(csvText: string): any {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("File CSV kosong atau tidak memiliki data baris.");
  }

  // Parse headers
  const headers = parseCsvLine(lines[0]);
  
  // Find coordinate columns
  const latCandidates = ["latitude", "lat", "y", "lintang"];
  const lngCandidates = ["longitude", "lng", "lon", "x", "bujur"];

  let latIndex = -1;
  let lngIndex = -1;

  for (let i = 0; i < headers.length; i++) {
    const headerLower = headers[i].toLowerCase().trim().replace(/['"_-]/g, "");
    if (latCandidates.includes(headerLower) || latCandidates.some(c => headerLower.includes(c))) {
      if (latIndex === -1) latIndex = i;
    }
    if (lngCandidates.includes(headerLower) || lngCandidates.some(c => headerLower.includes(c))) {
      if (lngIndex === -1) lngIndex = i;
    }
  }

  if (latIndex === -1 || lngIndex === -1) {
    throw new Error(
      "Kolom koordinat tidak ditemukan! Harap pastikan file CSV memiliki kolom 'latitude' (atau 'lat', 'y', 'lintang') dan 'longitude' (atau 'lng', 'lon', 'x', 'bujur')."
    );
  }

  const features: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < Math.max(latIndex, lngIndex) + 1) continue;

    const latVal = parseFloat(cells[latIndex]);
    const lngVal = parseFloat(cells[lngIndex]);

    if (isNaN(latVal) || isNaN(lngVal)) continue;

    // Compile other properties
    const properties: Record<string, any> = {};
    headers.forEach((header, idx) => {
      if (idx !== latIndex && idx !== lngIndex) {
        properties[header.trim()] = cells[idx]?.trim() || "";
      }
    });

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lngVal, latVal]
      },
      properties
    });
  }

  return {
    type: "FeatureCollection",
    features
  };
}

// Helper to parse a line of CSV, respecting quotes
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.replace(/^['"]|['"]$/g, "").trim());
}

export function parseKmlToGeoJson(kmlText: string): any {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, "text/xml");
  const placemarks = xmlDoc.getElementsByTagName("Placemark");
  const features: any[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = pm.getElementsByTagName("name")[0];
    const descEl = pm.getElementsByTagName("description")[0];

    const name = nameEl ? nameEl.textContent || "" : `Placemark ${i + 1}`;
    const description = descEl ? descEl.textContent || "" : "";

    const properties: Record<string, any> = { name, description };

    // Extract other simple child nodes as properties
    for (let j = 0; j < pm.children.length; j++) {
      const child = pm.children[j];
      const tag = child.tagName.toLowerCase();
      if (!["name", "description", "point", "linestring", "polygon", "style", "styleurl", "extendeddata"].includes(tag)) {
        properties[child.tagName] = child.textContent || "";
      }
    }

    // Try parsing point
    const pointEl = pm.getElementsByTagName("Point")[0];
    if (pointEl) {
      const coordsText = pointEl.getElementsByTagName("coordinates")[0]?.textContent || "";
      const coords = parseKmlCoordinates(coordsText);
      if (coords.length > 0) {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: coords[0]
          },
          properties
        });
        continue;
      }
    }

    // Try parsing LineString
    const lineEl = pm.getElementsByTagName("LineString")[0];
    if (lineEl) {
      const coordsText = lineEl.getElementsByTagName("coordinates")[0]?.textContent || "";
      const coords = parseKmlCoordinates(coordsText);
      if (coords.length > 0) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coords
          },
          properties
        });
        continue;
      }
    }

    // Try parsing Polygon
    const polyEl = pm.getElementsByTagName("Polygon")[0];
    if (polyEl) {
      const outerRing = polyEl.getElementsByTagName("outerBoundaryIs")[0];
      if (outerRing) {
        const coordsText = outerRing.getElementsByTagName("coordinates")[0]?.textContent || "";
        const coords = parseKmlCoordinates(coordsText);
        if (coords.length > 0) {
          features.push({
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [coords] // Polygon is nested arrays of rings
            },
            properties
          });
          continue;
        }
      }
    }
  }

  return {
    type: "FeatureCollection",
    features
  };
}

function parseKmlCoordinates(coordsText: string): [number, number][] {
  const result: [number, number][] = [];
  const coordsList = coordsText.trim().split(/\s+/);
  
  for (const coord of coordsList) {
    if (!coord) continue;
    const parts = coord.split(",");
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lng) && !isNaN(lat)) {
        result.push([lng, lat]);
      }
    }
  }
  return result;
}
