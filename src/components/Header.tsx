import { useState, useRef, useEffect } from "react";
import {
  Map,
  FolderOpen,
  Save,
  Trash2,
  RefreshCw,
  Layers,
  MapPin,
  Compass,
  FileUp,
  FolderArchive,
  Ruler,
  Radio,
  FileJson,
  BarChart2,
  Menu,
  ChevronDown,
  HelpCircle,
  Sun,
  Moon,
  Cpu
} from "lucide-react";
import type { BasemapId, GisTool } from "../types";

interface HeaderProps {
  currentBasemap: BasemapId;
  onChangeBasemap: (id: BasemapId) => void;
  activeTool: GisTool;
  onChangeTool: (tool: GisTool) => void;
  onResetView: () => void;
  onClearDrawings: () => void;
  onTriggerFileUpload: () => void;
  onShowStats: () => void;
  totalCustomPoints: number;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Header({
  currentBasemap,
  onChangeBasemap,
  activeTool,
  onChangeTool,
  onResetView,
  onClearDrawings,
  onTriggerFileUpload,
  onShowStats,
  totalCustomPoints,
  isSidebarOpen,
  onToggleSidebar
}: HeaderProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    if (activeDropdown === name) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(name);
    }
  };

  const handleMenuAction = (action: () => void) => {
    action();
    setActiveDropdown(null);
  };

  return (
    <header className="bg-[#1e293b] border-b border-[#334155] text-slate-100 flex items-center justify-between px-5 h-14 shadow-lg relative z-50 select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-2.5">
        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
            isSidebarOpen
              ? "bg-[#38bdf8]/15 border-[#38bdf8]/40 text-[#38bdf8] hover:bg-[#38bdf8]/25"
              : "bg-[#0f172a] border-[#334155] text-[#38bdf8] hover:text-white hover:bg-[#1e293b]"
          }`}
          title={isSidebarOpen ? "Sembunyikan Panel Kontrol" : "Tampilkan Panel Kontrol"}
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        <div className="bg-[#38bdf8]/10 text-[#38bdf8] p-1.5 rounded-lg border border-[#38bdf8]/30 flex items-center justify-center">
          <Map className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-sans font-extrabold tracking-tight text-lg text-white flex items-center gap-1.5">
            <span className="text-[#38bdf8]">PetainAja</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#0f172a] text-[#38bdf8] rounded border border-[#334155]">
              v1.5 PRO
            </span>
          </h1>
          <span className="text-[9px] font-mono text-slate-400 tracking-wider uppercase">
            WEBGIS PORTAL ACEH
          </span>
        </div>
      </div>

      {/* Menu Bar */}
      <div className="hidden md:flex items-center h-full gap-1 font-sans text-sm" ref={dropdownRef}>
        {/* Project Dropdown */}
        <div className="relative h-full flex items-center">
          <button
            onClick={() => toggleDropdown("project")}
            className={`flex items-center gap-1.5 px-4 h-full transition-all text-sm font-medium relative ${
              activeDropdown === "project" ? "text-white" : "text-[#94a3b8] hover:text-white"
            }`}
          >
            <FolderOpen className="w-4 h-4 text-[#38bdf8]" />
            Project
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            {activeDropdown === "project" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "project" && (
            <div className="absolute left-0 top-[56px] w-52 bg-[#0f172a] border border-[#334155] rounded-b-lg shadow-2xl py-1.5 animate-in fade-in duration-100">
              <button
                onClick={() => handleMenuAction(onResetView)}
                className="w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
              >
                <Compass className="w-4 h-4 text-[#38bdf8]" />
                Reset Map Extent (Aceh)
              </button>
              <button
                onClick={() => handleMenuAction(() => alert("Project configurations saved successfully to local state."))}
                className="w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs border-b border-[#334155]/30"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                Save Project
              </button>
              <button
                onClick={() => handleMenuAction(() => alert("Exported Aceh layers: 4 default layers loaded. Coordinates in WGS 84 (EPSG:4326)."))}
                className="w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
              >
                <FileJson className="w-4 h-4 text-[#38bdf8]" />
                Export Project GeoJSON
              </button>
            </div>
          )}
        </div>

        {/* Edit Dropdown */}
        <div className="relative h-full flex items-center">
          <button
            onClick={() => toggleDropdown("edit")}
            className={`flex items-center gap-1.5 px-4 h-full transition-all text-sm font-medium relative ${
              activeDropdown === "edit" ? "text-white" : "text-[#94a3b8] hover:text-white"
            }`}
          >
            <Cpu className="w-4 h-4 text-[#38bdf8]" />
            Edit
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            {activeDropdown === "edit" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "edit" && (
            <div className="absolute left-0 top-[56px] w-52 bg-[#0f172a] border border-[#334155] rounded-b-lg shadow-2xl py-1.5 animate-in fade-in duration-100">
              <button
                onClick={() => handleMenuAction(onClearDrawings)}
                className="w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center gap-2.5 text-red-400 hover:text-red-300 text-xs"
              >
                <Trash2 className="w-4 h-4" />
                Clear Measurements & Pins
              </button>
              <button
                onClick={() => handleMenuAction(() => alert("No layers are editable. Toggle GeoJSON layers visibility in layers manager instead."))}
                className="w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-400 hover:text-slate-300 text-xs"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                Reload WebGIS layers
              </button>
            </div>
          )}
        </div>

        {/* View Dropdown */}
        <div className="relative h-full flex items-center">
          <button
            onClick={() => toggleDropdown("view")}
            className={`flex items-center gap-1.5 px-4 h-full transition-all text-sm font-medium relative ${
              activeDropdown === "view" ? "text-white" : "text-[#94a3b8] hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4 text-[#38bdf8]" />
            View (Basemap)
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            {activeDropdown === "view" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "view" && (
            <div className="absolute left-0 top-[56px] w-60 bg-[#0f172a] border border-[#334155] rounded-b-lg shadow-2xl py-1.5 animate-in fade-in duration-100">
              <div className="px-3.5 py-1 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Pilih Basemap</div>
              <button
                onClick={() => handleMenuAction(() => onChangeBasemap("voyager"))}
                className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                  currentBasemap === "voyager" ? "text-[#38bdf8] font-semibold" : "text-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> CartoDB Voyager (Street)
                </span>
                {currentBasemap === "voyager" && <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>}
              </button>
              <button
                onClick={() => handleMenuAction(() => onChangeBasemap("positron"))}
                className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                  currentBasemap === "positron" ? "text-[#38bdf8] font-semibold" : "text-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-blue-400" /> CartoDB Positron (Light)
                </span>
                {currentBasemap === "positron" && <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>}
              </button>
              <button
                onClick={() => handleMenuAction(() => onChangeBasemap("dark-matter"))}
                className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                  currentBasemap === "dark-matter" ? "text-[#38bdf8] font-semibold" : "text-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-purple-400" /> CartoDB Dark Matter (Dark)
                </span>
                {currentBasemap === "dark-matter" && <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>}
              </button>
            </div>
          )}
        </div>

        {/* Add Data Dropdown */}
        <div className="relative h-full flex items-center">
          <button
            onClick={() => toggleDropdown("add-data")}
            className={`flex items-center gap-1.5 px-4 h-full transition-all text-sm font-medium relative ${
              activeDropdown === "add-data"
                ? "text-white"
                : activeTool === "add-custom-pin"
                ? "text-[#38bdf8] font-semibold"
                : "text-[#94a3b8] hover:text-white"
            }`}
          >
            <MapPin className="w-4 h-4 text-orange-500" />
            Add Data
            {totalCustomPoints > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-600 text-white rounded-full">
                {totalCustomPoints}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            {(activeDropdown === "add-data" || activeTool === "add-custom-pin") && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "add-data" && (
            <div className="absolute left-0 top-[56px] w-64 bg-[#0f172a] border border-[#334155] rounded-b-lg shadow-2xl py-1.5 animate-in fade-in duration-100 divide-y divide-[#334155]/20">
              <div className="py-1">
                <button
                  onClick={() => handleMenuAction(onTriggerFileUpload)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                >
                  <FileUp className="w-4 h-4 text-[#38bdf8]" />
                  <div>
                    <p className="font-medium">Upload File GeoJSON</p>
                    <p className="text-[9px] text-slate-500 font-mono">Format .geojson / .json</p>
                  </div>
                </button>
                <button
                  onClick={() => handleMenuAction(onTriggerFileUpload)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                >
                  <FolderArchive className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-medium">Upload Shapefile (.ZIP)</p>
                    <p className="text-[9px] text-slate-400 font-mono">Wajib ada .shp, .shx, .dbf, .prj</p>
                  </div>
                </button>
              </div>
              <div className="py-1">
              <button
                onClick={() => handleMenuAction(() => onChangeTool(activeTool === "add-custom-pin" ? "none" : "add-custom-pin"))}
                className={`w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-xs ${
                  activeTool === "add-custom-pin" ? "bg-[#38bdf8]/10 text-[#38bdf8] font-medium" : "text-slate-300"
                }`}
              >
                <MapPin className="w-4 h-4 text-orange-400" />
                <div>
                  <p className="font-medium">Klik Peta Tambah Pin</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {activeTool === "add-custom-pin" ? "Status: AKTIF (klik peta)" : "Klik untuk mengaktifkan"}
                  </p>
                </div>
              </button>
              </div>
            </div>
          )}
        </div>

        {/* Processing Dropdown */}
        <div className="relative h-full flex items-center">
          <button
            onClick={() => toggleDropdown("processing")}
            className={`flex items-center gap-1.5 px-4 h-full transition-all text-sm font-medium relative ${
              activeDropdown === "processing"
                ? "text-white"
                : activeTool === "measure-distance" || activeTool === "buffer-generator"
                ? "text-[#38bdf8] font-semibold"
                : "text-[#94a3b8] hover:text-white"
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-500" />
            Processing
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            {(activeDropdown === "processing" || activeTool === "measure-distance" || activeTool === "buffer-generator") && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "processing" && (
            <div className="absolute left-0 top-[56px] w-64 bg-[#0f172a] border border-[#334155] rounded-b-lg shadow-2xl py-1.5 animate-in fade-in duration-100">
              <button
                onClick={() => handleMenuAction(() => onChangeTool(activeTool === "measure-distance" ? "none" : "measure-distance"))}
                className={`w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-xs ${
                  activeTool === "measure-distance" ? "bg-[#38bdf8]/10 text-[#38bdf8] font-medium" : "text-slate-300"
                }`}
              >
                <Ruler className="w-4 h-4 text-yellow-400" />
                <div>
                  <p className="font-medium">Ukur Jarak Spasial</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {activeTool === "measure-distance" ? "Status: AKTIF (klik peta)" : "Ukur jarak linier antar-titik"}
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleMenuAction(() => onChangeTool(activeTool === "buffer-generator" ? "none" : "buffer-generator"))}
                className={`w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-xs ${
                  activeTool === "buffer-generator" ? "bg-[#38bdf8]/10 text-[#38bdf8] font-medium" : "text-slate-300"
                }`}
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="font-medium">Generator Buffer Spasial</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {activeTool === "buffer-generator" ? "Status: AKTIF (pilih titik)" : "Buat area penyangga (buffer) lingkaran"}
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleMenuAction(onShowStats)}
                className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs border-t border-[#334155]/20"
              >
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <div>
                  <p className="font-medium">Statistik Wilayah Aceh</p>
                  <p className="text-[9px] text-slate-500 font-mono">Tampilkan ringkasan spasial Aceh</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Badges & Quick Action Controls (Right side of header) */}
      <div className="flex items-center gap-2">
        {/* Active Tool indicator */}
        {activeTool !== "none" && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-[#38bdf8]/10 text-[#38bdf8] text-xs font-mono rounded-full border border-[#38bdf8]/30">
            <span className="w-2 h-2 bg-[#38bdf8] rounded-full animate-ping"></span>
            Tool Aktif:{" "}
            <span className="font-bold">
              {activeTool === "measure-distance"
                ? "Pengukuran Jarak"
                : activeTool === "buffer-generator"
                ? "Generator Buffer"
                : "Tambah Pin Custom"}
            </span>
            <button
              onClick={() => onChangeTool("none")}
              className="ml-1.5 text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 px-1 py-0.25 rounded font-bold text-[10px]"
              title="Batalkan alat"
            >
              ✕
            </button>
          </div>
        )}

        {/* Database Status indicator */}
        <div className="flex items-center gap-1.5 bg-[#0f172a] px-2.5 py-1 rounded-md border border-[#334155] text-[11px] font-mono">
          <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
          <span className="text-slate-400">EPSG:</span>
          <span className="text-[#38bdf8] font-bold">4326</span>
        </div>

        {/* Help button */}
        <button
          onClick={() =>
            alert(
              "PetainAja WebGIS v1.5 PRO\n\nPanduan Singkat:\n- Toggle visualisasi layer pada sidebar kiri (Kabupaten, Jalan, Sungai, Landmarks).\n- Klik fitur di peta untuk melihat tabel atribut/properti detail.\n- Pilih 'Processing' untuk Mengukur Jarak atau membuat Buffer Spasial di sekeliling Masjid / Landmark.\n- Gunakan 'Add Data' untuk menambahkan Pin kustom di peta secara langsung."
            )
          }
          className="p-1.5 hover:bg-[#1e293b] rounded-md text-slate-400 hover:text-white transition-colors border border-[#334155]"
          title="Bantuan Pengguna"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
