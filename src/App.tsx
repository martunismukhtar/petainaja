/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MapContainer from "./components/MapContainer";
import Footer from "./components/Footer";
import { LayerId } from "./types";
import type {
  GisLayer,
  ClickedFeatureInfo,
  CustomPin,
  BasemapId,
  GisTool
} from "./types";
import {
  BarChart2,
  PieChart,
  Grid,
  TrendingUp,
  Map,
  X,
  FileJson,
  CheckCircle2,
  Table,
  Download,
  Search,
  Maximize2
} from "lucide-react";
import {
  KABUPATEN_DATA,
  JALAN_DATA,
  SUNGAI_DATA,
  LANDMARK_DATA
} from "./data/geojson";
import {
  geojsonToKml,
  geojsonToWktCsv,
  downloadFile
} from "./utils/exportUtils";
import { validateAndParseShapefileZip } from "./utils/shapefileParser";

const INITIAL_LAYERS: GisLayer[] = [
  {
    id: LayerId.KABUPATEN,
    name: "Kabupaten / Kecamatan",
    visible: true,
    type: "fill",
    color: "#3b82f6",
    outlineColor: "#1d4ed8",
    opacity: 0.25,
    description: "Batas administrasi kecamatan di Banda Aceh",
    count: 5,
    iconStyle: "circle",
    lineStyle: "dashed"
  },
  {
    id: LayerId.JALAN,
    name: "Infrastruktur Jalan",
    visible: true,
    type: "line",
    color: "#f59e0b",
    opacity: 0.95,
    description: "Jalan arteri dan jalan protokol utama",
    count: 4,
    lineStyle: "solid",
    lineWidth: 3
  },
  {
    id: LayerId.SUNGAI,
    name: "Hidrologi Sungai",
    visible: false,
    type: "line",
    color: "#06b6d4",
    opacity: 0.8,
    description: "Aliran sungai Krueng Aceh & Krueng Daroy",
    count: 2,
    lineStyle: "solid",
    lineWidth: 4
  },
  {
    id: LayerId.LANDMARK,
    name: "Landmarks (Titik Penting)",
    visible: true,
    type: "circle",
    color: "#10b981",
    opacity: 1.0,
    description: "Masjid Raya, Museum, dan fasilitas bersejarah",
    count: 4,
    iconStyle: "marker"
  }
];

export default function App() {
  // --- CORE STATE ---
  const [layers, setLayers] = useState<GisLayer[]>(INITIAL_LAYERS);
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>("voyager");
  const [activeTool, setActiveTool] = useState<GisTool>("none");
  const [clickedFeature, setClickedFeature] = useState<ClickedFeatureInfo | null>(null);
  const [customPins, setCustomPins] = useState<CustomPin[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(window.innerWidth >= 768);

  // Auto-hide sidebar on mobile screens on mount and handle resize
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Footer Coordinates & Zoom
  const [pointerCoords, setPointerCoords] = useState<{ lon: number; lat: number }>({
    lon: 95.319,
    lat: 5.551
  });
  const [zoomLevel, setZoomLevel] = useState<number>(13);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // Emitter ref to center/fly map on demand (from Sidebar)
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);

  // Dynamic Uploaded Datasets
  const [uploadedGeoJSONs, setUploadedGeoJSONs] = useState<any[]>([]);
  const [isUploadedVisible, setIsUploadedVisible] = useState<boolean>(true);

  // UI Control Modals
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [attributeTableLayerId, setAttributeTableLayerId] = useState<LayerId | string | null>(null);
  const [attributeSearchQuery, setAttributeSearchQuery] = useState<string>("");

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACTIONS & HANDLERS ---

  // --- LAYER STYLING & ACTIONS CALLBACKS ---
  const handleUpdateLayerColor = (id: LayerId | string, color: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, color } : l))
    );
  };

  const handleUpdateLayerOpacity = (id: LayerId | string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
  };

  const handleUpdateLayerIconStyle = (id: LayerId | string, iconStyle: "circle" | "square" | "star" | "triangle" | "marker") => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, iconStyle } : l))
    );
  };

  const handleUpdateLayerLineStyle = (id: LayerId | string, lineStyle: "solid" | "dashed" | "dotted") => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, lineStyle } : l))
    );
  };

  const handleUpdateLayerLineWidth = (id: LayerId | string, lineWidth: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, lineWidth } : l))
    );
  };

  const handleOpenAttributeTable = (id: LayerId | string) => {
    setAttributeTableLayerId(id);
    setAttributeSearchQuery("");
  };

  const handleRemoveLayer = (id: LayerId | string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setUploadedGeoJSONs((prev, index) => {
      // Clean up the corresponding uploadedGeoJSON if we find it
      const layerIndex = layers.findIndex((l) => l.id === id);
      const isUploadedCount = layers.filter((l, idx) => l.isUploaded && idx < layerIndex).length;
      return prev.filter((_, idx) => idx !== isUploadedCount);
    });
  };

  const handleExportLayer = (id: LayerId | string, format: "shp" | "kml" | "geojson") => {
    // Get corresponding data
    let geojson: any = null;
    let name = "layer";

    if (id === LayerId.KABUPATEN) {
      geojson = KABUPATEN_DATA;
      name = "Kabupaten_Banda_Aceh";
    } else if (id === LayerId.JALAN) {
      geojson = JALAN_DATA;
      name = "Infrastruktur_Jalan_Aceh";
    } else if (id === LayerId.SUNGAI) {
      geojson = SUNGAI_DATA;
      name = "Hidrologi_Sungai_Aceh";
    } else if (id === LayerId.LANDMARK) {
      geojson = LANDMARK_DATA;
      name = "Landmarks_Aceh";
    } else {
      const customL = layers.find((l) => l.id === id);
      if (customL && customL.isUploaded) {
        geojson = customL.geojson;
        name = customL.name.replace(/\s+/g, "_");
      }
    }

    if (!geojson) {
      alert("Gagal mengekspor: Dataset tidak ditemukan.");
      return;
    }

    if (format === "geojson") {
      const content = JSON.stringify(geojson, null, 2);
      downloadFile(content, `${name}.geojson`, "application/json");
      alert(`Sukses mengekspor ${name}.geojson`);
    } else if (format === "kml") {
      const content = geojsonToKml(geojson, name);
      downloadFile(content, `${name}.kml`, "application/vnd.google-earth.kml+xml");
      alert(`Sukses mengekspor ${name}.kml`);
    } else if (format === "shp") {
      // Shapefile alternative (WKT CSV format)
      const content = geojsonToWktCsv(geojson);
      downloadFile(content, `${name}_WKT_SHP.csv`, "text/csv");
      alert(`Sukses mengekspor ${name}_WKT_SHP.csv (Simbologi & Atribut Spasial WKT siap di-import ke QGIS / ArcGIS)`);
    }
  };

  // Layer toggle handler
  const handleToggleLayer = (id: LayerId | string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  // Basemap switcher
  const handleChangeBasemap = (id: BasemapId) => {
    setActiveBasemap(id);
  };

  // Tool activator
  const handleChangeTool = (tool: GisTool) => {
    setActiveTool(tool);
    // Clear clicked features properties panel when changing tools
    setClickedFeature(null);
  };

  // Reset view to default Banda Aceh Center
  const handleResetView = () => {
    setFlyToCoords([95.319, 5.551]);
  };

  // Reset custom user-added content
  const handleClearDrawings = () => {
    setCustomPins([]);
    setClickedFeature(null);
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === LayerId.SUNGAI ? { ...layer, visible: false } : layer
      )
    );
    alert("Semua Pin Kustom dan hasil pengukuran telah dibersihkan.");
  };

  // Fly to location
  const handleZoomToPin = (coordinates: [number, number]) => {
    setFlyToCoords(coordinates);
  };

  // Add custom pin to database list
  const handleAddCustomPin = (pin: CustomPin) => {
    setCustomPins((prev) => [pin, ...prev]);
  };

  const handleDeleteCustomPin = (id: string) => {
    setCustomPins((prev) => prev.filter((pin) => pin.id !== id));
  };

  // Pointer coordination tracking from map
  const handleUpdatePointer = (lon: number, lat: number) => {
    setPointerCoords({ lon, lat });
  };

  const handleUpdateZoom = (zoom: number) => {
    setZoomLevel(zoom);
  };

  // --- LOCAL FILE GEOJSON UPLOAD IMPLEMENTATION ---
  const handleTriggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith(".zip")) {
      try {
        const geojson = await validateAndParseShapefileZip(file);
        if (geojson && geojson.type === "FeatureCollection") {
          // Determine geometry type
          let layerType: "fill" | "line" | "circle" = "fill";
          const firstFeature = geojson.features?.[0];
          if (firstFeature && firstFeature.geometry) {
            const geomType = firstFeature.geometry.type;
            if (geomType.includes("Polygon")) {
              layerType = "fill";
            } else if (geomType.includes("LineString")) {
              layerType = "line";
            } else if (geomType.includes("Point")) {
              layerType = "circle";
            }
          }

          const newLayerId = `uploaded-${Date.now()}`;
          const newLayer: GisLayer = {
            id: newLayerId,
            name: file.name.replace(/\.[^/.]+$/, ""),
            visible: true,
            type: layerType,
            color: layerType === "fill" ? "#10b981" : layerType === "line" ? "#f59e0b" : "#3b82f6",
            opacity: layerType === "fill" ? 0.35 : 0.85,
            description: `ZIP Shapefile: ${file.name}`,
            count: geojson.features?.length || 0,
            isUploaded: true,
            geojson: geojson
          };

          setLayers((prev) => [...prev, newLayer]);
          setUploadedGeoJSONs((prev) => [...prev, geojson]);
          setIsUploadedVisible(true);

          alert(
            `Berhasil memuat ZIP Shapefile: "${file.name}"\n` +
              `Nama Layer Baru: "${newLayer.name}"\n` +
              `Jumlah Fitur: ${newLayer.count} entitas.`
          );

          // Fly to first coordinate
          if (firstFeature) {
            const coords = getFeatureCenter(firstFeature);
            if (coords) {
              handleZoomToPin(coords);
            }
          }
        } else {
          alert(
            "Format file tidak didukung atau kosong! ZIP wajib berisi file bertipe .shp, .shx, .dbf, dan .prj yang valid."
          );
        }
      } catch (err: any) {
        alert(`Gagal memuat Shapefile dari ZIP: ${err.message || err}`);
      }
    } else if (fileNameLower.endsWith(".geojson") || fileNameLower.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (json.type === "FeatureCollection") {
            // Determine geometry type
            let layerType: "fill" | "line" | "circle" = "fill";
            const firstFeature = json.features?.[0];
            if (firstFeature && firstFeature.geometry) {
              const geomType = firstFeature.geometry.type;
              if (geomType.includes("Polygon")) {
                layerType = "fill";
              } else if (geomType.includes("LineString")) {
                layerType = "line";
              } else if (geomType.includes("Point")) {
                layerType = "circle";
              }
            }

            const newLayerId = `uploaded-${Date.now()}`;
            const newLayer: GisLayer = {
              id: newLayerId,
              name: file.name.replace(/\.[^/.]+$/, ""),
              visible: true,
              type: layerType,
              color: layerType === "fill" ? "#3b82f6" : layerType === "line" ? "#10b981" : "#f59e0b",
              opacity: layerType === "fill" ? 0.35 : 0.85,
              description: `GeoJSON: ${file.name}`,
              count: json.features?.length || 0,
              isUploaded: true,
              geojson: json
            };

            setLayers((prev) => [...prev, newLayer]);
            setUploadedGeoJSONs((prev) => [...prev, json]);
            setIsUploadedVisible(true);

            alert(
              `Berhasil memuat dataset GeoJSON: "${file.name}"\n` +
                `Nama Layer Baru: "${newLayer.name}"\n` +
                `Jumlah Fitur: ${newLayer.count} entitas.`
            );

            // Fly to first coordinate
            if (firstFeature) {
              const coords = getFeatureCenter(firstFeature);
              if (coords) {
                handleZoomToPin(coords);
              }
            }
          } else {
            alert(
              "Format file tidak didukung! File harus berupa GeoJSON valid yang bertipe 'FeatureCollection'."
            );
          }
        } catch (err) {
          alert("Gagal membaca file! Pastikan file adalah JSON yang valid.");
        }
      };
      reader.readAsText(file);
    } else {
      alert("Format file tidak didukung! Pilih file .geojson, .json, atau .zip (Shapefile).");
    }

    // Reset input so upload can trigger again for same file name
    e.target.value = "";
  };

  const handleClearUploaded = () => {
    setUploadedGeoJSONs([]);
    setIsUploadedVisible(false);
    setLayers((prev) => prev.filter((l) => !l.isUploaded));
  };

  // Aggregate total geographic features loaded
  const getTotalFeaturesCount = (): number => {
    let count = layers
      .filter((l) => l.visible)
      .reduce((acc, curr) => acc + curr.count, 0);

    if (isUploadedVisible) {
      uploadedGeoJSONs.forEach((geojson) => {
        count += geojson.features?.length || 0;
      });
    }

    count += customPins.length;
    return count;
  };

  // Get data attributes & table header configurations
  const getAttributeData = () => {
    if (!attributeTableLayerId) return { name: "", features: [], cols: [] };

    let geojson: any = null;
    let name = "";
    let cols: { key: string; label: string }[] = [];

    if (attributeTableLayerId === LayerId.KABUPATEN) {
      geojson = KABUPATEN_DATA;
      name = "Kabupaten / Kecamatan";
      cols = [
        { key: "name", label: "Nama Wilayah" },
        { key: "type", label: "Karakteristik" },
        { key: "area_km2", label: "Luas (km²)" },
        { key: "population", label: "Penduduk (Jiwa)" },
        { key: "density", label: "Kepadatan" }
      ];
    } else if (attributeTableLayerId === LayerId.JALAN) {
      geojson = JALAN_DATA;
      name = "Infrastruktur Jalan";
      cols = [
        { key: "name", label: "Nama Jalan" },
        { key: "type", label: "Tipe Jalan" },
        { key: "class", label: "Klasifikasi" },
        { key: "length_km", label: "Panjang (km)" }
      ];
    } else if (attributeTableLayerId === LayerId.SUNGAI) {
      geojson = SUNGAI_DATA;
      name = "Hidrologi Sungai";
      cols = [
        { key: "name", label: "Nama Sungai" },
        { key: "flow_type", label: "Tipe Aliran" },
        { key: "length_km", label: "Panjang (km)" }
      ];
    } else if (attributeTableLayerId === LayerId.LANDMARK) {
      geojson = LANDMARK_DATA;
      name = "Landmarks (Titik Penting)";
      cols = [
        { key: "name", label: "Nama Landmark" },
        { key: "category", label: "Kategori" },
        { key: "description", label: "Keterangan" }
      ];
    } else {
      const customL = layers.find((l) => l.id === attributeTableLayerId);
      if (customL && customL.isUploaded && customL.geojson) {
        geojson = customL.geojson;
        name = customL.name;
        
        // Auto-extract column headers based on keys in properties
        const keys = new Set<string>();
        geojson.features?.forEach((f: any) => {
          if (f.properties) {
            Object.keys(f.properties).forEach((k) => keys.add(k));
          }
        });
        
        if (keys.size === 0) {
          cols = [{ key: "id", label: "ID Fitur" }];
        } else {
          cols = Array.from(keys).map((k) => ({
            key: k,
            label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ")
          }));
        }
      }
    }

    const features = geojson ? geojson.features : [];
    return { name, features, cols };
  };

  // Extract center coordinates of features based on type
  const getFeatureCenter = (feature: any): [number, number] | null => {
    try {
      const geom = feature.geometry;
      if (!geom) return null;
      if (geom.type === "Point") {
        return geom.coordinates as [number, number];
      } else if (geom.type === "LineString") {
        const midIdx = Math.floor(geom.coordinates.length / 2);
        return geom.coordinates[midIdx] as [number, number];
      } else if (geom.type === "Polygon") {
        const outerRing = geom.coordinates[0];
        if (outerRing && outerRing.length > 0) {
          const midIdx = Math.floor(outerRing.length / 2);
          return outerRing[midIdx] as [number, number];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f172a] font-sans antialiased text-slate-100">
      {/* Hidden Native File Input for geojson loading */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".geojson,.json,.zip,application/json,application/zip,application/x-zip-compressed"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header component */}
      <Header
        currentBasemap={activeBasemap}
        onChangeBasemap={handleChangeBasemap}
        activeTool={activeTool}
        onChangeTool={handleChangeTool}
        onResetView={handleResetView}
        onClearDrawings={handleClearDrawings}
        onTriggerFileUpload={handleTriggerFileUpload}
        onShowStats={() => setShowStatsModal(true)}
        totalCustomPoints={customPins.length}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Body Layout (Sidebar + Map View) */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Sidebar */}
        {isSidebarOpen && (
          <Sidebar
            layers={layers}
            onToggleLayer={handleToggleLayer}
            clickedFeature={clickedFeature}
            onCloseFeatureInfo={() => setClickedFeature(null)}
            customPins={customPins}
            onDeleteCustomPin={handleDeleteCustomPin}
            onZoomToPin={handleZoomToPin}
            uploadedGeoJSONsCount={uploadedGeoJSONs.length}
            isUploadedVisible={isUploadedVisible}
            onToggleUploadedVisibility={() => setIsUploadedVisible(!isUploadedVisible)}
            onClearUploaded={handleClearUploaded}
            onClose={() => setIsSidebarOpen(false)}
            onUpdateLayerColor={handleUpdateLayerColor}
            onUpdateLayerOpacity={handleUpdateLayerOpacity}
            onUpdateLayerIconStyle={handleUpdateLayerIconStyle}
            onUpdateLayerLineStyle={handleUpdateLayerLineStyle}
            onUpdateLayerLineWidth={handleUpdateLayerLineWidth}
            onOpenAttributeTable={handleOpenAttributeTable}
            onExportLayer={handleExportLayer}
            onRemoveLayer={handleRemoveLayer}
          />
        )}

        {/* Map Canvas and mini map */}
        <MapContainer
          layers={layers}
          activeBasemap={activeBasemap}
          activeTool={activeTool}
          onChangeTool={handleChangeTool}
          clickedFeature={clickedFeature}
          onFeatureClick={setClickedFeature}
          customPins={customPins}
          onAddCustomPin={handleAddCustomPin}
          onUpdatePointer={handleUpdatePointer}
          onUpdateZoom={handleUpdateZoom}
          isMapLoaded={isMapLoaded}
          setIsMapLoaded={setIsMapLoaded}
          flyToCoords={flyToCoords}
          onResetFlyTo={() => setFlyToCoords(null)}
          uploadedGeoJSONs={isUploadedVisible ? uploadedGeoJSONs : []}
        />
      </div>

      {/* Footer component */}
      <Footer
        lon={pointerCoords.lon}
        lat={pointerCoords.lat}
        zoom={zoomLevel}
        activeBasemap={activeBasemap}
        totalFeatures={getTotalFeaturesCount()}
        isMapLoaded={isMapLoaded}
      />

      {/* REGIONAL STATISTICS POPUP DIALOG MODAL */}
      {showStatsModal && (
        <div className="absolute inset-0 bg-[#0f172a]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl p-6 w-full max-w-lg text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-[#334155] pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#38bdf8]" />
                <h3 className="font-bold text-base text-slate-100">Analisis Spasial & Statistik Aceh</h3>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto max-h-[400px] pr-1.5 custom-scrollbar">
              {/* Density Statistics bars */}
              <div>
                <p className="font-semibold text-slate-300 mb-2">Kepadatan Penduduk per Kecamatan (jiwa/km²):</p>
                <div className="space-y-3.5 bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
                  {/* Baiturrahman */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="font-medium text-slate-200">Baiturrahman (Pusat Kota)</span>
                      <span className="font-mono text-[#38bdf8] font-semibold">6.872 / km²</span>
                    </div>
                    <div className="h-2 w-full bg-[#0f172a] rounded-full overflow-hidden border border-[#334155]/20">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: "82%" }}></div>
                    </div>
                  </div>
                  {/* Kuta Alam */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="font-medium text-slate-200">Kuta Alam (Bisnis)</span>
                      <span className="font-mono text-[#38bdf8] font-semibold">8.301 / km²</span>
                    </div>
                    <div className="h-2 w-full bg-[#0f172a] rounded-full overflow-hidden border border-[#334155]/20">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: "100%" }}></div>
                    </div>
                  </div>
                  {/* Meuraxa */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="font-medium text-slate-200">Meuraxa (Pesisir)</span>
                      <span className="font-mono text-[#38bdf8] font-semibold">3.415 / km²</span>
                    </div>
                    <div className="h-2 w-full bg-[#0f172a] rounded-full overflow-hidden border border-[#334155]/20">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: "41%" }}></div>
                    </div>
                  </div>
                  {/* Syiah Kuala */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="font-medium text-slate-200">Syiah Kuala (Kampus)</span>
                      <span className="font-mono text-[#38bdf8] font-semibold">3.854 / km²</span>
                    </div>
                    <div className="h-2 w-full bg-[#0f172a] rounded-full overflow-hidden border border-[#334155]/20">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "46%" }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spatial Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-[#1e293b]/60 border border-[#334155] rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Luas Total Area</span>
                  <span className="text-lg font-bold text-white mt-1 block font-sans">30,48 km²</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">Wilayah Banda Aceh</span>
                </div>
                <div className="p-3.5 bg-[#1e293b]/60 border border-[#334155] rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Total Penduduk</span>
                  <span className="text-lg font-bold text-[#38bdf8] mt-1 block font-sans">160.600 jiwa</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">Sensus Penduduk BPS</span>
                </div>
              </div>

              {/* Summary metadata */}
              <div className="p-4 bg-[#38bdf8]/5 border border-[#38bdf8]/20 text-slate-300 rounded-xl space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-[11px] text-[#38bdf8]">
                  <CheckCircle2 className="w-4 h-4 text-[#38bdf8]" />
                  Sistem Informasi Geospasial Aktif
                </p>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  Data spasial yang disajikan adalah koordinat proyeksi geografis asli (WGS 84 / EPSG:4326) yang diperoleh melalui pengumpulan data sekunder untuk riset pemetaan wilayah pesisir Banda Aceh.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#334155]/50">
              <button
                onClick={() => setShowStatsModal(false)}
                className="py-2 px-5 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded-lg text-xs transition-colors"
              >
                Tutup Ringkasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ATTRIBUTE TABLE POPUP DIALOG MODAL */}
      {attributeTableLayerId && (
        (() => {
          const { name: activeLayerName, features: activeFeatures, cols: activeCols } = getAttributeData();
          const filteredFeatures = activeFeatures.filter((feature: any) => {
            if (!attributeSearchQuery) return true;
            const query = attributeSearchQuery.toLowerCase();
            return Object.values(feature.properties || {}).some((val) =>
              String(val).toLowerCase().includes(query)
            );
          });

          return (
            <div className="absolute inset-0 bg-[#0f172a]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
              <div className="bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl p-5 w-full max-w-5xl text-slate-100 flex flex-col gap-3.5 animate-in zoom-in-95 duration-200 h-[80vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center border-b border-[#334155] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Table className="w-5 h-5 text-[#38bdf8]" />
                    <div>
                      <h3 className="font-bold text-sm text-slate-100">Tabel Atribut Spasial</h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Layer: {activeLayerName} • {activeFeatures.length} total fitur</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAttributeTableLayerId(null)}
                    className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search & Export bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1e293b]/40 p-2.5 rounded-lg border border-[#334155]/40 text-xs">
                  <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Cari data atribut..."
                      value={attributeSearchQuery}
                      onChange={(e) => setAttributeSearchQuery(e.target.value)}
                      className="w-full bg-[#0f172a] text-slate-200 pl-8 pr-3 py-1.5 rounded border border-[#334155] text-xs focus:outline-none focus:border-[#38bdf8] transition-colors placeholder:text-slate-500 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      Menampilkan: <strong className="text-[#38bdf8]">{filteredFeatures.length}</strong> dari {activeFeatures.length} baris
                    </span>
                    <div className="h-4 w-px bg-[#334155]"></div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleExportLayer(attributeTableLayerId, "geojson")}
                        className="py-1 px-2.5 bg-[#10b981]/10 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> GeoJSON
                      </button>
                      <button
                        onClick={() => handleExportLayer(attributeTableLayerId, "kml")}
                        className="py-1 px-2.5 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/25 text-[#f59e0b] border border-[#f59e0b]/30 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> KML
                      </button>
                      <button
                        onClick={() => handleExportLayer(attributeTableLayerId, "shp")}
                        className="py-1 px-2.5 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/25 text-[#38bdf8] border border-[#38bdf8]/30 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1"
                        title="Ekspor sebagai SHP (WKT CSV)"
                      >
                        <Download className="w-3 h-3" /> SHP/CSV
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table Data view */}
                <div className="flex-1 overflow-auto border border-[#334155]/30 rounded-lg bg-[#0f172a]/80 custom-scrollbar">
                  {filteredFeatures.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                      <Search className="w-8 h-8 text-slate-600 animate-pulse" />
                      <p className="text-xs font-mono">Tidak ada data atribut yang cocok dengan pencarian.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#1e293b]/85 border-b border-[#334155] text-[10px] uppercase font-mono tracking-wider text-[#38bdf8] sticky top-0 z-10 backdrop-blur-xs">
                          <th className="py-2.5 px-3">No</th>
                          {activeCols.map((col) => (
                            <th key={col.key} className="py-2.5 px-3">{col.label}</th>
                          ))}
                          <th className="py-2.5 px-3 text-center">Aksi Navigasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFeatures.map((feature: any, idx: number) => {
                          const props = feature.properties || {};
                          return (
                            <tr key={idx} className="border-b border-[#334155]/40 hover:bg-[#1e293b]/40 even:bg-[#1e293b]/15 transition-all">
                              <td className="py-2 px-3 font-mono font-semibold text-slate-400">{idx + 1}</td>
                              {activeCols.map((col) => (
                                <td key={col.key} className="py-2 px-3 text-slate-200">
                                  {props[col.key] !== undefined ? String(props[col.key]) : "-"}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-center">
                                {(() => {
                                  const coords = getFeatureCenter(feature);
                                  if (!coords) return <span className="text-slate-500 font-mono text-[10px]">No Geo</span>;
                                  return (
                                    <button
                                      onClick={() => {
                                        handleZoomToPin(coords);
                                        setClickedFeature({
                                          layerName: activeLayerName,
                                          properties: props,
                                          coordinates: coords
                                        });
                                      }}
                                      className="py-1 px-2.5 bg-[#38bdf8]/10 hover:bg-[#38bdf8] hover:text-slate-950 text-[#38bdf8] font-bold rounded text-[10px] font-mono transition-all inline-flex items-center gap-1 shadow-sm border border-[#38bdf8]/20"
                                    >
                                      <Maximize2 className="w-3 h-3" /> Zoom Ke
                                    </button>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer close button */}
                <div className="flex justify-between items-center pt-2.5 border-t border-[#334155]/50 text-[10px] text-[#38bdf8] font-mono font-semibold">
                  <span>Sistem Proyeksi WGS 84 • EPSG:4326</span>
                  <button
                    onClick={() => setAttributeTableLayerId(null)}
                    className="py-1.5 px-4 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded text-xs transition-colors"
                  >
                    Tutup Tabel Atribut
                  </button>
                </div>

              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
