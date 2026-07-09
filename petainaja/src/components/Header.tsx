import { useState, useRef, useEffect } from "react";
import {
  Map,
  Trash2,
  RefreshCw,
  Layers,
  Compass,
  FileUp,
  FolderArchive,
  Ruler,
  Radio,
  BarChart2,
  Menu,
  ChevronDown,
  HelpCircle,
  Sun,
  Moon,
  Cpu,
  Plus,
  X,
  BookOpen,
  Info,
  Table,
  Globe,
  FileText,
} from "lucide-react";
import type { BasemapId, GisTool } from "../types";

interface HeaderProps {
  currentBasemap: BasemapId;
  onChangeBasemap: (id: BasemapId) => void;
  activeTool: GisTool;
  onChangeTool: (tool: GisTool) => void;
  // onResetView: () => void;
  onClearDrawings: () => void;
  onTriggerFileUpload: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCreateLayer?: (name: string, type: "fill" | "line" | "circle", color: string) => void;
  onCreateWmsLayer?: (name: string, url: string, layersParam: string) => void;
  onCreateVectorTileLayer?: (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => void;
  onCreatePmtilesLayer?: (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => void;
}

export default function Header({
  currentBasemap,
  onChangeBasemap,
  activeTool,
  onChangeTool,
  // onResetView,
  onClearDrawings,
  onTriggerFileUpload,
  isSidebarOpen,
  onToggleSidebar,
  onCreateLayer,
  onCreateWmsLayer,
  onCreateVectorTileLayer,
  onCreatePmtilesLayer,
}: HeaderProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showCsvInfo, setShowCsvInfo] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local state for mobile layer creation form
  const [mLayerName, setMLayerName] = useState("");
  const [mLayerTypeMode, setMLayerTypeMode] = useState<"geojson" | "wms" | "vector-tile" | "pmbtiles">("geojson");
  const [mLayerType, setMLayerType] = useState<"circle" | "line" | "fill">("circle");
  const [mLayerColor, setMLayerColor] = useState("#38bdf8");
  const [mWmsUrl, setMWmsUrl] = useState("https://kemendagri.go.id/geoserver/wms");
  const [mWmsLayers, setmWmsLayers] = useState("0");

  // Mobile VT
  const [mVtUrl, setMVtUrl] = useState("");
  const [mVtLayers, setMVtLayers] = useState("");
  const [mVtGeomType, setMVtGeomType] = useState<"fill" | "line" | "circle">("line");
  const [mVtColor, setMVtColor] = useState("#f43f5e");

  // Mobile PMTiles
  const [mPmTilesUrl, setMPmTilesUrl] = useState("");
  const [mPmTilesLayers, setMPmTilesLayers] = useState("");
  const [mPmTilesGeomType, setMPmTilesGeomType] = useState<"fill" | "line" | "circle">("line");
  const [mPmTilesColor, setMPmTilesColor] = useState("#a855f7");

  const handleMobileCreateLayerSubmit = () => {
    if (!mLayerName.trim()) return;
    if (mLayerTypeMode === "geojson") {
      onCreateLayer?.(mLayerName.trim(), mLayerType, mLayerColor);
    } else if (mLayerTypeMode === "wms") {
      onCreateWmsLayer?.(mLayerName.trim(), mWmsUrl.trim(), mWmsLayers.trim());
    } else if (mLayerTypeMode === "vector-tile") {
      onCreateVectorTileLayer?.(mLayerName.trim(), mVtUrl.trim(), mVtLayers.trim(), mVtGeomType, mVtColor);
    } else if (mLayerTypeMode === "pmbtiles") {
      onCreatePmtilesLayer?.(mLayerName.trim(), mPmTilesUrl.trim(), mPmTilesLayers.trim(), mPmTilesGeomType, mPmTilesColor);
    }
    setMLayerName("");
    setActiveDropdown(null);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
    <div ref={dropdownRef} className="flex flex-col relative z-50">
      <header className="bg-[#1e293b] border-b border-[#334155] text-slate-100 flex items-center justify-between px-4 sm:px-5 h-14 shadow-lg relative z-50 select-none">
        {/* Brand & Title */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Sidebar Toggle Button */}
          <button
            onClick={onToggleSidebar}
            className={`hidden md:flex p-1.5 rounded-lg border transition-all items-center justify-center ${
              isSidebarOpen
                ? "bg-[#38bdf8]/15 border-[#38bdf8]/40 text-[#38bdf8] hover:bg-[#38bdf8]/25"
                : "bg-[#0f172a] border-[#334155] text-[#38bdf8] hover:text-white hover:bg-[#1e293b]"
            }`}
            title={
              isSidebarOpen
                ? "Sembunyikan Panel Kontrol"
                : "Tampilkan Panel Kontrol"
            }
          >
            <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          <div className="bg-[#38bdf8]/10 text-[#38bdf8] p-1.5 rounded-lg border border-[#38bdf8]/30 flex items-center justify-center">
            <Map className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-sans font-extrabold tracking-tight text-base sm:text-lg text-white flex items-center gap-1.5">
              <span className="text-[#38bdf8]">PetainAja</span>
            </h1>
          </div>
        </div>

        {/* Menu Bar (Desktop Only) */}
        <div className="hidden md:flex items-center h-full gap-1 font-sans text-sm">
          {/* Edit Dropdown */}
          <div className="relative h-full flex items-center">
            <button
              onClick={() => toggleDropdown("edit")}
              className={`flex items-center gap-1.5 px-4 h-full transition-all text-sm font-medium relative ${
                activeDropdown === "edit"
                  ? "text-white"
                  : "text-[#94a3b8] hover:text-white"
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
                  onClick={() =>
                    handleMenuAction(() =>
                      alert(
                        "No layers are editable. Toggle GeoJSON layers visibility in layers manager instead.",
                      ),
                    )
                  }
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
                activeDropdown === "view"
                  ? "text-white"
                  : "text-[#94a3b8] hover:text-white"
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
                <div className="px-3.5 py-1 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Pilih Basemap
                </div>
                <button
                  onClick={() =>
                    handleMenuAction(() => onChangeBasemap("voyager"))
                  }
                  className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                    currentBasemap === "voyager"
                      ? "text-[#38bdf8] font-semibold"
                      : "text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> CartoDB Voyager
                    (Street)
                  </span>
                  {currentBasemap === "voyager" && (
                    <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
                  )}
                </button>
                <button
                  onClick={() =>
                    handleMenuAction(() => onChangeBasemap("positron"))
                  }
                  className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                    currentBasemap === "positron"
                      ? "text-[#38bdf8] font-semibold"
                      : "text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-blue-400" /> CartoDB
                    Positron (Light)
                  </span>
                  {currentBasemap === "positron" && (
                    <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
                  )}
                </button>
                <button
                  onClick={() =>
                    handleMenuAction(() => onChangeBasemap("dark-matter"))
                  }
                  className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                    currentBasemap === "dark-matter"
                      ? "text-[#38bdf8] font-semibold"
                      : "text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5 text-purple-400" /> CartoDB Dark
                    Matter (Dark)
                  </span>
                  {currentBasemap === "dark-matter" && (
                    <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
                  )}
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
              <FileUp className="w-4 h-4 text-[#38bdf8]" />
              Add Data
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              {(activeDropdown === "add-data" ||
                activeTool === "add-custom-pin") && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
              )}
            </button>
            {activeDropdown === "add-data" && (
              <div className="absolute left-0 top-[56px] w-72 bg-[#0f172a] border border-[#334155] rounded-b-lg shadow-2xl py-1.5 animate-in fade-in duration-100 divide-y divide-[#334155]/20">
                <div className="py-1">
                  <button
                    onClick={() => handleMenuAction(onTriggerFileUpload)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                  >
                    <FileUp className="w-4 h-4 text-[#38bdf8]" />
                    <div>
                      <p className="font-medium">Upload File GeoJSON</p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Format .geojson / .json
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleMenuAction(onTriggerFileUpload)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                  >
                    <FolderArchive className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="font-medium">Upload Shapefile (.ZIP)</p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        Wajib ada .shp, .shx, .dbf, .prj
                      </p>
                    </div>
                  </button>
                  
                  {/* CSV Upload option */}
                  <div className="w-full flex items-center justify-between pr-3 hover:bg-[#1e293b] text-slate-300 hover:text-white">
                    <button
                      onClick={() => handleMenuAction(onTriggerFileUpload)}
                      className="flex-1 text-left px-4 py-2.5 flex items-center gap-2.5 text-xs"
                    >
                      <Table className="w-4 h-4 text-amber-400" />
                      <div>
                        <p className="font-medium">Upload File CSV (.CSV)</p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          Format tabel titik koordinat
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCsvInfo(true);
                        setActiveDropdown(null);
                      }}
                      className="p-1.5 text-[#38bdf8] hover:bg-[#38bdf8]/15 hover:text-white rounded-md transition-all cursor-pointer"
                      title="Info Kolom Wajib CSV"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* KML Upload option */}
                  <button
                    onClick={() => handleMenuAction(onTriggerFileUpload)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                  >
                    <Globe className="w-4 h-4 text-pink-400" />
                    <div>
                      <p className="font-medium">Upload File KML (.KML)</p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        Format Google Earth KML
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
                  : activeTool === "measure-distance" ||
                      activeTool === "buffer-generator"
                    ? "text-[#38bdf8] font-semibold"
                    : "text-[#94a3b8] hover:text-white"
              }`}
            >
              <Compass className="w-4 h-4 text-[#38bdf8]" />
              Processing
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              {(activeDropdown === "processing" ||
                activeTool === "measure-distance" ||
                activeTool === "buffer-generator") && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
              )}
            </button>
            {activeDropdown === "processing" && (
              <div className="absolute left-0 top-[56px] w-64 bg-[#0f172a] border border-[#334155] rounded-b-lg shadow-2xl py-1.5 animate-in fade-in duration-100">
                <button
                  onClick={() =>
                    handleMenuAction(() =>
                      onChangeTool(
                        activeTool === "measure-distance"
                          ? "none"
                          : "measure-distance",
                      ),
                    )
                  }
                  className={`w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-xs ${
                    activeTool === "measure-distance"
                      ? "bg-[#38bdf8]/10 text-[#38bdf8] font-medium"
                      : "text-slate-300"
                  }`}
                >
                  <Ruler className="w-4 h-4 text-yellow-400" />
                  <div>
                    <p className="font-medium">Ukur Jarak Spasial</p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      {activeTool === "measure-distance"
                        ? "Status: AKTIF (klik peta)"
                        : "Ukur jarak linier antar-titik"}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleMenuAction(() =>
                      onChangeTool(
                        activeTool === "buffer-generator"
                          ? "none"
                          : "buffer-generator",
                      ),
                    )
                  }
                  className={`w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-xs ${
                    activeTool === "buffer-generator"
                      ? "bg-[#38bdf8]/10 text-[#38bdf8] font-medium"
                      : "text-slate-300"
                  }`}
                >
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-medium">Generator Buffer Spasial</p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      {activeTool === "buffer-generator"
                        ? "Status: AKTIF (pilih titik)"
                        : "Buat area penyangga (buffer) lingkaran"}
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Badges & Quick Action Controls (Right side of header) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
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
          <div className="hidden sm:flex items-center gap-1.5 bg-[#0f172a] px-2.5 py-1 rounded-md border border-[#334155] text-[11px] font-mono">
            <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
            <span className="text-slate-400">EPSG:</span>
            <span className="text-[#38bdf8] font-bold">4326</span>
          </div>

          {/* Help button */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-1.5 hover:bg-[#1e293b] rounded-md text-slate-400 hover:text-white transition-colors border border-[#334155]"
            title="Bantuan Pengguna"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Sub-Toolbar (Mobile Only, renders menus below the header as clean icons) */}
      <div className="md:hidden bg-[#151f32] border-b border-[#334155] text-slate-100 flex items-center justify-around h-11 shadow-md relative z-40 select-none font-sans">
        {/* Mobile Layer Manager Toggle */}
        <div className="relative flex flex-col items-center justify-center h-full">
          <button
            onClick={onToggleSidebar}
            className={`flex flex-col items-center justify-center px-3 h-full transition-all text-[10px] font-medium relative ${
              isSidebarOpen
                ? "text-white font-bold"
                : "text-[#94a3b8] hover:text-white"
            }`}
            title="Kelola Layer"
          >
            <Layers className="w-4 h-4 text-[#38bdf8]" />
            <span className="text-[9px] mt-0.5 font-semibold">Layers</span>
            {isSidebarOpen && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
        </div>

        {/* Mobile Edit Dropdown */}
        <div className="relative flex flex-col items-center justify-center h-full">
          <button
            onClick={() => toggleDropdown("edit")}
            className={`flex flex-col items-center justify-center px-3 h-full transition-all text-[10px] font-medium relative ${
              activeDropdown === "edit"
                ? "text-white"
                : "text-[#94a3b8] hover:text-white"
            }`}
            title="Edit"
          >
            <Cpu className="w-4 h-4 text-[#38bdf8]" />
            <span className="text-[9px] mt-0.5">Edit</span>
            {activeDropdown === "edit" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "edit" && (
            <div className="absolute left-1 top-[40px] w-52 bg-[#0f172a] border border-[#334155] rounded-lg shadow-2xl py-1.5 animate-in fade-in duration-100 z-50">
              <button
                onClick={() => handleMenuAction(onClearDrawings)}
                className="w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center gap-2.5 text-red-400 hover:text-red-300 text-xs"
              >
                <Trash2 className="w-4 h-4" />
                Clear Measurements & Pins
              </button>
              <button
                onClick={() =>
                  handleMenuAction(() =>
                    alert(
                      "No layers are editable. Toggle GeoJSON layers visibility in layers manager instead.",
                    ),
                  )
                }
                className="w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-400 hover:text-slate-300 text-xs"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                Reload WebGIS layers
              </button>
            </div>
          )}
        </div>

        {/* Mobile Basemap Dropdown */}
        <div className="relative flex flex-col items-center justify-center h-full">
          <button
            onClick={() => toggleDropdown("view")}
            className={`flex flex-col items-center justify-center px-3 h-full transition-all text-[10px] font-medium relative ${
              activeDropdown === "view"
                ? "text-white"
                : "text-[#94a3b8] hover:text-white"
            }`}
            title="Basemap"
          >
            <Layers className="w-4 h-4 text-[#38bdf8]" />
            <span className="text-[9px] mt-0.5">Basemap</span>
            {activeDropdown === "view" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "view" && (
            <div className="absolute left-1/2 -translate-x-1/2 top-[40px] w-60 bg-[#0f172a] border border-[#334155] rounded-lg shadow-2xl py-1.5 animate-in fade-in duration-100 z-50">
              <div className="px-3.5 py-1 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Pilih Basemap
              </div>
              <button
                onClick={() =>
                  handleMenuAction(() => onChangeBasemap("voyager"))
                }
                className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                  currentBasemap === "voyager"
                    ? "text-[#38bdf8] font-semibold"
                    : "text-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> CartoDB Voyager
                </span>
                {currentBasemap === "voyager" && (
                  <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
                )}
              </button>
              <button
                onClick={() =>
                  handleMenuAction(() => onChangeBasemap("positron"))
                }
                className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                  currentBasemap === "positron"
                    ? "text-[#38bdf8] font-semibold"
                    : "text-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-blue-400" /> CartoDB Positron
                </span>
                {currentBasemap === "positron" && (
                  <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
                )}
              </button>
              <button
                onClick={() =>
                  handleMenuAction(() => onChangeBasemap("dark-matter"))
                }
                className={`w-full text-left px-4 py-2 hover:bg-[#1e293b] flex items-center justify-between text-xs ${
                  currentBasemap === "dark-matter"
                    ? "text-[#38bdf8] font-semibold"
                    : "text-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-purple-400" /> CartoDB Dark Matter
                </span>
                {currentBasemap === "dark-matter" && (
                  <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Add Data Dropdown */}
        <div className="relative flex flex-col items-center justify-center h-full">
          <button
            onClick={() => toggleDropdown("add-data")}
            className={`flex flex-col items-center justify-center px-3 h-full transition-all text-[10px] font-medium relative ${
              activeDropdown === "add-data"
                ? "text-white"
                : "text-[#94a3b8] hover:text-white"
            }`}
            title="Add Data"
          >
            <FileUp className="w-4 h-4 text-[#38bdf8]" />
            <span className="text-[9px] mt-0.5">Add Data</span>
            {activeDropdown === "add-data" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "add-data" && (
            <div className="absolute left-1/2 -translate-x-1/2 top-[40px] w-72 bg-[#0f172a] border border-[#334155] rounded-lg shadow-2xl py-1.5 animate-in fade-in duration-100 z-50 divide-y divide-[#334155]/20">
              <div className="py-1">
                <button
                  onClick={() => handleMenuAction(onTriggerFileUpload)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                >
                  <FileUp className="w-4 h-4 text-[#38bdf8]" />
                  <div>
                    <p className="font-medium">Upload File GeoJSON</p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      Format .geojson / .json
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleMenuAction(onTriggerFileUpload)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                >
                  <FolderArchive className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-medium">Upload Shapefile (.ZIP)</p>
                    <p className="text-[9px] text-slate-400 font-mono">
                      Wajib ada .shp, .shx, .dbf, .prj
                    </p>
                  </div>
                </button>

                {/* CSV option */}
                <div className="w-full flex items-center justify-between pr-3 hover:bg-[#1e293b] text-slate-300 hover:text-white">
                  <button
                    onClick={() => handleMenuAction(onTriggerFileUpload)}
                    className="flex-1 text-left px-4 py-2.5 flex items-center gap-2.5 text-xs"
                  >
                    <Table className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="font-medium">Upload File CSV (.CSV)</p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        Format tabel koordinat
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCsvInfo(true);
                      setActiveDropdown(null);
                    }}
                    className="p-1.5 text-[#38bdf8] hover:bg-[#38bdf8]/15 hover:text-white rounded-md transition-all cursor-pointer"
                    title="Info Kolom Wajib CSV"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* KML option */}
                <button
                  onClick={() => handleMenuAction(onTriggerFileUpload)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-slate-300 hover:text-white text-xs"
                >
                  <Globe className="w-4 h-4 text-pink-400" />
                  <div>
                    <p className="font-medium">Upload File KML (.KML)</p>
                    <p className="text-[9px] text-slate-400 font-mono">
                      Format Google Earth KML
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Create Layer Button */}
        <div className="relative flex flex-col items-center justify-center h-full">
          <button
            onClick={() => toggleDropdown("create-layer")}
            className={`flex flex-col items-center justify-center px-3 h-full transition-all text-[10px] font-medium relative ${
              activeDropdown === "create-layer"
                ? "text-white"
                : "text-[#10b981] hover:text-emerald-400"
            }`}
            title="Buat Layer Baru"
          >
            <Plus className="w-4 h-4 text-[#10b981]" />
            <span className="text-[9px] mt-0.5 text-[#10b981] font-bold">Buat Layer</span>
            {activeDropdown === "create-layer" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]"></div>
            )}
          </button>
          {activeDropdown === "create-layer" && (
            <div className="fixed inset-0 bg-[#0f172a]/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
              <div className="bg-[#0f172a] border-2 border-[#334155] rounded-xl shadow-2xl p-4 w-full max-w-sm text-xs text-left space-y-3.5 animate-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center border-b border-[#334155]/60 pb-2">
                  <span className="text-[10px] font-bold uppercase text-[#38bdf8] font-mono tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Buat Layer Baru
                  </span>
                  <button
                    onClick={() => setActiveDropdown(null)}
                    className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Selector Mode Tab */}
                <div className="grid grid-cols-2 gap-1 border border-[#334155] rounded p-0.5 bg-[#1e293b]/50">
                  <button
                    type="button"
                    onClick={() => setMLayerTypeMode("geojson")}
                    className={`py-1.5 text-center text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                      mLayerTypeMode === "geojson"
                        ? "bg-[#38bdf8] text-[#0f172a]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Vector (GeoJSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMLayerTypeMode("wms")}
                    className={`py-1.5 text-center text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                      mLayerTypeMode === "wms"
                        ? "bg-[#38bdf8] text-[#0f172a]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    WMS Server
                  </button>
                  <button
                    type="button"
                    onClick={() => setMLayerTypeMode("vector-tile")}
                    className={`py-1.5 text-center text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                      mLayerTypeMode === "vector-tile"
                        ? "bg-[#38bdf8] text-[#0f172a]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Vector Tile
                  </button>
                  <button
                    type="button"
                    onClick={() => setMLayerTypeMode("pmbtiles")}
                    className={`py-1.5 text-center text-[8px] font-mono font-bold rounded transition-colors cursor-pointer ${
                      mLayerTypeMode === "pmbtiles"
                        ? "bg-[#38bdf8] text-[#0f172a]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    PMTiles
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                      Nama Layer
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Titik Evakuasi Bencana"
                      value={mLayerName}
                      onChange={(e) => setMLayerName(e.target.value)}
                      className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] text-xs font-sans placeholder:text-slate-600"
                    />
                  </div>

                  {mLayerTypeMode === "geojson" && (
                    <>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Tipe Geometri
                        </label>
                        <select
                          value={mLayerType}
                          onChange={(e) =>
                            setMLayerType(
                              e.target.value as "fill" | "line" | "circle",
                            )
                          }
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-sans cursor-pointer"
                        >
                          <option value="circle">🔴 Titik (Point)</option>
                          <option value="line">📏 Garis (LineString)</option>
                          <option value="fill">⬡ Poligon (Polygon)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Warna Tampilan
                        </label>
                        <div className="flex items-center gap-2.5 bg-[#1e293b]/40 p-2 rounded-lg border border-[#334155]/50">
                          <input
                            type="color"
                            value={mLayerColor}
                            onChange={(e) => setMLayerColor(e.target.value)}
                            className="w-8 h-8 bg-transparent border-0 cursor-pointer p-0 rounded-md"
                          />
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono">Kode warna terpilih:</span>
                            <p className="text-xs font-mono font-bold uppercase text-[#38bdf8]">{mLayerColor}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {mLayerTypeMode === "wms" && (
                    <>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          URL WMS Server
                        </label>
                        <input
                          type="text"
                          placeholder="https://geoserver.example.com/geoserver/wms"
                          value={mWmsUrl}
                          onChange={(e) => setMWmsUrl(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Layer Name WMS
                        </label>
                        <input
                          type="text"
                          placeholder="workspace:layer_name"
                          value={mWmsLayers}
                          onChange={(e) => setmWmsLayers(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] text-xs font-mono placeholder:text-slate-600"
                        />
                      </div>
                    </>
                  )}

                  {mLayerTypeMode === "vector-tile" && (
                    <>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          URL Vector Tile (.mvt / .pbf)
                        </label>
                        <input
                          type="text"
                          placeholder="https://example.com/tiles/{z}/{x}/{y}.pbf"
                          value={mVtUrl}
                          onChange={(e) => setMVtUrl(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Source Layer Name
                        </label>
                        <input
                          type="text"
                          placeholder="roads, water, dll"
                          value={mVtLayers}
                          onChange={(e) => setMVtLayers(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Tipe Geometri Rendisi
                        </label>
                        <select
                          value={mVtGeomType}
                          onChange={(e) => setMVtGeomType(e.target.value as any)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-sans cursor-pointer"
                        >
                          <option value="circle">🔴 Titik (Point)</option>
                          <option value="line">📏 Garis (LineString)</option>
                          <option value="fill">⬡ Poligon (Polygon)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Warna Layer
                        </label>
                        <input
                          type="color"
                          value={mVtColor}
                          onChange={(e) => setMVtColor(e.target.value)}
                          className="w-8 h-8 bg-transparent border-0 cursor-pointer p-0 rounded-md"
                        />
                      </div>
                    </>
                  )}

                  {mLayerTypeMode === "pmbtiles" && (
                    <>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          URL File PMTiles
                        </label>
                        <input
                          type="text"
                          placeholder="https://example.com/tiles.pmtiles"
                          value={mPmTilesUrl}
                          onChange={(e) => setMPmTilesUrl(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Source Layer Name
                        </label>
                        <input
                          type="text"
                          placeholder="water, roads, dll"
                          value={mPmTilesLayers}
                          onChange={(e) => setMPmTilesLayers(e.target.value)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Tipe Geometri Rendisi
                        </label>
                        <select
                          value={mPmTilesGeomType}
                          onChange={(e) => setMPmTilesGeomType(e.target.value as any)}
                          className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-[#38bdf8] text-xs font-sans cursor-pointer"
                        >
                          <option value="circle">🔴 Titik (Point)</option>
                          <option value="line">📏 Garis (LineString)</option>
                          <option value="fill">⬡ Poligon (Polygon)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                          Warna Layer
                        </label>
                        <input
                          type="color"
                          value={mPmTilesColor}
                          onChange={(e) => setMPmTilesColor(e.target.value)}
                          className="w-8 h-8 bg-transparent border-0 cursor-pointer p-0 rounded-md"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(null)}
                      className="flex-1 py-2 px-3 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 font-bold rounded-lg text-xs transition-colors cursor-pointer text-center"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleMobileCreateLayerSubmit}
                      disabled={
                        !mLayerName.trim() ||
                        (mLayerTypeMode === "wms" && (!mWmsUrl.trim() || !mWmsLayers.trim())) ||
                        (mLayerTypeMode === "vector-tile" && (!mVtUrl.trim() || !mVtLayers.trim())) ||
                        (mLayerTypeMode === "pmbtiles" && (!mPmTilesUrl.trim() || !mPmTilesLayers.trim()))
                      }
                      className="flex-[2] py-2 px-3 bg-[#10b981] hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer text-center"
                    >
                      ✓ Buat Layer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Processing Dropdown */}
        <div className="relative flex flex-col items-center justify-center h-full">
          <button
            onClick={() => toggleDropdown("processing")}
            className={`flex flex-col items-center justify-center px-3 h-full transition-all text-[10px] font-medium relative ${
              activeDropdown === "processing"
                ? "text-white"
                : activeTool === "measure-distance" ||
                    activeTool === "buffer-generator"
                  ? "text-[#38bdf8] font-semibold"
                  : "text-[#94a3b8] hover:text-white"
            }`}
            title="Processing"
          >
            <Compass className="w-4 h-4 text-purple-400" />
            <span className="text-[9px] mt-0.5">Processing</span>
            {(activeDropdown === "processing" ||
              activeTool === "measure-distance" ||
              activeTool === "buffer-generator") && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38bdf8]"></div>
            )}
          </button>
          {activeDropdown === "processing" && (
            <div className="absolute right-1 top-[40px] w-64 bg-[#0f172a] border border-[#334155] rounded-lg shadow-2xl py-1.5 animate-in fade-in duration-100 z-50">
              <button
                onClick={() =>
                  handleMenuAction(() =>
                    onChangeTool(
                      activeTool === "measure-distance"
                        ? "none"
                        : "measure-distance",
                    ),
                  )
                }
                className={`w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-xs ${
                  activeTool === "measure-distance"
                    ? "bg-[#38bdf8]/10 text-[#38bdf8] font-medium"
                    : "text-slate-300"
                }`}
              >
                <Ruler className="w-4 h-4 text-yellow-400" />
                <div>
                  <p className="font-medium">Ukur Jarak Spasial</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {activeTool === "measure-distance"
                      ? "Status: AKTIF"
                      : "Ukur jarak linier antar-titik"}
                  </p>
                </div>
              </button>

              <button
                onClick={() =>
                  handleMenuAction(() =>
                    onChangeTool(
                      activeTool === "buffer-generator"
                        ? "none"
                        : "buffer-generator",
                    ),
                  )
                }
                className={`w-full text-left px-4 py-2.5 hover:bg-[#1e293b] flex items-center gap-2.5 text-xs ${
                  activeTool === "buffer-generator"
                    ? "bg-[#38bdf8]/10 text-[#38bdf8] font-medium"
                    : "text-slate-300"
                }`}
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="font-medium">Generator Buffer Spasial</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {activeTool === "buffer-generator"
                      ? "Status: AKTIF"
                      : "Buat area penyangga (buffer) lingkaran"}
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM HELP MODAL (PANDUAN PENGGUNA NON-GIS) */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border-2 border-[#334155] rounded-xl shadow-2xl p-5 w-full max-w-2xl text-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#334155] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#38bdf8]" />
                <h3 className="font-bold text-base text-slate-100 font-sans tracking-wide">
                  Panduan & Cara Penggunaan WebGIS
                </h3>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="overflow-y-auto pr-2 space-y-4 text-xs font-sans leading-relaxed custom-scrollbar text-left">
              <p className="text-slate-400 italic bg-[#1e293b]/40 p-3 rounded-lg border border-[#334155]/50 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
                <span>
                  Selamat datang di <strong>Sistem Informasi Geografis (WebGIS)</strong>. Aplikasi peta interaktif ini dirancang khusus agar mudah digunakan oleh siapa saja, tanpa perlu latar belakang keahlian pemetaan profesional (GIS).
                </span>
              </p>

              {/* Step 1 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2 font-sans">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[#38bdf8] text-xs font-mono font-bold">1</span>
                  Melihat Informasi & Memilih Data (Layers)
                </h4>
                <div className="pl-7 text-slate-300 space-y-1">
                  <p>
                    • <strong>Kelola Data Peta (Layers):</strong> Gunakan tombol <strong className="text-[#38bdf8]">Layers</strong> di menu sisi kiri (atau bawah pada handphone) untuk memunculkan atau menyembunyikan informasi seperti Batas Wilayah, Jalan, Sungai, dan Tempat Penting (Landmark).
                  </p>
                  <p>
                    • <strong>Klik pada Peta:</strong> Klik objek apa saja di peta (misal garis jalan atau bidang kecamatan) untuk melihat informasi lengkapnya secara langsung.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2 font-sans">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[#38bdf8] text-xs font-mono font-bold">2</span>
                  Mengukur Jarak Antar Titik
                </h4>
                <div className="pl-7 text-slate-300 space-y-1">
                  <p>
                    • Buka menu <strong className="text-yellow-400">Processing</strong> di atas lalu pilih <strong className="text-yellow-400">Ukur Jarak Spasial</strong>.
                  </p>
                  <p>
                    • Klik titik awal di peta, lalu klik titik kedua. Anda dapat mengklik beberapa kali berturut-turut untuk mengukur rute yang berliku.
                  </p>
                  <p>
                    • Hasil jarak total dalam meter/kilometer akan langsung dihitung otomatis di pojok kanan atas peta.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2 font-sans">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[#38bdf8] text-xs font-mono font-bold">3</span>
                  Membuat Lingkaran Jangkauan (Buffer Spasial)
                </h4>
                <div className="pl-7 text-slate-300 space-y-1">
                  <p>
                    • Alat ini berguna untuk melihat cakupan wilayah (misalnya: daerah dalam radius 1 km di sekeliling masjid).
                  </p>
                  <p>
                    • Pilih menu <strong className="text-emerald-400">Processing</strong> lalu klik <strong className="text-emerald-400">Generator Buffer Spasial</strong>.
                  </p>
                  <p>
                    • Klik pada salah satu penanda tempat penting di peta, masukkan radius jangkauan yang Anda inginkan (misal: 1000 meter), lalu klik tombol buat.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2 font-sans">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[#38bdf8] text-xs font-mono font-bold">4</span>
                  Menggambar Data Anda Sendiri di Peta
                </h4>
                <div className="pl-7 text-slate-300 space-y-1">
                  <p>
                    • Klik tombol <strong className="text-[#10b981]">+ Buat Layer</strong> di atas atau menu bawah handphone.
                  </p>
                  <p>
                    • Beri nama peta kustom Anda (contoh: "Posko Penyelamatan Bencana").
                  </p>
                  <p>
                    • Pilih jenis gambar: <strong>Titik</strong> (untuk penanda tempat), <strong>Garis</strong> (untuk rute), atau <strong>Poligon</strong> (untuk batas area luas).
                  </p>
                  <p>
                    • Setelah terbuat, gunakan tombol gambar (pensil/kotak) di sebelah kanan atas peta untuk mulai melukis data Anda sendiri! Anda juga bisa mengisi data keterangan setiap titiknya langsung.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2 font-sans">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[#38bdf8] text-xs font-mono font-bold">5</span>
                  Mengunggah & Mengunduh File Data
                </h4>
                <div className="pl-7 text-slate-300 space-y-1">
                  <p>
                    • <strong>Upload:</strong> Gunakan menu <strong className="text-[#38bdf8]">Add Data</strong> untuk mengunggah file data peta dari komputer Anda sendiri (dalam format <strong>GeoJSON</strong> atau <strong>Shapefile .ZIP</strong>).
                  </p>
                  <p>
                    • <strong>Download:</strong> Klik layer kustom Anda pada daftar sebelah kiri, lalu pada asisten gaya sebelah kanan bawah, klik tombol export untuk mengunduh hasil kerja Anda kembali ke komputer.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#334155] pt-4 mt-4 flex justify-end">
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-5 py-2 bg-[#1e293b] hover:bg-[#334155] text-slate-200 hover:text-white font-bold font-sans rounded-lg transition-all cursor-pointer text-xs"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CSV INFO MODAL */}
      {showCsvInfo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border-2 border-[#334155] rounded-xl shadow-2xl p-5 w-full max-w-lg text-slate-200 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 text-left">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#334155] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-slate-100 font-sans tracking-wide">
                  Panduan Format Kolom File CSV
                </h3>
              </div>
              <button
                onClick={() => setShowCsvInfo(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-[#1e293b] rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="overflow-y-auto pr-2 space-y-4 text-xs font-sans leading-relaxed custom-scrollbar text-left">
              <p className="text-slate-300">
                Aplikasi ini akan memindai baris pertama file CSV Anda (header/nama kolom) untuk mendeteksi posisi koordinat secara otomatis. Pastikan file Anda memenuhi syarat berikut:
              </p>

              <div className="bg-[#1e293b]/50 border border-[#334155] rounded-lg p-3 space-y-3">
                {/* Lat Column Info */}
                <div>
                  <h4 className="font-bold text-amber-400 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider font-mono">
                    1. Kolom Garis Lintang (Latitude / Y)
                  </h4>
                  <p className="text-slate-300 mb-1">Harus mengandung salah satu kata berikut (tidak sensitif huruf besar/kecil):</p>
                  <div className="flex flex-wrap gap-1">
                    {["latitude", "lat", "y", "lintang"].map((c) => (
                      <code key={c} className="bg-[#0f172a] text-[#38bdf8] px-1.5 py-0.5 rounded font-mono border border-[#334155]/60">{c}</code>
                    ))}
                  </div>
                </div>

                {/* Lng Column Info */}
                <div>
                  <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider font-mono">
                    2. Kolom Garis Bujur (Longitude / X)
                  </h4>
                  <p className="text-slate-300 mb-1">Harus mengandung salah satu kata berikut (tidak sensitif huruf besar/kecil):</p>
                  <div className="flex flex-wrap gap-1">
                    {["longitude", "lng", "lon", "x", "bujur"].map((c) => (
                      <code key={c} className="bg-[#0f172a] text-[#38bdf8] px-1.5 py-0.5 rounded font-mono border border-[#334155]/60">{c}</code>
                    ))}
                  </div>
                </div>
              </div>

              {/* Example Section */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200">Contoh Struktur CSV yang Benar:</h4>
                <div className="bg-[#0f172a] rounded-lg border border-[#334155] p-3 font-mono text-[10px] text-slate-400 space-y-1 overflow-x-auto">
                  <p className="text-emerald-400 font-bold">nama_lokasi,lat,lon,kapasitas,status</p>
                  <p>Posko Utama,-8.1234,115.1234,250,Aktif</p>
                  <p>Posko Pembantu,-8.1421,115.1152,100,Siaga</p>
                  <p>Tenda Medis,-8.1189,115.1412,50,Penuh</p>
                </div>
              </div>

              {/* Important Notes */}
              <div className="space-y-2 bg-[#ea580c]/10 border border-[#ea580c]/30 rounded-lg p-3 text-slate-300">
                <h4 className="font-bold text-orange-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-orange-400 shrink-0" /> Catatan Penting:
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Gunakan tanda pemisah <strong>koma (,)</strong> sebagai standar pemisah kolom.</li>
                  <li>Koordinat wajib menggunakan format <strong>Angka Desimal</strong> (contoh: <code className="bg-[#0f172a] px-1 rounded text-[#38bdf8] font-mono">-8.1234</code>), <strong>bukan</strong> format derajat menit detik (DMS seperti 8°7'24"S).</li>
                  <li>Kolom selain koordinat (seperti nama, kapasitas, status) akan secara otomatis diimpor sebagai data pelengkap yang muncul saat titik di peta diklik.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#334155] pt-4 mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCsvInfo(false)}
                className="px-5 py-2 bg-[#1e293b] hover:bg-[#334155] text-slate-200 hover:text-white font-bold font-sans rounded-lg transition-all cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
