import React, { useState, useRef, useEffect } from "react";
import { LayerId } from "../types";
import type {
  GisLayer,
  ClickedFeatureInfo,  
  BasemapId,
  GisTool,
  EditingFeature
} from "../types";
import {
  KABUPATEN_DATA,
  JALAN_DATA,
  SUNGAI_DATA,
  LANDMARK_DATA
} from "../data/geojson";
import {
  geojsonToKml,
  geojsonToWktCsv,
  downloadFile
} from "../utils/exportUtils";
import { validateAndParseShapefileZip } from "../utils/shapefileParser";
import { parseCsvToGeoJson, parseKmlToGeoJson } from "../utils/csvKmlParser";
import {
  mergePolygons,
  mergeLines,
  dissolveFeatures,
  splitPolygon,
  splitLine,
} from "../utils/gisOperations";

const INITIAL_LAYERS: GisLayer[] = [];

export function useAppLogic() {
  // --- CORE STATE ---
  const [layers, setLayers] = useState<GisLayer[]>(() => {
    return INITIAL_LAYERS.map(layer => {
      return { ...layer };
    });
  });
  const [editingFeature, setEditingFeature] = useState<EditingFeature | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>("voyager");
  const [activeTool, setActiveTool] = useState<GisTool>("none");
  const [clickedFeature, setClickedFeature] = useState<ClickedFeatureInfo | null>(null);  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(window.innerWidth >= 768);

  // Automatically index all layer features with _feature_index whenever the layers state changes
  useEffect(() => {
    let changed = false;
    const nextLayers = layers.map((layer) => {
      if (!layer.geojson || !layer.geojson.features) return layer;

      let needsIndexing = false;
      const features = layer.geojson.features.map((f: any, idx: number) => {
        if (!f?.properties || f.properties._feature_index !== idx) {
          needsIndexing = true;
          return {
            ...f,
            properties: {
              ...(f?.properties || {}),
              _feature_index: idx
            }
          };
        }
        return f;
      });

      if (needsIndexing) {
        changed = true;
        return {
          ...layer,
          geojson: {
            ...layer.geojson,
            features
          }
        };
      }
      return layer;
    });

    if (changed) {
      setLayers(nextLayers);
    }
  }, [layers]);

  // Auto-hide sidebar on mobile screens on mount and handle resize (hanya jika lebar viewport berubah, menghindari bug keyboard virtual mobile)
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth !== lastWidth) {
        lastWidth = currentWidth;
        if (currentWidth < 768) {
          setIsSidebarOpen(false);
        } else {
          setIsSidebarOpen(true);
        }
      }
    };
    // Set initial state
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
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
  const [drawingLayerId, setDrawingLayerId] = useState<string | null>(null);

  // UI Control Modals
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [attributeTableLayerId, setAttributeTableLayerId] = useState<LayerId | string | null>(null);
  const [attributeSearchQuery, setAttributeSearchQuery] = useState<string>("");
  const [newColInputName, setNewColInputName] = useState<string>("");

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACTIONS & HANDLERS ---

  const handleUpdateLayerColor = (id: LayerId | string, color: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, color } : l))
    );
  };

  const handleUpdateColorClassification = (
    id: LayerId | string,
    classification: { enabled: boolean; columnName?: string; rules: Record<string, string> } | undefined
  ) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, colorClassification: classification } : l))
    );
  };

  const handleUpdateLayerOpacity = (id: LayerId | string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
  };

  const handleUpdateLayerIconStyle = (
    id: LayerId | string,
    iconStyle: "circle" | "square" | "star" | "triangle" | "marker"
  ) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, iconStyle } : l))
    );
  };

  const handleUpdateLayerLineStyle = (
    id: LayerId | string,
    lineStyle: "solid" | "dashed" | "dotted"
  ) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, lineStyle } : l))
    );
  };

  const handleUpdateLayerLineWidth = (id: LayerId | string, lineWidth: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, lineWidth } : l))
    );
  };

  const handleRenameLayer = (id: string, name: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name } : l))
    );
  };

  const handleUpdateWmsParams = (id: LayerId | string, wmsUrl: string, wmsLayers: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, wmsUrl, wmsLayers } : l))
    );
  };

  const handleOpenAttributeTable = (id: LayerId | string) => {
    setAttributeTableLayerId(id);
    setAttributeSearchQuery("");
  };

  const handleRemoveLayer = (id: LayerId | string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setUploadedGeoJSONs((prev: any) => {
      // Clean up the corresponding uploadedGeoJSON if we find it
      const layerIndex = layers.findIndex((l) => l.id === id);
      const isUploadedCount = layers.filter((l, idx) => l.isUploaded && idx < layerIndex).length;
      return prev.filter((_: any, idx: number) => idx !== isUploadedCount);
    });
  };

  const handleCreateLayer = (name: string, type: "fill" | "line" | "circle", color: string) => {
    const newId = `custom-layer-${Date.now()}`;
    const newLayer: GisLayer = {
      id: newId,
      name: name,
      visible: true,
      type: type,
      color: color,
      opacity: type === "fill" ? 0.35 : 0.85,
      description: `Layer kustom baru tipe ${type}`,
      count: 0,
      isUploaded: true,
      customColumns: ["nama", "keterangan"],
      geojson: {
        type: "FeatureCollection",
        features: []
      }
    };
    setLayers((prev) => [...prev, newLayer]);
  };

  const handleCreateWmsLayer = (name: string, url: string, layersParam: string) => {
    const newWmsId = `wms-layer-${Date.now()}`;
    const newLayer: GisLayer = {
      id: newWmsId,
      name: name,
      visible: true,
      type: "wms",
      color: "#ffffff",
      opacity: 0.8,
      description: `WMS Raster Layer dari server: ${url}`,
      wmsUrl: url,
      wmsLayers: layersParam,
      count: 0
    };
    setLayers((prev) => [...prev, newLayer]);
  };

  const handleCreateVectorTileLayer = (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => {
    const newVtId = `vt-layer-${Date.now()}`;
    const newLayer: GisLayer = {
      id: newVtId,
      name: name,
      visible: true,
      type: "vector-tile",
      color: color,
      opacity: geomType === "fill" ? 0.35 : 0.85,
      description: `Vector Tile Layer: ${url}`,
      vectorTileUrl: url,
      vectorTileLayers: layersParam,
      vectorTileGeomType: geomType,
      count: 0
    };
    setLayers((prev) => [...prev, newLayer]);
  };

  const handleCreatePmtilesLayer = (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => {
    const newPmId = `pm-layer-${Date.now()}`;
    const newLayer: GisLayer = {
      id: newPmId,
      name: name,
      visible: true,
      type: "pmbtiles",
      color: color,
      opacity: geomType === "fill" ? 0.35 : 0.85,
      description: `PMTiles Layer: ${url}`,
      pmtilesUrl: url,
      pmtilesLayers: layersParam,
      pmtilesGeomType: geomType,
      count: 0
    };
    setLayers((prev) => [...prev, newLayer]);
  };

  const handleEditFeature = (layerId: string, featureIndex: number, geometry: any, properties: any) => {
    setEditingFeature({
      layerId,
      featureIndex,
      geometry,
      properties
    });
  };

  const handleCancelEditing = () => {
    setEditingFeature(null);
  };

  const handleSaveEditedFeature = (layerId: string, featureIndex: number, geometry: any, properties: any) => {
    setLayers((prev) => prev.map((layer) => {
      if (layer.id === layerId && layer.geojson) {
        const updatedFeatures = [...layer.geojson.features];
        if (featureIndex >= 0 && featureIndex < updatedFeatures.length) {
          updatedFeatures[featureIndex] = {
            ...updatedFeatures[featureIndex],
            geometry,
            properties: {
              ...updatedFeatures[featureIndex].properties,
              ...properties
            }
          };
        }
        return {
          ...layer,
          geojson: {
            ...layer.geojson,
            features: updatedFeatures
          }
        };
      }
      return layer;
    }));
    setEditingFeature(null);
    setClickedFeature(null);
  };

  const handleStartDrawing = (layerId: string) => {
    if (drawingLayerId === layerId) {
      setDrawingLayerId(null);
    } else {
      setDrawingLayerId(layerId);
      // Ensure the drawing layer is visible on the map
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, visible: true } : l))
      );
      // Deactivate other spatial analysis tools
      setActiveTool("none");
      // Otomatis sembunyikan sidebar saat mulai menggambar fitur baru
      setIsSidebarOpen(false);
    }
  };

  const handleSaveDrawnFeature = (layerId: string | null, geometryOrFeatures: any, properties?: any) => {
    if (!layerId || !geometryOrFeatures) {
      setDrawingLayerId(null);
      return;
    }
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          
          let newFeatures: any[] = [];
          if (Array.isArray(geometryOrFeatures)) {
            newFeatures = geometryOrFeatures.map((f) => ({
              type: "Feature",
              geometry: f.geometry,
              properties: f.properties || {}
            }));
          } else {
            newFeatures = [{
              type: "Feature",
              geometry: geometryOrFeatures,
              properties: properties || {}
            }];
          }

          const updatedFeatures = [...(currentGeoJSON.features || []), ...newFeatures];
          return {
            ...l,
            count: updatedFeatures.length,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );
    setDrawingLayerId(null);
  };

  const handleAddColumn = (layerId: string | LayerId, colName: string) => {
    const cleanKey = colName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!cleanKey) return;
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const updatedFeatures = (currentGeoJSON.features || []).map((f: any) => ({
            ...f,
            properties: {
              ...f.properties,
              [cleanKey]: f.properties?.[cleanKey] !== undefined ? f.properties[cleanKey] : ""
            }
          }));
          const currentCols = l.customColumns || ["nama", "keterangan"];
          const updatedCols = currentCols.includes(cleanKey) ? currentCols : [...currentCols, cleanKey];
          return {
            ...l,
            customColumns: updatedCols,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );
  };

  const handleDeleteColumn = (layerId: string | LayerId, colKey: string) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const updatedFeatures = (currentGeoJSON.features || []).map((f: any) => {
            const props = { ...f.properties };
            delete props[colKey];
            return {
              ...f,
              properties: props
            };
          });
          const currentCols = l.customColumns || ["nama", "keterangan"];
          const updatedCols = currentCols.filter((k) => k !== colKey);
          return {
            ...l,
            customColumns: updatedCols,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );
  };

  const handleUpdateAttribute = (layerId: string | LayerId, featureIndex: number, key: string, value: any) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const updatedFeatures = (currentGeoJSON.features || []).map((f: any, idx: number) => {
            if (idx === featureIndex) {
              return {
                ...f,
                properties: {
                  ...f.properties,
                  [key]: value
                }
              };
            }
            return f;
          });
          return {
            ...l,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );
  };

  const handleDeleteFeature = (layerId: string | LayerId, featureIndex: number) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const updatedFeatures = (currentGeoJSON.features || []).filter((_: any, idx: number) => idx !== featureIndex);
          return {
            ...l,
            count: updatedFeatures.length,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );

    // Reset or shift clickedFeature if the deleted feature was active
    setClickedFeature((prev) => {
      if (!prev || prev.layerId !== layerId) return prev;
      if (prev.featureIndex === featureIndex) {
        return null; // Deleted the currently clicked feature
      }
      if (prev.featureIndex !== undefined && prev.featureIndex > featureIndex) {
        return {
          ...prev,
          featureIndex: prev.featureIndex - 1 // Shift index down
        };
      }
      return prev;
    });
  };

  const handleUpdateFeatureProperties = (layerId: string, featureIndex: number, properties: Record<string, any>) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const updatedFeatures = [...(currentGeoJSON.features || [])];
          if (featureIndex >= 0 && featureIndex < updatedFeatures.length) {
            updatedFeatures[featureIndex] = {
              ...updatedFeatures[featureIndex],
              properties: {
                ...properties
              }
            };
          }
          return {
            ...l,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );

    // Sync clickedFeature properties so the UI stays up-to-date
    setClickedFeature((prev) => {
      if (prev && prev.layerId === layerId && prev.featureIndex === featureIndex) {
        return {
          ...prev,
          properties: {
            ...properties
          }
        };
      }
      return prev;
    });
  };

  const handleMergeFeatures = (layerId: string, featureIndexes: number[]) => {
    if (!featureIndexes || featureIndexes.length < 2) {
      alert("Pilih minimal 2 fitur untuk digabungkan!");
      return;
    }

    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const features = currentGeoJSON.features || [];
          
          // Separate selected features to merge and other features
          const toMerge = features.filter((_: any, idx: number) => featureIndexes.includes(idx));
          const others = features.filter((_: any, idx: number) => !featureIndexes.includes(idx));

          if (toMerge.length < 2) return l;

          let mergedFeature: any = null;
          const isPolygon = toMerge.some((f: any) => f.geometry?.type?.includes("Polygon"));
          
          if (isPolygon) {
            mergedFeature = mergePolygons(toMerge);
          } else {
            mergedFeature = mergeLines(toMerge);
          }

          if (!mergedFeature) {
            alert("Gagal menggabungkan fitur. Pastikan tipe geometri cocok (hanya Polygon atau LineString).");
            return l;
          }

          const updatedFeatures = [...others, mergedFeature];
          return {
            ...l,
            count: updatedFeatures.length,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );
    setClickedFeature(null);
  };

  const handleDissolveLayer = (layerId: string, propertyName?: string) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const dissolvedGeoJSON = dissolveFeatures(currentGeoJSON, propertyName || undefined);
          
          return {
            ...l,
            count: dissolvedGeoJSON.features?.length || 0,
            geojson: dissolvedGeoJSON
          };
        }
        return l;
      })
    );
    setClickedFeature(null);
  };

  const handleSplitFeature = (layerId: string, featureIndex: number, cutterCoords: [number, number][]) => {
    if (!cutterCoords || cutterCoords.length < 2) {
      alert("Garis pemotong tidak valid atau terlalu pendek!");
      return;
    }

    const targetLayer = layers.find((l) => l.id === layerId);
    if (!targetLayer || !targetLayer.geojson) {
      alert("Layer tidak ditemukan!");
      return;
    }

    const features = targetLayer.geojson.features || [];
    if (featureIndex === undefined || featureIndex < 0 || featureIndex >= features.length) {
      alert("Fitur tidak ditemukan!");
      return;
    }

    const targetFeature = features[featureIndex];
    if (!targetFeature || !targetFeature.geometry) {
      alert("Geometri fitur tidak valid!");
      return;
    }

    const lineFeature = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: cutterCoords
      },
      properties: {}
    };

    let splitResults: any[] = [];
    if (targetFeature.geometry?.type?.includes("Polygon")) {
      splitResults = splitPolygon(targetFeature, lineFeature);
    } else if (targetFeature.geometry?.type?.includes("Line")) {
      splitResults = splitLine(targetFeature, lineFeature);
    } else {
      alert("Hanya fitur Polygon atau LineString yang dapat dipotong!");
      return;
    }

    // If result only has 1 feature and it's equal to original, it means no intersection occurred
    if (splitResults.length <= 1) {
      alert("Garis pemotong tidak memotong fitur yang dipilih! Pastikan garis memotong melintasi batas fitur.");
      return;
    }

    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const currentGeoJSON = l.geojson || { type: "FeatureCollection", features: [] };
          const others = (currentGeoJSON.features || []).filter((_: any, idx: number) => idx !== featureIndex);
          const updatedFeatures = [...others, ...splitResults];

          return {
            ...l,
            count: updatedFeatures.length,
            geojson: {
              ...currentGeoJSON,
              features: updatedFeatures
            }
          };
        }
        return l;
      })
    );

    setClickedFeature(null);
  };

  const handleExportLayer = (id: LayerId | string, format: "shp" | "kml" | "geojson") => {
    // Get corresponding data
    let geojson: any = null;
    let name = "layer";
    const layerFromState = layers.find((l) => l.id === id);

    if (id === LayerId.KABUPATEN) {
      geojson = layerFromState?.geojson || KABUPATEN_DATA;
      name = "Kabupaten_Banda_Aceh";
    } else if (id === LayerId.JALAN) {
      geojson = layerFromState?.geojson || JALAN_DATA;
      name = "Infrastruktur_Jalan_Aceh";
    } else if (id === LayerId.SUNGAI) {
      geojson = layerFromState?.geojson || SUNGAI_DATA;
      name = "Hidrologi_Sungai_Aceh";
    } else if (id === LayerId.LANDMARK) {
      geojson = layerFromState?.geojson || LANDMARK_DATA;
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
    if (tool === "split-geometry") {
      setIsSidebarOpen(false);
    }
  };

  // Reset custom user-added content
  const handleClearDrawings = () => {    
    setClickedFeature(null);
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === LayerId.SUNGAI ? { ...layer, visible: false } : layer
      )
    );
    alert("Semua Pin Kustom dan hasil pengukuran telah dibersihkan.");
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
    } else if (fileNameLower.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const geojson = parseCsvToGeoJson(event.target?.result as string);
          if (geojson && geojson.type === "FeatureCollection") {
            const newLayerId = `uploaded-${Date.now()}`;
            const newLayer: GisLayer = {
              id: newLayerId,
              name: file.name.replace(/\.[^/.]+$/, ""),
              visible: true,
              type: "circle",
              color: "#f59e0b",
              opacity: 0.85,
              description: `CSV: ${file.name}`,
              count: geojson.features?.length || 0,
              isUploaded: true,
              geojson: geojson
            };

            setLayers((prev) => [...prev, newLayer]);
            setUploadedGeoJSONs((prev) => [...prev, geojson]);
            setIsUploadedVisible(true);

            alert(
              `Berhasil memuat dataset CSV: "${file.name}"\n` +
                `Nama Layer Baru: "${newLayer.name}"\n` +
                `Jumlah Fitur: ${newLayer.count} entitas.`
            );
          }
        } catch (err: any) {
          alert(`Gagal membaca file CSV: ${err.message || err}`);
        }
      };
      reader.readAsText(file);
    } else if (fileNameLower.endsWith(".kml")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const geojson = parseKmlToGeoJson(event.target?.result as string);
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
              color: layerType === "fill" ? "#ec4899" : layerType === "line" ? "#a855f7" : "#06b6d4",
              opacity: layerType === "fill" ? 0.35 : 0.85,
              description: `KML: ${file.name}`,
              count: geojson.features?.length || 0,
              isUploaded: true,
              geojson: geojson
            };

            setLayers((prev) => [...prev, newLayer]);
            setUploadedGeoJSONs((prev) => [...prev, geojson]);
            setIsUploadedVisible(true);

            alert(
              `Berhasil memuat dataset KML: "${file.name}"\n` +
                `Nama Layer Baru: "${newLayer.name}"\n` +
                `Jumlah Fitur: ${newLayer.count} entitas.`
            );
          }
        } catch (err: any) {
          alert(`Gagal membaca file KML: ${err.message || err}`);
        }
      };
      reader.readAsText(file);
    } else {
      alert("Format file tidak didukung! Pilih file .geojson, .json, .csv, .kml, atau .zip (Shapefile).");
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
    
    return count;
  };

  // Get data attributes & table header configurations
  const getAttributeData = () => {
    if (!attributeTableLayerId) return { name: "", features: [], cols: [] };

    let geojson: any = null;
    let name = "";
    let cols: { key: string; label: string }[] = [];
    const layerFromState = layers.find((l) => l.id === attributeTableLayerId);

    if (attributeTableLayerId === LayerId.KABUPATEN) {
      geojson = layerFromState?.geojson || KABUPATEN_DATA;
      name = "Kabupaten / Kecamatan";
      cols = [
        { key: "name", label: "Nama Wilayah" },
        { key: "type", label: "Karakteristik" },
        { key: "area_km2", label: "Luas (km²)" },
        { key: "population", label: "Penduduk (Jiwa)" },
        { key: "density", label: "Kepadatan" }
      ];
    } else if (attributeTableLayerId === LayerId.JALAN) {
      geojson = layerFromState?.geojson || JALAN_DATA;
      name = "Infrastruktur Jalan";
      cols = [
        { key: "name", label: "Nama Jalan" },
        { key: "type", label: "Tipe Jalan" },
        { key: "class", label: "Klasifikasi" },
        { key: "length_km", label: "Panjang (km)" }
      ];
    } else if (attributeTableLayerId === LayerId.SUNGAI) {
      geojson = layerFromState?.geojson || SUNGAI_DATA;
      name = "Hidrologi Sungai";
      cols = [
        { key: "name", label: "Nama Sungai" },
        { key: "flow_type", label: "Tipe Aliran" },
        { key: "length_km", label: "Panjang (km)" }
      ];
    } else if (attributeTableLayerId === LayerId.LANDMARK) {
      geojson = layerFromState?.geojson || LANDMARK_DATA;
      name = "Landmarks (Titik Penting)";
      cols = [
        { key: "name", label: "Nama Landmark" },
        { key: "category", label: "Kategori" },
        { key: "description", label: "Keterangan" }
      ];
    } else {
      const customL = layers.find((l) => l.id === attributeTableLayerId);
      if (customL && customL.isUploaded) {
        geojson = customL.geojson || { type: "FeatureCollection", features: [] };
        name = customL.name;
        
        // Auto-extract column headers based on keys in properties AND customColumns
        const keys = new Set<string>();
        if (customL.customColumns) {
          customL.customColumns.forEach((k) => keys.add(k));
        }
        geojson.features?.forEach((f: any) => {
          if (f.properties) {
            Object.keys(f.properties).forEach((k) => keys.add(k));
          }
        });
        
        if (keys.size === 0) {
          cols = [
            { key: "nama", label: "Nama" },
            { key: "keterangan", label: "Keterangan" }
          ];
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

  return {
    layers,
    setLayers,
    editingFeature,
    setEditingFeature,
    activeBasemap,
    setActiveBasemap,
    activeTool,
    setActiveTool,
    clickedFeature,
    setClickedFeature,
    isSidebarOpen,
    setIsSidebarOpen,
    pointerCoords,
    setPointerCoords,
    zoomLevel,
    setZoomLevel,
    isMapLoaded,
    setIsMapLoaded,
    flyToCoords,
    setFlyToCoords,
    uploadedGeoJSONs,
    setUploadedGeoJSONs,
    isUploadedVisible,
    setIsUploadedVisible,
    drawingLayerId,
    setDrawingLayerId,
    showStatsModal,
    setShowStatsModal,
    attributeTableLayerId,
    setAttributeTableLayerId,
    attributeSearchQuery,
    setAttributeSearchQuery,
    newColInputName,
    setNewColInputName,
    fileInputRef,

    // Actions
    handleUpdateLayerColor,
    handleUpdateColorClassification,
    handleUpdateLayerOpacity,
    handleUpdateLayerIconStyle,
    handleUpdateLayerLineStyle,
    handleUpdateLayerLineWidth,
    handleRenameLayer,
    handleUpdateWmsParams,
    handleOpenAttributeTable,
    handleRemoveLayer,
    handleCreateLayer,
    handleCreateWmsLayer,
    handleCreateVectorTileLayer,
    handleCreatePmtilesLayer,
    handleEditFeature,
    handleCancelEditing,
    handleSaveEditedFeature,
    handleStartDrawing,
    handleSaveDrawnFeature,
    handleAddColumn,
    handleDeleteColumn,
    handleUpdateAttribute,
    handleDeleteFeature,
    handleUpdateFeatureProperties,
    handleMergeFeatures,
    handleDissolveLayer,
    handleSplitFeature,
    handleExportLayer,
    handleToggleLayer,
    handleChangeBasemap,
    handleChangeTool,
    handleClearDrawings,
    handleUpdatePointer,
    handleUpdateZoom,
    handleTriggerFileUpload,
    handleFileChange,
    handleClearUploaded,
    getTotalFeaturesCount,
    getAttributeData,
    getFeatureCenter
  };
}
