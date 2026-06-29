import { Compass, Cpu, CheckCircle2, Layers } from "lucide-react";
import type { BasemapId } from "../types";

interface FooterProps {
  lon: number;
  lat: number;
  zoom: number;
  activeBasemap: BasemapId;
  totalFeatures: number;
  isMapLoaded: boolean;
}

export default function Footer({
  lon,
  lat,
  zoom,
  activeBasemap,
  totalFeatures,
  isMapLoaded
}: FooterProps) {
  return (
    <footer className="bg-[#0f172a] border-t border-[#334155] text-slate-400 text-xs px-5 py-1.5 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner select-none relative z-40 h-auto sm:h-9">
      {/* Coordinates Display (Required: Lon:95.123456 | Lat:5.123456) */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
        <Compass className="w-3.5 h-3.5 text-[#38bdf8] animate-spin-slow" />
        <span className="text-slate-500 mr-1">Pointer:</span>
        <span className="bg-[#1e293b] border border-[#334155] rounded px-1.5 py-0.5 font-semibold text-[#38bdf8]">
          Lon:{lon.toFixed(6)}
        </span>
        <span className="text-slate-700">|</span>
        <span className="bg-[#1e293b] border border-[#334155] rounded px-1.5 py-0.5 font-semibold text-[#38bdf8]">
          Lat:{lat.toFixed(6)}
        </span>
      </div>

      {/* Map Stats & Indicators */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-[10px]">
        {/* Active basemap */}
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-[#38bdf8]" />
          <span className="text-slate-500">Basemap:</span>
          <span className="text-slate-300 capitalize">{activeBasemap.replace("-", " ")}</span>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <span className="text-slate-500 font-sans">Zoom:</span>
          <span className="bg-[#1e293b] px-1.5 py-0.5 rounded text-white font-bold border border-[#334155]">
            {zoom.toFixed(1)}
          </span>
        </div>

        {/* Features Count */}
        <div className="hidden md:flex items-center gap-1">
          <span className="text-slate-500">Total Features:</span>
          <span className="text-slate-300 font-semibold">{totalFeatures}</span>
        </div>

        {/* System Status */}
        <div className="flex items-center gap-1.5 border-l border-[#334155] pl-3 sm:pl-4">
          {isMapLoaded ? (
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] uppercase font-sans font-semibold">Maplibre Engine Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-400 animate-pulse">
              <Cpu className="w-3.5 h-3.5 text-yellow-500 animate-spin" />
              <span className="text-[10px] uppercase font-sans">Memuat Peta...</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
