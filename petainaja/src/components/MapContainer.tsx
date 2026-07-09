import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LayerId } from "../types";
import type {
  GisLayer,
  ClickedFeatureInfo,
  BasemapId,
  GisTool,
} from "../types";
import {
  BANDA_ACEH_CENTER,
  KABUPATEN_DATA,
  JALAN_DATA,
  SUNGAI_DATA,
  // LANDMARK_DATA,
} from "../data/geojson";
import {
  calculateHaversineDistance,
  generateCircularBufferGeoJSON,
} from "../utils/gisUtils";
import { findClickedFeatureIndex } from "../utils/gisOperations";
import {
  Ruler,
  Radio,
  MapPin,
  Trash2,
  Printer,  
  X,
  Type,
  Square,
  Slash,
  Image as ImageIcon,
  Locate,
  Eye,
  EyeOff,
  Scissors,
} from "lucide-react";

export interface PrintLayoutElement {
  id: string;
  type: "text" | "line" | "rectangle" | "image";
  x: number; // percentage from left, 0 - 100
  y: number; // percentage from top, 0 - 100
  width?: number; // width in px
  height?: number; // height in px
  content?: string; // for text
  imageUrl?: string; // for image
  fontSize?: number; // for text
  fontColor?: string; // for text
  lineWidth?: number; // for line thickness
  lineColor?: string; // for line
  rotation?: number; // for line/image rotation in degrees
  rectFillColor?: string; // for rectangle
  rectBorderColor?: string; // for rectangle
  rectBorderWidth?: number; // for rectangle
}

const CLASSIC_NORTH_ARROW =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 5 L75 80 L50 65 L25 80 Z' fill='black'/><path d='M50 5 L50 65 L25 80 Z' fill='%23ccc'/><text x='50' y='98' font-family='sans-serif' font-size='18' font-weight='bold' text-anchor='middle' fill='black'>U</text></svg>";

const MODERN_NORTH_ARROW =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' stroke='black' Width='2' fill='none'/><path d='M50 15 L58 50 L50 45 L42 50 Z' fill='black'/><path d='M50 85 L58 50 L50 55 L42 50 Z' fill='%23777'/><text x='50' y='12' font-family='sans-serif' font-size='14' font-weight='bold' text-anchor='middle' fill='black'>U</text></svg>";

// Basemap JSON Style URL Map
const BASEMAP_STYLES: Record<BasemapId, string> = {
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  "dark-matter":
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

interface MapContainerProps {
  layers: GisLayer[];
  activeBasemap: BasemapId;
  activeTool: GisTool;
  onChangeTool: (tool: GisTool) => void;
  clickedFeature: ClickedFeatureInfo | null;
  onFeatureClick: (info: ClickedFeatureInfo | null) => void;
  onUpdatePointer: (lon: number, lat: number) => void;
  onUpdateZoom: (zoom: number) => void;
  isMapLoaded: boolean;
  setIsMapLoaded: (loaded: boolean) => void;
  flyToCoords: [number, number] | null;
  onResetFlyTo: () => void;
  uploadedGeoJSONs: any[];
  drawingLayerId: string | null;
  onSaveDrawnFeature: (
    layerId: string,
    geometry: any,
    properties?: any,
  ) => void;
  editingFeature?: any | null;
  onSaveEditedFeature?: (
    layerId: string,
    featureIndex: number,
    updatedGeometry: any,
    updatedProperties: any,
  ) => void;
  onCancelEditing?: () => void;
  onSplitFeature?: (
    layerId: string,
    featureIndex: number,
    cutterCoords: [number, number][],
  ) => void;
}

export interface EditPart {
  id: string;
  label: string;
  coords: [number, number][];
  type: "exterior" | "interior" | "line" | "point";
  polyIndex?: number;
  ringIndex?: number;
}

function getSqDist(p: [number, number], w: [number, number]) {
  return (p[0] - w[0]) ** 2 + (p[1] - w[1]) ** 2;
}

function distToSegmentSquared(
  p: [number, number],
  v: [number, number],
  w: [number, number],
) {
  const l2 = getSqDist(v, w);
  if (l2 === 0) return getSqDist(p, v);
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return getSqDist(p, [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])]);
}

function distToSegment(
  p: [number, number],
  v: [number, number],
  w: [number, number],
) {
  return Math.sqrt(distToSegmentSquared(p, v, w));
}

function getLayerColorExpression(layer: any): any {
  if (
    layer.colorClassification &&
    layer.colorClassification.enabled &&
    layer.colorClassification.rules &&
    Object.keys(layer.colorClassification.rules).length > 0
  ) {
    const rules = layer.colorClassification.rules;
    const colName = layer.colorClassification.columnName || "keterangan";
    
    // Support casing/variants if default "keterangan" is chosen
    const getPropExpr = colName.toLowerCase() === "keterangan"
      ? ["coalesce", ["get", "keterangan"], ["get", "Keterangan"], ["get", "KETERANGAN"], ""]
      : ["coalesce", ["get", colName], ""];

    const matchExpr: any[] = [
      "match",
      getPropExpr,
    ];
    for (const [val, color] of Object.entries(rules)) {
      matchExpr.push(val);
      matchExpr.push(color);
    }
    matchExpr.push(layer.color); // fallback color
    return matchExpr;
  }
  return layer.color;
}

export default function MapContainer({
  layers,
  activeBasemap,
  activeTool,
  onChangeTool,
  clickedFeature,
  onFeatureClick,
  onUpdatePointer,
  onUpdateZoom,
  isMapLoaded,
  setIsMapLoaded,
  flyToCoords,
  onResetFlyTo,
  uploadedGeoJSONs,
  drawingLayerId,
  onSaveDrawnFeature,
  editingFeature,
  onSaveEditedFeature,
  onCancelEditing,
  onSplitFeature,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);

  // Markers arrays to clean up on updates
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);
  const draggedVertexIndexRef = useRef<number | null>(null);

  // GIS Tool States
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [splitPoints, setSplitPoints] = useState<[number, number][]>([]);
  const [bufferCenter, setBufferCenter] = useState<[number, number] | null>(
    null,
  );
  const [bufferRadius, setBufferRadius] = useState<number>(1.0); // radius in km

  // Interactive Feature Drawing States
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [sessionFeatures, setSessionFeatures] = useState<any[]>([]);
  const [drawProperties, setDrawProperties] = useState<Record<string, any>>({
    nama: "Fitur Baru",
    keterangan: "Dibuat secara interaktif",
  });

  // Dialog state for adding pin
  const [pinDialogCoords, setPinDialogCoords] = useState<
    [number, number] | null
  >(null);
  const [newPinName, setNewPinName] = useState("");
  const [newPinCategory, setNewPinCategory] = useState("Fasilitas");
  const [newPinDesc, setNewPinDesc] = useState("");

  // Map pitch/bearing for 3D navigation
  const [is3DMode, setIs3DMode] = useState(false);

  // Mini Map visibility state
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Geolocation states
  const [isLocating, setIsLocating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Print & Layout States
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printTitle, setPrintTitle] = useState("PETA SPASIAL KOTA BANDA ACEH");
  const [printSubtitle, setPrintSubtitle] = useState(
    "Badan Perencanaan Pembangunan Daerah Kota Banda Aceh",
  );
  const [printPaperSize, setPrintPaperSize] = useState<"A4" | "A3">("A4");
  const [printOrientation, setPrintOrientation] = useState<
    "landscape" | "portrait"
  >("landscape");
  const [capturedMapUrl, setCapturedMapUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [printLogo, setPrintLogo] = useState<string | null>(null);
  const [printScaleText, setPrintScaleText] = useState("1:25.000");
  const [printSourceText, setPrintSourceText] = useState(
    "Sumber: Badan Perencanaan Pembangunan Daerah Kota Banda Aceh",
  );
  const [printGovernmentName, setPrintGovernmentName] =
    useState("PEMERINTAH KOTA");
  const [printRegionName, setPrintRegionName] = useState("BANDA ACEH");
  const [printProvinceName, setPrintProvinceName] = useState(
    "Provinsi Aceh, Indonesia",
  );
  const [printShowLegend, setPrintShowLegend] = useState(true);
  const [printShowCompass, setPrintShowCompass] = useState(true);
  const [printScaleBarKm, setPrintScaleBarKm] = useState("3 km");
  const [printProjection, setPrintProjection] = useState(
    "SISTEM PROYEKSI: UTM ZONE 46N",
  );
  const [printDatum, setPrintDatum] = useState("WGS 84 / UTM 46N");
  const [printCartographer, setPrintCartographer] =
    useState("Bappeda Banda Aceh");
  const printLogoInputRef = useRef<HTMLInputElement>(null);

  // Dynamic layout print elements
  const [printSidebarTab, setPrintSidebarTab] = useState<"info" | "elements">(
    "info",
  );
  const [printLayoutElements, setPrintLayoutElements] = useState<
    PrintLayoutElement[]
  >([
    {
      id: "preset-north",
      type: "image",
      x: 88,
      y: 12,
      width: 50,
      height: 50,
      imageUrl: CLASSIC_NORTH_ARROW,
    },
  ]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  // Drag handlers for print layout elements
  const startDrag = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const element = printLayoutElements.find((el) => el.id === id);
    if (!element) return;

    setSelectedElementId(id);

    const paperEl = document.getElementById("print-layout-paper");
    if (!paperEl) return;

    const rect = paperEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startXPercent = element.x;
    const startYPercent = element.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const dxPercent = (dx / rect.width) * 100;
      const dyPercent = (dy / rect.height) * 100;

      const newX = Math.round(
        Math.max(0, Math.min(100, startXPercent + dxPercent)),
      );
      const newY = Math.round(
        Math.max(0, Math.min(100, startYPercent + dyPercent)),
      );

      setPrintLayoutElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, x: newX, y: newY } : el)),
      );
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const startTouchDrag = (e: React.TouchEvent, id: string) => {
    e.stopPropagation();

    const element = printLayoutElements.find((el) => el.id === id);
    if (!element) return;

    setSelectedElementId(id);

    const paperEl = document.getElementById("print-layout-paper");
    if (!paperEl) return;

    const rect = paperEl.getBoundingClientRect();
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startXPercent = element.x;
    const startYPercent = element.y;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0];
      const dx = currentTouch.clientX - startX;
      const dy = currentTouch.clientY - startY;
      const dxPercent = (dx / rect.width) * 100;
      const dyPercent = (dy / rect.height) * 100;

      const newX = Math.round(
        Math.max(0, Math.min(100, startXPercent + dxPercent)),
      );
      const newY = Math.round(
        Math.max(0, Math.min(100, startYPercent + dyPercent)),
      );

      setPrintLayoutElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, x: newX, y: newY } : el)),
      );
    };

    const handleTouchEnd = () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
  };

  const updateSelectedElement = (updates: Partial<PrintLayoutElement>) => {
    if (!selectedElementId) return;
    setPrintLayoutElements((prev) =>
      prev.map((el) =>
        el.id === selectedElementId ? { ...el, ...updates } : el,
      ),
    );
  };

  const handleAddTextElement = () => {
    const newEl: PrintLayoutElement = {
      id: `text-${Date.now()}`,
      type: "text",
      x: 50,
      y: 50,
      content: "Teks Baru",
      fontSize: 16,
      fontColor: "#000000",
    };
    setPrintLayoutElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
  };

  const handleAddLineElement = () => {
    const newEl: PrintLayoutElement = {
      id: `line-${Date.now()}`,
      type: "line",
      x: 50,
      y: 50,
      width: 100, // length in px
      lineWidth: 3, // thickness in px
      lineColor: "#ff0000",
      rotation: 0,
    };
    setPrintLayoutElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
  };

  const handleAddRectangleElement = () => {
    const newEl: PrintLayoutElement = {
      id: `rect-${Date.now()}`,
      type: "rectangle",
      x: 50,
      y: 50,
      width: 120,
      height: 60,
      rectFillColor: "rgba(255, 255, 255, 0.7)",
      rectBorderColor: "#000000",
      rectBorderWidth: 2,
    };
    setPrintLayoutElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
  };

  const handleAddImageElement = () => {
    const newEl: PrintLayoutElement = {
      id: `image-${Date.now()}`,
      type: "image",
      x: 50,
      y: 50,
      width: 60,
      height: 60,
      imageUrl: CLASSIC_NORTH_ARROW,
    };
    setPrintLayoutElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
  };

  const handleUploadElementImage = (
    e: React.ChangeEvent<HTMLInputElement>,
    id: string,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPrintLayoutElements((prev) =>
            prev.map((el) =>
              el.id === id ? { ...el, imageUrl: reader.result as string } : el,
            ),
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [activeEditingCoords, setActiveEditingCoords] = useState<
    [number, number][]
  >([]);
  const [editingParts, setEditingParts] = useState<EditPart[]>([]);
  const [activePartIndex, setActivePartIndex] = useState<number>(0);

  // Ref to always reference the freshest state variables inside the map event closures
  const stateRef = useRef({
    drawingLayerId,
    layers,
    activeTool,
    bufferRadius,
    onFeatureClick,
    sessionFeatures,
    editingFeature,
    drawProperties,
    drawPoints,
    splitPoints,
    clickedFeature,
    editingParts: [] as EditPart[],
    activePartIndex: 0,
    activeEditingCoords: [] as [number, number][],
  });

  useEffect(() => {
    stateRef.current = {
      drawingLayerId,
      layers,
      activeTool,
      bufferRadius,
      onFeatureClick,
      sessionFeatures,
      editingFeature,
      drawProperties,
      drawPoints,
      splitPoints,
      clickedFeature,
      editingParts,
      activePartIndex,
      activeEditingCoords,
    };
  }, [
    drawingLayerId,
    layers,
    activeTool,
    bufferRadius,
    onFeatureClick,
    sessionFeatures,
    editingFeature,
    drawProperties,
    drawPoints,
    splitPoints,
    clickedFeature,
    editingParts,
    activePartIndex,
    activeEditingCoords,
  ]);

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
      preserveDrawingBuffer: true,
    } as any);

    // Build Mini Map (Synchronized static overview)
    const miniMap = new maplibregl.Map({
      container: miniMapContainerRef.current,
      style: BASEMAP_STYLES[activeBasemap],
      center: BANDA_ACEH_CENTER,
      zoom: 9,
      interactive: false,
      attributionControl: false,
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
    mainMap.on("dblclick", handleMapDblClick);
    mainMap.on("contextmenu", handleMapContextMenu);

    // Interactive Drawing Vertex Hover Pointer Cursor
    mainMap.on("mouseenter", "draw-temp-circle-layer", () => {
      mainMap.getCanvas().style.cursor = "pointer";
    });
    mainMap.on("mouseleave", "draw-temp-circle-layer", () => {
      mainMap.getCanvas().style.cursor = "";
    });

    // Vertex dragging handlers
    mainMap.on("mousedown", "draw-temp-circle-layer", (e) => {
      e.preventDefault(); // Prevent default map drag behavior
      const features = mainMap.queryRenderedFeatures(e.point, {
        layers: ["draw-temp-circle-layer"],
      });
      if (features && features.length > 0) {
        const geom = features[0].geometry;
        if (geom && geom.type === "Point") {
          const coords = geom.coordinates;
          const { drawPoints: latestDrawPoints } = stateRef.current;
          const clickedIndex = latestDrawPoints.findIndex(
            (pt) =>
              Math.abs(pt[0] - coords[0]) < 1e-6 &&
              Math.abs(pt[1] - coords[1]) < 1e-6
          );
          if (clickedIndex !== -1) {
            draggedVertexIndexRef.current = clickedIndex;
            mainMap.dragPan.disable();
            mainMap.getCanvas().style.cursor = "grabbing";
          }
        }
      }
    });

    mainMap.on("mousemove", (e) => {
      if (draggedVertexIndexRef.current !== null) {
        const index = draggedVertexIndexRef.current;
        const newLngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setDrawPoints((prev) => {
          const updated = [...prev];
          if (index < updated.length) {
            updated[index] = newLngLat;
          }
          return updated;
        });
      }
    });

    mainMap.on("mouseup", () => {
      if (draggedVertexIndexRef.current !== null) {
        draggedVertexIndexRef.current = null;
        mainMap.dragPan.enable();
        mainMap.getCanvas().style.cursor = "";
      }
    });

    // Right-click a vertex to delete it during drawing
    mainMap.on("contextmenu", "draw-temp-circle-layer", (e) => {
      e.preventDefault(); // Stop standard context menu or map contextmenu
      const features = mainMap.queryRenderedFeatures(e.point, {
        layers: ["draw-temp-circle-layer"],
      });
      if (features && features.length > 0) {
        const geom = features[0].geometry;
        if (geom && geom.type === "Point") {
          const coords = geom.coordinates;
          const { drawPoints: latestDrawPoints } = stateRef.current;
          const clickedIndex = latestDrawPoints.findIndex(
            (pt) =>
              Math.abs(pt[0] - coords[0]) < 1e-6 &&
              Math.abs(pt[1] - coords[1]) < 1e-6
          );
          if (clickedIndex !== -1) {
            setDrawPoints((prev) => prev.filter((_, idx) => idx !== clickedIndex));
          }
        }
      }
    });

    // Prevent default context menu on container when editing
    const container = mapContainerRef.current;
    const preventContextMenu = (event: MouseEvent) => {
      const { editingFeature: curEditingFeature } = stateRef.current;
      if (curEditingFeature) {
        event.preventDefault();
      }
    };
    if (container) {
      container.addEventListener("contextmenu", preventContextMenu);
    }

    // Mapbox custom scale control
    mainMap.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }),
      "bottom-left",
    );

    return () => {
      if (container) {
        container.removeEventListener("contextmenu", preventContextMenu);
      }
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
    });
  }, [activeBasemap]);

  // --- 2.5 RESIZE MINI MAP WHEN VISIBILITY TOGGLED ---
  useEffect(() => {
    if (showMiniMap && miniMapRef.current) {
      const timer = setTimeout(() => {
        miniMapRef.current?.resize();
      }, 350); // wait for scale transition
      return () => clearTimeout(timer);
    }
  }, [showMiniMap]);

  // --- 2.7 INITIAL LOAD AUTO GEOLOCATION ---
  const hasLocatedOnLoadRef = useRef(false);
  useEffect(() => {
    if (isMapLoaded && !hasLocatedOnLoadRef.current) {
      hasLocatedOnLoadRef.current = true;
      handleLocateUser();
    }
  }, [isMapLoaded]);

  // --- 3. HANDLE FLY TO EMITTER (FROM SIDEBAR) ---
  useEffect(() => {
    if (!mapRef.current || !flyToCoords) return;
    mapRef.current.flyTo({
      center: flyToCoords,
      zoom: 15.5,
      essential: true,
      duration: 1800,
      pitch: is3DMode ? 45 : 0,
    });
    onResetFlyTo();
  }, [flyToCoords]);

  // --- VERTEX EDITING ENGINE ---
  const [editProperties, setEditProperties] = useState<Record<string, any>>({});
  const editingMarkersRef = useRef<maplibregl.Marker[]>([]);
  const isDraggingVertexRef = useRef(false);

  // Draggable window state for FLOATING FEATURE DRAWING OVERLAY
  const [drawDragOffset, setDrawDragOffset] = useState({ x: 0, y: 0 });
  const [isDrawDragging, setIsDrawDragging] = useState(false);
  const [drawDragStart, setDrawDragStart] = useState({ x: 0, y: 0 });

  // Draggable window state for FLOATING FEATURE VERTEX EDITING OVERLAY
  const [editDragOffset, setEditDragOffset] = useState({ x: 0, y: 0 });
  const [isEditDragging, setIsEditDragging] = useState(false);
  const [editDragStart, setEditDragStart] = useState({ x: 0, y: 0 });

  // Draggable window state for PIN CREATION POPUP DIALOG
  const [pinDragOffset, setPinDragOffset] = useState({ x: 0, y: 0 });
  const [isPinDragging, setIsPinDragging] = useState(false);
  const [pinDragStart, setPinDragStart] = useState({ x: 0, y: 0 });

  // Mobile optimization panel states
  const [isDrawPanelMinimized, setIsDrawPanelMinimized] = useState(() => window.innerWidth < 768);
  const [isEditPanelMinimized, setIsEditPanelMinimized] = useState(() => window.innerWidth < 768);
  const [isMeasurePanelMinimized, setIsMeasurePanelMinimized] = useState(() => window.innerWidth < 768);
  const [isBufferPanelMinimized, setIsBufferPanelMinimized] = useState(() => window.innerWidth < 768);
  const [isSplitPanelMinimized, setIsSplitPanelMinimized] = useState(() => window.innerWidth < 768);

  // Auto-minimize on mobile when drawing starts
  useEffect(() => {
    if (drawingLayerId) {
      setIsDrawPanelMinimized(window.innerWidth < 768);
    }
  }, [drawingLayerId]);

  // Auto-minimize on mobile when editing starts
  useEffect(() => {
    if (editingFeature) {
      setIsEditPanelMinimized(window.innerWidth < 768);
    }
  }, [editingFeature]);

  // Auto-minimize on mobile when measurement or buffer or split starts
  useEffect(() => {
    if (activeTool === "measure-distance") {
      setIsMeasurePanelMinimized(window.innerWidth < 768);
    }
    if (activeTool === "buffer-generator") {
      setIsBufferPanelMinimized(window.innerWidth < 768);
    }
    if (activeTool === "split-geometry") {
      setIsSplitPanelMinimized(window.innerWidth < 768);
    }
  }, [activeTool]);

  // --- DRAGGING EFFECT FOR DRAWING MODAL ---
  const handleDrawDragMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        'input, button, select, textarea, [role="button"]',
      )
    )
      return;
    setIsDrawDragging(true);
    setDrawDragStart({
      x: e.clientX - drawDragOffset.x,
      y: e.clientY - drawDragOffset.y,
    });
  };

  useEffect(() => {
    if (!isDrawDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDrawDragOffset({
        x: e.clientX - drawDragStart.x,
        y: e.clientY - drawDragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDrawDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDrawDragging, drawDragStart]);

  // --- DRAGGING EFFECT FOR VERTEX EDITING MODAL ---
  const handleEditDragMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        'input, button, select, textarea, [role="button"]',
      )
    )
      return;
    setIsEditDragging(true);
    setEditDragStart({
      x: e.clientX - editDragOffset.x,
      y: e.clientY - editDragOffset.y,
    });
  };

  useEffect(() => {
    if (!isEditDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setEditDragOffset({
        x: e.clientX - editDragStart.x,
        y: e.clientY - editDragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsEditDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isEditDragging, editDragStart]);

  // --- DRAGGING EFFECT FOR PIN CREATION POPUP DIALOG ---
  const handlePinDragMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        'input, button, select, textarea, [role="button"]',
      )
    )
      return;
    setIsPinDragging(true);
    setPinDragStart({
      x: e.clientX - pinDragOffset.x,
      y: e.clientY - pinDragOffset.y,
    });
  };

  useEffect(() => {
    if (!isPinDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPinDragOffset({
        x: e.clientX - pinDragStart.x,
        y: e.clientY - pinDragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsPinDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPinDragging, pinDragStart]);

  useEffect(() => {
    if (!pinDialogCoords) {
      setPinDragOffset({ x: 0, y: 0 });
    }
  }, [pinDialogCoords]);

  const recreateEditingMarkers = (
    map: maplibregl.Map,
    coordsList: [number, number][],
    layerType: string,
    geomType: string,
    currentParts?: EditPart[],
    currActivePartIndex?: number
  ) => {
    editingMarkersRef.current.forEach((m) => m.remove());
    editingMarkersRef.current = [];

    const currentCoords = [...coordsList];

    const updateVisualEditLayer = (list: [number, number][]) => {
      const src = map.getSource(
        "editing-highlight-source",
      ) as maplibregl.GeoJSONSource;
      if (!src) return;

      const activeIdx = currActivePartIndex ?? activePartIndex;
      const parts = currentParts ?? editingParts;

      let drawGeom: any = null;

      if (parts && parts.length > 0) {
        // Update the coordinates of the active part in the temporary list
        const tempParts = parts.map((p, idx) => {
          if (idx === activeIdx) {
            return { ...p, coords: list };
          }
          return p;
        });

        if (geomType === "Point") {
          drawGeom = {
            type: "Point",
            coordinates: tempParts[0]?.coords[0] || [0, 0],
          };
        } else if (geomType === "MultiPoint") {
          drawGeom = {
            type: "MultiPoint",
            coordinates: tempParts.map(p => p.coords[0] || [0, 0]),
          };
        } else if (geomType === "LineString") {
          drawGeom = {
            type: "LineString",
            coordinates: tempParts[0]?.coords || [],
          };
        } else if (geomType === "MultiLineString") {
          drawGeom = {
            type: "MultiLineString",
            coordinates: tempParts.map(p => p.coords),
          };
        } else if (geomType === "Polygon") {
          drawGeom = {
            type: "Polygon",
            coordinates: tempParts.map(p => p.coords.length >= 3 ? [...p.coords, p.coords[0]] : []),
          };
        } else if (geomType === "MultiPolygon") {
          // Group parts by polyIndex
          const polyGroups: Record<number, EditPart[]> = {};
          tempParts.forEach(p => {
            const pIdx = p.polyIndex ?? 0;
            if (!polyGroups[pIdx]) polyGroups[pIdx] = [];
            polyGroups[pIdx].push(p);
          });

          const coordinates: any[] = [];
          Object.keys(polyGroups).forEach(pIdxKey => {
            const pIdx = Number(pIdxKey);
            const rings = polyGroups[pIdx].map(p => p.coords.length >= 3 ? [...p.coords, p.coords[0]] : []);
            coordinates.push(rings);
          });

          drawGeom = {
            type: "MultiPolygon",
            coordinates
          };
        }
      } else {
        // Fallback for single part editing
        if (layerType === "circle" || geomType === "Point") {
          drawGeom = {
            type: "Point",
            coordinates: list[0] || [0, 0],
          };
        } else if (layerType === "line" || geomType === "LineString") {
          drawGeom = {
            type: "LineString",
            coordinates: list,
          };
        } else if (layerType === "fill" || geomType === "Polygon") {
          drawGeom = {
            type: "Polygon",
            coordinates: list.length >= 3 ? [[...list, list[0]]] : [],
          };
        }
      }

      src.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: drawGeom,
            properties: {},
          },
        ],
      });
    };

    updateVisualEditLayer(currentCoords);

    currentCoords.forEach((coord, idx) => {
      const el = document.createElement("div");
      el.className =
        "w-6 h-6 bg-orange-500 border-2 border-white rounded-full shadow-lg cursor-move hover:scale-125 transition-transform flex items-center justify-center text-[10px] text-white font-bold font-mono select-none";
      el.textContent = String(idx + 1);
      el.title =
        "Seret untuk memindahkan. Klik kanan untuk menghapus vertex ini.";

      // Right-click to delete vertex
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const minRequired =
          geomType === "Polygon" || geomType === "MultiPolygon" ? 3 : 2;
        if (geomType === "Point") {
          return; // Point has exactly 1 vertex and cannot be deleted
        }

        if (currentCoords.length <= minRequired) {
          alert(
            `Tidak dapat menghapus vertex. Minimal diperlukan ${minRequired} vertex untuk tipe geometri ini.`,
          );
          return;
        }

        const updated = currentCoords.filter((_, i) => i !== idx);
        setActiveEditingCoords(updated);

        const activeIdx = currActivePartIndex ?? activePartIndex;
        const parts = currentParts ?? editingParts;
        const updatedParts = parts.map((p, pIdx) => {
          if (pIdx === activeIdx) {
            return { ...p, coords: updated };
          }
          return p;
        });
        setEditingParts(updatedParts);
        recreateEditingMarkers(map, updated, layerType, geomType, updatedParts, activeIdx);
      });

      const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat(coord)
        .addTo(map);

      // Disable map drag when mouse enters vertex marker so user can drag easily
      el.addEventListener("mouseenter", () => {
        map.dragPan.disable();
      });

      el.addEventListener("mouseleave", () => {
        if (!isDraggingVertexRef.current) {
          map.dragPan.enable();
        }
      });

      marker.on("dragstart", () => {
        isDraggingVertexRef.current = true;
        map.dragPan.disable();
      });

      marker.on("drag", () => {
        const lngLat = marker.getLngLat();
        currentCoords[idx] = [lngLat.lng, lngLat.lat];
        updateVisualEditLayer(currentCoords);
      });

      marker.on("dragend", () => {
        isDraggingVertexRef.current = false;
        map.dragPan.enable();
        const lngLat = marker.getLngLat();
        currentCoords[idx] = [lngLat.lng, lngLat.lat];
        updateVisualEditLayer(currentCoords);
        setActiveEditingCoords([...currentCoords]);

        const updatedParts = (currentParts ?? editingParts).map((p, pIdx) => {
          if (pIdx === (currActivePartIndex ?? activePartIndex)) {
            return { ...p, coords: [...currentCoords] };
          }
          return p;
        });
        setEditingParts(updatedParts);
      });

      editingMarkersRef.current.push(marker);
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    editingMarkersRef.current.forEach((m) => m.remove());
    editingMarkersRef.current = [];

    const editSource = map.getSource(
      "editing-highlight-source",
    ) as maplibregl.GeoJSONSource;
    if (editSource) {
      editSource.setData({ type: "FeatureCollection", features: [] });
    }

    if (!editingFeature) {
      setActiveEditingCoords([]);
      setEditingParts([]);
      setActivePartIndex(0);
      setEditProperties({});
      setEditDragOffset({ x: 0, y: 0 });

      // If there is a clickedFeature, show it on the editing highlight layer!
      if (clickedFeature && clickedFeature.geometry) {
        if (editSource) {
          editSource.setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: clickedFeature.geometry,
                properties: clickedFeature.properties || {},
              },
            ],
          });
        }
      }
      return;
    }

    const geom = editingFeature.geometry;
    const layerId = editingFeature.layerId;
    const targetLayer = layers.find((l) => l.id === layerId);
    const layerType = targetLayer?.type || "circle";

    setEditProperties({ ...editingFeature.properties });

    // Build the list of edit parts
    let partsList: EditPart[] = [];
    if (geom.type === "Point") {
      partsList = [{
        id: "part-0",
        label: "Titik Utama",
        coords: [geom.coordinates],
        type: "point",
        polyIndex: 0,
        ringIndex: 0
      }];
    } else if (geom.type === "MultiPoint") {
      partsList = geom.coordinates.map((pt: any, i: number) => ({
        id: `part-${i}`,
        label: `Titik Part ${i + 1}`,
        coords: [pt],
        type: "point",
        polyIndex: i,
        ringIndex: 0
      }));
    } else if (geom.type === "LineString") {
      partsList = [{
        id: "part-0",
        label: "Garis Utama",
        coords: [...geom.coordinates],
        type: "line",
        polyIndex: 0,
        ringIndex: 0
      }];
    } else if (geom.type === "MultiLineString") {
      partsList = geom.coordinates.map((line: any, i: number) => ({
        id: `part-${i}`,
        label: `Part ${i + 1} (Garis)`,
        coords: [...line],
        type: "line",
        polyIndex: i,
        ringIndex: 0
      }));
    } else if (geom.type === "Polygon") {
      partsList = geom.coordinates.map((ring: any, rIdx: number) => ({
        id: `part-ring-${rIdx}`,
        label: rIdx === 0 ? "Batas Luar (Exterior)" : `Lubang ${rIdx} (Hole)`,
        coords: ring.slice(0, -1),
        type: rIdx === 0 ? "exterior" : "interior",
        polyIndex: 0,
        ringIndex: rIdx
      }));
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((poly: any, pIdx: number) => {
        poly.forEach((ring: any, rIdx: number) => {
          partsList.push({
            id: `part-p${pIdx}-r${rIdx}`,
            label: `Poligon ${pIdx + 1}: ${rIdx === 0 ? "Batas Luar" : `Lubang ${rIdx}`}`,
            coords: ring.slice(0, -1),
            type: rIdx === 0 ? "exterior" : "interior",
            polyIndex: pIdx,
            ringIndex: rIdx
          });
        });
      });
    }

    setEditingParts(partsList);
    setActivePartIndex(0);

    const initialCoords = partsList[0]?.coords || [];
    setActiveEditingCoords(initialCoords);
    recreateEditingMarkers(map, initialCoords, layerType, geom.type, partsList, 0);
  }, [editingFeature, clickedFeature, isMapLoaded]);

  // --- 4. TOGGLE LAYER VISIBILITIES & DYNAMIC STYLING ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // Clean up removed custom layers first
    try {
      const style = map.getStyle();
      if (style) {
        // 1. Custom vector layers cleanup
        style.layers.forEach((mapL) => {
          if (mapL.id.startsWith("custom-layer-")) {
            const remainder = mapL.id
              .replace("custom-layer-outline-", "")
              .replace("custom-layer-", "");
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

        // 2. WMS layers cleanup
        style.layers.forEach((mapL) => {
          if (mapL.id.startsWith("wms-layer-")) {
            const remainder = mapL.id.replace("wms-layer-", "");
            const layerStillExists = layers.some((l) => l.id === remainder);
            if (!layerStillExists) {
              if (map.getLayer(mapL.id)) {
                map.removeLayer(mapL.id);
              }
            }
          }
        });
        Object.keys(style.sources).forEach((sourceKey) => {
          if (sourceKey.startsWith("wms-source-")) {
            const remainder = sourceKey.replace("wms-source-", "");
            const layerStillExists = layers.some((l) => l.id === remainder);
            if (!layerStillExists) {
              if (map.getSource(sourceKey)) {
                map.removeSource(sourceKey);
              }
            }
          }
        });

        // 3. Standard system layers cleanup if removed from prop list
        const hasKabupaten = layers.some((l) => l.id === LayerId.KABUPATEN);
        if (!hasKabupaten) {
          if (map.getLayer("kabupaten-layer"))
            map.removeLayer("kabupaten-layer");
          if (map.getLayer("kabupaten-outline"))
            map.removeLayer("kabupaten-outline");
        }

        const hasJalan = layers.some((l) => l.id === LayerId.JALAN);
        if (!hasJalan) {
          if (map.getLayer("jalan-layer")) map.removeLayer("jalan-layer");
        }

        const hasSungai = layers.some((l) => l.id === LayerId.SUNGAI);
        if (!hasSungai) {
          if (map.getLayer("sungai-layer")) map.removeLayer("sungai-layer");
        }

        const hasLandmark = layers.some((l) => l.id === LayerId.LANDMARK);
        if (!hasLandmark) {
          landmarkMarkersRef.current.forEach((m) => m.remove());
          landmarkMarkersRef.current = [];
        }
      }
    } catch (e) {
      console.error("Error cleaning up custom/WMS/standard layers:", e);
    }

    layers.forEach((layer) => {
      const isVisible = layer.visible;
      const visibilityValue = isVisible ? "visible" : "none";

      // Kabupaten
      if (layer.id === LayerId.KABUPATEN) {
        if (map.getLayer("kabupaten-layer")) {
          map.setLayoutProperty(
            "kabupaten-layer",
            "visibility",
            visibilityValue,
          );
          map.setPaintProperty("kabupaten-layer", "fill-color", getLayerColorExpression(layer));
          map.setPaintProperty(
            "kabupaten-layer",
            "fill-opacity",
            layer.opacity,
          );
        }
        if (map.getLayer("kabupaten-outline")) {
          map.setLayoutProperty(
            "kabupaten-outline",
            "visibility",
            visibilityValue,
          );
          map.setPaintProperty("kabupaten-outline", "line-color", getLayerColorExpression(layer));
          map.setPaintProperty(
            "kabupaten-outline",
            "line-opacity",
            layer.opacity,
          );

          if (layer.lineStyle === "dashed") {
            map.setPaintProperty("kabupaten-outline", "line-dasharray", [3, 2]);
          } else if (layer.lineStyle === "dotted") {
            map.setPaintProperty("kabupaten-outline", "line-dasharray", [1, 2]);
          } else {
            map.setPaintProperty("kabupaten-outline", "line-dasharray", null);
          }
        }
        if (layer.geojson && map.getSource("kabupaten-source")) {
          const src = map.getSource(
            "kabupaten-source",
          ) as maplibregl.GeoJSONSource;
          src.setData(layer.geojson);
        }
      }

      // Jalan
      if (layer.id === LayerId.JALAN) {
        if (map.getLayer("jalan-layer")) {
          map.setLayoutProperty("jalan-layer", "visibility", visibilityValue);
          map.setPaintProperty("jalan-layer", "line-color", getLayerColorExpression(layer));
          map.setPaintProperty("jalan-layer", "line-opacity", layer.opacity);
          map.setPaintProperty(
            "jalan-layer",
            "line-width",
            layer.lineWidth || 3,
          );

          if (layer.lineStyle === "dashed") {
            map.setPaintProperty("jalan-layer", "line-dasharray", [4, 3]);
          } else if (layer.lineStyle === "dotted") {
            map.setPaintProperty("jalan-layer", "line-dasharray", [1, 2]);
          } else {
            map.setPaintProperty("jalan-layer", "line-dasharray", null);
          }
        }
        if (layer.geojson && map.getSource("jalan-source")) {
          const src = map.getSource("jalan-source") as maplibregl.GeoJSONSource;
          src.setData(layer.geojson);
        }
      }

      // Sungai
      if (layer.id === LayerId.SUNGAI) {
        if (map.getLayer("sungai-layer")) {
          map.setLayoutProperty("sungai-layer", "visibility", visibilityValue);
          map.setPaintProperty("sungai-layer", "line-color", getLayerColorExpression(layer));
          map.setPaintProperty("sungai-layer", "line-opacity", layer.opacity);
          map.setPaintProperty(
            "sungai-layer",
            "line-width",
            layer.lineWidth || 4.5,
          );

          if (layer.lineStyle === "dashed") {
            map.setPaintProperty("sungai-layer", "line-dasharray", [4, 3]);
          } else if (layer.lineStyle === "dotted") {
            map.setPaintProperty("sungai-layer", "line-dasharray", [1, 2]);
          } else {
            map.setPaintProperty("sungai-layer", "line-dasharray", null);
          }
        }
        if (layer.geojson && map.getSource("sungai-source")) {
          const src = map.getSource(
            "sungai-source",
          ) as maplibregl.GeoJSONSource;
          src.setData(layer.geojson);
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
            data: layer.geojson,
          });

          if (layer.type === "fill") {
            map.addLayer({
              id: mainLayerId,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": getLayerColorExpression(layer),
                "fill-opacity": layer.opacity,
              },
            });
            map.addLayer({
              id: outlineLayerId,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": getLayerColorExpression(layer),
                "line-opacity":
                  layer.opacity + 0.2 > 1 ? 1 : layer.opacity + 0.2,
                "line-width": 1.5,
              },
            });
          } else if (layer.type === "line") {
            map.addLayer({
              id: mainLayerId,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": getLayerColorExpression(layer),
                "line-opacity": layer.opacity,
                "line-width": layer.lineWidth || 3,
              },
            });
          } else {
            // Circle/Point layer
            map.addLayer({
              id: mainLayerId,
              type: "circle",
              source: sourceId,
              paint: {
                "circle-color": getLayerColorExpression(layer),
                "circle-opacity": layer.opacity,
                "circle-radius": 6,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
              },
            });
          }

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
          const existingSource = map.getSource(
            sourceId,
          ) as maplibregl.GeoJSONSource;
          if (existingSource) {
            existingSource.setData(layer.geojson);
          }
        }

        // Apply dynamic styles & visibility updates
        if (map.getLayer(mainLayerId)) {
          map.setLayoutProperty(mainLayerId, "visibility", visibilityValue);
          if (layer.type === "fill") {
            map.setPaintProperty(mainLayerId, "fill-color", getLayerColorExpression(layer));
            map.setPaintProperty(mainLayerId, "fill-opacity", layer.opacity);
            if (map.getLayer(outlineLayerId)) {
              map.setLayoutProperty(
                outlineLayerId,
                "visibility",
                visibilityValue,
              );
              map.setPaintProperty(outlineLayerId, "line-color", getLayerColorExpression(layer));
              map.setPaintProperty(
                outlineLayerId,
                "line-opacity",
                layer.opacity + 0.2 > 1 ? 1 : layer.opacity + 0.2,
              );
            }
          } else if (layer.type === "line") {
            map.setPaintProperty(mainLayerId, "line-color", getLayerColorExpression(layer));
            map.setPaintProperty(mainLayerId, "line-opacity", layer.opacity);
            map.setPaintProperty(
              mainLayerId,
              "line-width",
              layer.lineWidth || 3,
            );

            if (layer.lineStyle === "dashed") {
              map.setPaintProperty(mainLayerId, "line-dasharray", [4, 3]);
            } else if (layer.lineStyle === "dotted") {
              map.setPaintProperty(mainLayerId, "line-dasharray", [1, 2]);
            } else {
              map.setPaintProperty(mainLayerId, "line-dasharray", null);
            }
          } else {
            // Circle type
            map.setPaintProperty(mainLayerId, "circle-color", getLayerColorExpression(layer));
            map.setPaintProperty(mainLayerId, "circle-opacity", layer.opacity);
          }
        }
      }

      // Dynamic WMS Raster Layers
      if (layer.type === "wms" && layer.wmsUrl) {
        const sourceId = `wms-source-${layer.id}`;
        const mainLayerId = `wms-layer-${layer.id}`;

        const separator = layer.wmsUrl.includes("?") ? "&" : "?";
        const wmsTileUrl = `${layer.wmsUrl}${separator}service=WMS&version=1.1.1&request=GetMap&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true&layers=${layer.wmsLayers || "0"}`;

        const existingSource = map.getSource(sourceId) as any;
        if (existingSource) {
          const existingTiles = existingSource.tiles || [];
          if (existingTiles[0] !== wmsTileUrl) {
            if (map.getLayer(mainLayerId)) {
              map.removeLayer(mainLayerId);
            }
            map.removeSource(sourceId);
          }
        }

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "raster",
            tiles: [wmsTileUrl],
            tileSize: 256,
          });

          map.addLayer({
            id: mainLayerId,
            type: "raster",
            source: sourceId,
            paint: {
              "raster-opacity": layer.opacity,
            },
          });
        }

        // Sync visibility and opacity of WMS layer
        if (map.getLayer(mainLayerId)) {
          map.setLayoutProperty(mainLayerId, "visibility", visibilityValue);
          map.setPaintProperty(mainLayerId, "raster-opacity", layer.opacity);
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

    const featuresSource = landmarkLayer?.geojson?.features || [];

    featuresSource.forEach((feature: any, idx: number) => {
      const coords = feature.geometry.coordinates as [number, number];
      const props = feature.properties || {};

      // Create Custom Marker HTML
      const el = document.createElement("div");

      let shapeClasses = "";
      let innerHTML = "";

      if (iconStyle === "circle") {
        shapeClasses =
          "w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-lg cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `<div class="w-2.5 h-2.5 bg-white rounded-full"></div>`;
      } else if (iconStyle === "square") {
        shapeClasses =
          "w-7 h-7 rounded-lg flex items-center justify-center border-2 border-white shadow-lg cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `<div class="w-2.5 h-2.5 bg-white rounded-sm"></div>`;
      } else if (iconStyle === "star") {
        shapeClasses =
          "w-8 h-8 flex items-center justify-center cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `
          <svg class="w-8 h-8 filter drop-shadow-md" viewBox="0 0 24 24" fill="${layerColor}">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="white" strokeWidth="1.5"/>
          </svg>
        `;
      } else if (iconStyle === "triangle") {
        shapeClasses =
          "w-8 h-8 flex items-center justify-center cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `
          <svg class="w-8 h-8 filter drop-shadow-md" viewBox="0 0 24 24" fill="${layerColor}">
            <polygon points="12,2 22,22 2,22" stroke="white" strokeWidth="2"/>
          </svg>
        `;
      } else {
        // "marker"
        shapeClasses =
          "w-8 h-8 flex items-center justify-center cursor-pointer transform hover:scale-115 transition-transform duration-150 relative group";
        innerHTML = `
          <svg class="w-8 h-8 filter drop-shadow-md" viewBox="0 0 24 24" fill="${layerColor}">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" strokeWidth="1.5"/>
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
      label.className =
        "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-950 text-white font-sans text-[10px] py-1 px-2 rounded shadow-md border border-slate-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-semibold";
      label.textContent = props.name || props.nama || "Landmark";
      el.appendChild(label);

      // Attach click to feature info panel
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onFeatureClick({
          layerId: LayerId.LANDMARK,
          layerName: "Landmarks (Titik Penting)",
          properties: props,
          coordinates: coords,
          geometry: feature.geometry,
          featureIndex: idx,
        } as any);
        map.flyTo({ center: coords, zoom: 15, duration: 1000 });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);

      landmarkMarkersRef.current.push(marker);
    });
  };

  useEffect(() => {
    if (isMapLoaded) {
      renderLandmarkMarkers();
    }
  }, [layers, isMapLoaded]);

  // --- 7. EXTERNAL UPLOADED GEOJSON FLY-TO ONLY ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || uploadedGeoJSONs.length === 0) return;

    // Fly to bounds or first coordinate of the newly uploaded dataset
    const latestGeoJSON = uploadedGeoJSONs[uploadedGeoJSONs.length - 1];
    try {
      const firstFeature = latestGeoJSON.features[0];
      if (firstFeature && firstFeature.geometry) {
        const geom = firstFeature.geometry;
        let targetCoords: [number, number] | null = null;
        if (geom.type === "Point") targetCoords = geom.coordinates;
        else if (geom.type === "Polygon")
          targetCoords = geom.coordinates[0][0];
        else if (geom.type === "LineString")
          targetCoords = geom.coordinates[0];

        if (targetCoords) {
          map.flyTo({ center: targetCoords, zoom: 12.5 });
        }
      }
    } catch (err) {
      console.error("Fly to uploaded bounds error:", err);
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
        data: KABUPATEN_DATA,
      });

      map.addLayer({
        id: "kabupaten-layer",
        type: "fill",
        source: "kabupaten-source",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.22,
        },
      });

      map.addLayer({
        id: "kabupaten-outline",
        type: "line",
        source: "kabupaten-source",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.5,
          "line-dasharray": [3, 2],
        },
      });
    }

    // 2. Roads
    if (!map.getSource("jalan-source")) {
      map.addSource("jalan-source", {
        type: "geojson",
        data: JALAN_DATA,
      });

      map.addLayer({
        id: "jalan-layer",
        type: "line",
        source: "jalan-source",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3,
          "line-opacity": 0.95,
        },
      });
    }

    // 3. Rivers
    if (!map.getSource("sungai-source")) {
      map.addSource("sungai-source", {
        type: "geojson",
        data: SUNGAI_DATA,
      });

      map.addLayer({
        id: "sungai-layer",
        type: "line",
        source: "sungai-source",
        paint: {
          "line-color": "#06b6d4",
          "line-width": 4.5,
          "line-opacity": 0.8,
        },
      });
    }

    // 4. Spatial Measurement Layer
    if (!map.getSource("measure-line-source")) {
      map.addSource("measure-line-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "measure-line-layer",
        type: "line",
        source: "measure-line-source",
        paint: {
          "line-color": "#ef4444",
          "line-width": 3,
          "line-dasharray": [1, 1],
        },
      });

      map.addLayer({
        id: "measure-points-layer",
        type: "circle",
        source: "measure-line-source",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ef4444",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    // 4.5 Split Line Layer
    if (!map.getSource("split-line-source")) {
      map.addSource("split-line-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "split-line-layer",
        type: "line",
        source: "split-line-source",
        paint: {
          "line-color": "#f97316", // orange
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "split-points-layer",
        type: "circle",
        source: "split-line-source",
        paint: {
          "circle-radius": 5,
          "circle-color": "#f97316",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    // 5. Buffer Polygon Layer
    if (!map.getSource("buffer-source")) {
      map.addSource("buffer-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "buffer-fill-layer",
        type: "fill",
        source: "buffer-source",
        paint: {
          "fill-color": "#10b981",
          "fill-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "buffer-outline-layer",
        type: "line",
        source: "buffer-source",
        paint: {
          "line-color": "#047857",
          "line-width": 2,
        },
      });
    }

    // 6. Temporary GIS Feature Drawing Layer
    if (!map.getSource("draw-temp-source")) {
      map.addSource("draw-temp-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Fill layer (for polygons)
      map.addLayer({
        id: "draw-temp-fill-layer",
        type: "fill",
        source: "draw-temp-source",
        paint: {
          "fill-color": "#e11d48",
          "fill-opacity": 0.3,
        },
        filter: ["==", "$type", "Polygon"],
      });

      // Line layer (for line strings and polygon boundaries)
      map.addLayer({
        id: "draw-temp-line-layer",
        type: "line",
        source: "draw-temp-source",
        paint: {
          "line-color": "#e11d48",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
        filter: ["in", "$type", "LineString", "Polygon"],
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
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    // 7. Active Feature Editing Highlight Layer
    if (!map.getSource("editing-highlight-source")) {
      map.addSource("editing-highlight-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Fill Layer (Polygons)
      map.addLayer({
        id: "editing-highlight-fill",
        type: "fill",
        source: "editing-highlight-source",
        paint: {
          "fill-color": "#f97316",
          "fill-opacity": 0.4,
        },
        filter: ["==", "$type", "Polygon"],
      });

      // Line Layer (Lines & Polygon borders)
      map.addLayer({
        id: "editing-highlight-line",
        type: "line",
        source: "editing-highlight-source",
        paint: {
          "line-color": "#f97316",
          "line-width": 4,
          "line-dasharray": [1.5, 1],
        },
        filter: ["in", "$type", "LineString", "Polygon"],
      });

      // Point Layer (Circles)
      map.addLayer({
        id: "editing-highlight-circle",
        type: "circle",
        source: "editing-highlight-source",
        paint: {
          "circle-radius": 7,
          "circle-color": "#f97316",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
        filter: ["==", "$type", "Point"],
      });
    }

    // Trigger Initial Markers rendering after WebGL is armed
    renderLandmarkMarkers();

    // Prevent map dragging when the mouse is over active drawing vector layers on the map
    // NOTE: editing-highlight-* layers are excluded to avoid interfering with vertex marker dragging
    const activeVectorLayers = [
      "draw-temp-fill-layer",
      "draw-temp-line-layer",
      "draw-temp-circle-layer",
      "measure-line-layer",
      "measure-points-layer",
      "buffer-fill-layer",
      "buffer-outline-layer",
    ];

    activeVectorLayers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.on("mouseenter", layerId, () => {
          map.dragPan.disable();
        });
        map.on("mouseleave", layerId, () => {
          if (!isDraggingVertexRef.current) {
            map.dragPan.enable();
          }
        });
      }
    });
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
      onFeatureClick: curOnFeatureClick,
      editingFeature: curEditingFeature,
      clickedFeature: curClickedFeature,
      splitPoints: curSplitPoints,
    } = stateRef.current;

    // Vertex editing intercept
    if (curEditingFeature) {
      return;
    }

    // Drawing intercept: accumulate points for all vector types
    if (curDrawingLayerId) {
      // If we clicked directly on an existing active drawing vertex, do NOT add a new point
      const vertexFeatures = map.queryRenderedFeatures(e.point, {
        layers: ["draw-temp-circle-layer"],
      });
      if (vertexFeatures && vertexFeatures.length > 0) {
        return;
      }

      setDrawPoints((prev) => [...prev, clickedCoords]);
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

    // B.5 Split geometry cutter tool
    if (curActiveTool === "split-geometry") {
      // If no feature is selected yet OR no split points are drawn yet, allow selecting/switching the target feature by clicking on it
      if (!curClickedFeature || curSplitPoints.length === 0) {
        const activeQueryLayers = curLayers
          .filter((layer) => layer.visible && (layer.type === "fill" || layer.type === "line"))
          .map((layer) => (layer.isUploaded ? `custom-layer-${layer.id}` : `${layer.id}-layer`))
          .filter((layerId) => map.getLayer(layerId));

        if (activeQueryLayers.length > 0) {
          const features = map.queryRenderedFeatures(e.point, {
            layers: activeQueryLayers,
          });
          if (features && features.length > 0) {
            const feat = features[0];
            let layerId = "";
            let layerName = "Data Spasial";

            const matchedLayer = curLayers.find((layer) => {
              const mapLayerId = layer.isUploaded ? `custom-layer-${layer.id}` : `${layer.id}-layer`;
              return feat.layer?.id === mapLayerId;
            });

            if (matchedLayer) {
              layerId = matchedLayer.id;
              layerName = matchedLayer.name;
            }

            const targetLayer = curLayers.find((l) => l.id === layerId);
            
            if (targetLayer) {
              const fIndex = findClickedFeatureIndex(
                targetLayer.geojson,
                [e.lngLat.lng, e.lngLat.lat],
                feat
              );

              curOnFeatureClick({
                layerId: targetLayer.id,
                layerName: layerName,
                properties: feat.properties || {},
                coordinates: e.lngLat.toArray() as [number, number],
                geometry: feat.geometry,
                featureIndex: fIndex >= 0 ? fIndex : undefined,
              } as any);
              return; // Select the feature and exit, don't add to split points yet!
            }
          }
        }
      }

      setSplitPoints((prev) => {
        const updated = [...prev, clickedCoords];
        updateSplitLayer(updated);
        stateRef.current.splitPoints = updated;
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
    const activeQueryLayers = curLayers
      .filter((layer) => layer.visible)
      .map((layer) => (layer.isUploaded ? `custom-layer-${layer.id}` : `${layer.id}-layer`))
      .filter((layerId) => map.getLayer(layerId));

    const features = activeQueryLayers.length > 0
      ? map.queryRenderedFeatures(e.point, { layers: activeQueryLayers })
      : [];

    if (features && features.length > 0) {
      const feature = features[0];
      let layerName = "Data Spasial";
      let layerId = "";

      const matchedLayer = curLayers.find((layer) => {
        const mapLayerId = layer.isUploaded ? `custom-layer-${layer.id}` : `${layer.id}-layer`;
        return feature.layer?.id === mapLayerId;
      });

      if (matchedLayer) {
        layerId = matchedLayer.id;
        layerName = matchedLayer.name;
      }

      // Find feature index in state
      const targetLayer = curLayers.find((l) => l.id === layerId);
      const fIndex = targetLayer
        ? findClickedFeatureIndex(targetLayer.geojson, clickedCoords, feature)
        : -1;

      curOnFeatureClick({
        layerId: layerId,
        layerName: layerName,
        properties: feature.properties || {},
        coordinates: clickedCoords,
        geometry: feature.geometry,
        featureIndex: fIndex >= 0 ? fIndex : undefined,
      } as any);
    } else {
      curOnFeatureClick(null);
    }
  };

  const handleMapDblClick = (e: maplibregl.MapMouseEvent) => {
    const {
      drawingLayerId: curDrawingLayerId,
      layers: curLayers,
      drawProperties: curDrawProperties,
      activeTool: curActiveTool,
      splitPoints: curSplitPoints,
      clickedFeature: curClickedFeature,
    } = stateRef.current;

    if (curActiveTool === "split-geometry") {
      e.originalEvent.preventDefault(); // prevent map zoom on dblclick
      
      const cleanPoints = curSplitPoints.filter((pt, i, arr) => {
        if (i === 0) return true;
        const prevPt = arr[i - 1];
        const isDup = Math.abs(pt[0] - prevPt[0]) < 1e-7 && Math.abs(pt[1] - prevPt[1]) < 1e-7;
        return !isDup;
      });

      if (cleanPoints.length >= 2) {
        if (curClickedFeature && curClickedFeature.layerId && onSplitFeature) {
          onSplitFeature(
            curClickedFeature.layerId as string,
            curClickedFeature.featureIndex as number,
            cleanPoints
          );
        }
        handleClearToolGraphics();
        onChangeTool("none");
      } else {
        alert("Garis pemotong minimal harus memiliki 2 titik!");
      }
      return;
    }

    if (!curDrawingLayerId) return;

    const targetLayer = curLayers.find((l) => l.id === curDrawingLayerId);
    const layerType = targetLayer?.type || "circle";

    if (layerType === "line" || layerType === "fill") {
      e.originalEvent.preventDefault(); // prevent map zoom on dblclick
      
      setDrawPoints((currentPoints) => {
        const cleanPoints = currentPoints.filter((pt, i, arr) => {
          if (i === 0) return true;
          const prevPt = arr[i - 1];
          const isDup = Math.abs(pt[0] - prevPt[0]) < 1e-7 && Math.abs(pt[1] - prevPt[1]) < 1e-7;
          return !isDup;
        });

        const minRequired = layerType === "line" ? 2 : 3;
        if (cleanPoints.length < minRequired) {
          return currentPoints;
        }

        let geom: any = null;
        if (layerType === "line") {
          geom = { type: "LineString", coordinates: cleanPoints };
        } else if (layerType === "fill") {
          geom = {
            type: "Polygon",
            coordinates: [[...cleanPoints, cleanPoints[0]]],
          };
        }

        if (geom) {
          setSessionFeatures((prev) => [
            ...prev,
            {
              geometry: geom,
              properties: {
                nama: `${curDrawProperties.nama || targetLayer?.name || "Objek"} ${prev.length + 1}`,
                keterangan: curDrawProperties.keterangan || "Dibuat secara interaktif",
              },
            },
          ]);
        }
        return []; // Clear active points for the next vector
      });
    }
  };

  const handleFinishCurrentShapeAndStartNew = () => {
    const {
      drawingLayerId: curDrawingLayerId,
      layers: curLayers,
      drawProperties: curDrawProperties,
      drawPoints: curDrawPoints,
    } = stateRef.current;
    if (!curDrawingLayerId) return;

    const targetLayer = curLayers.find((l) => l.id === curDrawingLayerId);
    const layerType = targetLayer?.type || "circle";

    if (layerType === "line" || layerType === "fill") {
      const cleanPoints = curDrawPoints.filter((pt, i, arr) => {
        if (i === 0) return true;
        const prevPt = arr[i - 1];
        return Math.abs(pt[0] - prevPt[0]) > 1e-7 || Math.abs(pt[1] - prevPt[1]) > 1e-7;
      });

      const minRequired = layerType === "line" ? 2 : 3;
      if (cleanPoints.length < minRequired) {
        alert(layerType === "line"
          ? "Garis aktif harus memiliki minimal 2 titik sudut sebelum diselesaikan!"
          : "Area poligon harus memiliki minimal 3 titik sudut sebelum diselesaikan!"
        );
        return;
      }

      let geom: any = null;
      if (layerType === "line") {
        geom = { type: "LineString", coordinates: cleanPoints };
      } else if (layerType === "fill") {
        geom = {
          type: "Polygon",
          coordinates: [[...cleanPoints, cleanPoints[0]]],
        };
      }

      if (geom) {
        setSessionFeatures((prev) => [
          ...prev,
          {
            geometry: geom,
            properties: {
              nama: `${curDrawProperties.nama || targetLayer?.name || "Objek"} ${prev.length + 1}`,
              keterangan: curDrawProperties.keterangan || "Dibuat secara interaktif",
            },
          },
        ]);
      }
      setDrawPoints([]); // Clear active points for the next vector
    }
  };

  const handleMapContextMenu = (e: maplibregl.MapMouseEvent) => {
    const {
      editingFeature: curEditingFeature,
      layers: curLayers,
      activeTool: curActiveTool,
      splitPoints: curSplitPoints,
      clickedFeature: curClickedFeature,
    } = stateRef.current;

    if (curActiveTool === "split-geometry") {
      e.originalEvent.preventDefault();
      
      const cleanPoints = curSplitPoints.filter((pt, i, arr) => {
        if (i === 0) return true;
        const prevPt = arr[i - 1];
        const isDup = Math.abs(pt[0] - prevPt[0]) < 1e-7 && Math.abs(pt[1] - prevPt[1]) < 1e-7;
        return !isDup;
      });

      if (cleanPoints.length >= 2) {
        if (curClickedFeature && curClickedFeature.layerId && onSplitFeature) {
          onSplitFeature(
            curClickedFeature.layerId as string,
            curClickedFeature.featureIndex as number,
            cleanPoints
          );
        }
        handleClearToolGraphics();
        onChangeTool("none");
      } else {
        alert("Garis pemotong minimal harus memiliki 2 titik!");
      }
      return;
    }

    if (!curEditingFeature) return;

    e.originalEvent.preventDefault();

    const clickedCoords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const geom = curEditingFeature.geometry;
    if (geom.type === "Point") {
      return;
    }

    const {
      editingParts: curEditingParts,
      activePartIndex: curActivePartIndex,
    } = stateRef.current;

    setActiveEditingCoords((prev) => {
      if (prev.length === 0) {
        return [clickedCoords];
      }

      let bestIndex = prev.length;
      let minDistance = Infinity;

      const isPolygon = geom.type === "Polygon" || geom.type === "MultiPolygon";

      for (let i = 0; i < prev.length; i++) {
        const p1 = prev[i];
        const p2 = prev[(i + 1) % prev.length];

        if (!isPolygon && i === prev.length - 1) {
          continue;
        }

        const dist = distToSegment(clickedCoords, p1, p2);
        if (dist < minDistance) {
          minDistance = dist;
          bestIndex = i + 1;
        }
      }

      const updated = [...prev];
      updated.splice(bestIndex, 0, clickedCoords);

      const map = mapRef.current;
      if (map) {
        const targetLayer = curLayers.find(
          (l) => l.id === curEditingFeature.layerId,
        );
        const layerType = targetLayer?.type || "circle";

        const updatedParts = curEditingParts.map((p, pIdx) => {
          if (pIdx === curActivePartIndex) {
            return { ...p, coords: updated };
          }
          return p;
        });
        setEditingParts(updatedParts);

        recreateEditingMarkers(map, updated, layerType, geom.type, updatedParts, curActivePartIndex);
      }

      return updated;
    });
  };

  // --- 10. REAL-TIME RENDER UPDATES FOR TOOLS ---

  // Update line string representation on map
  const updateMeasurementLayer = (pts: [number, number][]) => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(
      "measure-line-source",
    ) as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: any[] = [];

    // Line feature
    if (pts.length > 1) {
      features.push({
        type: "Feature",
        properties: { type: "measure-line" },
        geometry: {
          type: "LineString",
          coordinates: pts,
        },
      });
    }

    // Dot features
    pts.forEach((pt) => {
      features.push({
        type: "Feature",
        properties: { type: "measure-node" },
        geometry: {
          type: "Point",
          coordinates: pt,
        },
      });
    });

    source.setData({
      type: "FeatureCollection",
      features: features,
    });
  };

  const updateSplitLayer = (pts: [number, number][]) => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(
      "split-line-source",
    ) as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: any[] = [];

    // Line feature
    if (pts.length > 1) {
      features.push({
        type: "Feature",
        properties: { type: "split-line" },
        geometry: {
          type: "LineString",
          coordinates: pts,
        },
      });
    }

    // Dot features
    pts.forEach((pt) => {
      features.push({
        type: "Feature",
        properties: { type: "split-node" },
        geometry: {
          type: "Point",
          coordinates: pt,
        },
      });
    });

    source.setData({
      type: "FeatureCollection",
      features: features,
    });
  };

  // Update dynamic feature drawing visual representation (includes completed session features + currently active path)
  const syncDrawTempSource = (
    pts: [number, number][],
    type: string,
    completed: any[],
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(
      "draw-temp-source",
    ) as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: any[] = [];

    // 1. Add already completed features from this session
    completed.forEach((f) => {
      features.push({
        type: "Feature",
        properties: f.properties || {},
        geometry: f.geometry,
      });
    });

    // 2. Add current active feature being drawn
    if (type === "fill" && pts.length >= 3) {
      features.push({
        type: "Feature",
        properties: { isTemp: true },
        geometry: {
          type: "Polygon",
          coordinates: [[...pts, pts[0]]],
        },
      });
    }

    if ((type === "line" || type === "fill") && pts.length >= 2) {
      features.push({
        type: "Feature",
        properties: { isTemp: true },
        geometry: {
          type: "LineString",
          coordinates: pts,
        },
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
            coordinates: pt,
          },
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
            coordinates: pt,
          },
        });
      });
    }

    source.setData({
      type: "FeatureCollection",
      features: features,
    });
  };

  // Keep map drawing source in sync with React state
  useEffect(() => {
    if (!drawingLayerId) return;
    const targetLayer = layers.find((l) => l.id === drawingLayerId);
    const layerType = targetLayer?.type || "circle";
    syncDrawTempSource(drawPoints, layerType, sessionFeatures);
  }, [drawPoints, sessionFeatures, drawingLayerId, layers]);

  // Reset draw states when drawing is cancelled (drawingLayerId becomes null)
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      if (drawingLayerId) {
        map.doubleClickZoom.disable();
      } else {
        map.doubleClickZoom.enable();
      }
    }

    if (drawingLayerId) return;
    setDrawPoints([]);
    setSessionFeatures([]);
    setDrawDragOffset({ x: 0, y: 0 });
    if (map) {
      const source = map.getSource(
        "draw-temp-source",
      ) as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }
  }, [drawingLayerId]);

  // Update buffer polygon visual
  const updateBufferLayer = (center: [number, number], rKm: number) => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("buffer-source") as maplibregl.GeoJSONSource;
    if (!source) return;

    const bufferGeoJSON = generateCircularBufferGeoJSON(center, rKm);
    source.setData({
      type: "FeatureCollection",
      features: [bufferGeoJSON],
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
      total += calculateHaversineDistance(
        measurePoints[i],
        measurePoints[i + 1],
      );
    }
    return total;
  };

  // Clear current active tools graphics
  const handleClearToolGraphics = () => {
    setMeasurePoints([]);
    setSplitPoints([]);
    setBufferCenter(null);
    updateMeasurementLayer([]);
    updateSplitLayer([]);

    const map = mapRef.current;
    if (map) {
      const bufSource = map.getSource(
        "buffer-source",
      ) as maplibregl.GeoJSONSource;
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

  // Capture map and open print/export dialog
  const handleCaptureMap = () => {
    setIsCapturing(true);
    const map = mapRef.current;
    if (!map) {
      setIsCapturing(false);
      alert("Peta belum siap. Silakan tunggu hingga peta selesai dimuat.");
      return;
    }

    // Buka modal terlebih dahulu agar user bisa melihat layout settings
    setPrintDialogOpen(true);
    setCapturedMapUrl(null);

    // Tunggu map selesai render sebelum menangkap canvas
    if (map.isStyleLoaded() && !map.isMoving()) {
      captureCanvas(map);
    } else {
      map.once("idle", () => {
        captureCanvas(map);
      });
    }
  };

  const captureCanvas = (map: maplibregl.Map) => {
    try {
      // Force render selesai dengan meminta render frame
      map.triggerRepaint();

      // Gunakan requestAnimationFrame untuk memastikan WebGL buffer ter-update
      requestAnimationFrame(() => {
        try {
          const canvas = map.getCanvas();
          if (!canvas) {
            throw new Error("Canvas peta tidak ditemukan");
          }

          // Baca pixel pertama untuk memaksa WebGL menyelesaikan rendering ke buffer
          const gl = canvas.getContext("webgl") || canvas.getContext("webgl2");
          if (gl) {
            const pixel = new Uint8Array(4);
            (gl as WebGLRenderingContext).readPixels(
              0,
              0,
              1,
              1,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixel,
            );
          }

          const dataUrl = canvas.toDataURL("image/png");

          if (!dataUrl || dataUrl === "data:," || dataUrl.length < 100) {
            throw new Error("Gambar peta kosong atau tidak valid");
          }

          setCapturedMapUrl(dataUrl);
        } catch (innerErr) {
          console.error("Gagal menangkap kanvas peta:", innerErr);
          // Set capturedMapUrl tetap null agar modal menampilkan pesan error
          setCapturedMapUrl(null);
        } finally {
          setIsCapturing(false);
        }
      });
    } catch (err) {
      console.error("Gagal menangkap kanvas peta:", err);
      setCapturedMapUrl(null);
      setIsCapturing(false);
    }
  };

  // High-fidelity local print handler via temporary hidden iframe
  const handlePrintPDF = () => {
    const paperEl = document.getElementById("print-layout-paper");
    if (!paperEl) {
      alert("Elemen lembar cetak tidak ditemukan!");
      return;
    }

    // Create a temporary iframe for printing
    const iframe = document.createElement("iframe");
    iframe.name = "print_iframe";
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.left = "-10000px";
    iframe.style.top = "-10000px";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      alert("Gagal membuka window cetak!");
      return;
    }

    // Capture styles (excluding @media print to avoid conflicts in the iframe)
    let stylesHtml = "";
    for (const styleSheet of Array.from(document.styleSheets)) {
      try {
        let rulesHtml = "";
        for (const rule of Array.from(styleSheet.cssRules)) {
          // Skip @media print rules as they can conflict with our iframe print setup
          if (
            rule.type === CSSRule.MEDIA_RULE &&
            (rule as CSSMediaRule).media?.mediaText?.includes("print")
          ) {
            continue;
          }
          rulesHtml += rule.cssText;
        }
        if (rulesHtml) {
          stylesHtml += `<style>${rulesHtml}</style>`;
        }
      } catch (e) {
        // Fallback for cross-origin sheets (like google fonts link, etc.)
        if (styleSheet.href) {
          stylesHtml += `<link rel="stylesheet" href="${styleSheet.href}">`;
        }
      }
    }

    // Also copy direct link elements (excluding any style elements with @media print)
    document.querySelectorAll("link[rel='stylesheet']").forEach((link) => {
      stylesHtml += link.outerHTML;
    });

    const isPortrait = printOrientation === "portrait";
    const widthMm =
      printPaperSize === "A4"
        ? isPortrait
          ? "210mm"
          : "297mm"
        : isPortrait
          ? "297mm"
          : "420mm";
    const heightMm =
      printPaperSize === "A4"
        ? isPortrait
          ? "297mm"
          : "210mm"
        : isPortrait
          ? "420mm"
          : "594mm";

    // Write html inside iframe
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printTitle || "Peta Cetak"}</title>
          ${stylesHtml}
          <style>
            @page {
              size: ${printPaperSize === "A4" ? "A4" : "A3"} ${printOrientation};
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background-color: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #print-paper-wrapper {
              width: ${widthMm};
              height: ${heightMm};
              max-width: 100% !important;
              max-height: 100% !important;
              box-sizing: border-box;
              margin: 0 auto;
              padding: 8mm;
              background: white !important;
              color: black !important;
              overflow: hidden;
              position: relative;
            }
            /* Override the container styles so that it fills the exact paper size printed */
            .print-paper-class {
              width: 100% !important;
              height: 100% !important;
              max-height: none !important;
              max-width: none !important;
              border: 4px double black !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 6px !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: ${isPortrait ? "column" : "row"} !important;
              background: white !important;
              color: black !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div id="print-paper-wrapper">
            <div class="${paperEl.className} print-paper-class">
              ${paperEl.innerHTML}
            </div>
          </div>
          <script>
            // Strip any focus/selection overlays and checkmarks
            document.querySelectorAll('.ring-2, .ring-sky-400').forEach(el => {
              el.style.ring = "none";
              el.style.outline = "none";
              el.style.boxShadow = "none";
              el.className = el.className.replace(/ring-\\S+/g, '').replace(/ring-offset-\\S+/g, '');
            });
            // Hide selection badges and buttons
            document.querySelectorAll('.print\\\\:hidden, button').forEach(el => {
              el.style.display = "none";
            });
            // Run print when resources have loaded
            window.onload = function() {
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 1000);
              }, 800);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  const isPortrait = printOrientation === "portrait";
  const paperWidth =
    printPaperSize === "A4"
      ? isPortrait
        ? "210mm"
        : "297mm"
      : isPortrait
        ? "297mm"
        : "420mm";
  const paperHeight =
    printPaperSize === "A4"
      ? isPortrait
        ? "297mm"
        : "210mm"
      : isPortrait
        ? "420mm"
        : "594mm";

  // Handle logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPrintLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPrintLogo(null);
    if (printLogoInputRef.current) {
      printLogoInputRef.current.value = "";
    }
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

  // Real-time geolocation detection with safe fallback
  const handleLocateUser = () => {
    if (!mapRef.current) return;
    setIsLocating(true);
    showToast("Mendeteksi lokasi geografis Anda secara real-time...");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setIsLocating(false);
          showToast("Lokasi terdeteksi! Mengarahkan peta ke koordinat Anda.");
          
          mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: 15.5,
            duration: 1500,
          });
        },
        (error) => {
          console.error("Gagal mendeteksi lokasi:", error);
          setIsLocating(false);
          showToast("Gagal mendeteksi lokasi (Izin ditolak/Timeout). Diarahkan ke lokasi default.");
          
          mapRef.current?.flyTo({
            center: BANDA_ACEH_CENTER,
            zoom: 13,
            duration: 1200,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0,
        }
      );
    } else {
      setIsLocating(false);
      showToast("Browser tidak mendukung Geolocation. Diarahkan ke lokasi default.");
      mapRef.current?.flyTo({
        center: BANDA_ACEH_CENTER,
        zoom: 13,
        duration: 1200,
      });
    }
  };

  return (
    <div className="flex-1 h-full relative bg-[#0f172a] flex flex-col overflow-hidden">
      {/* Real-time elegant toast notification banner */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-[#0f172a]/95 border-2 border-[#38bdf8] text-slate-100 px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 text-xs font-medium font-sans animate-in fade-in slide-in-from-top-4 duration-200 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Main Map Canvas Container */}
      <div
        id="main-map"
        ref={mapContainerRef}
        className="w-full h-full flex-1 relative z-0"
      />

      {/* 2. Synchronized Mini Map Container (Requirements Spec: Mini Map) */}
      <div
        id="mini-map-box"
        className={`absolute bottom-5 right-5 w-40 h-40 sm:w-48 sm:h-48 rounded-xl border-2 border-[#334155] bg-[#0f172a] shadow-2xl z-35 overflow-hidden transition-all duration-300 hover:scale-105 hover:border-[#38bdf8] group ${
          showMiniMap ? "hidden md:block" : "hidden"
        }`}
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
        </button>

        <button
          onClick={handleToggle3D}
          className={`cursor-pointer p-2.5 rounded-lg border shadow-lg font-sans text-xs flex items-center justify-center gap-1.5 transition-all ${
            is3DMode
              ? "bg-[#434955] border-[#38bdf8] text-slate-950 font-bold"
              : "bg-[#0f172a] border-[#334155] text-slate-300 hover:bg-[#1e293b] hover:text-white"
          }`}
          title="Ganti Sudut Pandang 3D"
        >
          <svg
            fill="#38bdf8"
            version="1.1"
            id="Capa_1"
            xmlns="http://www.w3.org/2000/svg"
            width="24px"
            height="24px"
            viewBox="0 0 51.463 51.463"
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g
              id="SVGRepo_tracerCarrier"
              strokeLinecap="round"
              strokeLinejoin="round"
            ></g>
            <g id="SVGRepo_iconCarrier">
              {" "}
              <g>
                {" "}
                <g>
                  {" "}
                  <path d="M24.832,22.621V33.15c0.903,0.114,2.122,0.204,3.747,0.204c2.96,0,5.373-0.7,6.889-2.079 c1.448-1.311,2.372-3.343,2.372-6.051c0-2.598-0.905-4.407-2.372-5.603c-1.398-1.175-3.363-1.764-6.209-1.764l-4.427,0.038v2.167 l4.672-0.034c3.479,0,5.422,1.919,5.397,5.284c0,3.864-2.145,5.85-5.756,5.828c-0.566,0-1.15,0-1.537-0.067v-8.453H24.832z"></path>{" "}
                  <path d="M18.118,31.155c-1.451,0-2.874-0.584-3.459-0.936l-0.654,2.175c0.819,0.536,2.408,1.048,4.254,1.048 c3.76,0,5.909-2.029,5.909-4.601c0-2.056-1.494-3.458-3.34-3.784v-0.047c1.867-0.657,2.801-1.962,2.801-3.553 c0-1.987-1.61-3.715-4.741-3.715c-1.822,0-3.506,0.562-4.369,1.17l0.655,2.078c0.63-0.421,1.867-0.96,3.104-0.96 c1.66,0,2.435,0.866,2.435,1.896c0,1.519-1.681,2.126-3.016,2.126h-1.283v2.104h1.332c1.748,0,3.429,0.771,3.429,2.568 C21.204,29.918,20.313,31.155,18.118,31.155z"></path>{" "}
                  <path d="M8.832,11.011l8.335,2.675c0.059,0.084,0.153,0.137,0.256,0.137c0.032,0,0.065-0.005,0.098-0.017l0.011-0.003l7.917,2.541 c0.03,0.01,0.063,0.015,0.095,0.015c0.031,0,0.063-0.005,0.094-0.015l7.6-2.438c0.007,0,0.013,0.003,0.02,0.003 c0.071,0,0.141-0.026,0.194-0.071L50.16,8.475c0.129-0.041,0.216-0.161,0.216-0.295c0-0.135-0.087-0.255-0.216-0.296L25.636,0.015 c-0.061-0.02-0.127-0.02-0.188,0L0.926,7.883C0.798,7.924,0.71,8.044,0.71,8.179s0.088,0.254,0.216,0.295L8.832,11.011 C8.831,11.011,8.831,11.011,8.832,11.011z M17.527,13.149l-7.605-2.44l7.012-2.352l7.378,2.518L17.527,13.149z M17.903,8.032 l7.534-2.525l7.462,2.488l-7.619,2.555L17.903,8.032z M25.543,15.722l-7.018-2.252l6.755-2.264l6.95,2.371L25.543,15.722z M33.22,13.258l-6.971-2.378l7.631-2.559l7.221,2.407L33.22,13.258z M41.513,5.761l7.534,2.418l-6.978,2.239 c-0.025-0.02-0.053-0.038-0.084-0.048l-7.127-2.376l6.646-2.229C41.507,5.765,41.51,5.762,41.513,5.761z M40.517,5.441 l-6.638,2.226l-7.463-2.488l6.496-2.178L40.517,5.441z M25.543,0.636l6.371,2.044l-6.478,2.172l-6.391-2.131L25.543,0.636z M18.053,3.039c0.009,0.004,0.017,0.012,0.026,0.016l6.378,2.126l-7.523,2.522l-6.501-2.219L18.053,3.039z M9.479,5.791 c0.029,0.024,0.063,0.046,0.103,0.06l6.383,2.177l-7.041,2.361L2.037,8.18L9.479,5.791z"></path>{" "}
                  <path d="M50.54,42.987l-24.521-8.006c-0.063-0.021-0.13-0.021-0.193,0L1.304,42.987c-0.128,0.042-0.214,0.162-0.214,0.296 c0,0.136,0.088,0.255,0.216,0.296l7.693,2.469c0.023,0.011,0.047,0.019,0.072,0.022l16.756,5.377 c0.03,0.011,0.063,0.016,0.094,0.016c0.032,0,0.064-0.005,0.095-0.016l24.521-7.868c0.128-0.041,0.215-0.16,0.216-0.296 C50.753,43.148,50.667,43.029,50.54,42.987z M33.254,37.998l7.562,2.469l-6.733,2.284l-7.485-2.511l6.615-2.218 C33.228,38.017,33.239,38.005,33.254,37.998z M33.11,43.079l-7.354,2.494l-7.555-2.519l7.419-2.487L33.11,43.079z M25.921,35.604 l6.357,2.076l-6.659,2.233l-6.363-2.134L25.921,35.604z M18.271,38.102c0.004,0.002,0.008,0.005,0.012,0.006l6.359,2.132 l-7.421,2.488l-6.493-2.164L18.271,38.102z M2.409,43.28l7.341-2.396c0.014,0.007,0.023,0.017,0.037,0.021l6.455,2.152 l-7.105,2.382L2.409,43.28z M10.134,45.76l7.088-2.376l7.561,2.521l-6.904,2.342L10.134,45.76z M25.921,50.825l-7.049-2.262 l6.885-2.335l7.105,2.37L25.921,50.825z M33.81,48.295c-0.033-0.033-0.07-0.061-0.117-0.075l-6.961-2.321l7.352-2.494l7.316,2.454 L33.81,48.295z M42.399,45.539l-7.346-2.464l6.655-2.257c0.024-0.008,0.045-0.024,0.065-0.039l7.66,2.5L42.399,45.539z"></path>{" "}
                  <path d="M1.09,10.664v29.175c0,0.171,0.139,0.311,0.31,0.311c0.173,0,0.312-0.139,0.312-0.311V10.664 c0-0.171-0.139-0.311-0.312-0.311C1.229,10.354,1.09,10.493,1.09,10.664z"></path>{" "}
                  <path d="M9.276,13.893V36.61c0,0.146,0.118,0.265,0.265,0.265c0.146,0,0.264-0.118,0.264-0.265V13.893 c0-0.146-0.118-0.265-0.264-0.265C9.394,13.628,9.276,13.746,9.276,13.893z"></path>{" "}
                  <path d="M49.86,10.421c-0.172,0-0.311,0.139-0.311,0.311v29.175c0,0.173,0.139,0.312,0.311,0.312s0.312-0.139,0.312-0.312V10.731 C50.171,10.561,50.032,10.421,49.86,10.421z"></path>{" "}
                  <path d="M41.458,13.96v22.719c0,0.146,0.118,0.265,0.266,0.265c0.146,0,0.264-0.119,0.264-0.265V13.96 c0-0.146-0.118-0.265-0.264-0.265C41.576,13.695,41.458,13.813,41.458,13.96z"></path>{" "}
                </g>{" "}
              </g>{" "}
            </g>
          </svg>
        </button>

        {/* Real-time Geolocation Control */}
        <button
          onClick={handleLocateUser}
          disabled={isLocating}
          className={`cursor-pointer p-2.5 rounded-lg border shadow-lg font-sans text-xs flex items-center justify-center transition-all ${
            isLocating
              ? "bg-[#1e293b] border-amber-500 text-amber-400 font-bold animate-pulse"
              : "bg-[#0f172a] border-[#334155] text-slate-300 hover:bg-[#1e293b] hover:text-white"
          }`}
          title="Deteksi & Zoom ke Lokasi Saya"
        >
          <Locate className={`w-4 h-4 ${isLocating ? "animate-spin text-amber-400" : "text-[#38bdf8]"}`} />
        </button>

        {/* Toggle Mini Map Control */}
        <button
          onClick={() => setShowMiniMap((prev) => !prev)}
          className={`hidden md:flex cursor-pointer p-2.5 rounded-lg border shadow-lg font-sans text-xs items-center justify-center transition-all ${
            showMiniMap
              ? "bg-[#1e293b]/90 border-[#38bdf8]/80 text-[#38bdf8] font-bold"
              : "bg-[#0f172a] border-[#334155] text-slate-400 hover:bg-[#1e293b] hover:text-white"
          }`}
          title={showMiniMap ? "Sembunyikan Mini Map Overview" : "Tampilkan Mini Map Overview"}
        >
          {showMiniMap ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col rounded-lg bg-[#0f172a] border border-[#334155] shadow-lg overflow-hidden">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="p-2.5 text-slate-300 hover:text-white hover:bg-[#1e293b] transition-colors border-b border-[#334155] cursor-pointer"
            title="Zoom In"
          >
            <svg
              width="24px"
              height="24px"
              viewBox="0 0 24 24"
              fill="#38bdf8"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                {" "}
                <path
                  d="M4 12H20M12 4V20"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>{" "}
              </g>
            </svg>
          </button>

          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="p-2.5 text-slate-300 hover:text-white hover:bg-[#1e293b] transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <svg
              width="24px"
              height="24px"
              viewBox="0 0 24 24"
              fill="#38bdf8"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                {" "}
                <path
                  d="M6 12L18 12"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>{" "}
              </g>
            </svg>
          </button>
        </div>
      </div>

      {/* Measure HUD Panel (Active when tool is measure-distance) */}
      {activeTool === "measure-distance" && (
        isMeasurePanelMinimized ? (
          <div
            style={{
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
            className="absolute bg-[#0f172a]/95 border-2 border-sky-500 rounded-lg shadow-xl px-3 py-2.5 z-40 w-[92%] max-w-sm text-slate-100 flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs select-none"
          >
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                <span className="font-bold text-[11px]">Ukur Jarak Spasial</span>
              </div>
              <div className="text-[11px] font-mono font-bold text-amber-400">
                {getMeasuredDistance().toFixed(3)} km ({measurePoints.length} Pts)
              </div>
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={handleClearToolGraphics}
                className="flex-1 py-1 px-2 bg-[#1e293b] hover:bg-[#334155] text-slate-300 font-bold font-mono rounded text-[10px] border border-[#334155] transition-all cursor-pointer"
                title="Reset Garis"
              >
                Reset Garis
              </button>
              <button
                type="button"
                onClick={() => setIsMeasurePanelMinimized(false)}
                className="py-1 px-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold font-mono rounded text-[10px] transition-all cursor-pointer"
              >
                ⚙️ Detail
              </button>
              <button
                type="button"
                onClick={() => onChangeTool("none")}
                className="p-1 bg-slate-800 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-5 left-5 bg-[#0f172a]/95 text-slate-100 p-4 rounded-xl border border-[#334155] shadow-2xl z-30 max-w-xs animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-[#38bdf8]/10 text-[#38bdf8] p-1.5 rounded border border-[#38bdf8]/20">
                  <Ruler className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs">Ukur Jarak Spasial</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Haversine formula
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMeasurePanelMinimized(true)}
                className="px-2 py-0.5 bg-sky-500/10 hover:bg-sky-500/30 text-sky-400 border border-sky-500/20 rounded text-[9px] font-mono transition-all cursor-pointer"
                title="Sembunyikan panel lengkap"
              >
                🗕 Ringkas
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="text-[11px] text-slate-300 bg-[#1e293b]/80 p-2 rounded border border-[#334155]">
                💡 <span className="font-semibold text-slate-200">Petunjuk:</span>{" "}
                Klik berurutan pada peta untuk menarik garis ukur.
              </p>

              <div className="p-2 bg-[#1e293b]/50 rounded border border-[#334155]">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">
                  Jumlah Titik
                </span>
                <p className="font-bold text-[#38bdf8] mt-0.5 font-mono">
                  {measurePoints.length} Titik Koordinat
                </p>
              </div>

              <div className="p-2 bg-[#1e293b]/50 rounded border border-[#334155]">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">
                  Total Jarak Linier
                </span>
                <p className="font-extrabold text-base text-amber-400 mt-0.5 font-mono">
                  {getMeasuredDistance().toFixed(3)}{" "}
                  <span className="text-xs font-semibold text-slate-400">km</span>
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
        )
      )}

      {/* Split Geometry HUD Panel */}
      {activeTool === "split-geometry" && (
        isSplitPanelMinimized ? (
          // MINIMIZED HUD (Perfect for mobile, won't cover screen)
          <div
            style={{
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
            className="absolute bg-[#0f172a]/95 border-2 border-orange-500 rounded-lg shadow-xl px-3 py-2 z-40 w-[92%] max-w-sm text-slate-100 flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs select-none"
          >
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                  <Scissors className="w-2.5 h-2.5" />
                </span>
                <span className="font-bold text-[11px] text-orange-400">Potong Geometri</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsSplitPanelMinimized(false)}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono rounded text-[10px] border border-slate-700 transition-colors cursor-pointer"
                >
                  ⚙️ Detail
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTool("none")}
                  className="p-1 bg-slate-800 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {clickedFeature ? (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <p className="text-slate-300 truncate max-w-[180px] font-medium">
                    🎯 {clickedFeature.properties?.nama || clickedFeature.properties?.Name || clickedFeature.properties?.Nama || `Fitur #${clickedFeature.featureIndex}`}
                  </p>
                  <p className="text-orange-400 font-mono font-semibold">
                    {splitPoints.length} Titik
                  </p>
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onFeatureClick(null);
                      setSplitPoints([]);
                      updateSplitLayer([]);
                    }}
                    className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold font-mono rounded text-[10px] border border-slate-700 transition-colors cursor-pointer"
                  >
                    Ganti
                  </button>

                  {splitPoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSplitPoints([]);
                        updateSplitLayer([]);
                      }}
                      className="py-1 px-2 bg-slate-800 hover:bg-red-500/10 text-red-400 font-mono rounded text-[10px] border border-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer flex items-center justify-center"
                      title="Hapus garis"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    disabled={splitPoints.length < 2}
                    onClick={() => {
                      if (onSplitFeature && clickedFeature?.layerId) {
                        onSplitFeature(
                          clickedFeature.layerId as string,
                          clickedFeature.featureIndex as number,
                          splitPoints
                        );
                      }
                      handleClearToolGraphics();
                      onChangeTool("none");
                    }}
                    className={`flex-1 py-1 px-2.5 rounded text-[10px] font-bold font-mono text-center flex items-center justify-center gap-1 border transition-all ${
                      splitPoints.length >= 2
                        ? "bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-md cursor-pointer"
                        : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Potong!
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-mono text-center leading-relaxed py-0.5">
                👉 Klik satu fitur (Polygon/Line) pada peta untuk dipotong
              </p>
            )}
          </div>
        ) : (
          // MAXIMIZED HUD (Desktop-friendly or expanded overlay)
          <div className="absolute bottom-5 left-5 bg-[#0f172a]/95 text-slate-100 p-4 rounded-xl border-2 border-orange-500 shadow-2xl z-30 w-80 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-orange-500/10 text-orange-400 p-1.5 rounded border border-orange-500/20">
                  <Scissors className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-bold text-xs">Potong Geometri (Split)</h3>
                  <p className="text-[10px] text-orange-400 font-mono">
                    Menggunakan garis pemotong
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsSplitPanelMinimized(true)}
                  className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono rounded text-[10px] border border-slate-700 transition-colors cursor-pointer"
                >
                  Sembunyikan
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTool("none")}
                  className="p-1 bg-slate-800 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {clickedFeature ? (
                <>
                  <div className="p-2 bg-[#1e293b]/80 rounded border border-orange-500/30 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-orange-400 uppercase tracking-wider font-mono">
                        Fitur Terpilih:
                      </span>
                      <p className="font-bold text-slate-100 truncate mt-0.5">
                        {clickedFeature.properties?.nama || clickedFeature.properties?.Name || clickedFeature.properties?.Nama || `Fitur #${clickedFeature.featureIndex}`}
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Layer: {clickedFeature.layerId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onFeatureClick(null);
                        setSplitPoints([]);
                        updateSplitLayer([]);
                      }}
                      className="ml-2 px-2 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 hover:text-white transition-colors cursor-pointer"
                    >
                      Ganti
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-300 bg-[#1e293b]/40 p-2 rounded border border-[#334155]">
                    💡 <span className="font-semibold text-orange-400">Petunjuk:</span>{" "}
                    Klik kiri pada peta untuk mulai menggambar garis pemotong (jingga putus-putus) melintasi fitur di atas. Klik minimal 2 titik.
                  </p>

                  <div className="p-2 bg-[#1e293b]/50 rounded border border-[#334155] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">
                        Titik Pemotong
                      </span>
                      <p className="font-bold text-orange-400 mt-0.5 font-mono">
                        {splitPoints.length} Titik
                      </p>
                    </div>
                    {splitPoints.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSplitPoints([]);
                          updateSplitLayer([]);
                        }}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#1e293b] rounded transition-colors"
                        title="Hapus garis"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={splitPoints.length < 2}
                      onClick={() => {
                        if (onSplitFeature && clickedFeature?.layerId) {
                          onSplitFeature(
                            clickedFeature.layerId as string,
                            clickedFeature.featureIndex as number,
                            splitPoints
                          );
                        }
                        handleClearToolGraphics();
                        onChangeTool("none");
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold font-mono text-center flex items-center justify-center gap-1.5 border transition-all ${
                        splitPoints.length >= 2
                          ? "bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-lg cursor-pointer"
                          : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                      }`}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      Potong Fitur!
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-3 text-center bg-[#1e293b]/40 rounded-lg border border-[#334155] space-y-2">
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    ⚠️ <span className="font-semibold text-slate-200">Peringatan:</span>{" "}
                    Belum ada fitur terpilih untuk dipotong.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Silakan klik salah satu fitur Polygon atau LineString pada peta untuk memulai pemotongan.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Buffer Generator Slider Panel */}
      {activeTool === "buffer-generator" && (
        isBufferPanelMinimized ? (
          <div
            style={{
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
            className="absolute bg-[#0f172a]/95 border-2 border-emerald-500 rounded-lg shadow-xl px-3 py-2.5 z-40 w-[92%] max-w-sm text-slate-100 flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs select-none"
          >
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-bold text-[11px]">Area Penyangga (Buffer)</span>
              </div>
              <div className="text-[11px] font-mono font-bold text-[#38bdf8] bg-slate-900 px-1.5 py-0.5 rounded border border-[#334155]">
                {bufferRadius.toFixed(1)} km
              </div>
            </div>

            {/* slider inline */}
            <input
              type="range"
              min="0.2"
              max="5.0"
              step="0.1"
              value={bufferRadius}
              onChange={(e) =>
                handleBufferRadiusChange(parseFloat(e.target.value))
              }
              className="w-full h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
            />

            <div className="flex items-center justify-between gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={handleClearToolGraphics}
                className="flex-1 py-1 px-2 bg-slate-800 hover:bg-[#334155] text-slate-300 font-bold font-mono rounded text-[10px] border border-[#334155] transition-all cursor-pointer"
              >
                Hapus Buffer
              </button>
              <button
                type="button"
                onClick={() => setIsBufferPanelMinimized(false)}
                className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono rounded text-[10px] transition-all cursor-pointer"
              >
                ⚙️ Detail
              </button>
              <button
                type="button"
                onClick={() => onChangeTool("none")}
                className="p-1 bg-slate-800 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute bottom-5 left-5 bg-[#0f172a]/95 text-slate-100 p-4 rounded-xl border border-[#334155] shadow-2xl z-30 w-72 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-[#38bdf8]/10 text-[#38bdf8] p-1.5 rounded border border-[#38bdf8]/20">
                  <Radio className="w-4 h-4 animate-ping" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#38bdf8]">
                    Generator Buffer Spasial
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Area circle overlay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBufferPanelMinimized(true)}
                className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-mono transition-all cursor-pointer"
                title="Sembunyikan panel lengkap"
              >
                🗕 Ringkas
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <p className="text-[11px] text-slate-300 bg-[#1e293b]/80 p-2 rounded border border-[#334155]">
                📍 <span className="font-semibold text-slate-200">Petunjuk:</span>{" "}
                Klik di mana saja pada peta untuk menggambar area penyangga
                melingkar.
              </p>

              {/* Slider control */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-slate-400 uppercase tracking-wider">
                    Radius Buffer
                  </span>
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
                  onChange={(e) =>
                    handleBufferRadiusChange(parseFloat(e.target.value))
                  }
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
                  <span className="text-slate-500 uppercase tracking-wider">
                    Titik Pusat Buffer
                  </span>
                  <p className="text-[#38bdf8] mt-0.5 truncate font-semibold">
                    Lon: {bufferCenter[0].toFixed(5)} | Lat:{" "}
                    {bufferCenter[1].toFixed(5)}
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
        )
      )}

      {/* 4. PIN CREATION POPUP DIALOG */}
      {pinDialogCoords && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div
            style={{
              transform: `translate(calc(-50% + ${pinDragOffset.x}px), ${pinDragOffset.y}px)`,
              top: "100px",
              left: "50%",
            }}
            className="pointer-events-auto absolute bg-[#0f172a]/95 border border-[#334155] rounded-xl shadow-2xl p-5 w-full max-w-sm text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-150 select-none"
          >
            <div
              onMouseDown={handlePinDragMouseDown}
              className="flex justify-between items-center border-b border-[#334155] pb-2.5 cursor-move select-none"
              title="Seret header ini untuk memindahkan dialog"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-orange-500 animate-bounce" />
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                  Tambah Penanda Kustom
                  <span className="text-[9px] text-[#38bdf8] font-normal normal-case animate-pulse font-mono">
                    (Seret Panel ⬘)
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPinDialogCoords(null)}
                className="text-slate-400 hover:text-white font-bold text-xs hover:bg-[#1e293b] px-1.5 py-0.5 rounded cursor-pointer"
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
                <span className="uppercase font-bold block text-[8px] tracking-wider mb-1 text-slate-500">
                  Koordinat Terpilih
                </span>
                <p className="text-slate-300">
                  Lon: {pinDialogCoords[0].toFixed(6)}
                </p>
                <p className="text-slate-300">
                  Lat: {pinDialogCoords[1].toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING FEATURE VERTEX EDITING OVERLAY */}
      {editingFeature &&
        (() => {
          const targetLayer = layers.find(
            (l) => l.id === editingFeature.layerId,
          );
          const geomType = editingFeature.geometry?.type || "Point";

          const handleAddVertexAtCenter = () => {
            const map = mapRef.current;
            if (!map) return;
            const center = map.getCenter();
            const newCoord: [number, number] = [center.lng, center.lat];
            const updated = [...activeEditingCoords, newCoord];
            setActiveEditingCoords(updated);

            const updatedParts = editingParts.map((p, idx) => {
              if (idx === activePartIndex) {
                return { ...p, coords: updated };
              }
              return p;
            });
            setEditingParts(updatedParts);

            recreateEditingMarkers(
              map,
              updated,
              targetLayer?.type || "circle",
              geomType,
              updatedParts,
              activePartIndex
            );
          };

          const handleDeleteVertex = (idxToDelete: number) => {
            const map = mapRef.current;
            if (!map) return;
            const updated = activeEditingCoords.filter(
              (_, idx) => idx !== idxToDelete,
            );
            setActiveEditingCoords(updated);

            const updatedParts = editingParts.map((p, idx) => {
              if (idx === activePartIndex) {
                return { ...p, coords: updated };
              }
              return p;
            });
            setEditingParts(updatedParts);

            recreateEditingMarkers(
              map,
              updated,
              targetLayer?.type || "circle",
              geomType,
              updatedParts,
              activePartIndex
            );
          };

          const handleSaveEdits = () => {
            if (activeEditingCoords.length === 0) return;

            // First, save the current activeEditingCoords into current activePartIndex of editingParts
            const finalParts = editingParts.map((p, idx) => {
              if (idx === activePartIndex) {
                return { ...p, coords: activeEditingCoords };
              }
              return p;
            });

            let finalGeom: any = null;
            let targetGeomType = geomType;

            // If there's more than 1 part, or the user added a part, we should use Multi geometries
            if (finalParts.length > 1) {
              if (geomType === "LineString" || geomType === "MultiLineString") {
                targetGeomType = "MultiLineString";
              } else if (geomType === "Polygon" || geomType === "MultiPolygon") {
                targetGeomType = "MultiPolygon";
              }
            }

            if (targetGeomType === "Point") {
              finalGeom = {
                type: "Point",
                coordinates: finalParts[0]?.coords[0] || activeEditingCoords[0],
              };
            } else if (targetGeomType === "MultiPoint") {
              finalGeom = {
                type: "MultiPoint",
                coordinates: finalParts.map(p => p.coords[0]),
              };
            } else if (targetGeomType === "LineString") {
              finalGeom = {
                type: "LineString",
                coordinates: finalParts[0]?.coords || activeEditingCoords,
              };
            } else if (targetGeomType === "MultiLineString") {
              finalGeom = {
                type: "MultiLineString",
                coordinates: finalParts.map(p => p.coords),
              };
            } else if (targetGeomType === "Polygon") {
              finalGeom = {
                type: "Polygon",
                coordinates: finalParts.map(p => [...p.coords, p.coords[0]]),
              };
            } else if (targetGeomType === "MultiPolygon") {
              // Group parts by polyIndex
              const polyGroups: Record<number, EditPart[]> = {};
              finalParts.forEach(p => {
                const pIdx = p.polyIndex ?? 0;
                if (!polyGroups[pIdx]) polyGroups[pIdx] = [];
                polyGroups[pIdx].push(p);
              });

              const coordinates: any[] = [];
              Object.keys(polyGroups).forEach(pIdxKey => {
                const pIdx = Number(pIdxKey);
                const rings = polyGroups[pIdx].map(p => [...p.coords, p.coords[0]]);
                coordinates.push(rings);
              });

              finalGeom = {
                type: "MultiPolygon",
                coordinates
              };
            }

            if (onSaveEditedFeature) {
              onSaveEditedFeature(
                editingFeature.layerId,
                editingFeature.featureIndex,
                finalGeom,
                editProperties,
              );
            }
          };

          const handleAddNewPart = (type: "exterior" | "interior" | "line") => {
            const map = mapRef.current;
            if (!map) return;
            const center = map.getCenter();
            const cLng = center.lng;
            const cLat = center.lat;

            // Let's create a default small triangle/line around the center
            const delta = 0.001;
            let newCoords: [number, number][] = [];
            if (type === "line") {
              newCoords = [
                [cLng - delta, cLat - delta],
                [cLng + delta, cLat + delta]
              ];
            } else {
              // Triangle for polygon exterior/interior
              newCoords = [
                [cLng, cLat + delta],
                [cLng + delta, cLat - delta],
                [cLng - delta, cLat - delta]
              ];
            }

            // 1. Save current activeEditingCoords into current activePartIndex of editingParts
            const savedParts = editingParts.map((p, idx) => {
              if (idx === activePartIndex) {
                return { ...p, coords: activeEditingCoords };
              }
              return p;
            });

            // Calculate new polyIndex and ringIndex
            let newPolyIndex = 0;
            let newRingIndex = 0;
            let newLabel = "";

            if (geomType.includes("Polygon")) {
              if (type === "exterior") {
                // Find the maximum polyIndex in current parts
                const maxPolyIdx = Math.max(...savedParts.map(p => p.polyIndex ?? 0), -1);
                newPolyIndex = maxPolyIdx + 1;
                newRingIndex = 0;
                newLabel = `Poligon ${newPolyIndex + 1}: Batas Luar`;
              } else {
                // Add hole to the currently active part's polygon index
                const activePart = savedParts[activePartIndex];
                const activePolyIdx = activePart?.polyIndex ?? 0;
                const existingRingsOfPoly = savedParts.filter(p => p.polyIndex === activePolyIdx);
                newPolyIndex = activePolyIdx;
                newRingIndex = existingRingsOfPoly.length;
                newLabel = `Poligon ${newPolyIndex + 1}: Lubang ${newRingIndex}`;
              }
            } else {
              // MultiLineString / LineString
              newPolyIndex = savedParts.length;
              newRingIndex = 0;
              newLabel = `Part ${newPolyIndex + 1} (Garis)`;
            }

            const newPart: EditPart = {
              id: `part-new-${Date.now()}`,
              label: newLabel,
              coords: newCoords,
              type: type,
              polyIndex: newPolyIndex,
              ringIndex: newRingIndex
            };

            const updatedParts = [...savedParts, newPart];
            
            // Update state
            setEditingParts(updatedParts);
            setActivePartIndex(updatedParts.length - 1);
            setActiveEditingCoords(newCoords);

            // Recreate markers
            recreateEditingMarkers(
              map,
              newCoords,
              targetLayer?.type || "circle",
              geomType.includes("Multi") ? geomType : (geomType === "Polygon" ? "MultiPolygon" : "MultiLineString"),
              updatedParts,
              updatedParts.length - 1
            );
          };

          const handleDeleteCurrentPart = () => {
            if (editingParts.length <= 1) {
              alert("Fitur harus memiliki minimal 1 part!");
              return;
            }

            if (!window.confirm("Apakah Anda yakin ingin menghapus part ini beserta seluruh vertex-nya?")) {
              return;
            }

            const map = mapRef.current;
            if (!map) return;

            // Filter out the active part
            const remainingParts = editingParts.filter((_, idx) => idx !== activePartIndex);

            // Select a new active part index
            const nextActiveIndex = 0;
            const nextCoords = remainingParts[nextActiveIndex].coords;

            setEditingParts(remainingParts);
            setActivePartIndex(nextActiveIndex);
            setActiveEditingCoords(nextCoords);

            recreateEditingMarkers(
              map,
              nextCoords,
              targetLayer?.type || "circle",
              geomType,
              remainingParts,
              nextActiveIndex
            );
          };

          if (isEditPanelMinimized) {
            return (
              <div
                style={{
                  top: "16px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
                className="absolute bg-[#0f172a]/95 border-2 border-orange-500 rounded-lg shadow-xl px-3 py-2.5 z-40 w-[92%] max-w-sm text-slate-100 flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs select-none"
              >
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                    <span className="font-bold text-[11px]">✏️ Edit: {targetLayer?.name || "Layer"}</span>
                  </div>
                  <div className="text-[10px] text-orange-400 font-mono font-bold">
                    {editingParts.length > 1 ? `${editingParts.length} Part | ` : ""}{activeEditingCoords.length} Vertex
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1.5 mt-0.5">
                  <button
                    type="button"
                    onClick={handleAddVertexAtCenter}
                    className="flex-1 py-1 px-2 bg-orange-600/10 hover:bg-orange-600/30 text-orange-400 border border-orange-500/20 rounded text-[10px] font-mono transition-all truncate cursor-pointer"
                  >
                    ➕ Vertex
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    className="flex-1 py-1 px-2 bg-orange-600 hover:bg-orange-500 text-white font-bold font-mono rounded text-[10px] transition-all truncate cursor-pointer"
                  >
                    💾 Simpan
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditPanelMinimized(false)}
                    className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono rounded text-[10px] border border-[#334155] transition-all cursor-pointer shrink-0"
                  >
                    ⚙️ Atribut
                  </button>

                  <button
                    type="button"
                    onClick={onCancelEditing}
                    className="p-1 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 rounded border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                    title="Batalkan perubahan"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              style={{
                transform: `translate(calc(-50% + ${editDragOffset.x}px), ${editDragOffset.y}px)`,
                top: "16px",
                left: "50%",
              }}
              className="absolute bg-[#0f172a]/95 border-2 border-orange-500 rounded-xl shadow-2xl p-4 z-40 w-full max-w-lg text-slate-100 flex flex-col gap-3 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs select-none"
            >
              <div
                onMouseDown={handleEditDragMouseDown}
                className="flex justify-between items-center border-b border-[#334155] pb-2 cursor-move select-none"
                title="Seret header ini untuk memindahkan panel"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
                  <h4 className="font-bold text-xs text-slate-100 font-mono tracking-wide uppercase flex items-center gap-1.5">
                    Edit Vertex & Atribut: {targetLayer?.name || "Layer Kustom"}
                    <span className="text-[9px] text-orange-400 font-normal normal-case animate-pulse">
                      (Seret Panel ⬘)
                    </span>
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditPanelMinimized(true)}
                    className="px-2 py-0.5 bg-orange-600/10 hover:bg-orange-600/30 text-orange-400 border border-orange-500/20 rounded text-[9px] font-mono transition-all cursor-pointer flex items-center gap-1"
                    title="Sembunyikan panel lengkap"
                  >
                    🗕 Ringkas
                  </button>
                  <div className="text-[10px] font-mono text-slate-400">
                    {editingParts.length > 1 ? `${editingParts.length} Part | ` : ""}{activeEditingCoords.length} Vertex Aktif
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
                💡 <strong>Panduan:</strong> Geser penanda angka berwarna{" "}
                <strong>oranye</strong> di peta untuk memindahkan vertex secara
                interaktif. Anda juga dapat mengubah nilai atribut di bawah ini.
              </p>

              {/* Part Management Section */}
              {(geomType.includes("Polygon") || geomType.includes("Line") || geomType.includes("Point")) && (
                <div className="flex flex-col gap-2 bg-[#0f172a] p-3 rounded-lg border border-[#334155]/80">
                  <div className="flex justify-between items-center text-[10px] text-orange-400 font-bold uppercase font-mono tracking-wider">
                    <span>Manajemen Multi-Part & Lubang ({editingParts.length} Part)</span>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentPart}
                      disabled={editingParts.length <= 1}
                      className="px-2 py-0.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 disabled:opacity-30 border border-red-500/30 rounded text-[9px] font-mono transition-all cursor-pointer"
                      title="Hapus part aktif saat ini"
                    >
                      🗑️ Hapus Part
                    </button>
                  </div>

                  {editingParts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                      {editingParts.map((p, pIdx) => {
                        const isActive = pIdx === activePartIndex;
                        return (
                          <button
                            key={p.id || pIdx}
                            type="button"
                            onClick={() => {
                              const map = mapRef.current;
                              if (!map) return;
                              
                              const updatedParts = [...editingParts];
                              updatedParts[activePartIndex] = {
                                ...updatedParts[activePartIndex],
                                coords: activeEditingCoords
                              };
                              setEditingParts(updatedParts);
                              
                              setActivePartIndex(pIdx);
                              setActiveEditingCoords(p.coords);
                              
                              recreateEditingMarkers(
                                map,
                                p.coords,
                                targetLayer?.type || "circle",
                                geomType,
                                updatedParts,
                                pIdx
                              );
                            }}
                            className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isActive
                                ? "bg-orange-600 text-white border-orange-500 font-bold shadow-md"
                                : "bg-slate-800 text-slate-300 border-[#334155] hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white animate-pulse" : "bg-slate-500"}`} />
                            {p.label} ({p.coords.length} vtx)
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2 mt-1">
                    {geomType.includes("Polygon") ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAddNewPart("exterior")}
                          className="flex-1 py-1 px-2 bg-emerald-600/10 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-mono transition-all cursor-pointer"
                        >
                          ➕ Batas Luar Baru
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddNewPart("interior")}
                          className="flex-1 py-1 px-2 bg-sky-600/10 hover:bg-sky-600/30 text-sky-400 border border-sky-500/20 rounded text-[9px] font-mono transition-all cursor-pointer"
                        >
                          ➕ Lubang Baru (Hole)
                        </button>
                      </>
                    ) : geomType.includes("Line") ? (
                      <button
                        type="button"
                        onClick={() => handleAddNewPart("line")}
                        className="flex-1 py-1 px-2 bg-sky-600/10 hover:bg-sky-600/30 text-sky-400 border border-sky-500/20 rounded text-[9px] font-mono transition-all cursor-pointer"
                      >
                        ➕ Part Garis Baru
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Atribut Editor */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-[#1e293b]/40 p-2.5 rounded-lg border border-[#334155]/50 max-h-36 overflow-y-auto custom-scrollbar">
                <div className="col-span-2 text-[10px] text-orange-400 font-bold uppercase font-mono tracking-wider mb-0.5">
                  Edit Atribut Fitur
                </div>
                {Object.keys(editProperties).map((key) => {
                  if (key === "color") return null;
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase font-mono">
                        {key}
                      </label>
                      <input
                        type="text"
                        value={editProperties[key] || ""}
                        onChange={(e) =>
                          setEditProperties({
                            ...editProperties,
                            [key]: e.target.value,
                          })
                        }
                        className="bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-orange-500 transition-all font-mono text-[11px]"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Vertices List */}
              {geomType !== "Point" && (
                <div className="flex flex-col gap-1.5 bg-[#0f172a] p-2.5 rounded-lg border border-[#334155]">
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase font-mono tracking-wider">
                    <span>
                      Daftar Koordinat Vertices ({activeEditingCoords.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddVertexAtCenter}
                      className="px-2 py-0.5 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/30 rounded text-[9px] font-mono transition-all cursor-pointer"
                    >
                      + Tambah Vertex Baru
                    </button>
                  </div>
                  <div className="max-h-24 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                    {activeEditingCoords.map((coord, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-[#1e293b]/70 px-2.5 py-1.5 rounded border border-[#334155]/60 text-[10px] font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 bg-orange-600/20 text-orange-400 rounded-full flex items-center justify-center font-bold text-[9px]">
                            {idx + 1}
                          </span>
                          <span>Lon: {coord[0].toFixed(5)}</span>
                          <span className="text-slate-500">|</span>
                          <span>Lat: {coord[1].toFixed(5)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteVertex(idx)}
                          disabled={
                            activeEditingCoords.length <=
                            (geomType === "Polygon" ? 3 : 2)
                          }
                          className="text-red-400 hover:text-red-300 disabled:opacity-30 p-1 rounded transition-all cursor-pointer"
                          title="Hapus vertex ini"
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
                  onClick={onCancelEditing}
                  className="flex-1 py-1.5 bg-[#1e293b] hover:bg-slate-800 text-slate-300 font-bold font-mono rounded text-[10px] border border-[#334155] transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="flex-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold font-mono rounded text-[10px] transition-all shadow-md cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          );
        })()}

         {drawingLayerId &&
        (() => {
          const targetLayer = layers.find((l) => l.id === drawingLayerId);
          const layerType = targetLayer?.type || "circle";

          // Validation for the current active geometry
          const isValidActiveShape =
            (layerType === "circle" && drawPoints.length >= 1) ||
            (layerType === "line" && drawPoints.length >= 2) ||
            (layerType === "fill" && drawPoints.length >= 3);

          const totalFeaturesCount = sessionFeatures.length + 
            (isValidActiveShape ? (layerType === "circle" ? drawPoints.length : 1) : 0);

          const hasAnyFeatureToSave = totalFeaturesCount > 0;

          const handleSaveAllAndClose = () => {
            const finalFeatures = [...sessionFeatures];

            // If there is currently an active shape being drawn, finalize it and save it too!
            if (isValidActiveShape) {
              if (layerType === "circle") {
                drawPoints.forEach((pt, index) => {
                  finalFeatures.push({
                    geometry: { type: "Point", coordinates: pt },
                    properties: {
                      nama: drawPoints.length > 1 || sessionFeatures.length > 0
                        ? `${drawProperties.nama} ${sessionFeatures.length + index + 1}`
                        : drawProperties.nama,
                      keterangan: drawProperties.keterangan || "Dibuat secara interaktif",
                    },
                  });
                });
              } else if (layerType === "line") {
                const cleanPoints = drawPoints.filter((pt, i, arr) => {
                  if (i === 0) return true;
                  const prevPt = arr[i - 1];
                  return Math.abs(pt[0] - prevPt[0]) > 1e-7 || Math.abs(pt[1] - prevPt[1]) > 1e-7;
                });
                if (cleanPoints.length >= 2) {
                  finalFeatures.push({
                    geometry: { type: "LineString", coordinates: cleanPoints },
                    properties: {
                      nama: finalFeatures.length > 0 
                        ? `${drawProperties.nama} ${finalFeatures.length + 1}` 
                        : drawProperties.nama,
                      keterangan: drawProperties.keterangan || "Dibuat secara interaktif",
                    },
                  });
                }
              } else if (layerType === "fill") {
                const cleanPoints = drawPoints.filter((pt, i, arr) => {
                  if (i === 0) return true;
                  const prevPt = arr[i - 1];
                  return Math.abs(pt[0] - prevPt[0]) > 1e-7 || Math.abs(pt[1] - prevPt[1]) > 1e-7;
                });
                if (cleanPoints.length >= 3) {
                  finalFeatures.push({
                    geometry: {
                      type: "Polygon",
                      coordinates: [[...cleanPoints, cleanPoints[0]]],
                    },
                    properties: {
                      nama: finalFeatures.length > 0 
                        ? `${drawProperties.nama} ${finalFeatures.length + 1}` 
                        : drawProperties.nama,
                      keterangan: drawProperties.keterangan || "Dibuat secara interaktif",
                    },
                  });
                }
              }
            }

            if (finalFeatures.length === 0) {
              alert("Silakan klik pada peta untuk menggambar terlebih dahulu sesuai petunjuk!");
              return;
            }

            onSaveDrawnFeature(drawingLayerId, finalFeatures);
            setDrawPoints([]);
            setSessionFeatures([]);
            setDrawProperties({
              nama: "Fitur Baru",
              keterangan: "Dibuat secara interaktif",
            });
          };

          if (isDrawPanelMinimized) {
            return (
              <div
                style={{
                  top: "16px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
                className="absolute bg-[#0f172a]/95 border-2 border-red-500 rounded-lg shadow-xl px-3 py-2.5 z-40 w-[92%] max-w-sm text-slate-100 flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs select-none"
              >
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="font-bold text-[11px]">✍️ Gambar: {targetLayer?.name || "Layer"}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {sessionFeatures.length > 0 ? `${sessionFeatures.length} Selesai, ` : ""}{drawPoints.length} Titik Aktif
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1.5 mt-0.5">
                  <button
                    type="button"
                    onClick={handleSaveAllAndClose}
                    disabled={!hasAnyFeatureToSave}
                    className="flex-1 py-1.5 px-3 bg-[#10b981] hover:bg-[#10b981]/90 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold font-mono rounded text-[10px] transition-all truncate cursor-pointer flex items-center justify-center gap-1"
                  >
                    💾 Simpan Objek {totalFeaturesCount > 0 ? `(${totalFeaturesCount})` : ""}
                  </button>

                  {(layerType === "line" || layerType === "fill") && drawPoints.length >= (layerType === "line" ? 2 : 3) && (
                    <button
                      type="button"
                      onClick={handleFinishCurrentShapeAndStartNew}
                      className="py-1.5 px-2 bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold font-mono rounded text-[10px] transition-all cursor-pointer shrink-0"
                      title="Selesaikan objek aktif ini dan mulai gambar baru"
                    >
                      🔁 Selesai & Baru
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsDrawPanelMinimized(false)}
                    className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono rounded text-[10px] border border-[#334155] transition-all cursor-pointer shrink-0"
                    title="Buka panel atribut lengkap"
                  >
                    ⚙️ Atribut
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDrawPoints([]);
                      setSessionFeatures([]);
                      onSaveDrawnFeature(drawingLayerId, null);
                    }}
                    className="p-1 bg-slate-800 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                    title="Batalkan menggambar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              style={{
                transform: `translate(calc(-50% + ${drawDragOffset.x}px), ${drawDragOffset.y}px)`,
                top: "16px",
                left: "50%",
              }}
              className="absolute bg-[#0f172a]/95 border-2 border-red-500 rounded-xl shadow-2xl p-4 z-40 w-full max-w-sm md:max-w-md text-slate-100 flex flex-col gap-3 animate-in slide-in-from-top-4 duration-200 backdrop-blur-xs select-none"
            >
              <div
                onMouseDown={handleDrawDragMouseDown}
                className="flex justify-between items-center border-b border-[#334155] pb-2 cursor-move select-none"
                title="Seret header ini untuk memindahkan panel"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <h4 className="font-bold text-xs text-slate-100 font-mono tracking-wide uppercase flex items-center gap-1.5">
                    Menggambar: {targetLayer?.name || "Layer"}
                    <span className="text-[9px] text-[#38bdf8] font-normal normal-case animate-pulse hidden md:inline">
                      (Seret ⬘)
                    </span>
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDrawPanelMinimized(true)}
                    className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded text-[9px] font-mono transition-all cursor-pointer"
                    title="Sembunyikan panel lengkap"
                  >
                    🗕 Ringkas
                  </button>
                  <div className="text-[10px] font-mono text-slate-400">
                    {sessionFeatures.length > 0 ? `${sessionFeatures.length} Selesai, ` : ""}{drawPoints.length} Titik Aktif
                  </div>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 p-2.5 rounded-lg border border-[#334155]/40 text-[10px] text-slate-300 space-y-1">
                <div>
                  💡 <strong>Panduan Menggambar Berantai & Edit Vertex:</strong>
                </div>
                <div className="font-mono text-slate-400 leading-normal">
                  {layerType === "circle" ? (
                    "• Cukup klik beberapa lokasi di peta. Setiap klik langsung dicatat sebagai titik baru secara otomatis."
                  ) : layerType === "line" ? (
                    <>
                      • Klik peta untuk meletakkan titik sudut garis.<br />
                      • <strong>Klik ganda (double-click)</strong> pada titik terakhir untuk menyelesaikan garis ini dan langsung mulai menggambar garis baru.<br />
                      • Klik <strong className="text-[#10b981]">Simpan Objek</strong> untuk menyimpan semua sekaligus!
                    </>
                  ) : (
                    <>
                      • Klik peta untuk meletakkan titik sudut area.<br />
                      • <strong>Klik ganda (double-click)</strong> pada titik terakhir untuk menyelesaikan area ini dan langsung mulai menggambar area baru.<br />
                      • Klik <strong className="text-[#10b981]">Simpan Objek</strong> untuk menyimpan semua sekaligus!
                    </>
                  )}
                  <div className="mt-1.5 text-amber-400 border-t border-[#334155]/30 pt-1.5">
                    ⚙️ <strong>Edit Vertex Aktif:</strong> Anda dapat <strong>menggeser (seret)</strong> titik mana saja di peta untuk memindahkannya, atau <strong>klik kanan</strong> pada titik untuk menghapusnya.
                  </div>
                </div>
              </div>

              {/* Form to set attributes */}
              <div className="space-y-2.5 bg-[#1e293b]/20 p-2.5 rounded-lg border border-[#334155]/30">
                <div className="text-[9px] text-[#38bdf8] font-bold uppercase font-mono tracking-wider">
                  Isi Data Objek
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5 font-mono">
                      Nama Objek / Fitur
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Titik Kumpul Evakuasi"
                      value={drawProperties.nama}
                      onChange={(e) =>
                        setDrawProperties((prev) => ({
                          ...prev,
                          nama: e.target.value,
                        }))
                      }
                      className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-500 transition-all font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 font-bold uppercase mb-0.5 font-mono">
                      Keterangan / Deskripsi
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Lapangan Terbuka"
                      value={drawProperties.keterangan || ""}
                      onChange={(e) =>
                        setDrawProperties((prev) => ({
                          ...prev,
                          keterangan: e.target.value,
                        }))
                      }
                      className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-red-500 transition-all font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1.5 border-t border-[#334155]/60">
                <button
                  type="button"
                  onClick={() => {
                    setDrawPoints([]);
                    setSessionFeatures([]);
                    setDrawProperties({
                      nama: "Fitur Baru",
                      keterangan: "Dibuat secara interaktif",
                    });
                    onSaveDrawnFeature(drawingLayerId, null);
                  }}
                  className="flex-1 min-w-[70px] py-1.5 bg-[#1e293b] hover:bg-slate-800 text-slate-300 font-bold font-mono rounded text-[11px] border border-[#334155] transition-all cursor-pointer text-center"
                >
                  Batal
                </button>

                {(layerType === "line" || layerType === "fill") && drawPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={handleFinishCurrentShapeAndStartNew}
                    disabled={!isValidActiveShape}
                    className="py-1.5 px-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-30 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold font-mono rounded text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Selesaikan objek aktif ini dan langsung mulai gambar baru"
                  >
                    🔁 Selesai & Baru
                  </button>
                )}

                {(drawPoints.length > 0 || sessionFeatures.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawPoints([]);
                      setSessionFeatures([]);
                    }}
                    className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold font-mono rounded text-[11px] border border-amber-500/20 transition-all cursor-pointer"
                  >
                    Reset Gambar
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveAllAndClose}
                  disabled={!hasAnyFeatureToSave}
                  className="flex-1 min-w-[110px] py-1.5 bg-[#10b981] hover:bg-emerald-600 disabled:opacity-30 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold font-mono rounded text-[11px] transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
                >
                  💾 Simpan Objek {totalFeaturesCount > 0 ? `(${totalFeaturesCount})` : ""}
                </button>
              </div>
            </div>
          );
        })()}

      {/* 6. PRINT AND EXPORT MAP LAYOUT MODAL */}
      {printDialogOpen && (
        <div className="fixed inset-0 bg-slate-950/98 z-50 flex flex-col md:flex-row p-4 gap-4 overflow-y-auto animate-in fade-in duration-300">
          {/* Print Style Injector */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @media print {
              /* Hide everything else on the page */
              body, html, #root {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 2px !important;
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
                left: 2px !important;
                top: 2px !important;
                width: calc(${paperWidth} - 4px) !important;
                height: calc(${paperHeight} - 4px) !important;
                margin: 2px !important;
                padding: 2px !important;
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
                margin: 2px;
              }
            }
          `,
            }}
          />

          {/* Left panel: Control settings */}
          <div className="w-full md:w-80 bg-[#0f172a] border border-[#334155] rounded-xl p-4 flex flex-col gap-4 text-slate-200 shrink-0 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#334155] pb-2">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#38bdf8]" />
                <h3 className="font-bold text-sm tracking-wide text-slate-100 font-mono">
                  LAYOUT CETAK
                </h3>
              </div>
              <button
                onClick={() => setPrintDialogOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/80 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Headers */}
            <div className="grid grid-cols-2 gap-1 bg-slate-900/60 p-1 rounded-lg border border-[#334155]/60 text-xs font-mono">
              <button
                onClick={() => setPrintSidebarTab("info")}
                className={`py-1.5 rounded transition-all cursor-pointer ${
                  printSidebarTab === "info"
                    ? "bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8] font-bold"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Informasi Utama
              </button>
              <button
                onClick={() => setPrintSidebarTab("elements")}
                className={`py-1.5 rounded transition-all cursor-pointer ${
                  printSidebarTab === "elements"
                    ? "bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8] font-bold"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Elemen Tambahan
              </button>
            </div>

            {/* Title options / Add Elements Tab content */}
            {printSidebarTab === "info" ? (
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[55vh] pr-1 scrollbar-thin">
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

                {/* Logo Upload */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                    Logo / Lambang Instansi
                  </label>
                  <input
                    ref={printLogoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-full text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-mono file:font-bold file:bg-[#38bdf8]/10 file:text-[#38bdf8] hover:file:bg-[#38bdf8]/20 cursor-pointer file:cursor-pointer"
                  />
                  {printLogo && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <img
                        src={printLogo}
                        alt="Logo"
                        className="w-8 h-8 object-contain border border-[#334155] rounded"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="text-[10px] text-red-400 hover:text-red-300 font-mono underline cursor-pointer"
                      >
                        Hapus Logo
                      </button>
                    </div>
                  )}
                </div>

                {/* Scale text input */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                    Skala Peta (Teks)
                  </label>
                  <input
                    type="text"
                    value={printScaleText}
                    onChange={(e) => setPrintScaleText(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                    placeholder="Contoh: 1:25.000"
                  />
                </div>

                {/* Source / Creator text input */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                    Sumber / Pembuat Peta
                  </label>
                  <input
                    type="text"
                    value={printSourceText}
                    onChange={(e) => setPrintSourceText(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                    placeholder="Contoh: Sumber: Bappeda Kota Banda Aceh"
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

                {/* Kop Instansi Detail */}
                <div className="border-t border-[#334155]/60 pt-2.5">
                  <span className="block text-[10px] text-sky-400 font-bold uppercase mb-2 font-mono">
                    🏢 IDENTITAS KOP INSTANSI
                  </span>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                        Teks Pemerintah
                      </label>
                      <input
                        type="text"
                        value={printGovernmentName}
                        onChange={(e) => setPrintGovernmentName(e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                        placeholder="Contoh: PEMERINTAH KOTA"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                        Nama Wilayah / Daerah
                      </label>
                      <input
                        type="text"
                        value={printRegionName}
                        onChange={(e) => setPrintRegionName(e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                        placeholder="Contoh: BANDA ACEH"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                        Keterangan Provinsi
                      </label>
                      <input
                        type="text"
                        value={printProvinceName}
                        onChange={(e) => setPrintProvinceName(e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                        placeholder="Contoh: Provinsi Aceh, Indonesia"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                        Nama Kartografer (Pembuat)
                      </label>
                      <input
                        type="text"
                        value={printCartographer}
                        onChange={(e) => setPrintCartographer(e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                        placeholder="Contoh: Bappeda Banda Aceh"
                      />
                    </div>
                  </div>
                </div>

                {/* Proyeksi & Koordinat */}
                <div className="border-t border-[#334155]/60 pt-2.5">
                  <span className="block text-[10px] text-sky-400 font-bold uppercase mb-2 font-mono">
                    🌐 PROYEKSI & DATUM KOORDINAT
                  </span>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                        Sistem Proyeksi (Teks Overlay)
                      </label>
                      <input
                        type="text"
                        value={printProjection}
                        onChange={(e) => setPrintProjection(e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                        placeholder="Contoh: SISTEM PROYEKSI: UTM ZONE 46N"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 font-mono uppercase mb-0.5">
                        Sistem Rujukan / Datum
                      </label>
                      <input
                        type="text"
                        value={printDatum}
                        onChange={(e) => setPrintDatum(e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                        placeholder="Contoh: WGS 84 / UTM 46N"
                      />
                    </div>
                  </div>
                </div>

                {/* Kontrol Tampilan Legenda, Kompas, & Skala */}
                <div className="border-t border-[#334155]/60 pt-2.5">
                  <span className="block text-[10px] text-sky-400 font-bold uppercase mb-2 font-mono">
                    ⚙️ VISIBILITAS ELEMEN KOP
                  </span>
                  <div className="space-y-2.5 bg-slate-900/50 p-2.5 border border-[#334155]/30 rounded-lg">
                    {/* Toggle Legenda */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-medium text-slate-300">
                        Tampilkan Legenda
                      </span>
                      <button
                        onClick={() => setPrintShowLegend(!printShowLegend)}
                        className={`px-2.5 py-1 text-[10px] rounded font-bold font-mono border transition-all cursor-pointer ${
                          printShowLegend
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border-transparent hover:text-slate-300"
                        }`}
                      >
                        {printShowLegend ? "AKTIF" : "Sembunyi"}
                      </button>
                    </div>

                    {/* Toggle Kompas */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-medium text-slate-300">
                        Tampilkan Arah Utara
                      </span>
                      <button
                        onClick={() => setPrintShowCompass(!printShowCompass)}
                        className={`px-2.5 py-1 text-[10px] rounded font-bold font-mono border transition-all cursor-pointer ${
                          printShowCompass
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border-transparent hover:text-slate-300"
                        }`}
                      >
                        {printShowCompass ? "AKTIF" : "Sembunyi"}
                      </button>
                    </div>

                    {/* Scale bar segment km input */}

                    <div className="border-t border-[#334155]/40 pt-2 mt-1">
                      <label className="block text-[9px] text-slate-400 font-mono uppercase mb-1">
                        Nilai Batas Skala Bar
                      </label>
                      <input
                        type="text"
                        value={printScaleBarKm}
                        onChange={(e) => setPrintScaleBarKm(e.target.value)}
                        className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] transition-all font-mono"
                        placeholder="Contoh: 3 km atau 500 m"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[55vh] pr-1 scrollbar-thin">
                {/* Add new element buttons */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5 font-mono">
                    Tambah Objek Baru ke Peta
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    <button
                      onClick={handleAddTextElement}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-[#334155] transition-all cursor-pointer text-[11px]"
                    >
                      <Type className="w-3.5 h-3.5 text-sky-400" />
                      Teks
                    </button>
                    <button
                      onClick={handleAddLineElement}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-[#334155] transition-all cursor-pointer text-[11px]"
                    >
                      <Slash className="w-3.5 h-3.5 text-red-400" />
                      Garis
                    </button>
                    <button
                      onClick={handleAddRectangleElement}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-[#334155] transition-all cursor-pointer text-[11px]"
                    >
                      <Square className="w-3.5 h-3.5 text-emerald-400" />
                      Persegi
                    </button>
                    <button
                      onClick={handleAddImageElement}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-[#334155] transition-all cursor-pointer text-[11px]"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      Gambar
                    </button>
                  </div>
                </div>

                {/* Edit Selected Element Properties */}
                {(() => {
                  const el = printLayoutElements.find(
                    (item) => item.id === selectedElementId,
                  );
                  if (!el) {
                    return (
                      <div className="bg-slate-900/40 border border-[#334155]/40 rounded-lg p-2.5 text-center text-xs text-slate-400 font-mono">
                        Pilih objek di kertas atau daftar di bawah untuk
                        mengeditnya.
                      </div>
                    );
                  }

                  return (
                    <div className="bg-[#1e293b]/70 border border-[#334155] rounded-lg p-2.5 flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-[#334155] pb-1.5">
                        <span className="text-[10px] text-sky-400 font-bold uppercase font-mono tracking-wider">
                          Edit: {el.type.toUpperCase()}
                        </span>
                        <button
                          onClick={() => {
                            setPrintLayoutElements((prev) =>
                              prev.filter((item) => item.id !== el.id),
                            );
                            setSelectedElementId(null);
                          }}
                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                          title="Hapus objek"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Position X and Y percentage sliders */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div>
                          <span className="text-slate-400">
                            Posisi X: {el.x}%
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={el.x}
                            onChange={(e) =>
                              updateSelectedElement({
                                x: parseInt(e.target.value),
                              })
                            }
                            className="w-full accent-sky-500 cursor-pointer"
                          />
                        </div>
                        <div>
                          <span className="text-slate-400">
                            Posisi Y: {el.y}%
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={el.y}
                            onChange={(e) =>
                              updateSelectedElement({
                                y: parseInt(e.target.value),
                              })
                            }
                            className="w-full accent-sky-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Type-Specific Properties */}
                      {el.type === "text" && (
                        <div className="flex flex-col gap-2 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Isi Teks
                            </span>
                            <input
                              type="text"
                              value={el.content || ""}
                              onChange={(e) =>
                                updateSelectedElement({
                                  content: e.target.value,
                                })
                              }
                              className="w-full bg-slate-900 border border-[#334155] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8] font-mono"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Ukuran Font ({el.fontSize}px)
                            </span>
                            <input
                              type="range"
                              min="8"
                              max="120"
                              value={el.fontSize || 14}
                              onChange={(e) =>
                                updateSelectedElement({
                                  fontSize: parseInt(e.target.value),
                                })
                              }
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Warna Teks
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={el.fontColor || "#000000"}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    fontColor: e.target.value,
                                  })
                                }
                                className="w-8 h-7 bg-transparent border-0 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={el.fontColor || "#000000"}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    fontColor: e.target.value,
                                  })
                                }
                                className="flex-1 bg-slate-900 border border-[#334155] rounded px-2 py-0.5 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {el.type === "line" && (
                        <div className="flex flex-col gap-2 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Panjang Garis ({el.width}px)
                            </span>
                            <input
                              type="range"
                              min="10"
                              max="600"
                              value={el.width || 100}
                              onChange={(e) =>
                                updateSelectedElement({
                                  width: parseInt(e.target.value),
                                })
                              }
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Ketebalan ({el.lineWidth}px)
                            </span>
                            <input
                              type="range"
                              min="1"
                              max="20"
                              value={el.lineWidth || 2}
                              onChange={(e) =>
                                updateSelectedElement({
                                  lineWidth: parseInt(e.target.value),
                                })
                              }
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Rotasi ({el.rotation || 0}°)
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={el.rotation || 0}
                              onChange={(e) =>
                                updateSelectedElement({
                                  rotation: parseInt(e.target.value),
                                })
                              }
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Warna Garis
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={el.lineColor || "#ff0000"}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    lineColor: e.target.value,
                                  })
                                }
                                className="w-8 h-7 bg-transparent border-0 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={el.lineColor || "#ff0000"}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    lineColor: e.target.value,
                                  })
                                }
                                className="flex-1 bg-slate-900 border border-[#334155] rounded px-2 py-0.5 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {el.type === "rectangle" && (
                        <div className="flex flex-col gap-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                                Lebar ({el.width}px)
                              </span>
                              <input
                                type="range"
                                min="10"
                                max="600"
                                value={el.width || 120}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    width: parseInt(e.target.value),
                                  })
                                }
                                className="w-full accent-sky-500 cursor-pointer"
                              />
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                                Tinggi ({el.height}px)
                              </span>
                              <input
                                type="range"
                                min="10"
                                max="400"
                                value={el.height || 60}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    height: parseInt(e.target.value),
                                  })
                                }
                                className="w-full accent-sky-500 cursor-pointer"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Tebal Bingkai ({el.rectBorderWidth}px)
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={
                                el.rectBorderWidth === undefined
                                  ? 2
                                  : el.rectBorderWidth
                              }
                              onChange={(e) =>
                                updateSelectedElement({
                                  rectBorderWidth: parseInt(e.target.value),
                                })
                              }
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Warna Bingkai
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={el.rectBorderColor || "#000000"}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    rectBorderColor: e.target.value,
                                  })
                                }
                                className="w-8 h-7 bg-transparent border-0 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={el.rectBorderColor || "#000000"}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    rectBorderColor: e.target.value,
                                  })
                                }
                                className="flex-1 bg-slate-900 border border-[#334155] rounded px-2 py-0.5 text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Warna Latar (Fill)
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={
                                  el.rectFillColor &&
                                  el.rectFillColor.startsWith("rgba")
                                    ? "#ffffff"
                                    : el.rectFillColor || "#ffffff"
                                }
                                onChange={(e) =>
                                  updateSelectedElement({
                                    rectFillColor: e.target.value,
                                  })
                                }
                                className="w-8 h-7 bg-transparent border-0 cursor-pointer"
                                disabled={el.rectFillColor === "rgba(0,0,0,0)"}
                              />
                              <select
                                value={
                                  el.rectFillColor === "rgba(0,0,0,0)"
                                    ? "transparan"
                                    : "solid"
                                }
                                onChange={(e) => {
                                  if (e.target.value === "transparan") {
                                    updateSelectedElement({
                                      rectFillColor: "rgba(0,0,0,0)",
                                    });
                                  } else {
                                    updateSelectedElement({
                                      rectFillColor: "#ffffff",
                                    });
                                  }
                                }}
                                className="flex-1 bg-slate-900 border border-[#334155] rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none"
                              >
                                <option value="solid font-mono">
                                  Isi Warna Solid
                                </option>
                                <option value="transparan font-mono">
                                  Transparan (Tanpa Latar)
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {el.type === "image" && (
                        <div className="flex flex-col gap-2 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Preset Gambar / Kompas
                            </span>
                            <select
                              value={
                                el.imageUrl === CLASSIC_NORTH_ARROW
                                  ? "classic"
                                  : el.imageUrl === MODERN_NORTH_ARROW
                                    ? "modern"
                                    : "custom"
                              }
                              onChange={(e) => {
                                if (e.target.value === "classic") {
                                  updateSelectedElement({
                                    imageUrl: CLASSIC_NORTH_ARROW,
                                  });
                                } else if (e.target.value === "modern") {
                                  updateSelectedElement({
                                    imageUrl: MODERN_NORTH_ARROW,
                                  });
                                } else {
                                  updateSelectedElement({ imageUrl: "" });
                                }
                              }}
                              className="w-full bg-slate-900 border border-[#334155] rounded px-2 py-1 text-xs font-mono text-slate-200 mb-1.5 focus:outline-none"
                            >
                              <option value="classic">
                                Kompas Klasik (North Arrow 1)
                              </option>
                              <option value="modern">
                                Kompas Modern (North Arrow 2)
                              </option>
                              <option value="custom">
                                Gambar Kustom (Upload)
                              </option>
                            </select>

                            {el.imageUrl !== CLASSIC_NORTH_ARROW &&
                              el.imageUrl !== MODERN_NORTH_ARROW && (
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleUploadElementImage(e, el.id)
                                  }
                                  className="w-full text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-sky-500/10 file:text-sky-400 cursor-pointer"
                                />
                              )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                                Lebar ({el.width}px)
                              </span>
                              <input
                                type="range"
                                min="10"
                                max="400"
                                value={el.width || 60}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    width: parseInt(e.target.value),
                                  })
                                }
                                className="w-full accent-sky-500 cursor-pointer"
                              />
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                                Tinggi ({el.height}px)
                              </span>
                              <input
                                type="range"
                                min="10"
                                max="400"
                                value={el.height || 60}
                                onChange={(e) =>
                                  updateSelectedElement({
                                    height: parseInt(e.target.value),
                                  })
                                }
                                className="w-full accent-sky-500 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase mb-0.5">
                              Rotasi ({el.rotation || 0}°)
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={el.rotation || 0}
                              onChange={(e) =>
                                updateSelectedElement({
                                  rotation: parseInt(e.target.value),
                                })
                              }
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* List of current dynamic elements */}
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 font-mono">
                    Daftar Objek Tambahan ({printLayoutElements.length})
                  </label>
                  <div className="max-h-24 overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-thin text-xs font-mono">
                    {printLayoutElements.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedElementId(item.id)}
                        className={`flex justify-between items-center px-2 py-1.5 rounded border transition-all cursor-pointer ${
                          selectedElementId === item.id
                            ? "bg-[#38bdf8]/10 border-[#38bdf8] text-white font-bold"
                            : "bg-slate-900/60 border-[#334155]/60 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-mono text-slate-500">
                            {idx + 1}.
                          </span>
                          {item.type === "text" && (
                            <Type className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                          )}
                          {item.type === "line" && (
                            <Slash className="w-3.5 h-3.5 shrink-0 text-red-400" />
                          )}
                          {item.type === "rectangle" && (
                            <Square className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                          )}
                          {item.type === "image" && (
                            <ImageIcon className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          )}
                          <span className="truncate leading-none text-[11px]">
                            {item.type === "text"
                              ? item.content
                              : `${item.type.toUpperCase()} (X:${item.x}%, Y:${item.y}%)`}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintLayoutElements((prev) =>
                              prev.filter((p) => p.id !== item.id),
                            );
                            if (selectedElementId === item.id)
                              setSelectedElementId(null);
                          }}
                          className="text-slate-500 hover:text-red-400 p-0.5 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {printLayoutElements.length === 0 && (
                      <div className="text-center text-[10px] text-slate-500 italic py-2">
                        Belum ada objek tambahan.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[#334155]">
              <button
                onClick={handlePrintPDF}
                disabled={!capturedMapUrl}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white font-bold font-mono rounded-lg text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20"
              >
                <Printer className="w-4 h-4" />
                Cetak ke PDF / Printer
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
                className={`bg-white text-black border-4 border-double border-black shadow-2xl flex ${
                  printOrientation === "portrait" ? "flex-col" : "flex-row"
                } gap-4 w-full ${
                  printOrientation === "landscape"
                    ? "aspect-[1.414]"
                    : "aspect-[0.707]"
                }`}
                style={{
                  maxHeight: "80vh",
                  width: "100%",
                  boxSizing: "border-box",
                  margin: "2px",
                  padding: "2px",
                }}
              >
                {/* A. MAP FRAME SECTION */}
                <div className="flex-[3] border-2 border-black relative flex items-center justify-center overflow-hidden bg-slate-50">
                  {capturedMapUrl ? (
                    <img
                      src={capturedMapUrl}
                      alt="Peta Spasial"
                      className="w-full h-full object-cover"
                      onError={() => {
                        console.error(
                          "Gagal memuat gambar peta yang ditangkap",
                        );
                        setCapturedMapUrl(null);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-sm font-mono font-bold text-slate-500">
                        {isCapturing
                          ? "Mengambil gambar peta..."
                          : "Gagal menangkap peta. Silakan tutup dan coba lagi."}
                      </span>
                    </div>
                  )}

                  {/* Grid or Scale ticks overlay inside map frame for decoration */}
                  {printProjection && (
                    <div className="absolute top-2 left-2 bg-white/80 border border-black px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-tight rounded pointer-events-none select-none text-black">
                      {printProjection}
                    </div>
                  )}
                  {/* Scale Bar */}

                  {/* Creator / Source text */}
                  <div className="absolute bottom-2 right-2 bg-white/80 border border-black px-2 py-1 text-[7px] font-mono font-bold rounded pointer-events-none select-none text-black max-w-[180px] text-right leading-tight">
                    {printSourceText || "Sumber: Bappeda Banda Aceh"}
                  </div>

                  {/* Dynamic Print Layout Overlay Elements */}
                  {printLayoutElements.map((el) => {
                    const isSelected = el.id === selectedElementId;

                    return (
                      <div
                        key={el.id}
                        onMouseDown={(e) => startDrag(e, el.id)}
                        onTouchStart={(e) => startTouchDrag(e, el.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(el.id);
                        }}
                        className={`absolute select-none cursor-move group transition-all duration-75 ${
                          isSelected
                            ? "ring-2 ring-sky-400 ring-offset-1 print:ring-0 print:ring-offset-0 z-50"
                            : "hover:ring-1 hover:ring-slate-400 z-40"
                        }`}
                        style={{
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          transform: "translate(-50%, -50%)",
                          padding: "4px",
                          borderRadius: "2px",
                        }}
                      >
                        {/* Selector badge */}
                        {isSelected && (
                          <div className="absolute -top-2.5 -right-2.5 w-4 h-4 bg-sky-500 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white print:hidden shadow-md">
                            ✓
                          </div>
                        )}

                        {el.type === "text" && (
                          <div
                            style={{
                              fontSize: `${el.fontSize || 14}px`,
                              color: el.fontColor || "#000000",
                              fontWeight: "bold",
                              whiteSpace: "nowrap",
                              fontFamily: "var(--font-sans)",
                            }}
                          >
                            {el.content}
                          </div>
                        )}

                        {el.type === "line" && (
                          <div
                            style={{
                              width: `${el.width || 100}px`,
                              height: `${el.lineWidth || 2}px`,
                              backgroundColor: el.lineColor || "#ff0000",
                              transform: `rotate(${el.rotation || 0}deg)`,
                              transformOrigin: "center",
                            }}
                          />
                        )}

                        {el.type === "rectangle" && (
                          <div
                            style={{
                              width: `${el.width || 120}px`,
                              height: `${el.height || 60}px`,
                              backgroundColor:
                                el.rectFillColor || "rgba(255,255,255,0.7)",
                              border: `${el.rectBorderWidth === undefined ? 2 : el.rectBorderWidth}px solid ${el.rectBorderColor || "#000000"}`,
                            }}
                          />
                        )}

                        {el.type === "image" && el.imageUrl && (
                          <img
                            src={el.imageUrl}
                            alt="Overlay element"
                            referrerPolicy="no-referrer"
                            style={{
                              width: `${el.width || 60}px`,
                              height: `${el.height || 60}px`,
                              transform: `rotate(${el.rotation || 0}deg)`,
                              transformOrigin: "center",
                              objectFit: "contain",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* B. KOP KARTOGRAFI SECTION (Title block & legend) */}
                {printOrientation === "landscape" ? (
                  /* Vertical Kop Layout for Landscape Orientation */
                  <div className="flex-[1] border-2 border-black p-3.5 flex flex-col justify-between text-black bg-white select-none overflow-hidden max-w-[280px]">
                    <div className="flex flex-col gap-2.5">
                      {/* Logo & Agency Info */}
                      <div className="text-center border-b-2 border-black pb-2 flex flex-col items-center justify-center gap-1">
                        {printLogo ? (
                          <img
                            src={printLogo}
                            alt="Logo Instansi"
                            className="w-10 h-10 object-contain border border-black rounded"
                          />
                        ) : (
                          <div className="w-9 h-9 border border-black flex items-center justify-center rounded bg-slate-100 font-bold text-xs">
                            SIG
                          </div>
                        )}
                        <div className="leading-tight">
                          <h4 className="font-sans font-extrabold text-[9px] tracking-wider">
                            {printGovernmentName}
                          </h4>
                          <h4 className="font-sans font-extrabold text-[10px] tracking-wider uppercase">
                            {printRegionName}
                          </h4>
                          <p className="text-[7px] text-slate-600 font-medium font-mono leading-none mt-0.5">
                            {printProvinceName}
                          </p>
                        </div>
                      </div>

                      {/* Map Title & Subtitle block */}
                      <div className="border-b-2 border-black pb-2">
                        <h2 className="font-sans font-extrabold text-xs tracking-wide uppercase leading-tight text-center">
                          {printTitle || "PETA SPASIAL KOTA"}
                        </h2>
                        <p className="text-[8px] font-mono mt-1 text-center font-medium leading-normal text-slate-700">
                          {printSubtitle ||
                            "Badan Perencanaan Pembangunan Daerah"}
                        </p>
                      </div>

                      {/* Compass Block */}
                      {printShowCompass && (
                        <div className="border-b-2 border-black pb-2.5 flex justify-center items-center gap-4 py-1">
                          <div className="flex flex-col items-center">
                            <svg
                              width="24px"
                              height="24px"
                              viewBox="0 0 100 100"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                              role="img"
                              className="iconify iconify--gis"
                              preserveAspectRatio="xMidYMid meet"
                              fill="#000000"
                            >
                              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                              <g
                                id="SVGRepo_tracerCarrier"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              ></g>
                              <g id="SVGRepo_iconCarrier">
                                <path
                                  d="M42.066 0v20h3.752V6.957L53.881 20h4.053V0h-3.752v13.355L45.996 0zm5.57 26.688l-25.77 69.949c-.823 2.238 1.658 4.248 3.677 2.978L50 84.195l24.455 15.42c2.02 1.273 4.504-.738 3.68-2.978l-25.79-70c-.472-1.096-1.283-1.632-2.384-1.635c-1.1-.003-2.017.856-2.324 1.686zm-.136 14.83V79.86L29.1 91.463z"
                                  fill="#000000"
                                  fillRule="evenodd"
                                ></path>
                              </g>
                            </svg>
                            <span className="text-[7px] font-bold mt-0.5 font-mono">
                              ARAH UTARA
                            </span>
                            <span className="text-[10px] mt-0.5 font-mono">
                              Skala: {printScaleText || "1:25.000"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Dynamic Legend Block */}
                      {printShowLegend && (
                        <div className="flex flex-col gap-1.5 border-b-2 border-black pb-2.5">
                          <h5 className="font-bold text-[9px] uppercase font-mono tracking-wider border-b border-slate-300 pb-0.5">
                            LEGENDA PETA
                          </h5>
                          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                            {/* Standard Layers */}

                            {/* Dynamic Active Layers from Application */}
                            {layers
                              .filter((l) => l.visible)
                              .map((l) => (
                                <div
                                  key={l.id}
                                  className="flex items-center gap-2 text-[9px]"
                                >
                                  {l.type === "fill" && (
                                    <div
                                      className="w-4 h-2.5 border border-black"
                                      style={{
                                        backgroundColor: l.color || "#94a3b8",
                                      }}
                                    />
                                  )}
                                  {l.type === "line" && (
                                    <div
                                      className="w-4 h-0.5"
                                      style={{
                                        backgroundColor: l.color || "#ef4444",
                                      }}
                                    />
                                  )}
                                  {l.type === "circle" && (
                                    <div
                                      className="w-2.5 h-2.5 rounded-full border border-black"
                                      style={{
                                        backgroundColor: l.color || "#3b82f6",
                                      }}
                                    />
                                  )}
                                  <span className="font-mono text-[8px] truncate leading-tight capitalize">
                                    {l.name}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer metadata block */}
                    <div className="border-t-2 border-black pt-2 text-[7px] font-mono text-slate-500 flex flex-col gap-0.5">
                      <div className="truncate">
                        {printSourceText || "Sumber: Bappeda Banda Aceh"}
                      </div>

                      <div className="truncate">
                        Tanggal Cetak:{" "}
                        {new Date().toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <div className="font-bold text-[6px] tracking-wider uppercase border-t border-slate-200 mt-1 pt-0.5 truncate">
                        KARTOGRAFER: {printCartographer}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Horizontal Kop Layout for Portrait Orientation */
                  <div className="border-2 border-black p-3 flex flex-row justify-between gap-4 text-black bg-white select-none text-left">
                    {/* Col 1: Logo, Title & Subtitle */}
                    <div className="flex-1 flex flex-col gap-1.5 pr-2 border-r border-slate-300">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
                        {printLogo ? (
                          <img
                            src={printLogo}
                            alt="Logo Instansi"
                            className="w-7 h-7 object-contain border border-black rounded"
                          />
                        ) : (
                          <div className="w-7 h-7 border border-black flex items-center justify-center rounded bg-slate-100 font-bold text-[10px]">
                            SIG
                          </div>
                        )}
                        <div className="leading-tight">
                          <h4 className="font-sans font-extrabold text-[8px] uppercase tracking-wider leading-none">
                            {printGovernmentName}
                          </h4>
                          <h4 className="font-sans font-extrabold text-[9px] uppercase tracking-wider leading-tight">
                            {printRegionName}
                          </h4>
                        </div>
                      </div>
                      <h2 className="font-sans font-extrabold text-[10px] tracking-wide uppercase leading-tight">
                        {printTitle || "PETA SPASIAL KOTA"}
                      </h2>
                      <p className="text-[7px] font-mono leading-tight text-slate-700">
                        {printSubtitle ||
                          "Badan Perencanaan Pembangunan Daerah"}
                      </p>
                    </div>

                    {/* Col 2: Legend Panel */}
                    {printShowLegend ? (
                      <div className="flex-1 px-2 border-r border-slate-300 flex flex-col gap-1">
                        <h5 className="font-bold text-[8px] uppercase font-mono tracking-wider border-b border-slate-300 pb-0.5">
                          LEGENDA
                        </h5>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-[70px] overflow-y-auto pr-1">
                          <div className="flex items-center gap-1 text-[8px]">
                            <div className="w-3 h-2 border border-black bg-emerald-500/10 shrink-0" />
                            <span className="font-mono text-[7px] leading-tight truncate">
                              Batas Kecamatan
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[8px]">
                            <div className="w-3 h-0.5 bg-red-500 shrink-0" />
                            <span className="font-mono text-[7px] leading-tight truncate">
                              Jalan Kota
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[8px]">
                            <div className="w-3 h-0.5 bg-blue-500 shrink-0" />
                            <span className="font-mono text-[7px] leading-tight truncate">
                              Aliran Sungai
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[8px]">
                            <div className="w-2 h-2 rounded-full bg-amber-500 border border-black shrink-0" />
                            <span className="font-mono text-[7px] leading-tight truncate">
                              Landmark Kota
                            </span>
                          </div>

                          {layers
                            .filter((l) => l.visible)
                            .map((l) => (
                              <div
                                key={l.id}
                                className="flex items-center gap-1 text-[8px]"
                              >
                                {l.type === "fill" && (
                                  <div
                                    className="w-3 h-2 border border-black shrink-0"
                                    style={{
                                      backgroundColor: l.color || "#94a3b8",
                                    }}
                                  />
                                )}
                                {l.type === "line" && (
                                  <div
                                    className="w-3 h-0.5 shrink-0"
                                    style={{
                                      backgroundColor: l.color || "#ef4444",
                                    }}
                                  />
                                )}
                                {l.type === "circle" && (
                                  <div
                                    className="w-2 h-2 rounded-full border border-black shrink-0"
                                    style={{
                                      backgroundColor: l.color || "#3b82f6",
                                    }}
                                  />
                                )}
                                <span className="font-mono text-[7px] truncate leading-tight capitalize shrink-0">
                                  {l.name}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 px-2 border-r border-slate-300 flex flex-col justify-center items-center text-slate-400 font-mono text-[8px]">
                        Legenda Dinonaktifkan
                      </div>
                    )}

                    {/* Col 3: Compass, Scale, Metadata */}
                    <div className="flex-1 pl-2 flex flex-row items-center justify-between gap-2">
                      <div className="flex flex-col items-center justify-center shrink-0">
                        {printShowCompass ? (
                          <div className="flex flex-col items-center justify-center">
                            <svg
                              width="24px"
                              height="24px"
                              viewBox="0 0 100 100"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                              role="img"
                              className="iconify iconify--gis"
                              preserveAspectRatio="xMidYMid meet"
                              fill="#000000"
                            >
                              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                              <g
                                id="SVGRepo_tracerCarrier"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              ></g>
                              <g id="SVGRepo_iconCarrier">
                                <path
                                  d="M42.066 0v20h3.752V6.957L53.881 20h4.053V0h-3.752v13.355L45.996 0zm5.57 26.688l-25.77 69.949c-.823 2.238 1.658 4.248 3.677 2.978L50 84.195l24.455 15.42c2.02 1.273 4.504-.738 3.68-2.978l-25.79-70c-.472-1.096-1.283-1.632-2.384-1.635c-1.1-.003-2.017.856-2.324 1.686zm-.136 14.83V79.86L29.1 91.463z"
                                  fill="#000000"
                                  fillRule="evenodd"
                                ></path>
                              </g>
                            </svg>
                            <span className="text-[6px] font-bold mt-0.5 font-mono">
                              ARAH UTARA
                            </span>
                          </div>
                        ) : (
                          <div className="h-7" />
                        )}
                      </div>
                      <div className="text-[7px] font-mono leading-snug text-slate-600 flex flex-col justify-center min-w-0">
                        <div className="truncate">Datum: {printDatum}</div>
                        <div className="truncate">
                          {printSourceText || "Sumber: Bappeda Banda Aceh"}
                        </div>
                        <div className="truncate font-bold text-[6px] text-black border-t border-slate-200 mt-0.5 pt-0.5">
                          KTR: {printCartographer}
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
