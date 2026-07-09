/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BarChart2, X, CheckCircle2 } from "lucide-react";

interface StatsModalProps {
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 bg-[#0f172a]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl p-6 w-full max-w-lg text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center border-b border-[#334155] pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#38bdf8]" />
            <h3 className="font-bold text-base text-slate-100">Analisis Spasial & Statistik Aceh</h3>
          </div>
          <button
            onClick={onClose}
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
            onClick={onClose}
            className="py-2 px-5 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded-lg text-xs transition-colors"
          >
            Tutup Ringkasan
          </button>
        </div>
      </div>
    </div>
  );
};
