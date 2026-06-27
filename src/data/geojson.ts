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
  features: [
    {
      type: "Feature",
      id: 1,
      properties: {
        name: "Kecamatan Baiturrahman",
        type: "Pusat Kota",
        area_km2: 4.54,
        population: 31200,
        density: "6,872 jiwa/km²",
        color: "#2563eb"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [95.310, 5.545],
            [95.325, 5.545],
            [95.325, 5.555],
            [95.310, 5.555],
            [95.310, 5.545]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: 2,
      properties: {
        name: "Kecamatan Kuta Alam",
        type: "Perumahan & Bisnis",
        area_km2: 5.12,
        population: 42500,
        density: "8,301 jiwa/km²",
        color: "#16a34a"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [95.325, 5.550],
            [95.345, 5.550],
            [95.345, 5.565],
            [95.325, 5.565],
            [95.325, 5.550]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: 3,
      properties: {
        name: "Kecamatan Meuraxa",
        type: "Pesisir & Pelabuhan",
        area_km2: 7.26,
        population: 24800,
        density: "3,415 jiwa/km²",
        color: "#ea580c"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [95.285, 5.545],
            [95.310, 5.545],
            [95.310, 5.570],
            [95.285, 5.570],
            [95.285, 5.545]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: 4,
      properties: {
        name: "Kecamatan Syiah Kuala",
        type: "Pendidikan & Kampus",
        area_km2: 9.34,
        population: 36000,
        density: "3,854 jiwa/km²",
        color: "#9333ea"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [95.345, 5.555],
            [95.375, 5.555],
            [95.375, 5.585],
            [95.345, 5.585],
            [95.345, 5.555]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: 5,
      properties: {
        name: "Kecamatan Jaya Baru",
        type: "Pemukiman",
        area_km2: 4.88,
        population: 26100,
        density: "5,348 jiwa/km²",
        color: "#db2777"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [95.290, 5.525],
            [95.310, 5.525],
            [95.310, 5.545],
            [95.290, 5.545],
            [95.290, 5.525]
          ]
        ]
      }
    }
  ]
};

// 2. Major Roads (Jalan LineStrings)
export const JALAN_DATA: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Jl. Sultan Iskandar Muda",
        type: "Protokol",
        lanes: 4,
        status: "Lancar"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [95.295, 5.565],
          [95.305, 5.555],
          [95.318, 5.551],
          [95.325, 5.545]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Jl. Teuku Umar",
        type: "Komersial",
        lanes: 4,
        status: "Padat Merayap"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [95.318, 5.551],
          [95.312, 5.538],
          [95.305, 5.525],
          [95.295, 5.515]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Jl. T. Nyak Arief",
        type: "Protokol",
        lanes: 4,
        status: "Ramai Lancar"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [95.322, 5.553],
          [95.335, 5.558],
          [95.350, 5.568],
          [95.365, 5.575]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Jl. Mohd. Jam",
        type: "Kolektor",
        lanes: 2,
        status: "Padat"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [95.318, 5.551],
          [95.319, 5.547],
          [95.321, 5.542]
        ]
      }
    }
  ]
};

// 3. Rivers (Sungai LineStrings)
export const SUNGAI_DATA: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Krueng Aceh",
        width_m: 65,
        depth_m: 4.5,
        quality: "Normal"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [95.332, 5.510],
          [95.325, 5.522],
          [95.323, 5.535],
          [95.320, 5.548],
          [95.315, 5.558],
          [95.312, 5.572],
          [95.318, 5.580]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Krueng Daroy",
        width_m: 15,
        depth_m: 2.1,
        quality: "Bersih"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [95.295, 5.515],
          [95.304, 5.528],
          [95.310, 5.538],
          [95.318, 5.551]
        ]
      }
    }
  ]
};

// 4. Landmarks (Titik Fasilitas/Points)
export const LANDMARK_DATA: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "Masjid Raya Baiturrahman",
        category: "Ibadah",
        description: "Masjid bersejarah ikon Aceh dengan 7 kubah dan tiang payung elektrik.",
        year_built: 1879,
        rating: 4.9
      },
      geometry: {
        type: "Point",
        coordinates: [95.3192, 5.5536]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Museum Tsunami Aceh",
        category: "Edukasi & Sejarah",
        description: "Museum megah yang dirancang oleh Ridwan Kamil untuk mengenang tsunami 2004.",
        year_built: 2009,
        rating: 4.8
      },
      geometry: {
        type: "Point",
        coordinates: [95.3153, 5.5481]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "PLTD Apung",
        category: "Monumen",
        description: "Kapal pembangkit listrik seberat 2.600 ton yang terdampar 3 km ke daratan saat tsunami.",
        year_built: 2004,
        rating: 4.7
      },
      geometry: {
        type: "Point",
        coordinates: [95.3051, 5.5450]
      }
    },
    {
      type: "Feature",
      properties: {
        name: "Pelabuhan Ulee Lheue",
        category: "Transportasi",
        description: "Pintu gerbang penyeberangan menuju Pulau Weh (Sabang).",
        year_built: 1990,
        rating: 4.5
      },
      geometry: {
        type: "Point",
        coordinates: [95.2862, 5.5684]
      }
    }
  ]
};
