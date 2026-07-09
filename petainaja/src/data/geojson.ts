// GeoJSON mock data for Banda Aceh, Indonesia
// Center is around Lon: 95.32, Lat: 5.55

export const BANDA_ACEH_CENTER: [number, number] = [95.319, 5.551];

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: any[];
}

// 1. Administrative Sub-districts (Kabupaten/Kecamatan Polygons)
export const KABUPATEN_DATA: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: []
};

// 2. Major Roads (Jalan LineStrings)
export const JALAN_DATA: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: []
};

// 3. Rivers (Sungai LineStrings)
export const SUNGAI_DATA: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: []
};

// 4. Landmarks (Titik Fasilitas/Points)
export const LANDMARK_DATA: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: []
};

