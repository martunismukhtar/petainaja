import { useState, useEffect } from "react";
import {
  Layers,
  // MapPin,
  Info,
  Map,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Sliders,
  Settings2,
  Trash2,
  FileJson,
  X,
  Table,
  Palette,
  Plus,
  PenTool,
  Check,
  Maximize2,
  GitMerge,
  Scissors,
} from "lucide-react";
import { LayerId } from "../types";
import type { GisLayer, ClickedFeatureInfo, GisTool } from "../types";

interface SidebarProps {
  layers: GisLayer[];
  onToggleLayer: (id: LayerId | string) => void;
  clickedFeature: ClickedFeatureInfo | null;
  onCloseFeatureInfo: () => void;

  uploadedGeoJSONsCount: number;
  isUploadedVisible: boolean;
  onToggleUploadedVisibility: () => void;
  onClearUploaded: () => void;
  onClose?: () => void;
  onUpdateLayerColor: (id: LayerId | string, color: string) => void;
  onUpdateLayerOpacity: (id: LayerId | string, opacity: number) => void;
  onUpdateLayerIconStyle: (
    id: LayerId | string,
    iconStyle: "circle" | "square" | "star" | "triangle" | "marker",
  ) => void;
  onUpdateLayerLineStyle: (
    id: LayerId | string,
    lineStyle: "solid" | "dashed" | "dotted",
  ) => void;
  onUpdateLayerLineWidth: (id: LayerId | string, lineWidth: number) => void;
  onOpenAttributeTable: (id: LayerId | string) => void;
  onExportLayer: (
    id: LayerId | string,
    format: "shp" | "kml" | "geojson",
  ) => void;
  onRemoveLayer?: (id: LayerId | string) => void;
  onCreateLayer?: (
    name: string,
    type: "fill" | "line" | "circle",
    color: string,
  ) => void;
  drawingLayerId?: string | null;
  onStartDrawing?: (layerId: string) => void;
  onEditFeature?: (
    layerId: string,
    featureIndex: number,
    geometry: any,
    properties: any,
  ) => void;
  onCreateWmsLayer?: (name: string, url: string, layersParam: string) => void;
  onCreateVectorTileLayer?: (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => void;
  onCreatePmtilesLayer?: (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => void;
  onRenameLayer?: (id: string, newName: string) => void;
  onUpdateWmsParams?: (
    id: string | LayerId,
    wmsUrl: string,
    wmsLayers: string,
  ) => void;
  onDeleteFeature?: (layerId: string, featureIndex: number) => void;
  onUpdateFeatureProperties?: (
    layerId: string,
    featureIndex: number,
    properties: Record<string, any>,
  ) => void;
  onMergeFeatures?: (layerId: string, featureIndexes: number[]) => void;
  onDissolveLayer?: (layerId: string, propertyName?: string) => void;
  onSplitFeature?: (layerId: string, featureIndex: number, cutterCoords: [number, number][]) => void;
  activeTool?: GisTool;
  onChangeTool?: (tool: GisTool) => void;
  onOpenAssistant?: (id: string) => void;
  onZoomToFeature?: (coords: [number, number]) => void;
  getFeatureCenter?: (feature: any) => [number, number] | null;
}

export default function Sidebar({
  layers,
  onToggleLayer,
  clickedFeature,
  onCloseFeatureInfo,

  // onDeleteCustomPin,
  // onZoomToPin,
  uploadedGeoJSONsCount,
  isUploadedVisible,
  onToggleUploadedVisibility,
  onClearUploaded,
  onClose,
  onUpdateLayerColor,
  onUpdateLayerOpacity,
  onUpdateLayerIconStyle,
  onUpdateLayerLineStyle,
  onUpdateLayerLineWidth,
  onOpenAttributeTable,
  onExportLayer,
  onRemoveLayer,
  onCreateLayer,
  drawingLayerId,
  onStartDrawing,
  onEditFeature,
  onCreateWmsLayer,
  onCreateVectorTileLayer,
  onCreatePmtilesLayer,
  onRenameLayer,
  onUpdateWmsParams,
  onDeleteFeature,
  onUpdateFeatureProperties,
  onMergeFeatures,
  onDissolveLayer,
  onChangeTool,
  onOpenAssistant,
  onZoomToFeature,
  getFeatureCenter,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteFeature, setConfirmDeleteFeature] = useState<{
    layerId: string;
    featureIndex: number;
  } | null>(null);
  const [confirmDeleteLayerId, setConfirmDeleteLayerId] = useState<string | null>(null);
  const [activeLayerConfigId, setActiveLayerConfigId] = useState<
    LayerId | string | null
  >(null);
  const [expandedFeatureListLayerId, setExpandedFeatureListLayerId] = useState<
    string | null
  >(null);
  const [isCreatingLayer, setIsCreatingLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerType, setNewLayerType] = useState<"fill" | "line" | "circle">(
    "circle",
  );
  const [newLayerColor, setNewLayerColor] = useState("#10b981");

  const [createLayerTypeMode, setCreateLayerTypeMode] = useState<
    "geojson" | "wms" | "vector-tile" | "pmbtiles"
  >("geojson");
  const [wmsUrl, setWmsUrl] = useState(
    "https://kemendagri.go.id/geoserver/wms",
  );
  const [wmsLayers, setWmsLayers] = useState("0");

  // Local state for Vector Tile creation
  const [vtUrl, setVtUrl] = useState("");
  const [vtLayers, setVtLayers] = useState("");
  const [vtGeomType, setVtGeomType] = useState<"fill" | "line" | "circle">("line");
  const [vtColor, setVtColor] = useState("#f43f5e");

  // Local state for PMTiles creation
  const [pmTilesUrlInput, setPmTilesUrlInput] = useState("");
  const [pmTilesLayersInput, setPmTilesLayersInput] = useState("");
  const [pmTilesGeomType, setPmTilesGeomType] = useState<"fill" | "line" | "circle">("line");
  const [pmTilesColor, setPmTilesColor] = useState("#a855f7");

  const [editWmsUrl, setEditWmsUrl] = useState("");
  const [editWmsLayers, setEditWmsLayers] = useState("");

  // Synchronize WMS editing local state when the active layer changes
  useEffect(() => {
    if (activeLayerConfigId) {
      const activeLayer = layers.find((l) => l.id === activeLayerConfigId);
      if (activeLayer && activeLayer.type === "wms") {
        setEditWmsUrl(activeLayer.wmsUrl || "");
        setEditWmsLayers(activeLayer.wmsLayers || "");
      }
    } else {
      setEditWmsUrl("");
      setEditWmsLayers("");
    }
  }, [activeLayerConfigId, layers]);

  const handleCreateLayerSubmit = () => {
    if (!newLayerName.trim()) return;
    if (createLayerTypeMode === "geojson") {
      onCreateLayer?.(newLayerName.trim(), newLayerType, newLayerColor);
    } else if (createLayerTypeMode === "wms") {
      onCreateWmsLayer?.(newLayerName.trim(), wmsUrl.trim(), wmsLayers.trim());
    } else if (createLayerTypeMode === "vector-tile") {
      onCreateVectorTileLayer?.(newLayerName.trim(), vtUrl.trim(), vtLayers.trim(), vtGeomType, vtColor);
    } else if (createLayerTypeMode === "pmbtiles") {
      onCreatePmtilesLayer?.(newLayerName.trim(), pmTilesUrlInput.trim(), pmTilesLayersInput.trim(), pmTilesGeomType, pmTilesColor);
    }
    setNewLayerName("");
    setIsCreatingLayer(false);
  };

  const [expandedSection, setExpandedSection] = useState<
    Record<string, boolean>
  >({
    layers: true,
    featureInfo: true,
    geoprocessing: true,
    pins: true,
    legend: true,
  });

  // Geoprocessing & Geometry edit local states
  const [gpSelectedLayerId, setGpSelectedLayerId] = useState<string>("");
  const [gpMergeSelectedIndices, setGpMergeSelectedIndices] = useState<number[]>([]);
  const [gpDissolvePropertyName, setGpDissolvePropertyName] = useState<string>("");
  const [activeGpTab, setActiveGpTab] = useState<"merge" | "dissolve" | "split">("merge");

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Local state for dynamic attribute editing
  const [editingProperties, setEditingProperties] = useState<Record<
    string,
    any
  > | null>(null);
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");
  const [attrSuccessMsg, setAttrSuccessMsg] = useState("");

  useEffect(() => {
    if (clickedFeature) {
      setEditingProperties({ ...clickedFeature.properties });
      setNewAttrKey("");
      setNewAttrVal("");
      setAttrSuccessMsg("");
    } else {
      setEditingProperties(null);
    }
  }, [clickedFeature]);

  const handleUpdatePropertyLocal = (key: string, value: any) => {
    if (!editingProperties) return;
    setEditingProperties({
      ...editingProperties,
      [key]: value,
    });
  };

  const handleDeletePropertyLocal = (key: string) => {
    if (!editingProperties) return;
    const updated = { ...editingProperties };
    delete updated[key];
    setEditingProperties(updated);
  };

  const handleAddPropertyLocal = () => {
    if (!editingProperties || !newAttrKey.trim()) return;
    const formattedKey = newAttrKey.trim().replace(/\s+/g, "_");
    setEditingProperties({
      ...editingProperties,
      [formattedKey]: newAttrVal.trim(),
    });
    setNewAttrKey("");
    setNewAttrVal("");
  };

  const handleSavePropertiesToServer = () => {
    if (
      !clickedFeature ||
      !clickedFeature.layerId ||
      clickedFeature.featureIndex === undefined ||
      !editingProperties
    )
      return;
    onUpdateFeatureProperties?.(
      clickedFeature.layerId as string,
      clickedFeature.featureIndex,
      editingProperties,
    );
    setAttrSuccessMsg("Atribut berhasil disimpan!");
    setTimeout(() => {
      setAttrSuccessMsg("");
    }, 2000);
  };

  // Filter layers or search inside feature attributes (if applicable)
  const filteredLayers = layers.filter((layer) =>
    layer.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(()=>{
    console.log(layers)
  }, [])

  return (
    <aside className="w-80 bg-[#0f172a] border-r border-[#334155] flex flex-col h-full text-slate-100 select-none z-40 shadow-lg absolute md:relative left-0 top-0 bottom-0">
      {/* Sidebar Header / Search */}
      <div className="p-4 border-b border-[#334155] bg-[#0f172a] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#38bdf8]" />
            <h2 className="font-sans font-bold text-xs uppercase tracking-wider text-[#94a3b8]">
              Control Panel
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#1e293b] text-[#38bdf8] font-mono font-semibold px-2 py-0.5 rounded border border-[#334155]">
              ACTIVE
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-[#1e293b] text-slate-400 hover:text-white rounded md:hidden transition-colors border border-[#334155]"
                title="Tutup Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Cari layer atau data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e293b] border border-[#334155] rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* LAYERS MANAGER */}
        <div className="bg-[#1e293b]/40 rounded-lg border border-[#334155] overflow-hidden">
          <button
            onClick={() => toggleSection("layers")}
            className="w-full flex items-center justify-between p-3 bg-[#1e293b]/80 border-b border-[#334155] hover:bg-[#1e293b] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Layer Manager
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold bg-[#0f172a] text-[#38bdf8] px-1.5 rounded border border-[#334155]">
                {layers.length + (uploadedGeoJSONsCount > 0 ? 1 : 0)}
              </span>
              {expandedSection.layers ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {expandedSection.layers && (
            <div className="p-2.5 space-y-1 bg-[#1e293b]/25">
              {/* Create New Custom Layer Form */}
              <div className="mb-2 px-0.5">
                {!isCreatingLayer ? (
                  <button
                    onClick={() => setIsCreatingLayer(true)}
                    className="w-full py-1.5 px-3 bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 rounded-md flex items-center justify-center gap-1.5 font-bold text-xs transition-all duration-150 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 animate-pulse" />
                    Buat Layer Baru
                  </button>
                ) : (
                  <div className="bg-[#0f172a] border border-[#334155]/80 rounded-md p-3 space-y-2.5 animate-in slide-in-from-top-1 duration-150 shadow-md">
                    <div className="flex justify-between items-center border-b border-[#334155]/60 pb-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#38bdf8] font-mono">
                        Layer Baru
                      </span>
                      <button
                        onClick={() => setIsCreatingLayer(false)}
                        className="text-slate-400 hover:text-white text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Selector Mode Tab */}
                    <div className="grid grid-cols-2 gap-1 border border-[#334155] rounded p-0.5 bg-[#1e293b]/50">
                      <button
                        type="button"
                        onClick={() => setCreateLayerTypeMode("geojson")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                          createLayerTypeMode === "geojson"
                            ? "bg-[#38bdf8] text-[#0f172a]"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Vector (GeoJSON)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateLayerTypeMode("wms")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                          createLayerTypeMode === "wms"
                            ? "bg-[#38bdf8] text-[#0f172a]"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        WMS Raster
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateLayerTypeMode("vector-tile")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                          createLayerTypeMode === "vector-tile"
                            ? "bg-[#38bdf8] text-[#0f172a]"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Vector Tile
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateLayerTypeMode("pmbtiles")}
                        className={`py-1 text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                          createLayerTypeMode === "pmbtiles"
                            ? "bg-[#38bdf8] text-[#0f172a]"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        PMTiles
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                          Nama Layer
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: Titik Evakuasi"
                          value={newLayerName}
                          onChange={(e) => setNewLayerName(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                        />
                      </div>

                      {createLayerTypeMode === "geojson" && (
                        <>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Tipe Geometri
                            </label>
                            <select
                              value={newLayerType}
                              onChange={(e) =>
                                setNewLayerType(
                                  e.target.value as "fill" | "line" | "circle",
                                )
                              }
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs cursor-pointer font-mono"
                            >
                              <option value="circle">Titik (Point)</option>
                              <option value="line">Garis (LineString)</option>
                              <option value="fill">Poligon (Polygon)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Warna Layer
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={newLayerColor}
                                onChange={(e) =>
                                  setNewLayerColor(e.target.value)
                                }
                                className="w-6 h-6 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                              />
                              <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">
                                {newLayerColor}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {createLayerTypeMode === "wms" && (
                        <>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              URL WMS Server
                            </label>
                            <input
                              type="text"
                              placeholder="https://geoserver.example.com/geoserver/wms"
                              value={wmsUrl}
                              onChange={(e) => setWmsUrl(e.target.value)}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Layer Name WMS (Parameters)
                            </label>
                            <input
                              type="text"
                              placeholder="workspace:layer_name atau ID layer"
                              value={wmsLayers}
                              onChange={(e) => setWmsLayers(e.target.value)}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                            />
                          </div>
                        </>
                      )}

                      {createLayerTypeMode === "vector-tile" && (
                        <>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              URL Vector Tile (.mvt / .pbf)
                            </label>
                            <input
                              type="text"
                              placeholder="https://example.com/tiles/{z}/{x}/{y}.pbf"
                              value={vtUrl}
                              onChange={(e) => setVtUrl(e.target.value)}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Source Layer Name
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: roads, water, landuse"
                              value={vtLayers}
                              onChange={(e) => setVtLayers(e.target.value)}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Tipe Geometri Rendisi
                            </label>
                            <select
                              value={vtGeomType}
                              onChange={(e) =>
                                setVtGeomType(
                                  e.target.value as "fill" | "line" | "circle",
                                )
                              }
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs cursor-pointer font-mono"
                            >
                              <option value="circle">Titik (Point)</option>
                              <option value="line">Garis (LineString)</option>
                              <option value="fill">Poligon (Polygon)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Warna Layer
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={vtColor}
                                onChange={(e) => setVtColor(e.target.value)}
                                className="w-6 h-6 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                              />
                              <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">
                                {vtColor}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {createLayerTypeMode === "pmbtiles" && (
                        <>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              URL File PMTiles (.pmtiles)
                            </label>
                            <input
                              type="text"
                              placeholder="https://example.com/file.pmtiles"
                              value={pmTilesUrlInput}
                              onChange={(e) => setPmTilesUrlInput(e.target.value)}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Source Layer Name
                            </label>
                            <input
                              type="text"
                              placeholder="Contoh: water, roads, default"
                              value={pmTilesLayersInput}
                              onChange={(e) => setPmTilesLayersInput(e.target.value)}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Tipe Geometri Rendisi
                            </label>
                            <select
                              value={pmTilesGeomType}
                              onChange={(e) =>
                                setPmTilesGeomType(
                                  e.target.value as "fill" | "line" | "circle",
                                )
                              }
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs cursor-pointer font-mono"
                            >
                              <option value="circle">Titik (Point)</option>
                              <option value="line">Garis (LineString)</option>
                              <option value="fill">Poligon (Polygon)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">
                              Warna Layer
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={pmTilesColor}
                                onChange={(e) => setPmTilesColor(e.target.value)}
                                className="w-6 h-6 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                              />
                              <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">
                                {pmTilesColor}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={handleCreateLayerSubmit}
                          disabled={
                            !newLayerName.trim() ||
                            (createLayerTypeMode === "wms" &&
                              (!wmsUrl.trim() || !wmsLayers.trim())) ||
                            (createLayerTypeMode === "vector-tile" &&
                              (!vtUrl.trim() || !vtLayers.trim())) ||
                            (createLayerTypeMode === "pmbtiles" &&
                              (!pmTilesUrlInput.trim() || !pmTilesLayersInput.trim()))
                          }
                          className="flex-1 py-1 bg-[#10b981] hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded text-[10px] transition-colors cursor-pointer"
                        >
                          Buat
                        </button>
                        <button
                          onClick={() => setIsCreatingLayer(false)}
                          className="px-2 py-1 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded text-[10px] transition-colors cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {filteredLayers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex flex-col bg-[#1e293b]/20 rounded-md border border-[#334155]/30 overflow-hidden mb-1"
                >
                  <div
                    className={`flex items-center justify-between p-2 transition-all ${
                      layer.visible
                        ? "bg-[#1e293b]/50 hover:bg-[#1e293b]"
                        : "opacity-60 hover:opacity-100 hover:bg-[#1e293b]/20"
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() => onToggleLayer(layer.id)}
                        className="rounded border-[#334155] text-[#38bdf8] focus:ring-[#38bdf8] bg-[#0f172a] w-3.5 h-3.5"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-200">
                          {layer.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {(layer.type as string) !== "wms" && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              {layer.count} fitur • {layer.description}
                            </span>
                          )}
                        </span>
                      </div>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {/* Open design assistant */}
                      <button
                        onClick={() => onOpenAssistant?.(layer.id)}
                        className="p-1 rounded bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/20 transition-all flex items-center justify-center"
                        title="Asisten Gaya & Gambar Fitur"
                      >
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      </button>

                      {/* Settings toggle button */}
                      <button
                        onClick={() =>
                          setActiveLayerConfigId(
                            activeLayerConfigId === layer.id ? null : layer.id,
                          )
                        }
                        className={`p-1 rounded transition-colors ${
                          activeLayerConfigId === layer.id
                            ? "text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30"
                            : "text-slate-400 hover:text-white hover:bg-[#1e293b] border border-transparent"
                        }`}
                        title="Pengaturan Gaya & Data"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Trash Button to Remove Layer */}
                      {confirmDeleteLayerId === layer.id ? (
                        <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded p-0.5 animate-in fade-in zoom-in-95 duration-150">
                          <span className="text-[9px] text-red-400 font-medium px-1 font-sans">Hapus?</span>
                          <button
                            onClick={() => {
                              onRemoveLayer?.(layer.id);
                              setConfirmDeleteLayerId(null);
                            }}
                            className="p-1 text-red-400 hover:text-white hover:bg-red-500 rounded transition-colors cursor-pointer"
                            title="Ya, Hapus"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteLayerId(null)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-[#1e293b] rounded transition-colors cursor-pointer"
                            title="Batal"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteLayerId(layer.id)}
                          className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded border border-transparent transition-colors"
                          title="Hapus Layer ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Visual color indicator */}
                      {(layer.type as string) !== "wms" && (
                        <span
                          onClick={() =>
                            setActiveLayerConfigId(
                              activeLayerConfigId === layer.id
                                ? null
                                : layer.id,
                            )
                          }
                          className="w-3.5 h-3.5 rounded-full border border-slate-900 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                          style={{
                            backgroundColor: layer.color,
                            borderColor: layer.outlineColor || "transparent",
                          }}
                          title={`Simbologi: ${layer.type} (Klik untuk edit)`}
                        ></span>
                      )}
                    </div>
                  </div>

                  {/* Color Classification Legend Preview */}
                  {layer.colorClassification?.enabled && layer.colorClassification?.rules && Object.keys(layer.colorClassification.rules).length > 0 && (
                    <div className="px-3 pb-2 pt-1.5 border-t border-[#334155]/20 bg-[#1e293b]/10">
                      <span className="text-[9px] text-[#38bdf8] font-bold uppercase tracking-wider font-mono block mb-1">
                        Legenda Klasifikasi Keterangan
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {Object.entries(layer.colorClassification.rules).map(([val, col]) => (
                          <div key={val} className="flex items-center gap-1.5 bg-[#0f172a]/40 px-2 py-0.5 rounded border border-[#334155]/20">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col }} />
                            <span className="text-[9px] text-slate-300 truncate font-mono">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* EXPANDED SETTINGS SECTION */}
                  {activeLayerConfigId === layer.id && (
                    <div className="p-3 bg-[#0f172a] border-t border-[#334155] text-xs space-y-3 animate-in slide-in-from-top-1 duration-150">
                      {layer.type === "wms" ? (
                        <div className="space-y-3 animate-in slide-in-from-top-1 duration-150">
                          {/* Rename Layer */}
                          <div className="space-y-1 bg-[#1e293b]/30 p-2 rounded-lg border border-[#334155]/30">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                              ✏️ Edit Nama Layer
                            </span>
                            <input
                              type="text"
                              value={layer.name}
                              onChange={(e) =>
                                onRenameLayer?.(layer.id, e.target.value)
                              }
                              className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-2 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-[#38bdf8]"
                            />
                          </div>

                          {/* URL Server WMS */}
                          <div className="space-y-1 bg-[#1e293b]/30 p-2 rounded-lg border border-[#334155]/30">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                              🔗 URL Server WMS
                            </span>
                            <input
                              type="text"
                              value={editWmsUrl}
                              onChange={(e) => setEditWmsUrl(e.target.value)}
                              placeholder="https://server.com/geoserver/wms"
                              className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-2 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-[#38bdf8]"
                            />
                          </div>

                          {/* Parameter WMS */}
                          <div className="space-y-1 bg-[#1e293b]/30 p-2 rounded-lg border border-[#334155]/30">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                              ⚙️ Parameter Layer (WMS layers)
                            </span>
                            <input
                              type="text"
                              value={editWmsLayers}
                              onChange={(e) => setEditWmsLayers(e.target.value)}
                              placeholder="workspace:layer_name"
                              className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-2 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-[#38bdf8]"
                            />
                          </div>

                          {/* Save Button for WMS URL & Parameter */}
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateWmsParams?.(layer.id, editWmsUrl.trim(), editWmsLayers.trim());
                              alert("Parameter WMS berhasil diperbarui!");
                            }}
                            disabled={!editWmsUrl.trim() || !editWmsLayers.trim()}
                            className="w-full py-1.5 bg-[#38bdf8] hover:bg-[#0284c7] disabled:opacity-50 text-slate-950 font-bold rounded text-[10px] transition-colors cursor-pointer"
                          >
                            Simpan Parameter WMS
                          </button>

                          {/* Opacity slider */}
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 font-mono">
                              <span>Transparansi (Opacity)</span>
                              <span className="text-[#38bdf8]">
                                {Math.round(layer.opacity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={layer.opacity}
                              onChange={(e) =>
                                onUpdateLayerOpacity(
                                  layer.id,
                                  parseFloat(e.target.value),
                                )
                              }
                              className="w-full accent-[#38bdf8] h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Rename Layer */}
                          <div className="space-y-1 bg-[#1e293b]/30 p-2 rounded-lg border border-[#334155]/30">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                              ✏️ Edit Nama Layer
                            </span>
                            <input
                              type="text"
                              value={layer.name}
                              onChange={(e) =>
                                onRenameLayer?.(layer.id, e.target.value)
                              }
                              className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-2 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-[#38bdf8]"
                            />
                          </div>

                          {/* Color Settings */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono flex items-center gap-1">
                              <Palette className="w-3 h-3 text-[#38bdf8]" />{" "}
                              Warna Layer
                            </span>
                            <div className="flex items-center gap-2">
                              {/* Color Circle Presets */}
                              <div className="flex flex-wrap gap-1.5 flex-1">
                                {[
                                  "#3b82f6",
                                  "#10b981",
                                  "#f59e0b",
                                  "#ef4444",
                                  "#8b5cf6",
                                  "#06b6d4",
                                  "#ec4899",
                                  "#14b8a6",
                                ].map((presetColor) => (
                                  <button
                                    key={presetColor}
                                    onClick={() =>
                                      onUpdateLayerColor(layer.id, presetColor)
                                    }
                                    className={`w-4 h-4 rounded-full border transition-transform ${
                                      layer.color === presetColor
                                        ? "border-white scale-110"
                                        : "border-transparent hover:scale-110"
                                    }`}
                                    style={{ backgroundColor: presetColor }}
                                  />
                                ))}
                              </div>
                              {/* Native Hex Input */}
                              <input
                                type="color"
                                value={layer.color}
                                onChange={(e) =>
                                  onUpdateLayerColor(layer.id, e.target.value)
                                }
                                className="w-5 h-5 rounded bg-transparent border-0 p-0 cursor-pointer"
                                title="Pilih warna kustom"
                              />
                            </div>
                          </div>

                          {/* Opacity Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 font-mono">
                              <span>Transparansi (Opacity)</span>
                              <span className="text-[#38bdf8]">
                                {Math.round(layer.opacity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={layer.opacity}
                              onChange={(e) =>
                                onUpdateLayerOpacity(
                                  layer.id,
                                  parseFloat(e.target.value),
                                )
                              }
                              className="w-full accent-[#38bdf8] h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Type Specific Customizations */}
                          {/* 1. Point Layer Icon (Simbologi) */}
                          {layer.type === "circle" && (
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                                Bentuk Simbol (Icon)
                              </span>
                              <div className="grid grid-cols-5 gap-1 bg-[#1e293b]/60 p-1 rounded border border-[#334155]/40 text-center">
                                {(
                                  [
                                    "circle",
                                    "square",
                                    "star",
                                    "triangle",
                                    "marker",
                                  ] as const
                                ).map((style) => (
                                  <button
                                    key={style}
                                    onClick={() =>
                                      onUpdateLayerIconStyle(layer.id, style)
                                    }
                                    className={`py-1 rounded text-[9px] font-semibold capitalize transition-all ${
                                      (layer.iconStyle || "marker") === style
                                        ? "bg-[#38bdf8] text-slate-950 shadow-sm font-bold"
                                        : "text-slate-300 hover:bg-[#1e293b] hover:text-white"
                                    }`}
                                  >
                                    {style}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 2. Line/Polygon Border Style */}
                          {(layer.type === "line" || layer.type === "fill") && (
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                                  Gaya Garis / Outline
                                </span>
                                <div className="grid grid-cols-3 gap-1 bg-[#1e293b]/60 p-1 rounded border border-[#334155]/40 text-center">
                                  {(["solid", "dashed", "dotted"] as const).map(
                                    (style) => (
                                      <button
                                        key={style}
                                        onClick={() =>
                                          onUpdateLayerLineStyle(
                                            layer.id,
                                            style,
                                          )
                                        }
                                        className={`py-0.5 rounded text-[9px] font-semibold capitalize transition-all ${
                                          (layer.lineStyle || "solid") === style
                                            ? "bg-[#38bdf8] text-slate-950 shadow-md font-bold"
                                            : "text-slate-300 hover:bg-[#1e293b] hover:text-white"
                                        }`}
                                      >
                                        {style}
                                      </button>
                                    ),
                                  )}
                                </div>
                              </div>

                              {/* Width adjustment for lines */}
                              {layer.type === "line" && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 font-mono">
                                    <span>Ketebalan Garis</span>
                                    <span className="text-[#38bdf8]">
                                      {layer.lineWidth ||
                                        (layer.id === LayerId.SUNGAI ? 4 : 3)}
                                      px
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={
                                      layer.lineWidth ||
                                      (layer.id === LayerId.SUNGAI ? 4 : 3)
                                    }
                                    onChange={(e) =>
                                      onUpdateLayerLineWidth(
                                        layer.id,
                                        parseInt(e.target.value),
                                      )
                                    }
                                    className="w-full accent-[#38bdf8] h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Actions: Open Attributes & Export */}
                          <div className="pt-2 border-t border-[#334155]/40 flex flex-col gap-2">
                            {/* Custom Drawing Button */}
                            {(layer.type as string) !== "wms" && (
                              <button
                                onClick={() => onStartDrawing?.(layer.id)}
                                className={`w-full py-1.5 px-3 border rounded flex items-center justify-center gap-1.5 font-bold text-xs transition-all duration-150 shadow-sm cursor-pointer ${
                                  drawingLayerId === layer.id
                                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/40"
                                    : "bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border-[#10b981]/30"
                                }`}
                              >
                                <PenTool className="w-3.5 h-3.5" />
                                {drawingLayerId === layer.id
                                  ? "Batal Menggambar"
                                  : "Gambar Fitur Baru"}
                              </button>
                            )}

                            {/* Open Attribute Table Button */}
                            <button
                              onClick={() => onOpenAttributeTable(layer.id)}
                              className="w-full py-1.5 px-3 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-200 hover:text-white rounded flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors"
                            >
                              <Table className="w-3.5 h-3.5 text-[#38bdf8]" />
                              Buka Tabel Atribut
                            </button>

                            {/* Export Data buttons group */}
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                                Ekspor Format Spasial
                              </span>
                              <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                                <button
                                  onClick={() =>
                                    onExportLayer(layer.id, "geojson")
                                  }
                                  className="py-1 px-1 bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 rounded transition-colors"
                                  title="Ekspor sebagai GeoJSON"
                                >
                                  GeoJSON
                                </button>
                                <button
                                  onClick={() => onExportLayer(layer.id, "kml")}
                                  className="py-1 px-1 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 rounded transition-colors"
                                  title="Ekspor sebagai KML"
                                >
                                  KML
                                </button>
                                <button
                                  onClick={() => onExportLayer(layer.id, "shp")}
                                  className="py-1 px-1 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 rounded transition-colors"
                                  title="Ekspor sebagai SHP (WKT CSV)"
                                >
                                  SHP/CSV
                                </button>
                              </div>
                            </div>

                            {/* List of features in the layer */}
                            {(layer.type as string) !== "wms" && layer.geojson && (
                              <div className="pt-2 border-t border-[#334155]/40 space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedFeatureListLayerId(
                                      expandedFeatureListLayerId === layer.id
                                        ? null
                                        : layer.id,
                                    )
                                  }
                                  className="w-full py-1 px-2 bg-[#1e293b]/50 hover:bg-[#1e293b] text-slate-300 rounded flex justify-between items-center text-[10px] font-mono border border-[#334155]/30 transition-all cursor-pointer"
                                >
                                  <span>
                                    📁 Daftar Fitur (
                                    {layer.geojson.features?.length || 0})
                                  </span>
                                  <span>
                                    {expandedFeatureListLayerId === layer.id
                                      ? "▲"
                                      : "▼"}
                                  </span>
                                </button>

                                {expandedFeatureListLayerId === layer.id && (
                                  <div className="max-h-48 overflow-y-auto border border-[#334155]/40 rounded-md bg-[#020617]/50 p-1.5 space-y-1 divide-y divide-[#334155]/20">
                                    {layer.geojson.features &&
                                    layer.geojson.features.length > 0 ? (
                                      layer.geojson.features.map(
                                        (feat: any, idx: number) => {
                                          const name =
                                            feat.properties?.nama ||
                                            feat.properties?.name ||
                                            `Fitur #${idx + 1}`;
                                          const geomType =
                                            feat.geometry?.type || "Point";
                                          return (
                                            <div
                                              key={idx}
                                              className="pt-1.5 pb-1 flex items-center justify-between gap-2 text-[10px]"
                                            >
                                              <div className="flex-1 min-w-0">
                                                <div
                                                  className="font-semibold text-slate-200 truncate"
                                                  title={name}
                                                >
                                                  {name}
                                                </div>
                                                <div className="text-[8px] text-slate-500 font-mono uppercase">
                                                  {geomType}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0">
                                                {(() => {
                                                  const coords = getFeatureCenter?.(feat);
                                                  if (!coords) return null;
                                                  return (
                                                    <button
                                                      type="button"
                                                      onClick={() => onZoomToFeature?.(coords)}
                                                      className="p-1 bg-[#38bdf8]/10 hover:bg-[#38bdf8] text-[#38bdf8] hover:text-slate-950 rounded transition-all cursor-pointer"
                                                      title="Zoom ke Fitur"
                                                    >
                                                      <Maximize2 className="w-2.5 h-2.5" />
                                                    </button>
                                                  );
                                                })()}
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    onEditFeature?.(
                                                      layer.id,
                                                      idx,
                                                      feat.geometry,
                                                      feat.properties,
                                                    )
                                                  }
                                                  className="p-1 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 rounded transition-all cursor-pointer"
                                                  title="Edit Geometri & Atribut"
                                                >
                                                  <PenTool className="w-2.5 h-2.5" />
                                                </button>
                                                {confirmDeleteFeature?.layerId === layer.id && confirmDeleteFeature?.featureIndex === idx ? (
                                                  <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded p-0.5 animate-in fade-in duration-150">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        onDeleteFeature?.(layer.id, idx);
                                                        setConfirmDeleteFeature(null);
                                                      }}
                                                      className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-all cursor-pointer animate-in zoom-in-95"
                                                      title="Ya, Hapus Fitur"
                                                    >
                                                      <Check className="w-2.5 h-2.5" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setConfirmDeleteFeature(null)}
                                                      className="p-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-all cursor-pointer"
                                                      title="Batal"
                                                    >
                                                      <X className="w-2.5 h-2.5" />
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteFeature({ layerId: layer.id, featureIndex: idx })}
                                                    className="p-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded transition-all cursor-pointer"
                                                    title="Hapus Fitur"
                                                  >
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        },
                                      )
                                    ) : (
                                      <div className="text-center text-slate-500 py-2 text-[10px] italic">
                                        Belum ada fitur di layer ini
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Uploaded GeoJSON layers */}
              {uploadedGeoJSONsCount > 0 && (
                <div
                  className={`flex items-center justify-between p-2 rounded-md transition-all border border-[#38bdf8]/30 ${
                    isUploadedVisible
                      ? "bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={isUploadedVisible}
                      onChange={onToggleUploadedVisibility}
                      className="rounded border-[#38bdf8]/30 text-[#38bdf8] focus:ring-[#38bdf8] bg-[#0f172a] w-3.5 h-3.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#38bdf8] flex items-center gap-1">
                        <FileJson className="w-3.5 h-3.5 text-[#38bdf8]" />
                        Uploaded GeoJSON
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {uploadedGeoJSONsCount} dataset aktif
                      </span>
                    </div>
                  </label>
                  <button
                    onClick={onClearUploaded}
                    className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#1e293b] rounded transition-colors"
                    title="Hapus layer upload"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ATTRIBUTE / CLICKED FEATURE INFO PANEL */}
        <div className="bg-[#1e293b]/40 rounded-lg border border-[#334155] overflow-hidden">
          <button
            onClick={() => toggleSection("featureInfo")}
            className="w-full flex items-center justify-between p-3 bg-[#1e293b]/80 border-b border-[#334155] hover:bg-[#1e293b] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Tabel Atribut Fitur
              </span>
            </div>
            {expandedSection.featureInfo ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSection.featureInfo && (
            <div className="p-3 bg-[#1e293b]/25">
              {clickedFeature ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-start border-b border-[#334155] pb-2">
                    <div>
                      <span className="text-[9px] font-mono uppercase bg-[#0f172a] text-[#38bdf8] px-1.5 py-0.5 rounded border border-[#334155]">
                        {clickedFeature.layerName}
                      </span>
                      <h4 className="font-bold text-xs text-white mt-2">
                        {editingProperties?.name ||
                          clickedFeature.properties.name ||
                          "Fitur Tanpa Nama"}
                      </h4>
                    </div>
                    <button
                      onClick={onCloseFeatureInfo}
                      className="text-slate-400 hover:text-white text-xs px-1 hover:bg-[#1e293b] rounded font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Attributes Key-Value Editor List */}
                  <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {editingProperties &&
                      Object.entries(editingProperties).map(([key, val]) => {
                        if (key === "color") return null;
                        return (
                          <div
                            key={key}
                            className="flex flex-col gap-1 pb-1.5 border-b border-[#334155]/20"
                          >
                            <div className="flex justify-between items-center">
                              <span
                                className="text-slate-400 font-mono uppercase text-[9px] tracking-wider truncate mr-1"
                                title={key}
                              >
                                {key.replace("_", " ")}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeletePropertyLocal(key)}
                                className="p-0.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Hapus Atribut"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={String(val)}
                              onChange={(e) =>
                                handleUpdatePropertyLocal(key, e.target.value)
                              }
                              className="w-full bg-[#0f172a] border border-[#334155] rounded px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-[#38bdf8] transition-colors"
                            />
                          </div>
                        );
                      })}

                    {/* Inline Form to ADD NEW ATTRIBUTE FIELD */}
                    <div className="bg-[#0f172a]/60 border border-dashed border-[#334155] rounded-lg p-2.5 mt-2 space-y-2">
                      <span className="text-[9px] font-bold text-[#38bdf8] uppercase font-mono block">
                        ➕ Tambah Atribut Baru
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <input
                            type="text"
                            placeholder="Nama Kolom"
                            value={newAttrKey}
                            onChange={(e) => setNewAttrKey(e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#334155] rounded px-2 py-1 text-slate-300 text-[10px] font-mono focus:outline-none focus:border-[#38bdf8]"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Nilai Atribut"
                            value={newAttrVal}
                            onChange={(e) => setNewAttrVal(e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#334155] rounded px-2 py-1 text-slate-300 text-[10px] font-mono focus:outline-none focus:border-[#38bdf8]"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPropertyLocal}
                        disabled={!newAttrKey.trim()}
                        className="w-full py-1 bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 disabled:opacity-50 text-[#38bdf8] text-[10px] font-bold rounded border border-[#38bdf8]/20 hover:border-[#38bdf8]/40 transition-all cursor-pointer"
                      >
                        Tambah ke Daftar
                      </button>
                    </div>
                  </div>

                  {/* Save button for edited attributes */}
                  {clickedFeature.layerId &&
                    clickedFeature.featureIndex !== undefined && (
                      <div className="space-y-1 pt-1.5 border-t border-[#334155]/40">
                        <button
                          onClick={handleSavePropertiesToServer}
                          className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Simpan Perubahan Atribut
                        </button>
                        {attrSuccessMsg && (
                          <p className="text-[10px] font-bold text-emerald-400 text-center animate-bounce mt-1">
                            {attrSuccessMsg}
                          </p>
                        )}
                      </div>
                    )}

                  {/* Clicked coordinates */}
                  <div className="p-2.5 bg-[#0f172a] border border-[#334155] rounded-md flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                        Koordinat Klik
                      </p>
                      <p className="text-[10px] font-mono text-[#38bdf8] mt-0.5 font-semibold">
                        Lon: {clickedFeature.coordinates[0].toFixed(6)}
                      </p>
                      <p className="text-[10px] font-mono text-[#38bdf8] font-semibold">
                        Lat: {clickedFeature.coordinates[1].toFixed(6)}
                      </p>
                    </div>
                    {onZoomToFeature && (
                      <button
                        type="button"
                        onClick={() => onZoomToFeature(clickedFeature.coordinates)}
                        className="py-1.5 px-2.5 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded text-[10px] font-mono transition-colors shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        🔍 Zoom Ke Sini
                      </button>
                    )}
                  </div>

                  {/* Vertex & Attributes Editing Trigger */}
                  {clickedFeature.layerId &&
                    clickedFeature.featureIndex !== undefined &&
                    onEditFeature && (
                      <button
                        onClick={() => {
                          onEditFeature(
                            clickedFeature.layerId as string,
                            clickedFeature.featureIndex as number,
                            (clickedFeature as any).geometry,
                            clickedFeature.properties,
                          );
                        }}
                        className="w-full py-2 px-3 bg-orange-600 hover:bg-orange-500 text-white border border-orange-500/40 rounded-lg flex items-center justify-center gap-1.5 font-bold text-xs transition-all duration-150 shadow-md cursor-pointer animate-pulse"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        Edit Geometri & Atribut (Vertex)
                      </button>
                    )}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#0f172a] flex items-center justify-center border border-[#334155]">
                    <Map className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-[11px] px-2 leading-relaxed">
                    Silakan klik salah satu fitur (Kabupaten, Jalan, Sungai,
                    atau Landmark) di peta untuk melihat properti data.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* GEOPROCESSING & GEOMETRY EDITING PANEL */}
        <div className="bg-[#1e293b]/40 rounded-lg border border-[#334155] overflow-hidden">
          <button
            onClick={() => toggleSection("geoprocessing")}
            className="w-full flex items-center justify-between p-3 bg-[#1e293b]/80 border-b border-[#334155] hover:bg-[#1e293b] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Geoprocessing & Edit Geometri
              </span>
            </div>
            {expandedSection.geoprocessing ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSection.geoprocessing && (
            <div className="p-3 bg-[#1e293b]/25 space-y-3.5">
              {/* Select Layer */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  Pilih Layer Target
                </label>
                <select
                  value={gpSelectedLayerId}
                  onChange={(e) => {
                    setGpSelectedLayerId(e.target.value);
                    setGpMergeSelectedIndices([]);
                    setGpDissolvePropertyName("");
                  }}
                  className="w-full bg-[#0f172a] text-xs text-slate-200 border border-[#334155] rounded-lg px-2.5 py-1.5 focus:border-[#38bdf8] focus:outline-none cursor-pointer"
                >
                  <option value="">-- Pilih Layer --</option>
                  {layers
                    .filter((l) => l.geojson && l.geojson.features && l.geojson.features.length > 0)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.geojson?.features?.length || 0} ftr)
                      </option>
                    ))}
                </select>
              </div>

              {gpSelectedLayerId ? (
                (() => {
                  const targetLayer = layers.find((l) => l.id === gpSelectedLayerId);
                  const features = targetLayer?.geojson?.features || [];

                  // Get attribute properties from first feature for dissolve options
                  const attrKeys = features.length > 0 && features[0].properties
                    ? Object.keys(features[0].properties)
                    : [];

                  return (
                    <div className="space-y-3">
                      {/* Tabs */}
                      <div className="flex bg-[#0f172a] p-0.5 rounded-lg border border-[#334155]">
                        <button
                          type="button"
                          onClick={() => setActiveGpTab("merge")}
                          className={`flex-1 py-1 text-center font-semibold text-[10px] rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            activeGpTab === "merge"
                              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                              : "text-slate-400 hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          <GitMerge className="w-3 h-3" />
                          Gabung
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveGpTab("dissolve")}
                          className={`flex-1 py-1 text-center font-semibold text-[10px] rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            activeGpTab === "dissolve"
                              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                              : "text-slate-400 hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          <Palette className="w-3 h-3" />
                          Dissolve
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveGpTab("split")}
                          className={`flex-1 py-1 text-center font-semibold text-[10px] rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            activeGpTab === "split"
                              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                              : "text-slate-400 hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          <Scissors className="w-3 h-3" />
                          Split
                        </button>
                      </div>

                      {/* Merge Tab Content */}
                      {activeGpTab === "merge" && (
                        <div className="space-y-2.5">
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Gabungkan minimal 2 fitur menjadi 1 entitas geometri (Polygon atau Line).
                          </p>
                          
                          <div className="max-h-44 overflow-y-auto border border-[#334155] rounded-lg bg-[#0f172a] p-1.5 space-y-1">
                            {features.map((f: any, idx: number) => {
                              const isChecked = gpMergeSelectedIndices.includes(idx);
                              const fName = f.properties?.nama || f.properties?.Name || f.properties?.Nama || `Fitur #${idx + 1}`;
                              return (
                                <label
                                  key={idx}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-[#1e293b] transition-all ${
                                    isChecked ? "bg-orange-500/5 text-orange-400 border border-orange-500/10" : "text-slate-300"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setGpMergeSelectedIndices((prev) => prev.filter((i) => i !== idx));
                                      } else {
                                        setGpMergeSelectedIndices((prev) => [...prev, idx]);
                                      }
                                    }}
                                    className="rounded border-[#334155] text-orange-500 focus:ring-orange-500 bg-[#0f172a] w-3.5 h-3.5"
                                  />
                                  <span className="truncate">{fName}</span>
                                </label>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            disabled={gpMergeSelectedIndices.length < 2}
                            onClick={() => {
                              if (onMergeFeatures) {
                                onMergeFeatures(gpSelectedLayerId, gpMergeSelectedIndices);
                                setGpMergeSelectedIndices([]);
                              }
                            }}
                            className={`w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                              gpMergeSelectedIndices.length >= 2
                                ? "bg-orange-600 hover:bg-orange-500 text-white border border-orange-500/30 cursor-pointer"
                                : "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                            }`}
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            Gabungkan ({gpMergeSelectedIndices.length} Fitur)
                          </button>
                        </div>
                      )}

                      {/* Dissolve Tab Content */}
                      {activeGpTab === "dissolve" && (
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Meleburkan batas antar wilayah poligon yang bersebelahan atau memiliki nilai atribut yang sama.
                          </p>

                          <div className="space-y-1.5">
                            <label className="text-[9px] text-slate-400 uppercase tracking-wider font-mono">
                              Kelompokkan Atribut (Opsional)
                            </label>
                            <select
                              value={gpDissolvePropertyName}
                              onChange={(e) => setGpDissolvePropertyName(e.target.value)}
                              className="w-full bg-[#0f172a] text-xs text-slate-200 border border-[#334155] rounded-lg px-2.5 py-1.5 focus:border-[#38bdf8] focus:outline-none cursor-pointer"
                            >
                              <option value="">-- Tanpa Atribut (Leburkan Semua) --</option>
                              {attrKeys.map((key) => (
                                <option key={key} value={key}>
                                  {key}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (onDissolveLayer) {
                                onDissolveLayer(gpSelectedLayerId, gpDissolvePropertyName || undefined);
                                alert(`Layer berhasil di-dissolve!`);
                              }
                            }}
                            className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-xs border border-orange-500/30 transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Palette className="w-3.5 h-3.5" />
                            Jalankan Dissolve
                          </button>
                        </div>
                      )}

                      {/* Split Tab Content */}
                      {activeGpTab === "split" && (
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Potong salah satu poligon/garis di layer target ini dengan membuat garis pemotong baru.
                          </p>

                          <div className="p-3 bg-[#0f172a] rounded-lg border border-[#334155] space-y-2.5">
                            <p className="text-[11px] text-amber-400 leading-relaxed font-semibold">
                              Cara Kerja Pemotongan:
                            </p>
                            <ol className="list-decimal list-inside text-[10px] text-slate-300 space-y-1 pl-0.5">
                              <li>Klik salah satu fitur pada peta yang ingin dipotong.</li>
                              <li>Gunakan panel terapung di peta untuk menggambar garis potong.</li>
                              <li>Klik tombol <span className="text-orange-400 font-bold">"Potong Fitur!"</span> untuk memproses pemotongan geometri.</li>
                            </ol>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (onChangeTool) {
                                onChangeTool("split-geometry");
                              }
                            }}
                            className="w-full py-2 bg-orange-600/15 hover:bg-orange-600/25 text-orange-400 border border-orange-500/20 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                            Buka Tool Potong di Peta
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="py-4 text-center text-slate-400 text-[10px]">
                  Silakan pilih layer target di atas untuk mengakses menu penggabungan, dissolve, dan pemotongan.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer Banner */}
      <div className="p-3 border-t border-[#334155] bg-[#0f172a] text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
        <span>Gunakan tombol kanan mouse untuk rotasi peta 3D</span>
      </div>
    </aside>
  );
}
