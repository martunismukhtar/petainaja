import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LayerId } from "../types";
import type {
  GisLayer,
  ClickedFeatureInfo,
  CustomPin,
  BasemapId,
  GisTool
} from "../types";
import {
  BANDA_ACEH_CENTER,
  KABUPATEN_DATA,
  JALAN_DATA,
  SUNGAI_DATA,
  LANDMARK_DATA
} from "../data/geojson";
import {
  calculateHaversineDistance,
  generateCircularBufferGeoJSON
} from "../utils/gisUtils";
import {
  Ruler,
  Radio,
  MapPin,
  Maximize2,
  Minimize2,
  Trash2,
  Navigation,
  Plus,
  Minus,
  Printer,
  Download,
  Compass,
  X
} from "lucide-react";

// Basemap JSON Style URL Map
const BASEMAP_STYLES: Record<BasemapId, string> = {
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  "dark-matter": "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
};

interface MapContainerProps {
  layers: GisLayer[];
  activeBasemap: BasemapId;
  activeTool: GisTool;
  onChangeTool: (tool: GisTool) => void;
  clickedFeature: ClickedFeatureInfo | null;
  onFeatureClick: (info: ClickedFeatureInfo | null) => void;
  customPins: CustomPin[];
  onAddCustomPin: (pin: CustomPin) => void;
  onUpdatePointer: (lon: number, lat: number) => void;
  onUpdateZoom: (zoom: number) => void;
  isMapLoaded: boolean;
  setIsMapLoaded: (loaded: boolean) => void;
  flyToCoords: [number, number] | null;
  onResetFlyTo: () => void;
  uploadedGeoJSONs: any[];
  drawingLayerId: string | null;
  onSaveDrawnFeature: (layerId: string, geometry: any, properties?: any) => void;
}

export default function MapContainer({
  layers,
  activeBasemap,
  activeTool,
  onChangeTool,
  clickedFeature,
  onFeatureClick,
  customPins,
  onAddCustomPin,
  onUpdatePointer,
  onUpdateZoom,
  isMapLoaded,
  setIsMapLoaded,
  flyToCoords,
  onResetFlyTo,
  uploadedGeoJSONs,
  drawingLayerId,
  onSaveDrawnFeature
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);

  // Markers arrays to clean up on updates
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);
  const customPinMarkersRef = useRef<maplibregl.Marker[]>([]);

  // GIS Tool States
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [bufferCenter, setBufferCenter] = useState<[number, number] | null>(null);
  const [bufferRadius, setBufferRadius] = useState<number>(1.0); // radius in km

  // Interactive Feature Drawing States
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [sessionFeatures, setSessionFeatures] = useState<any[]>([]);
  const [drawProperties, setDrawProperties] = useState<Record<string, any>>({
    nama: "Fitur Baru",
    keterangan: "Dibuat secara interaktif"
  });

  // Dialog state for adding pin
  const [pinDialogCoords, setPinDialogCoords] = useState<[number, number] | null>(null);
  const [newPinName, setNewPinName] = useState("");
  const [newPinCategory, setNewPinCategory] = useState("Fasilitas");
  const [newPinDesc, setNewPinDesc] = useState("");

  // Map pitch/bearing for 3D navigation
  const [is3DMode, setIs3DMode] = useState(false);

  // Print & Layout States
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printTitle, setPrintTitle] = useState("PETA SPASIAL KOTA BANDA ACEH");
  const [printSubtitle, setPrintSubtitle] = useState("Badan Perencanaan Pembangunan Daerah Kota Banda Aceh");
  const [printPaperSize, setPrintPaperSize] = useState<"A4" | "A3">("A4");
  const [printOrientation, setPrintOrientation] = useState<"landscape" | "portrait">("landscape");
  const [capturedMapUrl, setCapturedMapUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Ref to always reference the freshest state variables inside the map event closures
  const stateRef = useRef({
    drawingLayerId,
    layers,
    activeTool,
    bufferRadius,
    onFeatureClick,
    sessionFeatures
  });

  useEffect(() => {
    stateRef.current = {
      drawingLayerId,
      layers,
      activeTool,
      bufferRadius,
      onFeatureClick,
      sessionFeatures
    };
  }, [drawingLayerId, layers, activeTool, bufferRadius, onFeatureClick, sessionFeatures]);

  // --- 1. INITIALIZE MAIN & MINI MAP ---
  useEffect(() => {
    if (!mapContainerRef.current || !miniMapContainerRef.current) return;

    // Build Main Map
    const mainMap = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLES[activeBasemap],
      center: BANDA_ACEH_CENTER,
      zoom: 13,
      pitch: 0,
      bearing: 0,
      preserveDrawingBuffer: true
    } as any);

    // Build Mini Map (Synchronized static overview)
    const miniMap = new maplibregl.Map({
      container: miniMapContainerRef.current,
      style: BASEMAP_STYLES[activeBasemap],
      center: BANDA_ACEH_CENTER,
      zoom: 9,
      interactive: false,
      attributionControl: false
    });

    mapRef.current = mainMap;
    miniMapRef.current = miniMap;

    // Map Event Listeners
    mainMap.on("load", () => {
      setIsMapLoaded(true);
      onUpdateZoom(mainMap.getZoom());
      addGisSourcesAndLayers(mainMap);
    });

    mainMap.on("style.load", () => {
      // Re-add sources/layers whenever style changes
      if (mainMap.isStyleLoaded()) {
        addGisSourcesAndLayers(mainMap);
      }
    });

    mainMap.on("mousemove", (e) => {
      onUpdatePointer(e.lngLat.lng, e.lngLat.lat);
    });

    mainMap.on("zoom", () => {
      onUpdateZoom(mainMap.getZoom());
    });

    // Synchronize Mini-map center & zoom
    mainMap.on("move", () => {
      const center = mainMap.getCenter();
      miniMap.setCenter(center);
      miniMap.setZoom(Math.max(3, mainMap.getZoom() - 4.5));
    });

    // Main map interaction clicks
    mainMap.on("click", handleMapClick);

    // Mapbox custom scale control
    mainMap.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

    return () => {
      mainMap.remove();
      miniMap.remove();
      mapRef.current = null;
      miniMapRef.current = null;
    };
  }, []);

  // --- 2. SWITCH BASEMAP STYLE ---
  useEffect(() => {
    if (!mapRef.current || !miniMapRef.current) return;
    setIsMapLoaded(false);

    mapRef.current.setStyle(BASEMAP_STYLES[activeBasemap]);
    miniMapRef.current.setStyle(BASEMAP_STYLES[activeBasemap]);

    // When new style is loaded, markers might need to be redrawn
    mapRef.current.once("idle", () => {
      setIsMapLoaded(true);
      renderLandmarkMarkers();
      renderCustomPinMarkers();
    });
  }, [activeBasemap]);

  // --- 3. HANDLE FLY TO EMITTER (FROM SIDEBAR) ---
  useEffect(() => {
    if (!mapRef.current || !flyToCoords) return;
    mapRef.current.flyTo({
      center: flyToCoords,
      zoom: 15.5,
      essential: true,
      duration: 1800,
      pitch: is3DMode ? 45 : 0
    });
    onResetFlyTo();
  }, [flyToCoords]);

  // --- 4. TOGGLE LAYER VISIBILITIES & DYNAMIC STYLING ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // Clean up removed custom layers first
    try {
      const style = map.getStyle();
      if (style) {
        style.layers.forEach((mapL) => {
          if (mapL.id.startsWith("custom-layer-")) {
            const remainder = mapL.id.replace("custom-layer-outline-", "").replace("custom-layer-", "");
            const layerStillExists = layers.some((l) => l.id === remainder);
            if (!layerStillExists) {
              if (map.getLayer(mapL.id)) {
                map.removeLayer(mapL.id);
              }
            }
          }
        });
        Object.keys(style.sources).forEach((sourceKey) => {
          if (sourceKey.startsWith("custom-source-")) {
            const remainder = sourceKey.replace("custom-source-", "");
            const layerStillExists = layers.some((l) => l.id === remainder);
            if (!layerStillExists) {
              if (map.getSource(sourceKey)) {
                map.removeSource(sourceKey);
              }
            }
          }
        });
      }
    } catch (e) {
      console.error("Error cleaning up custom layers:", e);
    }

    layers.forEach((layer) => {
      const isVisible = layer.visible;
      const visibilityValue = isVisible ? "visible" : "none";

      // Kabupaten
      if (layer.id === LayerId.KABUPATEN) {
        if (map.getLayer("kabupaten-layer")) {
          map.setLayoutProperty("kabupaten-layer", "visibility", visibilityValue);
          map.setPaintProperty("kabupaten-layer", "fill-color", layer.color);
          map.setPaintProperty("kabupaten-layer", "fill-opacity", layer.opacity);
        }
        if (map.getLayer("kabupaten-outline")) {
          map.setLayoutProperty("kabupaten-outline", "visibility", visibilityValue);
          map.setPaintProperty("kabupaten-outline", "line-color", layer.color);
          map.setPaintProperty("kabupaten-outline", "line-opacity", layer.opacity);
          
          if (layer.lineStyle === "dashed") {
            map.setPaintProperty("kabupaten-outline", "line-dasharray", [3, 2]);
          } else if (layer.lineStyle === "dotted") {
            map.setPaintProperty("kabupaten-outline", "line-dasharray", [1, 2]);
          } else {
            map.setPaintProperty("kabupaten-outline", "line-dasharray", null);
          }
        }
      }

      // Jalan
      if (layer.id === LayerId.JALAN) {
        if (map.getLayer("jalan-layer")) {
          map.setLayoutProperty("jalan-layer", "visibility", visibilityValue);
          map.setPaintProperty("jalan-layer", "line-color", layer.color);
          map.setPaintProperty("jalan-layer", "line-opacity", layer.opacity);
          map.setPaintProperty("jalan-layer", "line-width", layer.lineWidth || 3);
          
          if (layer.lineStyle === "dashed") {
            map.setPaintProperty("jalan-layer", "line-dasharray", [4, 3]);
          } else if (layer.lineStyle === "dotted") {
            map.setPaintProperty("jalan-layer", "line-dasharray", [1, 2]);
          } else {
            map.setPaintProperty("jalan-layer", "line-dasharray", null);
          }
        }
      }

      // Sungai
      if (layer.id === LayerId.SUNGAI) {
        if (map.getLayer("sungai-layer")) {
          map.setLayoutProperty("sungai-layer", "visibility", visibilityValue);
          map.setPaintProperty("sungai-layer", "line-color", layer.color);
          map.setPaintProperty("sungai-layer", "line-opacity", layer.opacity);
          map.setPaintProperty("sungai-layer", "line-width", layer.lineWidth || 4.5);
          
          if (layer.lineStyle === "dashed") {
            map.setPaintProperty("sungai-layer", "line-dasharray", [4, 3]);
          } else if (layer.lineStyle === "dotted") {
            map.setPaintProperty("sungai-layer", "line-dasharray", [1, 2]);
          } else {
            map.setPaintProperty("sungai-layer", "line-dasharray", null);
          }
        }
      }

      // Landmark Markers Visibility Toggle
      if (layer.id === LayerId.LANDMARK) {
        landmarkMarkersRef.current.forEach((marker) => {
          const el = marker.getElement();
          if (isVisible) {
            el.style.display = "block";
            el.style.opacity = String(layer.opacity);
          } else {
            el.style.display = "none";
          }
        });
      }

      // Dynamic Uploaded Custom Layers
      if (layer.isUploaded) {
        const sourceId = `custom-source-${layer.id}`;
        const mainLayerId = `custom-layer-${layer.id}`;
        const outlineLayerId = `custom-layer-outline-${layer.id}`;

        // Ensure Source and Layer are initialized on the map if they do not exist
        if (layer.geojson && !map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "geojson",
            data: layer.geojson
          });

          if (layer.type === "fill") {
            map.addLayer({
              id: mainLayerId,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": layer.color,
                "fill-opacity": layer.opacity
              }
            });
            map.addLayer({
              id: outlineLayerId,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": layer.color,
                "line-opacity": layer.opacity + 0.2 > 1 ? 1 : layer.opacity + 0.2,
                "line-width": 1.5
              }
            });
          } else if (layer.type === "line") {
            map.addLayer({
              id: mainLayerId,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": layer.color,
                "line-opacity": layer.opacity,
                "line-width": layer.lineWidth || 3
              }
            });
          } else {
            // Circle/Point layer
            map.addLayer({
              id: mainLayerId,
              type: "circle",
              source: sourceId,
              paint: {
                "circle-color": layer.color,
                "circle-opacity": layer.opacity,
                "circle-radius": 6,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1
              }
            });
          }

          // Feature click listener for attributes table popup support on click
          map.on("click", mainLayerId, (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: [mainLayerId] });
            if (features.length > 0) {
              const feat = features[0];
              onFeatureClick({
                layerId: layer.id,
                layerName: layer.name,
                properties: feat.properties || {},
                coordinates: e.lngLat.toArray() as [number, number]
              });
            }
          });

          // Change cursor on hover
          map.on("mouseenter", mainLayerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", mainLayerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }

        // Sync dynamic GeoJSON source data with main layer state edits or newly drawn shapes
        if (layer.geojson && map.getSource(sourceId)) {
          const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          if (existingSource) {
            existingSource.setData(layer.geojson);
          }
        }

        // Apply dynamic styles & visibility updates
        if (map.getLayer(mainLayerId)) {
          map.setLayoutProperty(mainLayerId, "visibility", visibilityValue);
          if (layer.type === "fill") {
            map.setPaintProperty(mainLayerId, "fill-color", layer.color);
            map.setPaintProperty(mainLayerId, "fill-opacity", layer.opacity);
            if (map.getLayer(outlineLayerId)) {
              map.setLayoutProperty(outlineLayerId, "visibility", visibilityValue);
              map.setPaintProperty(outlineLayerId, "line-color", layer.color);
              map.setPaintProperty(outlineLayerId, "line-opacity", layer.opacity + 0.2 > 1 ? 1 : layer.opacity + 0.2);
            }
          } else if (layer.type === "line") {
            map.setPaintProperty(mainLayerId, "line-color", layer.color);
            map.setPaintProperty(mainLayerId, "line-opacity", layer.opacity);
            map.setPaintProperty(mainLayerId, "line-width", layer.lineWidth || 3);
            
            if (layer.lineStyle === "dashed") {
              map.setPaintProperty(mainLayerId, "line-dasharray", [4, 3]);
            } else if (layer.lineStyle === "dotted") {
              map.setPaintProperty(mainLayerId, "line-dasharray", [1, 2]);
            } else {
              map.setPaintProperty(mainLayerId, "line-dasharray", null);
            }
          } else {
            // Circle type
            map.setPaintProperty(mainLayerId, "circle-color", layer.color);
            map.setPaintProperty(mainLayerId, "circle-opacity", layer.opacity);
          }
        }
      }
    });
  }, [layers, isMapLoaded, onFeatureClick]);

  // --- 5. RENDER LANDMARK HTML MARKERS ---
  const renderLandmarkMarkers = () => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    landmarkMarkersRef.current.forEach((m) => m.remove());
    landmarkMarkersRef.current = [];

    const landmarkLayer = layers.find((l) => l.id === LayerId.LANDMARK);
    const isVisible = landmarkLayer?.visible !== false;
    const layerColor = landmarkLayer?.color || "#10b981";
    const layerOpacity = landmarkLayer?.opacity ?? 1.0;
    const iconStyle = landmarkLayer?.iconStyle || "marker";

    LANDMARK_DATA.features.forEach((feature) => {
      const coords = feature.geometry.coordinates as [number, number];
      const props = feature.properties;

      // Create Custom Marker HTML
      const el = document.createElement("div");
      
      let shapeClasses = "";
      let innerHTML = "";

      if (iconStyle === "circle") {
        shapeClasses = "w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-lg cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `<div class="w-2.5 h-2.5 bg-white rounded-full"></div>`;
      } else if (iconStyle === "square") {
        shapeClasses = "w-7 h-7 rounded-lg flex items-center justify-center border-2 border-white shadow-lg cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `<div class="w-2.5 h-2.5 bg-white rounded-sm"></div>`;
      } else if (iconStyle === "star") {
        shapeClasses = "w-8 h-8 flex items-center justify-center cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `
          <svg class="w-8 h-8 filter drop-shadow-md" viewBox="0 0 24 24" fill="${layerColor}">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="white" stroke-width="1.5"/>
          </svg>
        `;
      } else if (iconStyle === "triangle") {
        shapeClasses = "w-8 h-8 flex items-center justify-center cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `
          <svg class="w-8 h-8 filter drop-shadow-md" viewBox="0 0 24 24" fill="${layerColor}">
            <polygon points="12,2 22,22 2,22" stroke="white" stroke-width="2"/>
          </svg>
        `;
      } else { // "marker"
        shapeClasses = "w-8 h-8 flex items-center justify-center cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `
          <svg class="w-8 h-8 filter drop-shadow-md" viewBox="0 0 24 24" fill="${layerColor}">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/>
          </svg>
        `;
      }

      el.className = shapeClasses;
      el.innerHTML = innerHTML;
      if (iconStyle === "circle" || iconStyle === "square") {
        el.style.backgroundColor = layerColor;
      }
      el.style.display = isVisible ? "block" : "none";
      el.style.opacity = String(layerOpacity);

      // Tooltip/label on hover
      const label = document.createElement("div");
      label.className = "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-950 text-white font-sans text-[10px] py-1 px-2 rounded shadow-md border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-semibold";
      label.textContent = props.name;
      el.appendChild(label);

      // Attach click to feature info panel
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onFeatureClick({
          layerName: "Landmarks (Titik Penting)",
          properties: props,
          coordinates: coords
        });
        map.flyTo({ center: coords, zoom: 15, duration: 1000 });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);

      landmarkMarkersRef.current.push(marker);
    });
  };

  // --- 6. RENDER CUSTOM USER PIN MARKERS ---
  const renderCustomPinMarkers = () => {
    const map = mapRef.current;
    if (!map) return;

    customPinMarkersRef.current.forEach((m) => m.remove());
    customPinMarkersRef.current = [];

    customPins.forEach((pin) => {
      const el = document.createElement("div");
      el.className = "w-8 h-8 flex items-center justify-center cursor-pointer transform hover:scale-115 transition-transform relative group";

      // Marker Icon (Red pin teardrop styled)
      el.innerHTML = `
        <svg class="w-7 h-7 text-red-500 filter drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      `;

      // Hover Tooltip
      const label = document.createElement("div");
      label.className = "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 bg-slate-950 text-red-400 font-sans text-[10px] font-bold py-1 px-2 rounded border border-red-900/40 shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50";
      label.textContent = pin.name;
      el.appendChild(label);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onFeatureClick({
          layerName: `Pin Kustom (${pin.category})`,
          properties: {
            name: pin.name,
            kategori: pin.category,
            deskripsi: pin.description,
            latitude: pin.coordinates[1],
            longitude: pin.coordinates[0]
          },
          coordinates: pin.coordinates
        });
        map.flyTo({ center: pin.coordinates, zoom: 15, duration: 1000 });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(pin.coordinates)
        .addTo(map);

      customPinMarkersRef.current.push(marker);
    });
  };

  useEffect(() => {
    if (isMapLoaded) {
      renderLandmarkMarkers();
    }
  }, [layers, isMapLoaded]);

  useEffect(() => {
    if (isMapLoaded) {
      renderCustomPinMarkers();
    }
  }, [customPins, isMapLoaded]);

  // --- 7. EXTERNAL UPLOADED GEOJSON DRAWING ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || uploadedGeoJSONs.length === 0) return;

    // Draw last uploaded geojson
    const latestGeoJSON = uploadedGeoJSONs[uploadedGeoJSONs.length - 1];
    const sourceId = `uploaded-source-${uploadedGeoJSONs.length}`;
    const fillLayerId = `uploaded-layer-fill-${uploadedGeoJSONs.length}`;
    const lineLayerId = `uploaded-layer-line-${uploadedGeoJSONs.length}`;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: latestGeoJSON
      });

      // Render as both transparent fill and outline
      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#10b981",
          "fill-opacity": 0.25
        }
      });

      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#047857",
          "line-width": 2
        }
      });

      // Fly to bounds or first coordinate
      try {
        const firstFeature = latestGeoJSON.features[0];
        if (firstFeature && firstFeature.geometry) {
          const geom = firstFeature.geometry;
          let targetCoords: [number, number] | null = null;
          if (geom.type === "Point") targetCoords = geom.coordinates;
          else if (geom.type === "Polygon") targetCoords = geom.coordinates[0][0];
          else if (geom.type === "LineString") targetCoords = geom.coordinates[0];

          if (targetCoords) {
            map.flyTo({ center: targetCoords, zoom: 12.5 });
          }
        }
      } catch (err) {
        console.error("Fly to uploaded bounds error:", err);
      }
    }
  }, [uploadedGeoJSONs, isMapLoaded]);

  // Clean up uploaded layer on demand
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (uploadedGeoJSONs.length === 0) {
      // Clean up any dynamic uploaded layers from map
      try {
        const style = map.getStyle();
        style.layers.forEach((layer) => {
          if (layer.id.startsWith("uploaded-layer-")) {
            map.removeLayer(layer.id);
          }
        });
        Object.keys(style.sources).forEach((sourceKey) => {
          if (sourceKey.startsWith("uploaded-source-")) {
            map.removeSource(sourceKey);
          }
        });
      } catch (e) {
        // Safe fail
      }
    }
  }, [uploadedGeoJSONs]);

  // --- 8. WEBGL SOURCES & LAYERS SETUP (MAIN MAP) ---
  const addGisSourcesAndLayers = (map: maplibregl.Map) => {
    // 1. Kabupaten Sub-districts Fill & Border
    if (!map.getSource("kabupaten-source")) {
      map.addSource("kabupaten-source", {
        type: "geojson",
        data: KABUPATEN_DATA
      });

      map.addLayer({
        id: "kabupaten-layer",
        type: "fill",
        source: "kabupaten-source",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.22
        }
      });

      map.addLayer({
        id: "kabupaten-outline",
        type: "line",
        source: "kabupaten-source",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.5,
          "line-dasharray": [3, 2]
        }
      });
    }

    // 2. Roads
    if (!map.getSource("jalan-source")) {
      map.addSource("jalan-source", {
        type: "geojson",
        data: JALAN_DATA
      });

      map.addLayer({
        id: "jalan-layer",
        type: "line",
        source: "jalan-source",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3,
          "line-opacity": 0.95
        }
      });
    }

    // 3. Rivers
    if (!map.getSource("sungai-source")) {
      map.addSource("sungai-source", {
        type: "geojson",
        data: SUNGAI_DATA
      });

      map.addLayer({
        id: "sungai-layer",
        type: "line",
        source: "sungai-source",
        paint: {
          "line-color": "#06b6d4",
          "line-width": 4.5,
          "line-opacity": 0.8
        }
      });
    }

    // 4. Spatial Measurement Layer
    if (!map.getSource("measure-line-source")) {
      map.addSource("measure-line-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });

      map.addLayer({
        id: "measure-line-layer",
        type: "line",
        source: "measure-line-source",
        paint: {
          "line-color": "#ef4444",
          "line-width": 3,
          "line-dasharray": [1, 1]
        }
      });

      map.addLayer({
        id: "measure-points-layer",
        type: "circle",
        source: "measure-line-source",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ef4444",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });
    }

    // 5. Buffer Polygon Layer
    if (!map.getSource("buffer-source")) {
      map.addSource("buffer-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });

      map.addLayer({
        id: "buffer-fill-layer",
        type: "fill",
        source: "buffer-source",
        paint: {
          "fill-color": "#10b981",
          "fill-opacity": 0.25
        }
      });

      map.addLayer({
        id: "buffer-outline-layer",
        type: "line",
        source: "buffer-source",
        paint: {
          "line-color": "#047857",
          "line-width": 2
        }
      });
    }

    // 6. Temporary GIS Feature Drawing Layer
    if (!map.getSource("draw-temp-source")) {
      map.addSource("draw-temp-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      });

      // Fill layer (for polygons)
      map.addLayer({
        id: "draw-temp-fill-layer",
        type: "fill",
        source: "draw-temp-source",
        paint: {
          "fill-color": "#e11d48",
          "fill-opacity": 0.3
        },
        filter: ["==", "$type", "Polygon"]
      });

      // Line layer (for line strings and polygon boundaries)
      map.addLayer({
        id: "draw-temp-line-layer",
        type: "line",
        source: "draw-temp-source",
        paint: {
          "line-color": "#e11d48",
          "line-width": 3,
          "line-dasharray": [2, 1]
        },
        filter: ["in", "$type", "LineString", "Polygon"]
      });

      // Circle layer (for points and nodes)
      map.addLayer({
        id: "draw-temp-circle-layer",
        type: "circle",
        source: "draw-temp-source",
        paint: {
          "circle-radius": 6,
          "circle-color": "#e11d48",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });
    }

    // Trigger Initial Markers rendering after WebGL is armed
    renderLandmarkMarkers();
    renderCustomPinMarkers();
  };

  // --- 9. SPATIAL CLICK INTERACTION INTERCEPT ---
  const handleMapClick = (e: maplibregl.MapMouseEvent) => {
    const map = mapRef.current;
    if (!map) return;

    const clickedCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const {
      drawingLayerId: curDrawingLayerId,
      layers: curLayers,
      activeTool: curActiveTool,
      bufferRadius: curBufferRadius,
      onFeatureClick: curOnFeatureClick
    } = stateRef.current;

    // Drawing intercept
    if (curDrawingLayerId) {
      const targetLayer = curLayers.find((l) => l.id === curDrawingLayerId);
      const layerType = targetLayer?.type || "circle";
      
      setDrawPoints((prev) => {
        let updated = [...prev];
        if (layerType === "circle") {
          updated = [clickedCoords];
        } else {
          updated = [...prev, clickedCoords];
        }
        return updated;
      });
      return;
    }

    // A. Add custom pin tool
    if (curActiveTool === "add-custom-pin") {
      setPinDialogCoords(clickedCoords);
      return;
    }

    // B. Measure distance tool
    if (curActiveTool === "measure-distance") {
      setMeasurePoints((prev) => {
        const updated = [...prev, clickedCoords];
        updateMeasurementLayer(updated);
        return updated;
      });
      return;
    }

    // C. Spatial buffer generator tool
    if (curActiveTool === "buffer-generator") {
      setBufferCenter(clickedCoords);
      updateBufferLayer(clickedCoords, curBufferRadius);
      return;
    }

    // D. Default mode: Query vector layers at pixel
    const features = map.queryRenderedFeatures(e.point, {
      layers: ["kabupaten-layer", "jalan-layer", "sungai-layer"]
    });

    if (features.length > 0) {
      const feature = features[0];
      let layerName = "Data Spasial";

      if (feature.layer?.id === "kabupaten-layer") layerName = "Kecamatan (Poligon)";
      else if (feature.layer?.id === "jalan-layer") layerName = "Infrastruktur Jalan (Line)";
      else if (feature.layer?.id === "sungai-layer") layerName = "Hidrologi Sungai (Line)";

      curOnFeatureClick({
        layerName: layerName,
        properties: feature.properties,
        coordinates: clickedCoords
      });
    } else {
      curOnFeatureClick(null);
    }
  };

  // --- 10. REAL-TIME RENDER UPDATES FOR TOOLS ---

  // Update line string representation on map
  const updateMeasurementLayer = (pts: [number, number][]) => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("measure-line-source") as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: any[] = [];

    // Line feature
    if (pts.length > 1) {
      features.push({
        type: "Feature",
        properties: { type: "measure-line" },
        geometry: {
          type: "LineString",
          coordinates: pts
        }
      });
    }

    // Dot features
    pts.forEach((pt) => {
      features.push({
        type: "Feature",
        properties: { type: "measure-node" },
        geometry: {
          type: "Point",
          coordinates: pt
        }
      });
    });

    source.setData({
      type: "FeatureCollection",
      features: features
    });
  };

  // Update dynamic feature drawing visual representation (includes completed session features + currently active path)
  const syncDrawTempSource = (pts: [number, number][], type: string, completed: any[]) => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("draw-temp-source") as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: any[] = [];

    // 1. Add already completed features from this session
    completed.forEach((f) => {
      features.push({
        type: "Feature",
        properties: f.properties || {},
        geometry: f.geometry
      });
    });

    // 2. Add current active feature being drawn
    if (type === "fill" && pts.length >= 3) {
      features.push({
        type: "Feature",
        properties: { isTemp: true },
        geometry: {
          type: "Polygon",
          coordinates: [[...pts, pts[0]]]
        }
      });
    }

    if ((type === "line" || type === "fill") && pts.length >= 2) {
      features.push({
        type: "Feature",
        properties: { isTemp: true },
        geometry: {
          type: "LineString",
          coordinates: pts
        }
      });
    }

    // 3. Add point/circle features for all nodes in active shape (or just standard point if type is circle)
    if (type === "circle") {
      pts.forEach((pt) => {
        features.push({
          type: "Feature",
          properties: { isTemp: true },
          geometry: {
            type: "Point",
            coordinates: pt
          }
        });
      });
    } else {
      // For lines/polygons, draw vertices to assist drawing
      pts.forEach((pt) => {
        features.push({
          type: "Feature",
          properties: { isTempVertex: true },
          geometry: {
            type: "Point",
            coordinates: pt
          }
        });
      });
    }

    source.setData({
      type: "FeatureCollection",
      features: features
    });
  };

  // Keep map drawing source in sync with React state
  useEffect(() => {
    if (drawingLayerId) {
      const targetLayer = layers.find((l) => l.id === drawingLayerId);
      const layerType = targetLayer?.type || "circle";
      syncDrawTempSource(drawPoints, layerType, sessionFeatures);
    } else {
      setDrawPoints([]);
      setSessionFeatures([]);
      const map = mapRef.current;
      if (map) {
        const source = map.getSource("draw-temp-source") as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({ type: "FeatureCollection", features: [] });
        }
      }
    }
  }, [drawPoints, sessionFeatures, drawingLayerId, layers]);

  // Update buffer polygon visual
  const updateBufferLayer = (center: [number, number], rKm: number) => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("buffer-source") as maplibregl.GeoJSONSource;
    if (!source) return;

    const bufferGeoJSON = generateCircularBufferGeoJSON(center, rKm);
    source.setData({
      type: "FeatureCollection",
      features: [bufferGeoJSON]
    });
  };

  // Change buffer radius slider
  const handleBufferRadiusChange = (radius: number) => {
    setBufferRadius(radius);
    if (bufferCenter) {
      updateBufferLayer(bufferCenter, radius);
    }
  };

  // Calculate cumulative measured distance
  const getMeasuredDistance = (): number => {
    if (measurePoints.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      total += calculateHaversineDistance(measurePoints[i], measurePoints[i + 1]);
    }
    return total;
  };

  // Clear current active tools graphics
  const handleClearToolGraphics = () => {
    setMeasurePoints([]);
    setBufferCenter(null);
    updateMeasurementLayer([]);

    const map = mapRef.current;
    if (map) {
      const bufSource = map.getSource("buffer-source") as maplibregl.GeoJSONSource;
      if (bufSource) {
        bufSource.setData({ type: "FeatureCollection", features: [] });
      }
    }
  };

  useEffect(() => {
    // Clear graphics if user exits tool
    if (activeTool === "none") {
      handleClearToolGraphics();
    }
  }, [activeTool]);

  // Submit custom pin
  const handleSavePin = () => {
    if (!newPinName || !pinDialogCoords) return;

    onAddCustomPin({
      id: `pin_${Date.now()}`,
      name: newPinName,
      category: newPinCategory,
      coordinates: pinDialogCoords,
      description: newPinDesc || "Tidak ada deskripsi tambahan"
    });

    // Reset fields & close dialog
    setNewPinName("");
    setNewPinCategory("Fasilitas");
    setNewPinDesc("");
    setPinDialogCoords(null);
  };

  // Capture map and open print/export dialog
  const handleCaptureMap = () => {
    setIsCapturing(true);
    const map = mapRef.current;
    if (!map) {
      setIsCapturing(false);
      return;
    }

    try {
      const canvas = map.getCanvas();
      const dataUrl = canvas.toDataURL("image/png");
      setCapturedMapUrl(dataUrl);
      setPrintDialogOpen(true);
    } catch (err) {
      console.error("Gagal menangkap kanvas peta:", err);
      alert("Gagal menangkap gambar peta. Silakan gerakkan atau geser peta sedikit, lalu coba lagi.");
    } finally {
      setIsCapturing(false);
    }
  };

  // Download raw captured map image as PNG
  const handleDownloadMapPNG = () => {
    if (!capturedMapUrl) return;
    const link = document.createElement("a");
    link.download = `peta_banda_aceh_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = capturedMapUrl;
    link.click();
  };

  const isPortrait = printOrientation === "portrait";
  const paperWidth = printPaperSize === "A4" 
    ? (isPortrait ? "210mm" : "297mm") 
    : (isPortrait ? "297mm" : "420mm");
  const paperHeight = printPaperSize === "A4" 
    ? (isPortrait ? "297mm" : "210mm") 
    : (isPortrait ? "420mm" : "594mm");

  // Camera 3D controls toggle
  const handleToggle3D = () => {
    const map = mapRef.current;
    if (!map) return;

    if (is3DMode) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      setIs3DMode(false);
    } else {
      map.easeTo({ pitch: 55, bearing: -15, duration: 1000 });
      setIs3DMode(true);
    }
  };

  return (
    <div className="flex-1 h-full relative bg-[#0f172a] flex flex-col overflow-hidden">
      {/* 1. Main Map Canvas Container */}
      <div id="main-map" ref={mapContainerRef} className="w-full h-full flex-1 relative z-0" />

      {/* 2. Synchronized Mini Map Container (Requirements Spec: Mini Map) */}
      <div
        id="mini-map-box"
        className="absolute bottom-5 right-5 w-40 h-40 sm:w-48 sm:h-48 rounded-xl border-2 border-[#334155] bg-[#0f172a] shadow-2xl z-35 overflow-hidden transition-all duration-300 hover:scale-105 hover:border-[#38bdf8] group"
      >
        <div className="absolute top-0 left-0 right-0 bg-[#0f172a]/95 text-[9px] font-mono font-bold tracking-widest text-slate-300 py-1.5 px-2.5 z-40 border-b border-[#334155] flex items-center justify-between">
          <span>MINI MAP OVERVIEW</span>
          <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full animate-ping"></span>
        </div>
        <div ref={miniMapContainerRef} className="w-full h-full" />
        {/* Reticle / Scope representation in minimap center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-45">
          <div className="w-6 h-6 border-2 border-[#38bdf8] rounded-full opacity-60"></div>
          <div className="absolute w-3 h-0.5 bg-[#38bdf8] opacity-85"></div>
          <div className="absolute w-0.5 h-3 bg-[#38bdf8] opacity-85"></div>
        </div>
      </div>

      {/* 3. Floating Tool Panels & HUDs */}

      {/* Map Control Buttons (Layer Pitch, Zoom) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
        <button
          onClick={handleCaptureMap}
          disabled={isCapturing}
          className="p-2.5 rounded-lg border shadow-lg font-sans text-xs flex items-center justify-center gap-1.5 transition-all bg-[#0f172a] border-[#334155] text-slate-300 hover:bg-[#1e293b] hover:text-white disabled:opacity-50 cursor-pointer"
          title="Cetak dan Ekspor Tata Letak Peta (Kop Kartografi)"
        >
          <Printer className="w-4 h-4 text-[#38bdf8]" />
          <span className="font-bold text-[11px]">CETAK PETA</span>
        </button>

        <button
          onClick={handleToggle3D}
          className={`p-2.5 rounded-lg border shadow-lg font-sans text-xs flex items-center justify-center gap-1.5 transition-all ${
            is3DMode
              ? "bg-[#38bdf8] border-[#38bdf8] text-slate-950 font-bold"
              : "bg-[#0f172a] border-[#334155] text-slate-300 hover:bg-[#1e293b] hover:text-white"
          }`}
          title="Ganti Sudut Pandang 3D"
        >
          <Navigation className={`w-4 h-4 transition-transform duration-500 ${is3DMode ? "rotate-45" : ""}`} />
          <span className="font-bold text-[11px]">{is3DMode ? "2D" : "3D VIEW"}</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col rounded-lg bg-[#0f172a] border border-[#334155] shadow-lg overflow-hidden">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="p-2.5 text-slate-300 hover:text-white hover:bg-[#1e293b] transition-colors border-b border-[#334155]"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="p-2.5 text-slate-300 hover:text-white hover:bg-[#1e293b] transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Measure HUD Panel (Active when tool is measure-distance) */}
      {activeTool === "measure-distance" && (
        <div className="absolute bottom-5 left-5 bg-[#0f172a]/95 text-slate-100 p-4 rounded-xl border border-[#334155] shadow-2xl z-30 max-w-xs animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 border-b border-[#334155] pb-2.5 mb-3">
            <div className="bg-[#38bdf8]/10 text-[#38bdf8] p-1.5 rounded border border-[#38bdf8]/20">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs">Ukur Jarak Spasial</h3>
              <p className="text-[10px] text-slate-400 font-mono">Haversine formula</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <p className="text-[11px] text-slate-300 bg-[#1e293b]/80 p-2 rounded border border-[#334155]">
              💡 <span className="font-semibold text-slate-200">Petunjuk:</span> Klik berurutan pada peta untuk menarik garis ukur.
            </p>

            <div className="p-2 bg-[#1e293b]/50 rounded border border-[#334155]">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Jumlah Titik</span>
              <p className="font-bold text-[#38bdf8] mt-0.5 font-mono">{measurePoints.length} Titik Koordinat</p>
            </div>

            <div className="p-2 bg-[#1e293b]/50 rounded border border-[#334155]">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Total Jarak Linier</span>
              <p className="font-extrabold text-base text-amber-400 mt-0.5 font-mono">
                {getMeasuredDistance().toFixed(3)} <span className="text-xs font-semibold text-slate-400">km</span>
              </p>
              <p className="text-[9px] text-slate-500 font-mono">
                ≈ {(getMeasuredDistance() * 1000).toFixed(0)} meter
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClearToolGraphics}
                className="flex-1 py-1.5 px-3 bg-[#1e293b] hover:bg-[#334155] text-slate-300 font-bold rounded-lg text-[10px] border border-[#334155] transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset Garis
              </button>
              <button
                onClick={() => onChangeTool("none")}
                className="flex-1 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg text-[10px] border border-red-500/20 transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buffer Generator Slider Panel */}
      {activeTool === "buffer-generator" && (
        <div className="absolute bottom-5 left-5 bg-[#0f172a]/95 text-slate-100 p-4 rounded-xl border border-[#334155] shadow-2xl z-30 w-72 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 border-b border-[#334155] pb-2.5 mb-3">
            <div className="bg-[#38bdf8]/10 text-[#38bdf8] p-1.5 rounded border border-[#38bdf8]/20">
              <Radio className="w-4 h-4 animate-ping" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-[#38bdf8]">Generator Buffer Spasial</h3>
              <p className="text-[10px] text-slate-400 font-mono">Area circle overlay</p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <p className="text-[11px] text-slate-300 bg-[#1e293b]/80 p-2 rounded border border-[#334155]">
              📍 <span className="font-semibold text-slate-200">Petunjuk:</span> Klik di mana saja pada peta untuk menggambar area penyangga melingkar.
            </p>

            {/* Slider control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-400 uppercase tracking-wider">Radius Buffer</span>
                <span className="text-[#38bdf8] font-bold bg-[#1e293b] px-1.5 py-0.5 rounded border border-[#334155]">
                  {bufferRadius.toFixed(1)} km
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="5.0"
                step="0.1"
                value={bufferRadius}
                onChange={(e) => handleBufferRadiusChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>0.2 km</span>
                <span>2.5 km</span>
                <span>5.0 km</span>
              </div>
            </div>

            {bufferCenter && (
              <div className="p-2 bg-[#1e293b]/50 rounded border border-[#334155] text-[10px] font-mono">
                <span className="text-slate-500 uppercase tracking-wider">Titik Pusat Buffer</span>
                <p className="text-[#38bdf8] mt-0.5 truncate font-semibold">
                  Lon: {bufferCenter[0].toFixed(5)} | Lat: {bufferCenter[1].toFixed(5)}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClearToolGraphics}
                className="flex-1 py-1.5 px-3 bg-[#1e293b] hover:bg-[#334155] text-slate-300 font-bold rounded-lg text-[10px] border border-[#334155] transition-colors"
              >
                Hapus Buffer
              </button>
              <button
                onClick={() => onChangeTool("none")}
                className="flex-1 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg text-[10px] border border-red-500/20 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PIN CREATION POPUP DIALOG */}
      {pinDialogCoords && (
        <div className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl p-5 w-full max-w-sm text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-[#334155] pb-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-500 animate-bounce" />
                <h3 className="font-bold text-sm text-slate-100">Tambah Penanda Kustom</h3>
              </div>
              <button
                onClick={() => setPinDialogCoords(null)}
                className="text-slate-400 hover:text-white font-bold text-xs hover:bg-[#1e293b] px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Nama Pin / Landmark
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kedai Kopi Ulee Lheue"
                  value={newPinName}
                  onChange={(e) => setNewPinName(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-md py-1.5 px-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#38bdf8] transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Kategori
                </label>
                <select
                  value={newPinCategory}
                  onChange={(e) => setNewPinCategory(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-md py-1.5 px-3 text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-colors"
                >
                  <option value="Fasilitas">Fasilitas Publik</option>
                  <option value="Kuliner">Kuliner / Cafe</option>
                  <option value="Sejarah">Sejarah & Wisata</option>
                  <option value="Kedaruratan">Pos Kedaruratan</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Deskripsi Singkat
                </label>
                <textarea
                  placeholder="Keterangan pendukung untuk titik kustom ini..."
                  value={newPinDesc}
                  onChange={(e) => setNewPinDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-md py-1.5 px-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#38bdf8] transition-colors resize-none"
                />
              </div>

              <div className="bg-[#1e293b] p-2.5 rounded border border-[#334155] font-mono text-[10px] text-slate-400">
                <span className="uppercase font-bold block text-[8px] tracking-wider mb-1 text-slate-500">Koordinat Terpilih</span>
                <p className="text-slate-300">Lon: {pinDialogCoords[0].toFixed(6)}</p>
                <p className="text-slate-300">Lat: {pinDialogCoords[1].toFixed(6)}</p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setPinDialogCoords(null)}
                className="flex-1 py-2 bg-[#1e293b] hover:bg-[#334155] text-slate-300 font-bold rounded-lg text-xs border border-[#334155] transition-all"
              >
                Batalkan
              </button>
              <button
                onClick={handleSavePin}
                disabled={!newPinName}
                className="flex-1 py-2 bg-[#38bdf8] hover:bg-[#0ea5e9] disabled:opacity-40 disabled:hover:bg-[#38bdf8] text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md"
              >
                Simpan Penanda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. FLOATING FEATURE DRAWING OVERLAY */}
      {drawingLayerId && (() => {
        const targetLayer = layers.find((l) => l.id === drawingLayerId);
        const layerType = targetLayer?.type || "circle";
        
        // Validation for the current active geometry
        const isValidActiveShape = 
          (layerType === "circle" && drawPoints.length === 1) ||
          (layerType === "line" && drawPoints.length >= 2) ||
          (layerType === "fill" && drawPoints.length >= 3);

        const handleAddActiveToList = () => {
          if (!isValidActiveShape) return;
          
          let geom: any = null;
          if (layerType === "circle") {
            geom = {
              type: "Point",
              coordinates: drawPoints[0]
            };
          } else if (layerType === "line") {
            geom = {
              type: "LineString",
              coordinates: drawPoints
            };
          } else if (layerType === "fill") {
            geom = {
              type: "Polygon",
              coordinates: [[...drawPoints, drawPoints[0]]]
            };
          }

          if (geom) {
            setSessionFeatures((prev) => [
              ...prev,
              { geometry: geom, properties: { ...drawProperties } }
            ]);
            // Clear current drawing point & reset name
            setDrawPoints([]);
            setDrawProperties({
              nama: `Objek Baru ${sessionFeatures.length + 2}`,
              keterangan: "Dibuat secara interaktif"
            });
          }
        };

        const handleSaveAllAndClose = () => {
          let finalFeatures = [...sessionFeatures];
          
          // Automatically append active shape if it is valid
          if (isValidActiveShape) {
            let geom: any = null;
            if (layerType === "circle") {
              geom = { type: "Point", coordinates: drawPoints[0] };
            } else if (layerType === "line") {
              geom = { type: "LineString", coordinates: drawPoints };
            } else if (layerType === "fill") {
              geom = { type: "Polygon", coordinates: [[...drawPoints, drawPoints[0]]] };
            }
            if (geom) {
              finalFeatures.push({ geometry: geom, properties: { ...drawProperties } });
            }
          }

          if (finalFeatures.length === 0) {
            alert("Silakan gambar dan tambahkan minimal 1 objek terlebih dahulu!");
            return;
          }

          onSaveDrawnFeature(drawingLayerId, finalFeatures);
          setDrawPoints([]);
          setSessionFeatures([]);
          setDrawProperties({ nama: "Fitur Baru", keterangan: "Dibuat secara interaktif" });
        };

        return (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0f172a]/95 border-2 border-red-500 rounded-xl shadow-2xl p-4 z-40 w-full max-w-lg text-slate-100 flex flex-col gap-3 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs">
            <div className="flex justify-between items-center border-b border-[#334155] pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <h4 className="font-bold text-xs text-slate-100 font-mono tracking-wide uppercase">
                  Mode Menggambar Multi: {targetLayer?.name || "Layer Kustom"}
                </h4>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {drawPoints.length} Titik Aktif | {sessionFeatures.length} Sesi Terkumpul
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
              💡 <strong>Panduan:</strong> Klik peta untuk menggambar ({layerType === "fill" ? "Poligon" : layerType === "line" ? "Garis" : "Titik"}). Klik <strong>"+ Tambah Ke Sesi"</strong> untuk menampung objek, lalu buat objek berikutnya. Jika selesai, klik <strong>"Simpan Semua"</strong>.
            </p>

            {/* Form to set attributes for the current active feature */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-[#1e293b]/40 p-2.5 rounded-lg border border-[#334155]/50">
              <div className="col-span-2 text-[10px] text-red-400 font-bold uppercase font-mono tracking-wider mb-0.5 flex justify-between">
                <span>Atribut Objek Aktif</span>
                <span className="text-slate-400 font-normal normal-case">
                  ({drawPoints.length} koordinat)
                </span>
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1 font-mono">
                  Nama Fitur
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Titik Pos Pantau"
                  value={drawProperties.nama}
                  onChange={(e) => setDrawProperties((prev) => ({ ...prev, nama: e.target.value }))}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-500 transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1 font-mono">
                  Keterangan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kondisi Baik"
                  value={drawProperties.keterangan || ""}
                  onChange={(e) => setDrawProperties((prev) => ({ ...prev, keterangan: e.target.value }))}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-500 transition-all font-mono"
                />
              </div>

              {/* Action to add the active drawing to the session list */}
              <div className="col-span-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddActiveToList}
                  disabled={!isValidActiveShape}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold font-mono rounded text-[10px] transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  ➕ Tambah Objek Ke Sesi ({sessionFeatures.length + 1})
                </button>
              </div>
            </div>

            {/* List of features added to the temporary session */}
            {sessionFeatures.length > 0 && (
              <div className="flex flex-col gap-1.5 bg-[#0f172a] p-2.5 rounded-lg border border-[#334155]">
                <div className="text-[9px] text-slate-400 font-bold uppercase font-mono tracking-wider">
                  Daftar Objek Sementara Di Sesi ({sessionFeatures.length})
                </div>
                <div className="max-h-24 overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-thin">
                  {sessionFeatures.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-[#1e293b]/70 px-2 py-1.5 rounded border border-[#334155]/60 text-[10px]"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-200 truncate font-mono">
                          {idx + 1}. {f.properties.nama}
                        </span>
                        <span className="text-[9px] text-slate-400 truncate max-w-[280px]">
                          {f.properties.keterangan || "-"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessionFeatures((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 rounded transition-all cursor-pointer flex items-center justify-center"
                        title="Hapus objek ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1 border-t border-[#334155]/60">
              <button
                type="button"
                onClick={() => {
                  setDrawPoints([]);
                  setSessionFeatures([]);
                  setDrawProperties({ nama: "Fitur Baru", keterangan: "Dibuat secara interaktif" });
                  onSaveDrawnFeature(drawingLayerId, null, null);
                }}
                className="flex-1 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-slate-300 font-bold font-mono rounded text-[10px] border border-[#334155] transition-all cursor-pointer"
              >
                Batalkan
              </button>
              
              {drawPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawPoints([]);
                  }}
                  className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold font-mono rounded text-[10px] border border-amber-500/20 transition-all cursor-pointer"
                >
                  Reset Aktif
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveAllAndClose}
                disabled={sessionFeatures.length === 0 && !isValidActiveShape}
                className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-500 text-white font-bold font-mono rounded text-[10px] transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
              >
                💾 Simpan Semua ({sessionFeatures.length + (isValidActiveShape ? 1 : 0)})
              </button>
            </div>
          </div>
        );
      })()}

      {/* 6. PRINT AND EXPORT MAP LAYOUT MODAL */}
      {printDialogOpen && capturedMapUrl && (
        <div className="fixed inset-0 bg-slate-950/98 z-50 flex flex-col md:flex-row p-4 gap-4 overflow-y-auto animate-in fade-in duration-300">
          {/* Print Style Injector */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Hide everything else on the page */
              body, html, #root {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: 100% !important;
                overflow: visible !important;
              }
              body * {
                visibility: hidden !important;
              }
              #print-layout-paper, #print-layout-paper * {
                visibility: visible !important;
              }
              #print-layout-paper {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: ${paperWidth} !important;
                height: ${paperHeight} !important;
                margin: 0 !important;
                padding: 1.2cm !important;
                box-shadow: none !important;
                border: 4px double black !important;
                background-color: white !important;
                color: black !important;
                z-index: 9999999 !important;
                box-sizing: border-box !important;
                display: flex !important;
              }
              @page {
                size: ${printPaperSize.toLowerCase()} ${printOrientation.toLowerCase()};
                margin: 0;
              }
            }
          `}} />

          {/* Left panel: Control settings */}
          <div className="w-full md:w-80 bg-[#0f172a] border border-[#334155] rounded-xl p-4 flex flex-col gap-4 text-slate-200 shrink-0 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#334155] pb-2">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#38bdf8]" />
                <h3 className="font-bold text-sm tracking-wide text-slate-100 font-mono">LAYOUT CETAK</h3>
              </div>
              <button
                onClick={() => setPrintDialogOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/80 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title options */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                  Judul Utama Peta
                </label>
                <input
                  type="text"
                  value={printTitle}
                  onChange={(e) => setPrintTitle(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                  placeholder="Contoh: PETA KERAWANAN BANJIR"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                  Sub-Judul / Instansi
                </label>
                <input
                  type="text"
                  value={printSubtitle}
                  onChange={(e) => setPrintSubtitle(e.target.value)}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                  placeholder="Contoh: Bappeda Kota Banda Aceh"
                />
              </div>

              {/* Paper size selection */}
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                  Ukuran Kertas
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <button
                    onClick={() => setPrintPaperSize("A4")}
                    className={`py-1.5 rounded border transition-all cursor-pointer ${
                      printPaperSize === "A4"
                        ? "bg-[#38bdf8]/10 border-[#38bdf8] text-[#38bdf8] font-bold"
                        : "bg-[#1e293b] border-[#334155] text-slate-400 hover:text-white"
                    }`}
                  >
                    Kertas A4
                  </button>
                  <button
                    onClick={() => setPrintPaperSize("A3")}
                    className={`py-1.5 rounded border transition-all cursor-pointer ${
                      printPaperSize === "A3"
                        ? "bg-[#38bdf8]/10 border-[#38bdf8] text-[#38bdf8] font-bold"
                        : "bg-[#1e293b] border-[#334155] text-slate-400 hover:text-white"
                    }`}
                  >
                    Kertas A3 (Besar)
                  </button>
                </div>
              </div>

              {/* Orientation selection */}
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                  Orientasi Halaman
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <button
                    onClick={() => setPrintOrientation("landscape")}
                    className={`py-1.5 rounded border transition-all cursor-pointer ${
                      printOrientation === "landscape"
                        ? "bg-[#38bdf8]/10 border-[#38bdf8] text-[#38bdf8] font-bold"
                        : "bg-[#1e293b] border-[#334155] text-slate-400 hover:text-white"
                    }`}
                  >
                    Landscape
                  </button>
                  <button
                    onClick={() => setPrintOrientation("portrait")}
                    className={`py-1.5 rounded border transition-all cursor-pointer ${
                      printOrientation === "portrait"
                        ? "bg-[#38bdf8]/10 border-[#38bdf8] text-[#38bdf8] font-bold"
                        : "bg-[#1e293b] border-[#334155] text-slate-400 hover:text-white"
                    }`}
                  >
                    Portrait
                  </button>
                </div>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[#334155]">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono rounded-lg text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20"
              >
                <Printer className="w-4 h-4" />
                Cetak ke PDF / Printer
              </button>

              <button
                onClick={handleDownloadMapPNG}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-[#334155] font-bold font-mono rounded-lg text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Unduh Gambar Peta (PNG)
              </button>

              <button
                onClick={() => setPrintDialogOpen(false)}
                className="w-full py-2 bg-[#1e293b] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent font-bold font-mono rounded-lg text-xs transition-all cursor-pointer"
              >
                Kembali ke Aplikasi
              </button>
            </div>
          </div>

          {/* Right panel: Layout Preview Frame */}
          <div className="flex-1 flex justify-center items-center p-4 bg-slate-900 border border-[#334155] rounded-xl overflow-hidden min-h-[500px]">
            <div className="w-full max-w-4xl max-h-[85vh] overflow-auto flex items-center justify-center p-4 scrollbar-thin">
              {/* This mimics the paper. Handled nicely with aspect ratio constraints */}
              <div
                id="print-layout-paper"
                className={`bg-white text-black p-6 border-4 border-double border-black shadow-2xl flex ${
                  printOrientation === "portrait" ? "flex-col" : "flex-row"
                } gap-4 w-full ${
                  printOrientation === "landscape" ? "aspect-[1.414]" : "aspect-[0.707]"
                }`}
                style={{
                  maxHeight: "80vh",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              >
                {/* A. MAP FRAME SECTION */}
                <div className="flex-[3] border-2 border-black relative flex items-center justify-center overflow-hidden bg-slate-50">
                  <img
                    src={capturedMapUrl}
                    alt="Peta Spasial"
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Grid or Scale ticks overlay inside map frame for decoration */}
                  <div className="absolute top-2 left-2 bg-white/80 border border-black px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-tight rounded pointer-events-none select-none text-black">
                    SISTEM PROYEKSI: UTM ZONE 46N
                  </div>
                  <div className="absolute bottom-2 right-2 bg-white/80 border border-black px-2 py-1 text-[9px] font-mono font-bold rounded pointer-events-none select-none text-black">
                    Skala: Grafis Terlampir
                  </div>
                </div>

                {/* B. KOP KARTOGRAFI SECTION (Title block & legend) */}
                {printOrientation === "landscape" ? (
                  /* Vertical Kop Layout for Landscape Orientation */
                  <div className="flex-[1] border-2 border-black p-3.5 flex flex-col justify-between text-black bg-white select-none overflow-hidden max-w-[280px]">
                    <div className="flex flex-col gap-2.5">
                      {/* Logo & Agency Info */}
                      <div className="text-center border-b-2 border-black pb-2 flex flex-col items-center justify-center gap-1">
                        <div className="w-9 h-9 border border-black flex items-center justify-center rounded bg-slate-100 font-bold text-xs">
                          SIG
                        </div>
                        <div className="leading-tight">
                          <h4 className="font-sans font-extrabold text-[9px] tracking-wider">PEMERINTAH KOTA</h4>
                          <h4 className="font-sans font-extrabold text-[10px] tracking-wider uppercase">BANDA ACEH</h4>
                          <p className="text-[7px] text-slate-600 font-medium font-mono leading-none mt-0.5">Provinsi Aceh, Indonesia</p>
                        </div>
                      </div>

                      {/* Map Title & Subtitle block */}
                      <div className="border-b-2 border-black pb-2">
                        <h2 className="font-sans font-extrabold text-xs tracking-wide uppercase leading-tight text-center">
                          {printTitle || "PETA SPASIAL KOTA"}
                        </h2>
                        <p className="text-[8px] font-mono mt-1 text-center font-medium leading-normal text-slate-700">
                          {printSubtitle || "Badan Perencanaan Pembangunan Daerah"}
                        </p>
                      </div>

                      {/* Compass Block */}
                      <div className="border-b-2 border-black pb-2.5 flex justify-center items-center gap-4 py-1">
                        <div className="flex flex-col items-center">
                          <Compass className="w-8 h-8 text-black" />
                          <span className="text-[7px] font-bold mt-0.5 font-mono">NORTH / UTARA</span>
                        </div>
                        <div className="text-left font-mono leading-normal text-[8px]">
                          <div>Sistem Grid: Geografis</div>
                          <div>Spheroid: WGS 84</div>
                          <div>Zona Proyeksi: 46N</div>
                        </div>
                      </div>

                      {/* Dynamic Legend Block */}
                      <div className="flex flex-col gap-1.5">
                        <h5 className="font-bold text-[9px] uppercase font-mono tracking-wider border-b border-slate-300 pb-0.5">LEGENDA PETA</h5>
                        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {/* Standard Layers */}
                          <div className="flex items-center gap-2 text-[9px]">
                            <div className="w-4 h-2.5 border border-black bg-emerald-500/10" />
                            <span className="font-mono text-[8px] leading-tight">Batas Administrasi Kecamatan</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px]">
                            <div className="w-4 h-0.5 bg-red-500" />
                            <span className="font-mono text-[8px] leading-tight">Jaringan Jalan Utama</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px]">
                            <div className="w-4 h-0.5 bg-blue-500" />
                            <span className="font-mono text-[8px] leading-tight">Hidrologi Aliran Sungai</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px]">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-black" />
                            <span className="font-mono text-[8px] leading-tight">Titik Landmark & Fasilitas</span>
                          </div>

                          {/* Dynamic Active Layers from Application */}
                          {layers.filter(l => l.visible).map((l) => (
                            <div key={l.id} className="flex items-center gap-2 text-[9px]">
                              {l.type === "fill" && (
                                <div className="w-4 h-2.5 border border-black" style={{ backgroundColor: l.color || "#94a3b8" }} />
                              )}
                              {l.type === "line" && (
                                <div className="w-4 h-0.5" style={{ backgroundColor: l.color || "#ef4444" }} />
                              )}
                              {l.type === "circle" && (
                                <div className="w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: l.color || "#3b82f6" }} />
                              )}
                              <span className="font-mono text-[8px] truncate leading-tight capitalize">{l.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer metadata block */}
                    <div className="border-t-2 border-black pt-2 text-[7px] font-mono text-slate-500 flex flex-col gap-0.5">
                      <div>Pembuat: Portal SIG Web Banda Aceh</div>
                      <div>Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                      <div className="font-bold text-[6px] tracking-wider uppercase border-t border-slate-200 mt-1 pt-0.5">KARTOGRAFER INDONESIA</div>
                    </div>
                  </div>
                ) : (
                  /* Horizontal Kop Layout for Portrait Orientation */
                  <div className="border-2 border-black p-3 flex flex-row justify-between gap-4 text-black bg-white select-none text-left">
                    {/* Col 1: Logo, Title & Subtitle */}
                    <div className="flex-1 flex flex-col gap-1.5 pr-2 border-r border-slate-300">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
                        <div className="w-7 h-7 border border-black flex items-center justify-center rounded bg-slate-100 font-bold text-[10px]">
                          SIG
                        </div>
                        <div className="leading-tight">
                          <h4 className="font-sans font-extrabold text-[8px] uppercase tracking-wider leading-none">PEMERINTAH KOTA</h4>
                          <h4 className="font-sans font-extrabold text-[9px] uppercase tracking-wider leading-tight">BANDA ACEH</h4>
                        </div>
                      </div>
                      <h2 className="font-sans font-extrabold text-[10px] tracking-wide uppercase leading-tight">
                        {printTitle || "PETA SPASIAL KOTA"}
                      </h2>
                      <p className="text-[7px] font-mono leading-tight text-slate-700">
                        {printSubtitle || "Badan Perencanaan Pembangunan Daerah"}
                      </p>
                    </div>

                    {/* Col 2: Legend Panel */}
                    <div className="flex-1 px-2 border-r border-slate-300 flex flex-col gap-1">
                      <h5 className="font-bold text-[8px] uppercase font-mono tracking-wider border-b border-slate-300 pb-0.5">LEGENDA</h5>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-[70px] overflow-y-auto pr-1">
                        <div className="flex items-center gap-1 text-[8px]">
                          <div className="w-3 h-2 border border-black bg-emerald-500/10 shrink-0" />
                          <span className="font-mono text-[7px] leading-tight truncate">Batas Kecamatan</span>
                        </div>
                        <div className="flex items-center gap-1 text-[8px]">
                          <div className="w-3 h-0.5 bg-red-500 shrink-0" />
                          <span className="font-mono text-[7px] leading-tight truncate">Jalan Kota</span>
                        </div>
                        <div className="flex items-center gap-1 text-[8px]">
                          <div className="w-3 h-0.5 bg-blue-500 shrink-0" />
                          <span className="font-mono text-[7px] leading-tight truncate">Aliran Sungai</span>
                        </div>
                        <div className="flex items-center gap-1 text-[8px]">
                          <div className="w-2 h-2 rounded-full bg-amber-500 border border-black shrink-0" />
                          <span className="font-mono text-[7px] leading-tight truncate">Landmark Kota</span>
                        </div>

                        {layers.filter(l => l.visible).map((l) => (
                          <div key={l.id} className="flex items-center gap-1 text-[8px]">
                            {l.type === "fill" && (
                              <div className="w-3 h-2 border border-black shrink-0" style={{ backgroundColor: l.color || "#94a3b8" }} />
                            )}
                            {l.type === "line" && (
                              <div className="w-3 h-0.5 shrink-0" style={{ backgroundColor: l.color || "#ef4444" }} />
                            )}
                            {l.type === "circle" && (
                              <div className="w-2 h-2 rounded-full border border-black shrink-0" style={{ backgroundColor: l.color || "#3b82f6" }} />
                            )}
                            <span className="font-mono text-[7px] truncate leading-tight capitalize shrink-0">{l.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Col 3: Compass, Scale, Metadata */}
                    <div className="flex-1 pl-2 flex flex-row items-center justify-between gap-2">
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <Compass className="w-7 h-7 text-black" />
                        <span className="text-[6px] font-bold mt-0.5 font-mono">NORTH / UTARA</span>
                      </div>
                      <div className="text-[7px] font-mono leading-snug text-slate-600 flex flex-col justify-center min-w-0">
                        <div className="truncate">Datum: WGS 84 / UTM 46N</div>
                        <div className="truncate">Sumber: Bappeda Banda Aceh</div>
                        <div className="truncate font-bold text-[6px] text-black border-t border-slate-200 mt-0.5 pt-0.5">
                          TGL: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
