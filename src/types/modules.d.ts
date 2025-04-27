// Type definitions for missing modules

declare module 'wellknown' {
  export function parse(wkt: string): GeoJSON.Geometry | GeoJSON.Feature | null;
  export function stringify(geojson: GeoJSON.Geometry | GeoJSON.Feature): string;
  
  const _default: {
    parse: typeof parse;
    stringify: typeof stringify;
  };
  export default _default;
}

declare module 'csv2geojson' {
  export interface Csv2GeoJSONOptions {
    latfield: string;
    lonfield: string;
    delimiter?: string;
  }
  
  export interface GeoJSONResult {
    type: string;
    features: Array<{
      type: string;
      properties: Record<string, any>;
      geometry: {
        type: string;
        coordinates: number[];
      };
    }>;
  }
  
  export function csv2geojson(
    csvString: string, 
    options: Csv2GeoJSONOptions, 
    callback: (err: Error | null, data: GeoJSONResult | null) => void
  ): void;
  
  const _default: {
    csv2geojson: typeof csv2geojson;
  };
  export default _default;
}

declare module 'quadkeytools' {
  export interface BoundingBox {
    north: number;
    south: number;
    east: number;
    west: number;
  }
  
  export interface Location {
    lat: number;
    lng: number;
  }
  
  export function locationToQuadkey(location: Location, detail: number): string;
  export function bbox(quadkey: string): BoundingBox;
  export function children(quadkey: string): string[];
  export function inside(location: Location, quadkey: string): boolean;
  export function sibling(quadkey: string, direction: 'left' | 'right' | 'up' | 'down'): string;
  
  const _default: {
    locationToQuadkey: typeof locationToQuadkey;
    bbox: typeof bbox;
    children: typeof children;
    inside: typeof inside;
    sibling: typeof sibling;
  };
  export default _default;
}