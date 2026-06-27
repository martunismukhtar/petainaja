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
  Minus
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
  uploadedGeoJSONs
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

  // Dialog state for adding pin
  const [pinDialogCoords, setPinDialogCoords] = useState<[number, number] | null>(null);
  const [newPinName, setNewPinName] = useState("");
  const [newPinCategory, setNewPinCategory] = useState("Fasilitas");
  const [newPinDesc, setNewPinDesc] = useState("");

  // Map pitch/bearing for 3D navigation
  const [is3DMode, setIs3DMode] = useState(false);

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
      bearing: 0
    });

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
    });
  }, [layers, isMapLoaded]);

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

    // Trigger Initial Markers rendering after WebGL is armed
    renderLandmarkMarkers();
    renderCustomPinMarkers();
  };

  // --- 9. SPATIAL CLICK INTERACTION INTERCEPT ---
  const handleMapClick = (e: maplibregl.MapMouseEvent) => {
    const map = mapRef.current;
    if (!map) return;

    const clickedCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    // A. Add custom pin tool
    if (activeTool === "add-custom-pin") {
      setPinDialogCoords(clickedCoords);
      return;
    }

    // B. Measure distance tool
    if (activeTool === "measure-distance") {
      setMeasurePoints((prev) => {
        const updated = [...prev, clickedCoords];
        updateMeasurementLayer(updated);
        return updated;
      });
      return;
    }

    // C. Spatial buffer generator tool
    if (activeTool === "buffer-generator") {
      setBufferCenter(clickedCoords);
      updateBufferLayer(clickedCoords, bufferRadius);
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

      onFeatureClick({
        layerName: layerName,
        properties: feature.properties,
        coordinates: clickedCoords
      });
    } else {
      onFeatureClick(null);
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
    </div>
  );
}
