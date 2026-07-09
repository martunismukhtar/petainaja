/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Table, X, Search, Trash2, Download, Maximize2 } from "lucide-react";
import type { GisLayer } from "../types";

interface ColumnConfig {
  key: string;
  label: string;
}

interface AttributeTableModalProps {
  layerId: string;
  layers: GisLayer[];
  onClose: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  newColInputName: string;
  onNewColInputNameChange: (name: string) => void;
  onAddColumn: (layerId: string, colName: string) => void;
  onDeleteColumn: (layerId: string, colKey: string) => void;
  onExportLayer: (id: string, format: "shp" | "kml" | "geojson") => void;
  onUpdateAttribute: (layerId: string, featureIndex: number, key: string, value: any) => void;
  onDeleteFeature: (layerId: string, featureIndex: number) => void;
  onZoomToFeature: (props: Record<string, any>, coordinates: [number, number]) => void;
  attributeData: {
    name: string;
    features: any[];
    cols: ColumnConfig[];
  };
  getFeatureCenter: (feature: any) => [number, number] | null;
}

export const AttributeTableModal: React.FC<AttributeTableModalProps> = ({
  layerId,
  layers,
  onClose,
  searchQuery,
  onSearchQueryChange,
  newColInputName,
  onNewColInputNameChange,
  onAddColumn,
  onDeleteColumn,
  onExportLayer,
  onUpdateAttribute,
  onDeleteFeature,
  onZoomToFeature,
  attributeData,
  getFeatureCenter
}) => {
  const { name: activeLayerName, features: activeFeatures, cols: activeCols } = attributeData;

  const filteredFeatures = activeFeatures.filter((feature: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return Object.values(feature.properties || {}).some((val) =>
      String(val).toLowerCase().includes(query)
    );
  });

  const isCustomLayer = layers.some((l) => l.id === layerId && l.isUploaded);

  return (
    <div className="absolute inset-0 bg-[#0f172a]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl p-5 w-full max-w-5xl text-slate-100 flex flex-col gap-3.5 animate-in zoom-in-95 duration-200 h-[80vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#334155] pb-2.5">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-[#38bdf8]" />
            <div>
              <h3 className="font-bold text-sm text-slate-100">Tabel Atribut Spasial</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Layer: {activeLayerName} • {activeFeatures.length} total fitur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search, Export & New Column Form bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#1e293b]/40 p-2.5 rounded-lg border border-[#334155]/40 text-xs">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
              <Search className="w-3.5 h-3.5 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Cari data atribut..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full bg-[#0f172a] text-slate-200 pl-8 pr-3 py-1.5 rounded border border-[#334155] text-xs focus:outline-none focus:border-[#38bdf8] transition-colors placeholder:text-slate-500 font-mono"
            />
          </div>

          {/* Add New Column Form if it's a custom/editable layer */}
          {isCustomLayer && (
            <div className="flex items-center gap-1.5 bg-[#0f172a] p-1 rounded-md border border-[#334155] max-w-sm">
              <input
                type="text"
                placeholder="Tambah kolom kustom..."
                value={newColInputName}
                onChange={(e) => onNewColInputNameChange(e.target.value)}
                className="bg-transparent text-slate-200 px-2.5 py-1 text-xs focus:outline-none placeholder:text-slate-600 font-mono w-32"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = newColInputName.trim();
                    if (val) {
                      onAddColumn(layerId, val);
                      onNewColInputNameChange("");
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const val = newColInputName.trim();
                  if (val) {
                    onAddColumn(layerId, val);
                    onNewColInputNameChange("");
                  }
                }}
                className="py-1 px-2.5 bg-[#10b981] hover:bg-emerald-600 text-slate-950 font-bold rounded text-[10px] font-mono transition-colors cursor-pointer"
              >
                + Tambah Kolom
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold text-slate-400">
              Menampilkan: <strong className="text-[#38bdf8]">{filteredFeatures.length}</strong> dari {activeFeatures.length} baris
            </span>
            <div className="h-4 w-px bg-[#334155]"></div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onExportLayer(layerId, "geojson")}
                className="py-1 px-2.5 bg-[#10b981]/10 hover:bg-[#10b981]/25 text-[#10b981] border border-[#10b981]/30 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> GeoJSON
              </button>
              <button
                onClick={() => onExportLayer(layerId, "kml")}
                className="py-1 px-2.5 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/25 text-[#f59e0b] border border-[#f59e0b]/30 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" /> KML
              </button>
              <button
                onClick={() => onExportLayer(layerId, "shp")}
                className="py-1 px-2.5 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/25 text-[#38bdf8] border border-[#38bdf8]/30 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer"
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
                  <th className="py-2.5 px-3 w-12 text-center">No</th>
                  {activeCols.map((col) => (
                    <th key={col.key} className="py-2.5 px-3 min-w-[120px]">
                      <div className="flex items-center justify-between gap-1 group">
                        <span className="font-bold">{col.label}</span>
                        {isCustomLayer && col.key !== "nama" && col.key !== "keterangan" && (
                          <button
                            onClick={() => onDeleteColumn(layerId, col.key)}
                            className="text-slate-400 hover:text-red-400 p-0.5 hover:bg-[#1e293b] rounded transition-all cursor-pointer"
                            title={`Hapus kolom: ${col.label}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-center w-44 font-bold">Aksi Operasional</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeatures.map((feature: any, idx: number) => {
                  const props = feature.properties || {};
                  return (
                    <tr key={idx} className="border-b border-[#334155]/40 hover:bg-[#1e293b]/40 even:bg-[#1e293b]/15 transition-all">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-400 text-center">{idx + 1}</td>
                      {activeCols.map((col) => (
                        <td key={col.key} className="py-1 px-3 text-slate-200">
                          {isCustomLayer ? (
                            <input
                              type="text"
                              value={props[col.key] !== undefined ? String(props[col.key]) : ""}
                              onChange={(e) => onUpdateAttribute(layerId, idx, col.key, e.target.value)}
                              className="w-full bg-transparent border border-transparent hover:border-[#334155]/70 focus:border-[#38bdf8] focus:bg-[#0f172a] px-2 py-0.5 rounded text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-700 font-mono"
                              placeholder="..."
                            />
                          ) : (
                            <span className="font-mono">{props[col.key] !== undefined ? String(props[col.key]) : "-"}</span>
                          )}
                        </td>
                      ))}
                      <td className="py-1.5 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {(() => {
                            const coords = getFeatureCenter(feature);
                            if (!coords) return <span className="text-slate-500 font-mono text-[10px]">No Geo</span>;
                            return (
                              <button
                                onClick={() => onZoomToFeature(props, coords)}
                                className="py-1 px-2.5 bg-[#38bdf8]/10 hover:bg-[#38bdf8] hover:text-slate-950 text-[#38bdf8] font-bold rounded text-[10px] font-mono transition-all inline-flex items-center gap-1 shadow-sm border border-[#38bdf8]/20 cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3" /> Zoom
                              </button>
                            );
                          })()}
                          
                          {isCustomLayer && (
                            <button
                              onClick={() => onDeleteFeature(layerId, idx)}
                              className="py-1 px-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold rounded text-[10px] font-mono transition-all inline-flex items-center gap-1 border border-red-500/20 cursor-pointer"
                              title="Hapus fitur"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                          )}
                        </div>
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
            onClick={onClose}
            className="py-1.5 px-4 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded text-xs transition-colors cursor-pointer"
          >
            Tutup Tabel Atribut
          </button>
        </div>

      </div>
    </div>
  );
};
