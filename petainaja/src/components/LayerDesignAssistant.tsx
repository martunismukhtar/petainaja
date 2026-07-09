/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  X, 
  Paintbrush, 
  Brush, 
  Trash2, 
  Download, 
  Table, 
  Sparkles, 
  HelpCircle,
  CheckCircle,
  Eye,
  EyeOff
} from "lucide-react";
import type { GisLayer } from "../types";

interface LayerDesignAssistantProps {
  layerId: string;
  layers: GisLayer[];
  onClose: () => void;
  onUpdateLayerColor: (id: string, color: string) => void;
  onUpdateColorClassification?: (
    id: string,
    classification: { enabled: boolean; columnName?: string; rules: Record<string, string> } | undefined
  ) => void;
  onUpdateLayerOpacity: (id: string, opacity: number) => void;
  onUpdateLayerIconStyle?: (id: string, iconStyle: "circle" | "square" | "star" | "triangle" | "marker") => void;
  onUpdateLayerLineStyle?: (id: string, lineStyle: "solid" | "dashed" | "dotted") => void;
  onUpdateLayerLineWidth?: (id: string, lineWidth: number) => void;
  onStartDrawing: (layerId: string) => void;
  onOpenAttributeTable: (id: string) => void;
  onRemoveLayer: (id: string) => void;
  onExportLayer: (id: string, format: "shp" | "kml" | "geojson") => void;
  onToggleLayer: (id: string) => void;
}

const PRESET_COLORS = [
  "#38bdf8", // Sky Blue
  "#10b981", // Emerald Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#a855f7"  // Violet
];

export const LayerDesignAssistant: React.FC<LayerDesignAssistantProps> = ({
  layerId,
  layers,
  onClose,
  onUpdateLayerColor,
  onUpdateColorClassification,
  onUpdateLayerOpacity,
  onUpdateLayerLineWidth,
  onStartDrawing,
  onOpenAttributeTable,
  onRemoveLayer,
  onExportLayer,
  onToggleLayer
}) => {
  const layer = layers.find((l) => l.id === layerId);
  const [activeTab, setActiveTab] = useState<"style" | "draw" | "data">("style");

  if (!layer) return null;

  const hasFeatures = !!(layer?.geojson?.features && layer.geojson.features.length > 0);

  // Auto-switch tab on mobile if drawing is completed (has features)
  useEffect(() => {
    if (hasFeatures && window.innerWidth < 768 && (activeTab === "style" || activeTab === "draw")) {
      setActiveTab("data");
    }
  }, [hasFeatures, activeTab]);

  // Simple, non-GIS translated names
  const readableType = 
    layer.type === "circle" ? "Titik (Lokasi)" :
    layer.type === "line" ? "Garis (Rute/Jalan)" :
    layer.type === "fill" ? "Area (Wilayah)" : "Layer Peta";

  const isWms = layer.type === "wms";

  const getAllAttributeColumns = (): string[] => {
    if (!layer || !layer.geojson || !layer.geojson.features) return ["keterangan"];
    const colsSet = new Set<string>();
    layer.geojson.features.forEach((f: any) => {
      if (f.properties) {
        Object.keys(f.properties).forEach((k) => colsSet.add(k));
      }
    });
    if (layer.customColumns) {
      layer.customColumns.forEach((c) => colsSet.add(c));
    }
    const cols = Array.from(colsSet).filter(c => c !== "id" && c !== "_id");
    if (cols.length === 0) {
      cols.push("keterangan");
    }
    return cols.sort();
  };

  const getUniqueClassificationValues = (columnName: string): string[] => {
    if (!layer || !layer.geojson || !layer.geojson.features) return [];
    const values = new Set<string>();
    layer.geojson.features.forEach((f: any) => {
      const val = f.properties?.[columnName];
      if (val !== undefined && val !== null) {
        values.add(String(val).trim());
      }
    });
    return Array.from(values).filter(v => v.length > 0).sort();
  };

  return (
    <div className="fixed inset-0 md:bg-[#0f172a]/80 md:backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-4 z-50 pointer-events-none md:pointer-events-auto">
      <div className="pointer-events-auto bg-[#0f172a] border-2 border-[#334155] hover:border-[#38bdf8]/50 rounded-xl shadow-2xl p-4 md:p-5 w-full max-w-sm md:max-w-md max-h-[85vh] md:max-h-[90vh] text-slate-100 flex flex-col gap-3 md:gap-4 animate-in slide-in-from-bottom-5 md:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#334155] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#38bdf8]/10 text-[#38bdf8] p-2 rounded-lg border border-[#38bdf8]/20">
              <Sparkles className="w-5 h-5 text-[#38bdf8] animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider font-mono">
                Pusat Pengaturan Layer Baru
              </span>
              <h3 className="font-bold text-base text-slate-100 mt-0.5">{layer.name}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Jenis Tampilan: <strong className="text-slate-200">{readableType}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border border-[#334155] rounded-lg p-0.5 bg-[#1e293b]/50 text-xs shrink-0">
          <button
            onClick={() => setActiveTab("style")}
            className={`${
              hasFeatures ? "hidden md:flex" : "flex"
            } flex-1 py-2 text-center font-bold rounded-md transition-colors items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "style"
                ? "bg-[#38bdf8] text-[#0f172a]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" /> Gaya Visual
          </button>
          {!isWms && (
            <button
              onClick={() => setActiveTab("draw")}
              className={`${
                hasFeatures ? "hidden md:flex" : "flex"
              } flex-1 py-2 text-center font-bold rounded-md transition-colors items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "draw"
                  ? "bg-[#38bdf8] text-[#0f172a]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Brush className="w-3.5 h-3.5" /> Gambar Peta
            </button>
          )}
          <button
            onClick={() => setActiveTab("data")}
            className={`flex-1 py-2 text-center font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "data"
                ? "bg-[#38bdf8] text-[#0f172a]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Atribut & Data
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar space-y-4">

          {/* Tab Content 1: STYLING */}
          {activeTab === "style" && (
            <div className="space-y-4 py-1 animate-in fade-in duration-150">
              {isWms ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-bounce" />
                  <p>Layer WMS dilayani langsung oleh server eksternal.</p>
                  <p className="text-[10px] text-slate-500 mt-1">Gaya peta dikendalikan oleh penyedia WMS.</p>
                </div>
              ) : (
                <>
                  {/* 1. Preset colors */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-mono font-bold text-slate-400 block uppercase tracking-wider">
                      🎨 Pilih Warna Tampilan
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => onUpdateLayerColor(layer.id, color)}
                          className={`h-8 w-full rounded-lg border transition-transform relative cursor-pointer hover:scale-105 active:scale-95 ${
                            layer.color === color 
                              ? "border-white ring-2 ring-[#38bdf8]/40 scale-105" 
                              : "border-slate-800"
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {layer.color === color && (
                            <span className="absolute inset-0 flex items-center justify-center text-white font-bold drop-shadow-sm text-[10px]">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Custom color picker */}
                    <div className="flex items-center gap-2 mt-2 bg-[#1e293b]/40 p-2 rounded-lg border border-[#334155]/40">
                      <input
                        type="color"
                        value={layer.color}
                        onChange={(e) => onUpdateLayerColor(layer.id, e.target.value)}
                        className="w-8 h-8 bg-transparent border-0 cursor-pointer p-0 rounded-md"
                      />
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono">Atau pilih warna kustom:</span>
                        <p className="text-xs font-mono font-bold uppercase text-[#38bdf8]">{layer.color}</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Opacity/Transparency slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="text-slate-400 uppercase font-bold tracking-wider">
                        🌓 Tingkat Transparansi
                      </span>
                      <span className="text-[#38bdf8] font-bold bg-[#1e293b] px-2 py-0.5 rounded border border-[#334155]/60 text-[10px]">
                        {Math.round(layer.opacity * 100)}% Kejelasan
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={layer.opacity}
                      onChange={(e) => onUpdateLayerOpacity(layer.id, parseFloat(e.target.value))}
                      className="w-full h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                    />
                    <p className="text-[9px] text-slate-500 font-sans italic mt-1">
                      Atur agar objek di bawahnya atau peta jalan dasar (basemap) tetap terlihat jelas.
                    </p>
                  </div>

                  {/* 3. Width/Size customization */}
                  {layer.type === "circle" && onUpdateLayerLineWidth && (
                    <div className="space-y-1.5 bg-[#1e293b]/20 p-2.5 rounded-lg border border-[#334155]/30">
                      <div className="flex justify-between items-center text-[11px] font-mono">
                        <span className="text-slate-400 uppercase font-bold tracking-wider">
                          📍 Ukuran Simbol Titik
                        </span>
                        <span className="text-amber-400 font-bold font-mono text-[10px]">
                          {layer.lineWidth || 6} piksel
                        </span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="20"
                        step="1"
                        value={layer.lineWidth || 6}
                        onChange={(e) => onUpdateLayerLineWidth(layer.id, parseInt(e.target.value))}
                        className="w-full h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                      />
                    </div>
                  )}

                  {layer.type === "line" && onUpdateLayerLineWidth && (
                    <div className="space-y-1.5 bg-[#1e293b]/20 p-2.5 rounded-lg border border-[#334155]/30">
                      <div className="flex justify-between items-center text-[11px] font-mono">
                        <span className="text-slate-400 uppercase font-bold tracking-wider">
                          〰️ Ketebalan Garis Rute
                        </span>
                        <span className="text-amber-400 font-bold font-mono text-[10px]">
                          {layer.lineWidth || 3} piksel
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={layer.lineWidth || 3}
                        onChange={(e) => onUpdateLayerLineWidth(layer.id, parseInt(e.target.value))}
                        className="w-full h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                      />
                    </div>
                  )}

                  {/* 4. Color Classification based on attribute column */}
                  {onUpdateColorClassification && (
                    <div className="space-y-3 pt-3 border-t border-[#334155]/60">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-mono font-bold text-slate-400 block uppercase tracking-wider">
                          🏷️ Klasifikasi Warna (Atribut)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const isEnabled = !layer.colorClassification?.enabled;
                            const selectedCol = layer.colorClassification?.columnName || "keterangan";
                            const currentRules = layer.colorClassification?.rules || {};
                            
                            let newRules = { ...currentRules };
                            if (isEnabled && Object.keys(newRules).length === 0) {
                              const uniqueVals = getUniqueClassificationValues(selectedCol);
                              uniqueVals.forEach((val, i) => {
                                newRules[val] = PRESET_COLORS[i % PRESET_COLORS.length];
                              });
                            }
                            
                            onUpdateColorClassification(layer.id, {
                              enabled: isEnabled,
                              columnName: selectedCol,
                              rules: newRules
                            });
                          }}
                          className={`text-[10px] font-bold font-mono px-2 py-1 rounded transition-all cursor-pointer ${
                            layer.colorClassification?.enabled
                              ? "bg-[#10b981] text-slate-950 hover:bg-emerald-500"
                              : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-[#334155]"
                          }`}
                        >
                          {layer.colorClassification?.enabled ? "● Aktif" : "○ Nonaktif"}
                        </button>
                      </div>

                      {layer.colorClassification?.enabled && (
                        <div className="bg-[#1e293b]/50 p-2.5 rounded-lg border border-[#334155] space-y-2.5 animate-in fade-in duration-150">
                          {/* Select Attribute Column Dropdown */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 block font-mono">
                              PILIH KOLOM ATRIBUT:
                            </label>
                            <select
                              value={layer.colorClassification?.columnName || "keterangan"}
                              onChange={(e) => {
                                const newColName = e.target.value;
                                const uniqueVals = getUniqueClassificationValues(newColName);
                                const newRules: Record<string, string> = {};
                                uniqueVals.forEach((val, i) => {
                                  newRules[val] = PRESET_COLORS[i % PRESET_COLORS.length];
                                });
                                onUpdateColorClassification(layer.id, {
                                  enabled: true,
                                  columnName: newColName,
                                  rules: newRules
                                });
                              }}
                              className="w-full bg-[#0f172a] text-xs text-slate-200 rounded border border-[#334155] p-1.5 focus:outline-none focus:border-[#38bdf8] font-mono"
                            >
                              {getAllAttributeColumns().map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex justify-between items-center text-[10px] pt-1">
                            <span className="text-slate-400">Atur warna per nilai unik:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const selectedCol = layer.colorClassification?.columnName || "keterangan";
                                const uniqueVals = getUniqueClassificationValues(selectedCol);
                                const newRules: Record<string, string> = {};
                                uniqueVals.forEach((val, i) => {
                                  newRules[val] = PRESET_COLORS[i % PRESET_COLORS.length];
                                });
                                onUpdateColorClassification(layer.id, {
                                  enabled: true,
                                  columnName: selectedCol,
                                  rules: newRules
                                });
                              }}
                              className="text-[#38bdf8] hover:underline font-mono text-[9px]"
                            >
                              🎲 Acak Warna
                            </button>
                          </div>

                          {getUniqueClassificationValues(layer.colorClassification?.columnName || "keterangan").length === 0 ? (
                            <div className="text-[10px] text-amber-400 italic bg-[#0f172a] p-2 rounded border border-[#334155]/50 text-center">
                              ⚠️ Belum ada fitur yang memiliki data pada kolom "{layer.colorClassification?.columnName || "keterangan"}". Silakan tambahkan atau ubah data di tabel atribut terlebih dahulu.
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                              {getUniqueClassificationValues(layer.colorClassification?.columnName || "keterangan").map((val) => {
                                const currentColor = layer.colorClassification?.rules?.[val] || layer.color;
                                return (
                                  <div key={val} className="flex items-center justify-between gap-2 bg-[#0f172a] p-1.5 rounded border border-[#334155]/40">
                                    <span className="text-[10px] font-mono text-slate-300 truncate max-w-[180px]" title={val}>
                                      {val}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <input
                                        type="color"
                                        value={currentColor}
                                        onChange={(e) => {
                                          const updatedRules = {
                                            ...(layer.colorClassification?.rules || {}),
                                            [val]: e.target.value
                                          };
                                          onUpdateColorClassification(layer.id, {
                                            enabled: true,
                                            columnName: layer.colorClassification?.columnName || "keterangan",
                                            rules: updatedRules
                                          });
                                        }}
                                        className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0"
                                      />
                                      <span className="text-[9px] font-mono text-slate-400 uppercase">{currentColor}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <p className="text-[9px] text-slate-400 leading-normal">
                            * Warna ini akan diaplikasikan otomatis pada objek di peta berdasarkan nilai kolom <strong>{layer.colorClassification?.columnName || "keterangan"}</strong>.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab Content 2: DRAWING FEATURES */}
          {activeTab === "draw" && (
            <div className="space-y-3.5 py-1 animate-in fade-in duration-150">
              <div className="bg-[#1e293b]/50 p-3 rounded-lg border border-[#334155] text-xs space-y-2">
                <span className="font-bold text-[#38bdf8] flex items-center gap-1">
                  💡 Cara Menggambar Objek Baru:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-300 font-sans leading-relaxed text-[11px]">
                  <li>Klik tombol <strong>"Mulai Menggambar"</strong> di bawah.</li>
                  <li>Silakan klik pada area peta mana saja secara berurutan.</li>
                  <li>Tarik garis atau buat area poligon tertutup sesuai keinginan.</li>
                  <li>Klik <strong>"Simpan Objek"</strong> pada tombol melayang yang muncul setelah selesai.</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  onStartDrawing(layer.id);
                  onClose(); // auto close modal to draw
                }}
                className="w-full py-2.5 px-4 bg-[#10b981] hover:bg-emerald-600 text-slate-950 font-bold font-mono rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer scale-100 hover:scale-[1.02] active:scale-95"
              >
                <Brush className="w-4 h-4 text-slate-950" /> Mulai Menggambar di Peta Sekarang
              </button>
            </div>
          )}

          {/* Tab Content 3: ATTRIBUTES & EXPORT */}
          {activeTab === "data" && (
            <div className="space-y-3.5 py-1 animate-in fade-in duration-150">
              {/* Show Attribute table button */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono font-bold text-slate-400 block uppercase tracking-wider">
                  📊 Manajemen Data Atribut
                </span>
                <p className="text-[10px] text-slate-400">
                  Setiap objek di peta memiliki baris data deskripsi yang dapat Anda isi atau edit (seperti Nama, Keterangan, dll).
                </p>
                <button
                  onClick={() => {
                    onOpenAttributeTable(layer.id);
                    onClose();
                  }}
                  className="w-full py-2 px-3 bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Table className="w-4 h-4 text-[#38bdf8]" /> Buka Tabel Atribut Spasial
                </button>
              </div>

              {/* Mobile Only: Color Classification by Attribute (since Style tab is hidden on mobile once drawing has features) */}
              {onUpdateColorClassification && (
                <>
                  <div className="md:hidden h-px bg-[#334155]/60 my-2"></div>
                  <div className="md:hidden space-y-3 bg-[#1e293b]/20 p-2.5 rounded-lg border border-[#334155]/30">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-mono font-bold text-slate-400 block uppercase tracking-wider">
                        🏷️ Klasifikasi Warna (Atribut)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const isEnabled = !layer.colorClassification?.enabled;
                          const selectedCol = layer.colorClassification?.columnName || "keterangan";
                          const currentRules = layer.colorClassification?.rules || {};
                          
                          let newRules = { ...currentRules };
                          if (isEnabled && Object.keys(newRules).length === 0) {
                            const uniqueVals = getUniqueClassificationValues(selectedCol);
                            uniqueVals.forEach((val, i) => {
                              newRules[val] = PRESET_COLORS[i % PRESET_COLORS.length];
                            });
                          }
                          
                          onUpdateColorClassification(layer.id, {
                            enabled: isEnabled,
                            columnName: selectedCol,
                            rules: newRules
                          });
                        }}
                        className={`text-[10px] font-bold font-mono px-2 py-1 rounded transition-all cursor-pointer ${
                          layer.colorClassification?.enabled
                            ? "bg-[#10b981] text-slate-950 hover:bg-emerald-500"
                            : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-[#334155]"
                        }`}
                      >
                        {layer.colorClassification?.enabled ? "● Aktif" : "○ Nonaktif"}
                      </button>
                    </div>

                    {layer.colorClassification?.enabled && (
                      <div className="bg-[#0f172a] p-2.5 rounded-lg border border-[#334155] space-y-2.5 animate-in fade-in duration-150">
                        {/* Select Attribute Column Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 block font-mono">
                            PILIH KOLOM ATRIBUT:
                          </label>
                          <select
                            value={layer.colorClassification?.columnName || "keterangan"}
                            onChange={(e) => {
                              const newColName = e.target.value;
                              const uniqueVals = getUniqueClassificationValues(newColName);
                              const newRules: Record<string, string> = {};
                              uniqueVals.forEach((val, i) => {
                                newRules[val] = PRESET_COLORS[i % PRESET_COLORS.length];
                              });
                              onUpdateColorClassification(layer.id, {
                                enabled: true,
                                columnName: newColName,
                                rules: newRules
                              });
                            }}
                            className="w-full bg-[#1e293b] text-xs text-slate-200 rounded border border-[#334155] p-1.5 focus:outline-none focus:border-[#38bdf8] font-mono"
                          >
                            {getAllAttributeColumns().map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex justify-between items-center text-[10px] pt-1">
                          <span className="text-slate-400">Atur warna per nilai unik:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const selectedCol = layer.colorClassification?.columnName || "keterangan";
                              const uniqueVals = getUniqueClassificationValues(selectedCol);
                              const newRules: Record<string, string> = {};
                              uniqueVals.forEach((val, i) => {
                                newRules[val] = PRESET_COLORS[i % PRESET_COLORS.length];
                              });
                              onUpdateColorClassification(layer.id, {
                                enabled: true,
                                columnName: selectedCol,
                                rules: newRules
                              });
                            }}
                            className="text-[#38bdf8] hover:underline font-mono text-[9px]"
                          >
                            🎲 Acak Warna
                          </button>
                        </div>

                        {getUniqueClassificationValues(layer.colorClassification?.columnName || "keterangan").length === 0 ? (
                          <div className="text-[10px] text-amber-400 italic bg-[#0f172a] p-2 rounded border border-[#334155]/50 text-center">
                            ⚠️ Belum ada data unik untuk kolom ini.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                            {getUniqueClassificationValues(layer.colorClassification?.columnName || "keterangan").map((val) => {
                              const currentColor = layer.colorClassification?.rules?.[val] || layer.color;
                              return (
                                <div key={val} className="flex items-center justify-between gap-2 bg-[#1e293b]/40 p-1.5 rounded border border-[#334155]/40">
                                  <span className="text-[10px] font-mono text-slate-300 truncate max-w-[150px]" title={val}>
                                    {val}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <input
                                      type="color"
                                      value={currentColor}
                                      onChange={(e) => {
                                        const updatedRules = {
                                          ...(layer.colorClassification?.rules || {}),
                                          [val]: e.target.value
                                        };
                                        onUpdateColorClassification(layer.id, {
                                          enabled: true,
                                          columnName: layer.colorClassification?.columnName || "keterangan",
                                          rules: updatedRules
                                        });
                                      }}
                                      className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0"
                                    />
                                    <span className="text-[9px] font-mono text-slate-400 uppercase">{currentColor}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="h-px bg-[#334155]/60 my-2"></div>

              {/* Export data */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono font-bold text-slate-400 block uppercase tracking-wider">
                  💾 Ekspor Layer (Unduh Data)
                </span>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <button
                    onClick={() => onExportLayer(layer.id, "geojson")}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors cursor-pointer text-center font-mono font-bold flex items-center justify-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" /> GeoJSON (.json)
                  </button>
                  <button
                    onClick={() => onExportLayer(layer.id, "kml")}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors cursor-pointer text-center font-mono font-bold flex items-center justify-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" /> Google Earth (.kml)
                  </button>
                </div>
              </div>

              <div className="h-px bg-[#334155]/60 my-2"></div>

              {/* Operations */}
              <div className="flex items-center justify-between gap-3 text-xs pt-1.5">
                <button
                  onClick={() => {
                    onToggleLayer(layer.id);
                  }}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
                >
                  {layer.visible ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Sembunyikan Layer
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-400" /> Tampilkan Layer
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (confirm(`Apakah Anda yakin ingin menghapus layer "${layer.name}"? Semua data di dalamnya akan hilang.`)) {
                      onRemoveLayer(layer.id);
                      onClose();
                    }
                  }}
                  className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded border border-red-500/20 transition-colors flex items-center gap-1.5 cursor-pointer text-[11px]"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Layer
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer info/dismiss */}
        <div className="flex justify-end items-center pt-2.5 border-t border-[#334155]/50 mt-1">
          <button
            onClick={onClose}
            className="py-1.5 px-5 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Simpan & Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
