/**
 * GIS Data Export Utilities
 * Supporting export formats: GeoJSON, KML, and WKT CSV (compatible with Shapefiles)
 */

export function geojsonToKml(geojson: any, layerName: string): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${layerName}</name>
    <description>Exported from Banda Aceh GIS Web System</description>
    <Style id="polygonStyle">
      <LineStyle>
        <color>ff1d4ed8</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>403b82f6</color>
      </PolyStyle>
    </Style>
    <Style id="lineStyle">
      <LineStyle>
        <color>fff59e0b</color>
        <width>3</width>
      </LineStyle>
    </Style>
    <Style id="pointStyle">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
  `;

  if (geojson && geojson.features) {
    geojson.features.forEach((feature: any, idx: number) => {
      const props = feature.properties || {};
      const geom = feature.geometry || {};
      const name = props.name || `${layerName} Feature #${idx + 1}`;
      
      const desc = Object.entries(props)
        .map(([k, v]) => `<b>${k}:</b> ${v}`)
        .join("<br/>");

      kml += `    <Placemark>
      <name>${name}</name>
      <description><![CDATA[${desc}]]></description>
      `;

      if (geom.type === "Point") {
        kml += `      <styleUrl>#pointStyle</styleUrl>\n`;
        const [lon, lat] = geom.coordinates;
        kml += `      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
      `;
      } else if (geom.type === "LineString") {
        kml += `      <styleUrl>#lineStyle</styleUrl>\n`;
        const coords = geom.coordinates
          .map((c: any) => `${c[0]},${c[1]},0`)
          .join(" ");
        kml += `      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coords}</coordinates>
      </LineString>
      `;
      } else if (geom.type === "Polygon") {
        kml += `      <styleUrl>#polygonStyle</styleUrl>\n`;
        kml += `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
            `;
        // Handle coordinates array
        const ring = geom.coordinates[0] || [];
        const coordsStr = ring
          .map((c: any) => `${c[0]},${c[1]},0`)
          .join("\n            ");
        kml += coordsStr;
        kml += `
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
      `;
      }

      kml += `    </Placemark>\n`;
    });
  }

  kml += `  </Document>
</kml>`;
  return kml;
}

export function geojsonToWktCsv(geojson: any): string {
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    return "WKT,id\n";
  }

  // Determine all property headers
  const sampleProps = geojson.features[0].properties || {};
  const propKeys = Object.keys(sampleProps);
  
  // Header line
  let csv = `WKT,${propKeys.map(k => `"${k}"`).join(",")}\n`;

  geojson.features.forEach((feature: any, idx: number) => {
    const geom = feature.geometry || {};
    const props = feature.properties || {};

    let wkt = "";
    if (geom.type === "Point") {
      wkt = `POINT (${geom.coordinates[0]} ${geom.coordinates[1]})`;
    } else if (geom.type === "LineString") {
      const pts = geom.coordinates.map((c: any) => `${c[0]} ${c[1]}`).join(", ");
      wkt = `LINESTRING (${pts})`;
    } else if (geom.type === "Polygon") {
      const ring = geom.coordinates[0] || [];
      const pts = ring.map((c: any) => `${c[0]} ${c[1]}`).join(", ");
      wkt = `POLYGON ((${pts}))`;
    }

    const rowValues = propKeys.map(key => {
      const val = props[key];
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    });

    csv += `"${wkt}",${rowValues.join(",")}\n`;
  });

  return csv;
}

export function downloadFile(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
