/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Trash2, Check, PenTool, MapPin, Maximize2, Plus } from "lucide-react";
import type { ClickedFeatureInfo } from "../types";

interface FeatureInfoModalProps {
  clickedFeature: ClickedFeatureInfo;
  onClose: () => void;
  onUpdateFeatureProperties?: (layerId: string, featureIndex: number, properties: Record<string, any>) => void;
  onZoomToFeature?: (coords: [number, number]) => void;
  onEditFeature?: (layerId: string, featureIndex: number, geometry: any, properties: any) => void;
  onDeleteFeature?: (layerId: string, featureIndex: number) => void;
}

export const FeatureInfoModal: React.FC<FeatureInfoModalProps> = ({
  clickedFeature,
  onClose,
  onUpdateFeatureProperties,
  onZoomToFeature,
  onEditFeature,
  onDeleteFeature
}) => {
  const [editingProperties, setEditingProperties] = useState<Record<string, any> | null>(null);
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");
  const [attrSuccessMsg, setAttrSuccessMsg] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

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
    ) {
      return;
    }
    onUpdateFeatureProperties?.(
      clickedFeature.layerId,
      clickedFeature.featureIndex,
      editingProperties
    );
    setAttrSuccessMsg("Atribut berhasil disimpan!");
    setTimeout(() => {
      setAttrSuccessMsg("");
    }, 3000);
  };

  const handleDeleteFeatureClick = () => {
    if (
      !clickedFeature ||
      !clickedFeature.layerId ||
      clickedFeature.featureIndex === undefined
    ) {
      return;
    }
    setIsConfirmingDelete(true);
  };

  const handleConfirmDeleteActual = () => {
    if (
      !clickedFeature ||
      !clickedFeature.layerId ||
      clickedFeature.featureIndex === undefined
    ) {
      return;
    }
    onDeleteFeature?.(clickedFeature.layerId, clickedFeature.featureIndex);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div 
        id="feature-info-modal-card"
        className="bg-[#0f172a] border border-[#334155] rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 w-full max-w-md text-slate-100 flex flex-col gap-4 max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-200"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-[#334155] pb-3">
          <div className="flex-1 min-w-0 pr-2">
            <span className="text-[10px] font-mono uppercase bg-slate-800 text-[#38bdf8] px-2 py-0.5 rounded border border-[#334155] inline-block font-semibold">
              {clickedFeature.layerName || clickedFeature.layerId}
            </span>
            <h4 className="font-bold text-sm text-white mt-2 truncate">
              {editingProperties?.name || clickedFeature.properties.name || clickedFeature.properties.nama || clickedFeature.properties.Nama || "Fitur Tanpa Nama"}
            </h4>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar text-xs">
          
          {/* Attributes Key-Value list */}
          <div className="space-y-3">
            <h5 className="font-semibold text-slate-300 border-b border-slate-800 pb-1 flex justify-between items-center">
              <span>Atribut Data</span>
              <span className="text-[10px] font-mono text-slate-500">
                {editingProperties ? Object.keys(editingProperties).filter(k => k !== "color").length : 0} Atribut
              </span>
            </h5>
            
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
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
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={String(val)}
                        onChange={(e) =>
                          handleUpdatePropertyLocal(key, e.target.value)
                        }
                        className="w-full bg-[#0f172a] border border-[#334155] rounded px-2 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-[#38bdf8] transition-colors"
                      />
                    </div>
                  );
                })}

              {(!editingProperties || Object.keys(editingProperties).filter(k => k !== "color").length === 0) && (
                <p className="text-slate-500 italic text-center py-4">Tidak ada atribut data.</p>
              )}
            </div>

            {/* Inline Form to ADD NEW ATTRIBUTE FIELD */}
            <div className="bg-[#1e293b]/40 border border-dashed border-[#334155] rounded-lg p-3 space-y-2.5">
              <span className="text-[9px] font-bold text-[#38bdf8] uppercase font-mono block">
                ➕ Tambah Atribut Baru
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    placeholder="Nama Kolom"
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value)}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded px-2.5 py-1.5 text-slate-300 text-[11px] font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Nilai Atribut"
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded px-2.5 py-1.5 text-slate-300 text-[11px] font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddPropertyLocal}
                disabled={!newAttrKey.trim()}
                className="w-full py-1.5 bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 disabled:opacity-50 text-[#38bdf8] text-[10px] font-bold rounded border border-[#38bdf8]/20 hover:border-[#38bdf8]/40 transition-all cursor-pointer"
              >
                Tambah Atribut
              </button>
            </div>
          </div>

          {/* Action to Save Property Changes */}
          {clickedFeature.layerId && clickedFeature.featureIndex !== undefined && (
            <div className="space-y-1.5">
              <button
                onClick={handleSavePropertiesToServer}
                className="w-full py-2 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Simpan Perubahan Atribut
              </button>
              {attrSuccessMsg && (
                <p className="text-[11px] font-bold text-emerald-400 text-center animate-bounce">
                  {attrSuccessMsg}
                </p>
              )}
            </div>
          )}

          {/* Clicked Coordinates Block */}
          <div className="p-3 bg-slate-900 border border-[#334155] rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                  Koordinat Klik
                </p>
                <p className="text-[10px] font-mono text-slate-300 mt-0.5">
                  Lon: {clickedFeature.coordinates[0].toFixed(6)}
                </p>
                <p className="text-[10px] font-mono text-slate-300">
                  Lat: {clickedFeature.coordinates[1].toFixed(6)}
                </p>
              </div>
            </div>
            {onZoomToFeature && (
              <button
                type="button"
                onClick={() => onZoomToFeature(clickedFeature.coordinates)}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-[10px] font-mono transition-colors shadow-sm flex items-center gap-1 cursor-pointer shrink-0 border border-[#334155]"
              >
                <Maximize2 className="w-3 h-3" /> Zoom
              </button>
            )}
          </div>

        </div>

        {/* Modal Footer / Action Triggers */}
        <div className="border-t border-[#334155]/60 pt-3 flex flex-col gap-2">
          {clickedFeature.layerId && clickedFeature.featureIndex !== undefined && onEditFeature && (
            <button
              onClick={() => {
                onEditFeature(
                  clickedFeature.layerId as string,
                  clickedFeature.featureIndex as number,
                  (clickedFeature as any).geometry,
                  clickedFeature.properties
                );
                onClose(); // Auto-close modal so editing HUD shows unobstructed on screen
              }}
              className="w-full py-2 px-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              <PenTool className="w-4 h-4" />
              Edit Geometri & Atribut (Vertex)
            </button>
          )}

          {clickedFeature.layerId && clickedFeature.featureIndex !== undefined && onDeleteFeature && (
            isConfirmingDelete ? (
              <div className="flex gap-2 w-full animate-in fade-in duration-200">
                <button
                  onClick={handleConfirmDeleteActual}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-bold text-xs transition-colors cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  Ya, Hapus Fitur
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#334155] rounded-lg flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={handleDeleteFeatureClick}
                className="w-full py-2 px-3 bg-red-950/40 hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/20 rounded-lg flex items-center justify-center gap-1.5 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Hapus Fitur Ini
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
