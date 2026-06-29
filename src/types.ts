export enum LayerId {
  KABUPATEN = "kabupaten",
  JALAN = "jalan",
  SUNGAI = "sungai",
  LANDMARK = "landmark"
}

export interface GisLayer {
  id: LayerId | string;
  name: string;
  visible: boolean;
  type: "fill" | "line" | "circle" | "wms";
  color: string;
  outlineColor?: string;
  opacity: number;
  description: string;
  count: number;
  iconStyle?: "circle" | "square" | "star" | "triangle" | "marker";
  lineStyle?: "solid" | "dashed" | "dotted";
  lineWidth?: number;
  isUploaded?: boolean;
  geojson?: any;
  customColumns?: string[];
  wmsUrl?: string;
  wmsLayers?: string;
}

export interface EditingFeature {
  layerId: string;
  featureIndex: number;
  geometry: any;
  properties: Record<string, any>;
}

export interface ClickedFeatureInfo {
  layerId?: LayerId | string;
  layerName: string;
  properties: Record<string, any>;
  coordinates: [number, number];
  featureIndex?: number;
  geometry?: any;
}

export type BasemapId = "positron" | "dark-matter" | "voyager";

export interface BasemapOption {
  id: BasemapId;
  name: string;
  url: string;
  thumbnail: string;
}

export type GisTool = "none" | "measure-distance" | "buffer-generator" | "add-custom-pin";

export interface CustomPin {
  id: string;
  name: string;
  category: string;
  coordinates: [number, number];
  description: string;
}

export interface MeasurePoint {
  coordinates: [number, number];
  label?: string;
}
