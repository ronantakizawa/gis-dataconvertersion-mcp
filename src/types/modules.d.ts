// Type definitions for missing modules

declare module 'wellknown' {
    export function parse(wkt: string): any;
    export function stringify(geojson: any): string;
    export default {
      parse,
      stringify
    };
  }
  
  declare module 'shpjs' {
    export function parseShp(buffer: Buffer | ArrayBuffer): Promise<any>;
    export function parseDbf(buffer: Buffer | ArrayBuffer): Promise<any>;
    export function combine(arrays: any[]): any;
    export function parseZip(buffer: Buffer | ArrayBuffer): Promise<any>;
    export default {
      parseShp,
      parseDbf,
      combine,
      parseZip
    };
  }
  
  declare module 'csv2geojson' {
    export interface Csv2GeoJSONOptions {
      latfield: string;
      lonfield: string;
      delimiter?: string;
    }
    
    export function csv2geojson(
      csvString: string, 
      options: Csv2GeoJSONOptions, 
      callback: (err: Error | null, data: any) => void
    ): void;
    
    export default {
      csv2geojson
    };
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
    
    export default {
      locationToQuadkey,
      bbox,
      children,
      inside,
      sibling
    };
  }
  
  declare module 'epsg' {
    export function getProj4(epsgCode: number): string | null;
    
    export default {
      getProj4
    };
  }