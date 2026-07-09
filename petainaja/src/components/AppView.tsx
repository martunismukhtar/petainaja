/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MapContainer from "./MapContainer";
import Footer from "./Footer";
import { StatsModal } from "./StatsModal";
import { AttributeTableModal } from "./AttributeTableModal";
import { LayerDesignAssistant } from "./LayerDesignAssistant";
import { FeatureInfoModal } from "./FeatureInfoModal";
import { Sparkles } from "lucide-react";
import type { BasemapId, GisLayer, GisTool, ClickedFeatureInfo, EditingFeature } from "../types";

interface AppViewProps {
  // States & properties
  layers: GisLayer[];
  editingFeature: EditingFeature | null;
  activeBasemap: BasemapId;
  activeTool: GisTool;
  clickedFeature: ClickedFeatureInfo | null;
  isSidebarOpen: boolean;
  pointerCoords: { lon: number; lat: number };
  zoomLevel: number;
  isMapLoaded: boolean;
  flyToCoords: [number, number] | null;
  uploadedGeoJSONs: any[];
  isUploadedVisible: boolean;
  drawingLayerId: string | null;
  showStatsModal: boolean;
  attributeTableLayerId: string | null;
  attributeSearchQuery: string;
  newColInputName: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Setters or Simple handlers
  setClickedFeature: (info: ClickedFeatureInfo | null) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  setIsMapLoaded: (isLoaded: boolean) => void;
  setFlyToCoords: (coords: [number, number] | null) => void;
  setIsUploadedVisible: (isVisible: boolean) => void;
  setShowStatsModal: (show: boolean) => void;
  setAttributeTableLayerId: (id: string | null) => void;
  setAttributeSearchQuery: (query: string) => void;
  setNewColInputName: (name: string) => void;

  // Business Logic Handlers & Actions
  handleUpdateLayerColor: (id: string, color: string) => void;
  handleUpdateColorClassification: (
    id: string,
    classification: { enabled: boolean; columnName?: string; rules: Record<string, string> } | undefined
  ) => void;
  handleUpdateLayerOpacity: (id: string, opacity: number) => void;
  handleUpdateLayerIconStyle: (id: string, iconStyle: "circle" | "square" | "star" | "triangle" | "marker") => void;
  handleUpdateLayerLineStyle: (id: string, lineStyle: "solid" | "dashed" | "dotted") => void;
  handleUpdateLayerLineWidth: (id: string, lineWidth: number) => void;
  handleRenameLayer: (id: string, name: string) => void;
  handleUpdateWmsParams: (id: string, wmsUrl: string, wmsLayers: string) => void;
  handleOpenAttributeTable: (id: string) => void;
  handleRemoveLayer: (id: string) => void;
  handleCreateLayer: (name: string, type: "fill" | "line" | "circle", color: string) => void;
  handleCreateWmsLayer: (name: string, url: string, layersParam: string) => void;
  handleCreateVectorTileLayer: (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => void;
  handleCreatePmtilesLayer: (name: string, url: string, layersParam: string, geomType: "fill" | "line" | "circle", color: string) => void;
  handleEditFeature: (layerId: string, featureIndex: number, geometry: any, properties: any) => void;
  handleCancelEditing: () => void;
  handleSaveEditedFeature: (layerId: string, featureIndex: number, geometry: any, properties: any) => void;
  handleStartDrawing: (layerId: string) => void;
  handleSaveDrawnFeature: (layerId: string, geometryOrFeatures: any, properties?: any) => void;
  handleAddColumn: (layerId: string, colName: string) => void;
  handleDeleteColumn: (layerId: string, colKey: string) => void;
  handleUpdateAttribute: (layerId: string, featureIndex: number, key: string, value: any) => void;
  handleDeleteFeature: (layerId: string, featureIndex: number) => void;
  handleUpdateFeatureProperties: (layerId: string, featureIndex: number, properties: Record<string, any>) => void;
  handleMergeFeatures: (layerId: string, featureIndexes: number[]) => void;
  handleDissolveLayer: (layerId: string, propertyName?: string) => void;
  handleSplitFeature: (layerId: string, featureIndex: number, cutterCoords: [number, number][]) => void;
  handleExportLayer: (id: string, format: "shp" | "kml" | "geojson") => void;
  handleToggleLayer: (id: string) => void;
  handleChangeBasemap: (id: BasemapId) => void;
  handleChangeTool: (tool: GisTool) => void;
  handleClearDrawings: () => void;
  handleUpdatePointer: (lon: number, lat: number) => void;
  handleUpdateZoom: (zoom: number) => void;
  handleTriggerFileUpload: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearUploaded: () => void;
  getTotalFeaturesCount: () => number;
  getAttributeData: () => { name: string; features: any[]; cols: any[] };
  getFeatureCenter: (feature: any) => [number, number] | null;
}

export const AppView: React.FC<AppViewProps> = ({
  layers,
  editingFeature,
  activeBasemap,
  activeTool,
  clickedFeature,
  isSidebarOpen,
  pointerCoords,
  zoomLevel,
  isMapLoaded,
  flyToCoords,
  uploadedGeoJSONs,
  isUploadedVisible,
  drawingLayerId,
  showStatsModal,
  attributeTableLayerId,
  attributeSearchQuery,
  newColInputName,
  fileInputRef,

  setClickedFeature,
  setIsSidebarOpen,
  setIsMapLoaded,
  setFlyToCoords,
  setIsUploadedVisible,
  setShowStatsModal,
  setAttributeTableLayerId,
  setAttributeSearchQuery,
  setNewColInputName,

  handleUpdateLayerColor,
  handleUpdateColorClassification,
  handleUpdateLayerOpacity,
  handleUpdateLayerIconStyle,
  handleUpdateLayerLineStyle,
  handleUpdateLayerLineWidth,
  handleRenameLayer,
  handleUpdateWmsParams,
  handleOpenAttributeTable,
  handleRemoveLayer,
  handleCreateLayer,
  handleCreateWmsLayer,
  handleCreateVectorTileLayer,
  handleCreatePmtilesLayer,
  handleEditFeature,
  handleCancelEditing,
  handleSaveEditedFeature,
  handleStartDrawing,
  handleSaveDrawnFeature,
  handleAddColumn,
  handleDeleteColumn,
  handleUpdateAttribute,
  handleDeleteFeature,
  handleUpdateFeatureProperties,
  handleMergeFeatures,
  handleDissolveLayer,
  handleSplitFeature,
  handleExportLayer,
  handleToggleLayer,
  handleChangeBasemap,
  handleChangeTool,
  handleClearDrawings,
  handleUpdatePointer,
  handleUpdateZoom,
  handleTriggerFileUpload,
  handleFileChange,
  handleClearUploaded,
  getTotalFeaturesCount,
  getAttributeData,
  getFeatureCenter
}) => {
  const [activeAssistantLayerId, setActiveAssistantLayerId] = useState<string | null>(null);
  const [prevLayersCount, setPrevLayersCount] = useState(layers.length);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (layers.length > prevLayersCount) {
      const lastLayer = layers[layers.length - 1];
      if (lastLayer && (lastLayer.id.startsWith("custom-layer-") || lastLayer.id.startsWith("wms-layer-"))) {
        setActiveAssistantLayerId(lastLayer.id);
      }
    }
    setPrevLayersCount(layers.length);
  }, [layers, prevLayersCount]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f172a] font-sans antialiased text-slate-100 animate-fade-in">
      {/* Hidden Native File Input for geojson loading */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".geojson,.json,.zip,application/json,application/zip,application/x-zip-compressed"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header component */}
      <Header
        currentBasemap={activeBasemap}
        onChangeBasemap={handleChangeBasemap}
        activeTool={activeTool}
        onChangeTool={handleChangeTool}
        onClearDrawings={handleClearDrawings}
        onTriggerFileUpload={handleTriggerFileUpload}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onCreateLayer={handleCreateLayer}
        onCreateWmsLayer={handleCreateWmsLayer}
        onCreateVectorTileLayer={handleCreateVectorTileLayer}
        onCreatePmtilesLayer={handleCreatePmtilesLayer}
      />

      {/* Main Body Layout (Sidebar + Map View) */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Sidebar */}
        {isSidebarOpen && (
          <Sidebar
            layers={layers}
            onToggleLayer={handleToggleLayer}
            clickedFeature={clickedFeature}
            onCloseFeatureInfo={() => setClickedFeature(null)}                        
            uploadedGeoJSONsCount={uploadedGeoJSONs.length}
            isUploadedVisible={isUploadedVisible}
            onToggleUploadedVisibility={() => setIsUploadedVisible(!isUploadedVisible)}
            onClearUploaded={handleClearUploaded}
            onClose={() => setIsSidebarOpen(false)}
            onUpdateLayerColor={handleUpdateLayerColor}
            onUpdateLayerOpacity={handleUpdateLayerOpacity}
            onUpdateLayerIconStyle={handleUpdateLayerIconStyle}
            onUpdateLayerLineStyle={handleUpdateLayerLineStyle}
            onUpdateLayerLineWidth={handleUpdateLayerLineWidth}
            onOpenAttributeTable={handleOpenAttributeTable}
            onExportLayer={handleExportLayer}
            onRemoveLayer={handleRemoveLayer}
            onCreateLayer={handleCreateLayer}
            drawingLayerId={drawingLayerId}
            onStartDrawing={handleStartDrawing}
            onEditFeature={handleEditFeature}
            onCreateWmsLayer={handleCreateWmsLayer}
            onCreateVectorTileLayer={handleCreateVectorTileLayer}
            onCreatePmtilesLayer={handleCreatePmtilesLayer}
            onRenameLayer={handleRenameLayer}
            onUpdateWmsParams={handleUpdateWmsParams}
            onDeleteFeature={handleDeleteFeature}
            onUpdateFeatureProperties={handleUpdateFeatureProperties}
            onMergeFeatures={handleMergeFeatures}
            onDissolveLayer={handleDissolveLayer}
            onSplitFeature={handleSplitFeature}
            activeTool={activeTool}
            onChangeTool={handleChangeTool}
            onOpenAssistant={(id) => setActiveAssistantLayerId(id)}
            onZoomToFeature={(coords) => setFlyToCoords(coords)}
            getFeatureCenter={getFeatureCenter}
          />
        )}

        {/* Map Canvas and mini map */}
        <MapContainer
          layers={layers}
          activeBasemap={activeBasemap}
          activeTool={activeTool}
          onChangeTool={handleChangeTool}
          clickedFeature={clickedFeature}
          onFeatureClick={setClickedFeature}          
          onUpdatePointer={handleUpdatePointer}
          onUpdateZoom={handleUpdateZoom}
          isMapLoaded={isMapLoaded}
          setIsMapLoaded={setIsMapLoaded}
          flyToCoords={flyToCoords}
          onResetFlyTo={() => setFlyToCoords(null)}
          uploadedGeoJSONs={isUploadedVisible ? uploadedGeoJSONs : []}
          drawingLayerId={drawingLayerId}
          onSaveDrawnFeature={handleSaveDrawnFeature}
          editingFeature={editingFeature}
          onSaveEditedFeature={handleSaveEditedFeature}
          onCancelEditing={handleCancelEditing}
          onSplitFeature={handleSplitFeature}
        />
      </div>

      {/* Footer component */}
      <Footer
        lon={pointerCoords.lon}
        lat={pointerCoords.lat}
        zoom={zoomLevel}
        activeBasemap={activeBasemap}
        totalFeatures={getTotalFeaturesCount()}
        isMapLoaded={isMapLoaded}
      />

      {/* REGIONAL STATISTICS POPUP DIALOG MODAL */}
      {showStatsModal && (
        <StatsModal onClose={() => setShowStatsModal(false)} />
      )}

      {/* ATTRIBUTE TABLE POPUP DIALOG MODAL */}
      {attributeTableLayerId && (
        <AttributeTableModal
          layerId={attributeTableLayerId}
          layers={layers}
          onClose={() => setAttributeTableLayerId(null)}
          searchQuery={attributeSearchQuery}
          onSearchQueryChange={setAttributeSearchQuery}
          newColInputName={newColInputName}
          onNewColInputNameChange={setNewColInputName}
          onAddColumn={handleAddColumn}
          onDeleteColumn={handleDeleteColumn}
          onExportLayer={handleExportLayer}
          onUpdateAttribute={handleUpdateAttribute}
          onDeleteFeature={handleDeleteFeature}
          onZoomToFeature={(props, coords) => {
            setClickedFeature({
              layerId: attributeTableLayerId,
              layerName: layers.find(l => l.id === attributeTableLayerId)?.name || "",
              properties: props,
              coordinates: coords
            });
            setFlyToCoords(coords);
            setAttributeTableLayerId(null);
          }}
          attributeData={getAttributeData()}
          getFeatureCenter={getFeatureCenter}
        />
      )}

      {/* LAYER DESIGN & DRAWING ASSISTANT SHEET/MODAL */}
      {activeAssistantLayerId && (
        <LayerDesignAssistant
          layerId={activeAssistantLayerId}
          layers={layers}
          onClose={() => setActiveAssistantLayerId(null)}
          onUpdateLayerColor={handleUpdateLayerColor}
          onUpdateColorClassification={handleUpdateColorClassification}
          onUpdateLayerOpacity={handleUpdateLayerOpacity}
          onUpdateLayerIconStyle={handleUpdateLayerIconStyle}
          onUpdateLayerLineStyle={handleUpdateLayerLineStyle}
          onUpdateLayerLineWidth={handleUpdateLayerLineWidth}
          onStartDrawing={handleStartDrawing}
          onOpenAttributeTable={handleOpenAttributeTable}
          onRemoveLayer={handleRemoveLayer}
          onExportLayer={handleExportLayer}
          onToggleLayer={handleToggleLayer}
        />
      )}

      {/* MOBILE CLICKED FEATURE INFO MODAL */}
      {isMobile && clickedFeature && !editingFeature && activeTool !== "split-geometry" && (
        <FeatureInfoModal
          clickedFeature={clickedFeature}
          onClose={() => setClickedFeature(null)}
          onUpdateFeatureProperties={handleUpdateFeatureProperties}
          onZoomToFeature={(coords) => setFlyToCoords(coords)}
          onEditFeature={handleEditFeature}
          onDeleteFeature={handleDeleteFeature}
        />
      )}


    </div>
  );
};
