/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Map, 
  X, 
  UploadCloud, 
  Compass, 
  Table, 
  Layers, 
  Check, 
  Globe, 
  Sparkles,
  Info
} from "lucide-react";

interface WelcomeModalProps {
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem("petainaja_welcome_dismissed", "true");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
      <div className="bg-[#0f172a] border border-[#334155] rounded-2xl shadow-2xl w-full max-w-2xl text-slate-100 flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Decorative Top Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"></div>

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className="bg-[#38bdf8]/15 text-[#38bdf8] p-2 rounded-xl border border-[#38bdf8]/30 flex items-center justify-center">
              <Map className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-black text-xl text-white tracking-tight">
                  Selamat Datang di <span className="text-[#38bdf8]">PetainAja</span>
                </h2>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold uppercase tracking-wider">
                  v1.2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">Sistem Informasi Geospasial & WebGIS Profesional</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-2 hover:bg-[#1e293b] rounded-xl transition-all cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* App Info Box */}
          <div className="bg-[#1e293b]/40 border border-[#334155]/60 rounded-xl p-4 flex gap-4">
            <div className="p-2 bg-[#38bdf8]/10 text-[#38bdf8] rounded-lg self-start">
              <Info className="w-5 h-5 shrink-0" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-200">Tentang Aplikasi</h4>
              <p className="text-xs leading-relaxed text-slate-300">
                <strong className="text-white">PetainAja</strong> adalah platform WebGIS (Web Geographic Information System) mutakhir yang dirancang untuk membantu Anda memvisualisasikan, memanipulasi, menganalisis, dan mengekspor data spasial secara interaktif langsung dari peramban Anda. Aplikasi ini mendukung berbagai standar data geospasial modern dengan rendering peta berkinerja tinggi.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-300 tracking-wider uppercase font-mono text-[10px]">Fitur Unggulan</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Feature 1 */}
              <div className="p-4 bg-[#1e293b]/20 border border-[#334155]/30 rounded-xl hover:border-[#38bdf8]/40 hover:bg-[#1e293b]/35 transition-all group flex gap-3.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover:scale-110 transition-transform self-start">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-white">Multi-Format Import & Export</h4>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Unggah file <strong className="text-slate-300">GeoJSON</strong>, <strong className="text-slate-300">Shapefile (.ZIP)</strong>, <strong className="text-slate-300">KML</strong>, atau <strong className="text-slate-300">CSV</strong> koordinat titik. Ekspor kembali hasil analisis Anda ke format spasial standar.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-4 bg-[#1e293b]/20 border border-[#334155]/30 rounded-xl hover:border-[#38bdf8]/40 hover:bg-[#1e293b]/35 transition-all group flex gap-3.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform self-start">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-white">Pemrosesan & Analisis Spasial</h4>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Lakukan pengukuran jarak akurat, hasilkan area penyangga (<strong className="text-slate-300">Buffer Radius</strong>), gabungkan fitur (<strong className="text-slate-300">Merge</strong>), potong geometri (<strong className="text-slate-300">Split</strong>), atau lakukan <strong className="text-slate-300">Dissolve</strong>.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-4 bg-[#1e293b]/20 border border-[#334155]/30 rounded-xl hover:border-[#38bdf8]/40 hover:bg-[#1e293b]/35 transition-all group flex gap-3.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg group-hover:scale-110 transition-transform self-start">
                  <Table className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-white">Tabel Atribut & Skema Dinamis</h4>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Buka tabel database spasial kustom. Cari, saring, edit nilai atribut per baris, serta tambahkan atau hapus kolom secara dinamis dengan sinkronisasi langsung ke peta.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="p-4 bg-[#1e293b]/20 border border-[#334155]/30 rounded-xl hover:border-[#38bdf8]/40 hover:bg-[#1e293b]/35 transition-all group flex gap-3.5">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg group-hover:scale-110 transition-transform self-start">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-white">Layer Designer & Classification</h4>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Ubah warna, transparansi, ketebalan, dan ikon layer. Gunakan fitur klasifikasi warna otomatis berdasarkan nilai kolom statistik (klasifikasi kategori).
                  </p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="p-4 bg-[#1e293b]/20 border border-[#334155]/30 rounded-xl hover:border-[#38bdf8]/40 hover:bg-[#1e293b]/35 transition-all group flex gap-3.5 md:col-span-2">
                <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg group-hover:scale-110 transition-transform self-start">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-white">Integrasi Layanan Peta Modern (WMS, VT, & PMTiles)</h4>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Sambungkan dengan server eksternal seperti <strong className="text-slate-300">WMS Server</strong> (Web Map Service), rendisi <strong className="text-slate-300">Vector Tiles (.mvt/.pbf)</strong> secara cepat, atau muat basis data cloud <strong className="text-slate-300">PMTiles</strong> yang hemat bandwidth.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Quick tips */}
          <div className="p-4 bg-[#10b981]/5 border border-[#10b981]/20 text-slate-300 rounded-xl space-y-1">
            <h5 className="font-bold text-xs text-[#10b981] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#10b981]" />
              Tips Cepat Penggunaan
            </h5>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Gunakan panel sebelah kiri untuk mengaktifkan atau menonaktifkan layer peta. Klik ikon <strong className="text-slate-300">Help / Bantuan (?)</strong> di kanan atas header jika Anda membutuhkan panduan format data atau navigasi tools peta.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-[#1e293b]/20 px-6 py-4 border-t border-[#1e293b] flex flex-col sm:flex-row justify-between items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-400 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded bg-[#1e293b] border-[#334155] text-[#38bdf8] focus:ring-[#38bdf8]/30 w-4 h-4 cursor-pointer"
            />
            <span>Jangan tampilkan lagi ketika dibuka berikutnya</span>
          </label>
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-[#38bdf8]/10 hover:shadow-[#38bdf8]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Mulai Menjelajah
            <Check className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
