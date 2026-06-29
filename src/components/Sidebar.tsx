import React, { useState, useEffect } from "react";
import {
  Layers,
  MapPin,
  Ruler,
  Info,
  Map,
  Sparkles,
  Search,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sliders,
  Settings2,
  Trash2,
  Maximize2,
  FileJson,
  BarChart4,
  X,
  Table,
  Download,
  Palette,
  Plus,
  PenTool,
  Check
} from "lucide-react";
import { LayerId } from "../types";
import type { GisLayer, ClickedFeatureInfo, CustomPin } from "../types";

interface SidebarProps {
  layers: GisLayer[];
  onToggleLayer: (id: LayerId | string) => void;
  clickedFeature: ClickedFeatureInfo | null;
  onCloseFeatureInfo: () => void;
  customPins: CustomPin[];
  onDeleteCustomPin: (id: string) => void;
  onZoomToPin: (coordinates: [number, number]) => void;
  uploadedGeoJSONsCount: number;
  isUploadedVisible: boolean;
  onToggleUploadedVisibility: () => void;
  onClearUploaded: () => void;
  onClose?: () => void;
  onUpdateLayerColor: (id: LayerId | string, color: string) => void;
  onUpdateLayerOpacity: (id: LayerId | string, opacity: number) => void;
  onUpdateLayerIconStyle: (id: LayerId | string, iconStyle: "circle" | "square" | "star" | "triangle" | "marker") => void;
  onUpdateLayerLineStyle: (id: LayerId | string, lineStyle: "solid" | "dashed" | "dotted") => void;
  onUpdateLayerLineWidth: (id: LayerId | string, lineWidth: number) => void;
  onOpenAttributeTable: (id: LayerId | string) => void;
  onExportLayer: (id: LayerId | string, format: "shp" | "kml" | "geojson") => void;
  onRemoveLayer?: (id: LayerId | string) => void;
  onCreateLayer?: (name: string, type: "fill" | "line" | "circle", color: string) => void;
  drawingLayerId?: string | null;
  onStartDrawing?: (layerId: string) => void;
  onEditFeature?: (layerId: string, featureIndex: number, geometry: any, properties: any) => void;
  onCreateWmsLayer?: (name: string, url: string, layersParam: string) => void;
  onRenameLayer?: (id: string, newName: string) => void;
  onDeleteFeature?: (layerId: string, featureIndex: number) => void;
  onUpdateFeatureProperties?: (layerId: string, featureIndex: number, properties: Record<string, any>) => void;
}

export default function Sidebar({
  layers,
  onToggleLayer,
  clickedFeature,
  onCloseFeatureInfo,
  customPins,
  onDeleteCustomPin,
  onZoomToPin,
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
  onRenameLayer,
  onDeleteFeature,
  onUpdateFeatureProperties
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLayerConfigId, setActiveLayerConfigId] = useState<LayerId | string | null>(null);
  const [expandedFeatureListLayerId, setExpandedFeatureListLayerId] = useState<string | null>(null);
  const [isCreatingLayer, setIsCreatingLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerType, setNewLayerType] = useState<"fill" | "line" | "circle">("circle");
  const [newLayerColor, setNewLayerColor] = useState("#10b981");

  const [createLayerTypeMode, setCreateLayerTypeMode] = useState<"geojson" | "wms">("geojson");
  const [wmsUrl, setWmsUrl] = useState("https://kemendagri.go.id/geoserver/wms");
  const [wmsLayers, setWmsLayers] = useState("0");

  const handleCreateLayerSubmit = () => {
    if (!newLayerName.trim()) return;
    if (createLayerTypeMode === "geojson") {
      onCreateLayer?.(newLayerName.trim(), newLayerType, newLayerColor);
    } else {
      onCreateWmsLayer?.(newLayerName.trim(), wmsUrl.trim(), wmsLayers.trim());
    }
    setNewLayerName("");
    setIsCreatingLayer(false);
  };

  const [expandedSection, setExpandedSection] = useState<Record<string, boolean>>({
    layers: true,
    featureInfo: true,
    pins: true,
    legend: true
  });

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Local state for dynamic attribute editing
  const [editingProperties, setEditingProperties] = useState<Record<string, any> | null>(null);
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
      [key]: value
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
      [formattedKey]: newAttrVal.trim()
    });
    setNewAttrKey("");
    setNewAttrVal("");
  };

  const handleSavePropertiesToServer = () => {
    if (!clickedFeature || !clickedFeature.layerId || clickedFeature.featureIndex === undefined || !editingProperties) return;
    onUpdateFeatureProperties?.(clickedFeature.layerId as string, clickedFeature.featureIndex, editingProperties);
    setAttrSuccessMsg("Atribut berhasil disimpan!");
    setTimeout(() => {
      setAttrSuccessMsg("");
    }, 2000);
  };

  // Filter layers or search inside feature attributes (if applicable)
  const filteredLayers = layers.filter((layer) =>
    layer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 bg-[#0f172a] border-r border-[#334155] flex flex-col h-full text-slate-100 select-none z-40 shadow-lg absolute md:relative left-0 top-0 bottom-0">
      {/* Sidebar Header / Search */}
      <div className="p-4 border-b border-[#334155] bg-[#0f172a] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#38bdf8]" />
            <h2 className="font-sans font-bold text-xs uppercase tracking-wider text-[#94a3b8]">Control Panel</h2>
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
                      <span className="text-[10px] font-bold uppercase text-[#38bdf8] font-mono">Layer Baru</span>
                      <button onClick={() => setIsCreatingLayer(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
                    </div>

                    {/* Selector Mode Tab */}
                    <div className="flex border border-[#334155] rounded p-0.5 bg-[#1e293b]/50">
                      <button
                        type="button"
                        onClick={() => setCreateLayerTypeMode("geojson")}
                        className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
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
                        className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-colors cursor-pointer ${
                          createLayerTypeMode === "wms"
                            ? "bg-[#38bdf8] text-[#0f172a]"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        WMS Raster
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Nama Layer</label>
                        <input
                          type="text"
                          placeholder="Contoh: Titik Evakuasi"
                          value={newLayerName}
                          onChange={(e) => setNewLayerName(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                        />
                      </div>

                      {createLayerTypeMode === "geojson" ? (
                        <>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Tipe Geometri</label>
                            <select
                              value={newLayerType}
                              onChange={(e) => setNewLayerType(e.target.value as 'fill' | 'line' | 'circle')}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs cursor-pointer font-mono"
                            >
                              <option value="circle">Titik (Point)</option>
                              <option value="line">Garis (LineString)</option>
                              <option value="fill">Poligon (Polygon)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Warna Layer</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={newLayerColor}
                                onChange={(e) => setNewLayerColor(e.target.value)}
                                className="w-6 h-6 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                              />
                              <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">{newLayerColor}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">URL WMS Server</label>
                            <input
                              type="text"
                              placeholder="https://geoserver.example.com/geoserver/wms"
                              value={wmsUrl}
                              onChange={(e) => setWmsUrl(e.target.value)}
                              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Layer Name WMS (Parameters)</label>
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

                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={handleCreateLayerSubmit}
                          disabled={!newLayerName.trim() || (createLayerTypeMode === "wms" && (!wmsUrl.trim() || !wmsLayers.trim()))}
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
                <div key={layer.id} className="flex flex-col bg-[#1e293b]/20 rounded-md border border-[#334155]/30 overflow-hidden mb-1">
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
                        <span className="text-xs font-semibold text-slate-200">{layer.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {layer.count} fitur • {layer.description}
                        </span>
                      </div>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {/* Settings toggle button */}
                      <button
                        onClick={() => setActiveLayerConfigId(activeLayerConfigId === layer.id ? null : layer.id)}
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
                      <button
                        onClick={() => {
                          if (confirm(`Apakah Anda yakin ingin menghapus layer "${layer.name}"?`)) {
                            onRemoveLayer?.(layer.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded border border-transparent transition-colors"
                        title="Hapus Layer ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Visual color indicator */}
                      <span
                        onClick={() => setActiveLayerConfigId(activeLayerConfigId === layer.id ? null : layer.id)}
                        className="w-3.5 h-3.5 rounded-full border border-slate-900 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                        style={{
                          backgroundColor: layer.color,
                          borderColor: layer.outlineColor || "transparent"
                        }}
                        title={`Simbologi: ${layer.type} (Klik untuk edit)`}
                      ></span>
                    </div>
                  </div>

                  {/* EXPANDED SETTINGS SECTION */}
                  {activeLayerConfigId === layer.id && (
                    <div className="p-3 bg-[#0f172a] border-t border-[#334155] text-xs space-y-3 animate-in slide-in-from-top-1 duration-150">
                      {/* Rename Layer */}
                      <div className="space-y-1 bg-[#1e293b]/30 p-2 rounded-lg border border-[#334155]/30">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                          ✏️ Edit Nama Layer
                        </span>
                        <input
                          type="text"
                          value={layer.name}
                          onChange={(e) => onRenameLayer?.(layer.id, e.target.value)}
                          className="w-full bg-[#0f172a] border border-[#334155] rounded-md px-2 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-[#38bdf8]"
                        />
                      </div>

                      {/* Color Settings */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono flex items-center gap-1">
                          <Palette className="w-3 h-3 text-[#38bdf8]" /> Warna Layer
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Color Circle Presets */}
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"].map((presetColor) => (
                              <button
                                key={presetColor}
                                onClick={() => onUpdateLayerColor(layer.id, presetColor)}
                                className={`w-4 h-4 rounded-full border transition-transform ${
                                  layer.color === presetColor ? "border-white scale-110" : "border-transparent hover:scale-110"
                                }`}
                                style={{ backgroundColor: presetColor }}
                              />
                            ))}
                          </div>
                          {/* Native Hex Input */}
                          <input
                            type="color"
                            value={layer.color}
                            onChange={(e) => onUpdateLayerColor(layer.id, e.target.value)}
                            className="w-5 h-5 rounded bg-transparent border-0 p-0 cursor-pointer"
                            title="Pilih warna kustom"
                          />
                        </div>
                      </div>

                      {/* Opacity Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 font-mono">
                          <span>Transparansi (Opacity)</span>
                          <span className="text-[#38bdf8]">{Math.round(layer.opacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={layer.opacity}
                          onChange={(e) => onUpdateLayerOpacity(layer.id, parseFloat(e.target.value))}
                          className="w-full accent-[#38bdf8] h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Type Specific Customizations */}
                      {/* 1. Point Layer Icon (Simbologi) */}
                      {layer.type === "circle" && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Bentuk Simbol (Icon)</span>
                          <div className="grid grid-cols-5 gap-1 bg-[#1e293b]/60 p-1 rounded border border-[#334155]/40 text-center">
                            {(["circle", "square", "star", "triangle", "marker"] as const).map((style) => (
                              <button
                                key={style}
                                onClick={() => onUpdateLayerIconStyle(layer.id, style)}
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
                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Gaya Garis / Outline</span>
                            <div className="grid grid-cols-3 gap-1 bg-[#1e293b]/60 p-1 rounded border border-[#334155]/40 text-center">
                              {(["solid", "dashed", "dotted"] as const).map((style) => (
                                <button
                                  key={style}
                                  onClick={() => onUpdateLayerLineStyle(layer.id, style)}
                                  className={`py-0.5 rounded text-[9px] font-semibold capitalize transition-all ${
                                    (layer.lineStyle || "solid") === style
                                      ? "bg-[#38bdf8] text-slate-950 shadow-md font-bold"
                                      : "text-slate-300 hover:bg-[#1e293b] hover:text-white"
                                  }`}
                                >
                                  {style}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Width adjustment for lines */}
                          {layer.type === "line" && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 font-mono">
                                <span>Ketebalan Garis</span>
                                <span className="text-[#38bdf8]">{layer.lineWidth || (layer.id === LayerId.SUNGAI ? 4 : 3)}px</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={layer.lineWidth || (layer.id === LayerId.SUNGAI ? 4 : 3)}
                                onChange={(e) => onUpdateLayerLineWidth(layer.id, parseInt(e.target.value))}
                                className="w-full accent-[#38bdf8] h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions: Open Attributes & Export */}
                      <div className="pt-2 border-t border-[#334155]/40 flex flex-col gap-2">
                        {/* Custom Drawing Button */}
                        {layer.type !== "wms" && (
                          <button
                            onClick={() => onStartDrawing?.(layer.id)}
                            className={`w-full py-1.5 px-3 border rounded flex items-center justify-center gap-1.5 font-bold text-xs transition-all duration-150 shadow-sm cursor-pointer ${
                              drawingLayerId === layer.id
                                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/40"
                                : "bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] border-[#10b981]/30"
                            }`}
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            {drawingLayerId === layer.id ? "Batal Menggambar" : "Gambar Fitur Baru"}
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
                          <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">Ekspor Format Spasial</span>
                          <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                            <button
                              onClick={() => onExportLayer(layer.id, "geojson")}
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
                        {layer.type !== "wms" && layer.geojson && (
                          <div className="pt-2 border-t border-[#334155]/40 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedFeatureListLayerId(expandedFeatureListLayerId === layer.id ? null : layer.id)}
                              className="w-full py-1 px-2 bg-[#1e293b]/50 hover:bg-[#1e293b] text-slate-300 rounded flex justify-between items-center text-[10px] font-mono border border-[#334155]/30 transition-all cursor-pointer"
                            >
                              <span>📁 Daftar Fitur ({layer.geojson.features?.length || 0})</span>
                              <span>{expandedFeatureListLayerId === layer.id ? "▲" : "▼"}</span>
                            </button>

                            {expandedFeatureListLayerId === layer.id && (
                              <div className="max-h-48 overflow-y-auto border border-[#334155]/40 rounded-md bg-[#020617]/50 p-1.5 space-y-1 divide-y divide-[#334155]/20">
                                {layer.geojson.features && layer.geojson.features.length > 0 ? (
                                  layer.geojson.features.map((feat: any, idx: number) => {
                                    const name = feat.properties?.nama || feat.properties?.name || `Fitur #${idx + 1}`;
                                    const geomType = feat.geometry?.type || "Point";
                                    return (
                                      <div key={idx} className="pt-1.5 pb-1 flex items-center justify-between gap-2 text-[10px]">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-slate-200 truncate" title={name}>
                                            {name}
                                          </div>
                                          <div className="text-[8px] text-slate-500 font-mono uppercase">
                                            {geomType}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => onEditFeature?.(layer.id, idx, feat.geometry, feat.properties)}
                                            className="p-1 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 rounded transition-all cursor-pointer"
                                            title="Edit Geometri & Atribut"
                                          >
                                            <PenTool className="w-2.5 h-2.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (confirm(`Apakah Anda yakin ingin menghapus fitur "${name}"?`)) {
                                                onDeleteFeature?.(layer.id, idx);
                                              }
                                            }}
                                            className="p-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded transition-all cursor-pointer"
                                            title="Hapus Fitur"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
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
                        {editingProperties?.name || clickedFeature.properties.name || "Fitur Tanpa Nama"}
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
                    {editingProperties && Object.entries(editingProperties).map(([key, val]) => {
                      if (key === "color") return null;
                      return (
                        <div key={key} className="flex flex-col gap-1 pb-1.5 border-b border-[#334155]/20">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-mono uppercase text-[9px] tracking-wider truncate mr-1" title={key}>
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
                            onChange={(e) => handleUpdatePropertyLocal(key, e.target.value)}
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
                  {clickedFeature.layerId && clickedFeature.featureIndex !== undefined && (
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
                  <div className="p-2.5 bg-[#0f172a] border border-[#334155] rounded-md">
                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Koordinat Klik</p>
                    <p className="text-[10px] font-mono text-[#38bdf8] mt-0.5 font-semibold">
                      Lon: {clickedFeature.coordinates[0].toFixed(6)}
                    </p>
                    <p className="text-[10px] font-mono text-[#38bdf8] font-semibold">
                      Lat: {clickedFeature.coordinates[1].toFixed(6)}
                    </p>
                  </div>

                  {/* Vertex & Attributes Editing Trigger */}
                  {clickedFeature.layerId && clickedFeature.featureIndex !== undefined && onEditFeature && (
                    <button
                      onClick={() => {
                        onEditFeature(
                          clickedFeature.layerId as string,
                          clickedFeature.featureIndex as number,
                          (clickedFeature as any).geometry,
                          clickedFeature.properties
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
                  <p className="text-[11px] px-2 leading-relaxed">Silakan klik salah satu fitur (Kabupaten, Jalan, Sungai, atau Landmark) di peta untuk melihat properti data.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CUSTOM USER PINS */}
        <div className="bg-[#1e293b]/40 rounded-lg border border-[#334155] overflow-hidden">
          <button
            onClick={() => toggleSection("pins")}
            className="w-full flex items-center justify-between p-3 bg-[#1e293b]/80 border-b border-[#334155] hover:bg-[#1e293b] transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Custom Pins (User Data)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {customPins.length > 0 && (
                <span className="text-[10px] font-mono font-bold bg-[#0f172a] text-[#38bdf8] px-1.5 rounded border border-[#334155]">
                  {customPins.length}
                </span>
              )}
              {expandedSection.pins ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {expandedSection.pins && (
            <div className="p-2.5 bg-[#1e293b]/25">
              {customPins.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {customPins.map((pin) => (
                    <div
                      key={pin.id}
                      className="bg-[#0f172a]/50 hover:bg-[#0f172a] border border-[#334155] rounded p-2 flex items-center justify-between text-xs"
                    >
                      <button
                        onClick={() => onZoomToPin(pin.coordinates)}
                        className="text-left flex-1 hover:text-[#38bdf8] transition-colors"
                        title="Klik untuk zoom ke pin ini"
                      >
                        <p className="font-bold text-white text-[11px] truncate">{pin.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono truncate">
                          Lon: {pin.coordinates[0].toFixed(4)} | Lat: {pin.coordinates[1].toFixed(4)}
                        </p>
                      </button>
                      <button
                        onClick={() => onDeleteCustomPin(pin.id)}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#1e293b] rounded transition-colors"
                        title="Hapus pin ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-slate-500 text-[10px] leading-relaxed">
                  Belum ada pin kustom. Gunakan menu <strong className="text-orange-400 font-semibold">Add Data &rarr; Klik Peta Tambah Pin</strong> untuk menaruh penanda kustom secara instan di peta.
                </div>
              )}
            </div>
          )}
        </div>

        {/* VISUAL LEGEND */}
        <div className="bg-[#1e293b]/40 rounded-lg border border-[#334155] overflow-hidden">
          <button
            onClick={() => toggleSection("legend")}
            className="w-full flex items-center justify-between p-3 bg-[#1e293b]/80 border-b border-[#334155] hover:bg-[#1e293b] transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart4 className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Legenda Peta
              </span>
            </div>
            {expandedSection.legend ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSection.legend && (
            <div className="p-3 bg-[#1e293b]/25 space-y-3.5">
              {/* Kabupaten legend */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Wilayah Kecamatan</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-3.5 h-2.5 bg-blue-600/30 border border-blue-500 rounded-sm"></span>
                    <span className="text-slate-300 truncate">Baiturrahman</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-3.5 h-2.5 bg-green-600/30 border border-green-500 rounded-sm"></span>
                    <span className="text-slate-300 truncate">Kuta Alam</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-3.5 h-2.5 bg-orange-600/30 border border-orange-500 rounded-sm"></span>
                    <span className="text-slate-300 truncate">Meuraxa</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-3.5 h-2.5 bg-purple-600/30 border border-purple-500 rounded-sm"></span>
                    <span className="text-slate-300 truncate">Syiah Kuala</span>
                  </div>
                </div>
              </div>

              {/* Infrastructure */}
              <div className="border-t border-[#334155] pt-2 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Infrastruktur & Hidrologi</p>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-0.5 bg-amber-500 block"></span>
                    <span className="text-slate-300">Jalan Protokol / Komersial</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-1 bg-cyan-500 rounded-full block"></span>
                    <span className="text-slate-300">Krueng Aceh / Daroy (Sungai)</span>
                  </div>
                </div>
              </div>

              {/* Points */}
              <div className="border-t border-[#334155] pt-2 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Titik Penting (Landmarks)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white"></span>
                    <span className="text-slate-300">Ibadah / Sejarah</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white"></span>
                    <span className="text-slate-300">Monumen</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block border border-white"></span>
                    <span className="text-slate-300">Transportasi</span>
                  </div>
                  {customPins.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block border border-white animate-pulse"></span>
                      <span className="text-slate-300 font-semibold text-red-400">Pin Kustom</span>
                    </div>
                  )}
                </div>
              </div>
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
