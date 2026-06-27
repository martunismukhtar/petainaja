import JSZip from "jszip";
import shp from "shpjs";

export async function validateAndParseShapefileZip(file: File): Promise<any> {
  const arrayBuffer = await file.arrayBuffer();

  // 1. Load the ZIP with JSZip to inspect its contents
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);

  // We need to check if we have files ending with .shp, .shx, .dbf, and .prj
  const hasShp = files.some((f) => f.toLowerCase().endsWith(".shp"));
  const hasShx = files.some((f) => f.toLowerCase().endsWith(".shx"));
  const hasDbf = files.some((f) => f.toLowerCase().endsWith(".dbf"));
  const hasPrj = files.some((f) => f.toLowerCase().endsWith(".prj"));

  if (!hasShp || !hasShx || !hasDbf || !hasPrj) {
    const missing = [];
    if (!hasShp) missing.push(".shp");
    if (!hasShx) missing.push(".shx");
    if (!hasDbf) missing.push(".dbf");
    if (!hasPrj) missing.push(".prj");
    throw new Error(
      `File ZIP tidak lengkap! Wajib berisi file dengan ekstensi: ${missing.join(", ")}`
    );
  }

  // 2. Parse using shpjs
  // shpjs takes ArrayBuffer of the zip file
  // shp() returns GeoJSON (either a FeatureCollection or an array of FeatureCollections)
  const shpModule: any = shp;
  const parseFn = typeof shpModule === "function" ? shpModule : (shpModule.default || shpModule);

  const geojson = await parseFn(arrayBuffer);
  return geojson;
}
