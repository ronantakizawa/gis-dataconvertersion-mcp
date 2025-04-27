#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Import GIS conversion libraries
import wellknown from 'wellknown';
import csv2geojson from 'csv2geojson';

// Import TopoJSON libraries
import * as topojsonClient from 'topojson-client';
import * as topojsonServer from 'topojson-server';

// Import KML/KMZ conversion libraries
import { kml as kmlToGeoJSON } from '@tmcw/togeojson';
import tokml from 'tokml';
import { DOMParser } from 'xmldom';

// Import https for making requests (Node.js built-in)
import * as https from 'https';

// Define the tool response type to match what the MCP SDK expects
type ToolResponse = {
  content: Array<{
    type: 'text';
    text: string;
  }>;
};

class GisFormatServer {
  private server: Server;

  constructor() {
    console.error('[Setup] Initializing GIS Format Conversion MCP server...');
    
    this.server = new Server(
      {
        name: 'gis-format-conversion-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  // Define a consistent return type for all tool methods
  private formatToolResponse(text: string): ToolResponse {
    return {
      content: [
        {
          type: 'text',
          text
        },
      ],
    };
  }

  // Helper function to calculate centroid of polygon
  private getCentroid(points: number[][]): number[] {
    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += points[i][0];
      sumY += points[i][1];
    }
    
    return [sumX / n, sumY / n];
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'wkt_to_geojson',
          description: 'Convert Well-Known Text (WKT) to GeoJSON format',
          inputSchema: {
            type: 'object',
            properties: {
              wkt: {
                type: 'string',
                description: 'Well-Known Text (WKT) string to convert',
              },
            },
            required: ['wkt'],
          },
        },
        {
          name: 'geojson_to_wkt',
          description: 'Convert GeoJSON to Well-Known Text (WKT) format',
          inputSchema: {
            type: 'object',
            properties: {
              geojson: {
                type: 'object',
                description: 'GeoJSON object to convert',
              },
            },
            required: ['geojson'],
          },
        },
        {
          name: 'csv_to_geojson',
          description: 'Convert CSV with geographic data to GeoJSON',
          inputSchema: {
            type: 'object',
            properties: {
              csv: {
                type: 'string',
                description: 'CSV string to convert',
              },
              latfield: {
                type: 'string',
                description: 'Field name for latitude',
              },
              lonfield: {
                type: 'string',
                description: 'Field name for longitude',
              },
              delimiter: {
                type: 'string',
                description: 'CSV delimiter (default is comma)',
                default: ',',
              },
            },
            required: ['csv', 'latfield', 'lonfield'],
          },
        },
        {
          name: 'geojson_to_csv',
          description: 'Convert GeoJSON to CSV format',
          inputSchema: {
            type: 'object',
            properties: {
              geojson: {
                type: 'object',
                description: 'GeoJSON object to convert',
              },
              includeAllProperties: {
                type: 'boolean',
                description: 'Include all feature properties in the CSV',
                default: true,
              },
            },
            required: ['geojson'],
          },
        },
        {
          name: 'geojson_to_topojson',
          description: 'Convert GeoJSON to TopoJSON format (more compact with shared boundaries)',
          inputSchema: {
            type: 'object',
            properties: {
              geojson: {
                type: 'object',
                description: 'GeoJSON object to convert',
              },
              objectName: {
                type: 'string',
                description: 'Name of the TopoJSON object to create',
                default: 'data',
              },
              quantization: {
                type: 'number',
                description: 'Quantization parameter for simplification (0 to disable)',
                default: 1e4,
              },
            },
            required: ['geojson'],
          },
        },
        {
          name: 'topojson_to_geojson',
          description: 'Convert TopoJSON to GeoJSON format',
          inputSchema: {
            type: 'object',
            properties: {
              topojson: {
                type: 'object',
                description: 'TopoJSON object to convert',
              },
              objectName: {
                type: 'string',
                description: 'Name of the TopoJSON object to convert (if not provided, first object is used)',
              },
            },
            required: ['topojson'],
          },
        },
        {
          name: 'kml_to_geojson',
          description: 'Convert KML to GeoJSON format',
          inputSchema: {
            type: 'object',
            properties: {
              kml: {
                type: 'string',
                description: 'KML content to convert',
              },
            },
            required: ['kml'],
          },
        },
        {
          name: 'geojson_to_kml',
          description: 'Convert GeoJSON to KML format',
          inputSchema: {
            type: 'object',
            properties: {
              geojson: {
                type: 'object',
                description: 'GeoJSON object to convert',
              },
              documentName: {
                type: 'string',
                description: 'Name for the KML document',
                default: 'GeoJSON Conversion',
              },
              documentDescription: {
                type: 'string',
                description: 'Description for the KML document',
                default: 'Converted from GeoJSON by GIS Format Conversion MCP',
              },
              nameProperty: {
                type: 'string',
                description: 'Property name in GeoJSON to use as KML name',
                default: 'name',
              },
              descriptionProperty: {
                type: 'string',
                description: 'Property name in GeoJSON to use as KML description',
                default: 'description',
              }
            },
            required: ['geojson'],
          },
        },
        {
          name: 'coordinates_to_location',
          description: 'Convert latitude/longitude coordinates to location name using reverse geocoding',
          inputSchema: {
            type: 'object',
            properties: {
              latitude: {
                type: 'number',
                description: 'Latitude coordinate',
              },
              longitude: {
                type: 'number',
                description: 'Longitude coordinate',
              }
            },
            required: ['latitude', 'longitude'],
          },
        }
      ],
    }));

    // Using the 'as any' type assertion to bypass the TypeScript error
    this.server.setRequestHandler(CallToolRequestSchema, (async (request: any) => {
      try {
        switch (request.params.name) {
          case 'wkt_to_geojson':
            return await this.wktToGeoJSON(request.params.arguments);
          case 'geojson_to_wkt':
            return await this.geoJSONToWKT(request.params.arguments);
          case 'csv_to_geojson':
            return await this.csvToGeoJSON(request.params.arguments);
          case 'geojson_to_csv':
            return await this.geojsonToCSV(request.params.arguments);
          case 'geojson_to_topojson':
            return await this.geojsonToTopoJSON(request.params.arguments);
          case 'topojson_to_geojson':
            return await this.topojsonToGeoJSON(request.params.arguments);
          case 'kml_to_geojson':
            return await this.kmlToGeoJSON(request.params.arguments);
          case 'geojson_to_kml':
            return await this.geojsonToKML(request.params.arguments);
          case 'coordinates_to_location':
            return await this.coordinatesToLocation(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('[Error] Failed to process request:', error);
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to process request: ${error.message}`
          );
        }
        throw error;
      }
    }) as any);
  }

  async wktToGeoJSON(args: any): Promise<ToolResponse> {
    const { wkt } = args;

    if (!wkt) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: wkt'
      );
    }

    try {
      console.error(`[Converting] WKT to GeoJSON: "${wkt.substring(0, 50)}${wkt.length > 50 ? '...' : ''}"`);
      
      const geojson = wellknown.parse(wkt);
      
      if (!geojson) {
        throw new Error('Failed to parse WKT string');
      }
      
      return this.formatToolResponse(JSON.stringify(geojson, null, 2));
    } catch (error) {
      console.error('[Error] WKT to GeoJSON conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `WKT to GeoJSON conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async geoJSONToWKT(args: any): Promise<ToolResponse> {
    const { geojson } = args;

    if (!geojson) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: geojson'
      );
    }

    try {
      console.error(`[Converting] GeoJSON to WKT: ${JSON.stringify(geojson).substring(0, 50)}...`);
      
      const wkt = wellknown.stringify(geojson);
      
      if (!wkt) {
        throw new Error('Failed to convert GeoJSON to WKT');
      }
      
      return this.formatToolResponse(wkt);
    } catch (error) {
      console.error('[Error] GeoJSON to WKT conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `GeoJSON to WKT conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async csvToGeoJSON(args: any): Promise<ToolResponse> {
    const { csv, latfield, lonfield, delimiter = ',' } = args;

    if (!csv || !latfield || !lonfield) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: csv, latfield, lonfield'
      );
    }

    return new Promise<ToolResponse>((resolve, reject) => {
      try {
        console.error(`[Converting] CSV to GeoJSON using lat field ${latfield} and lon field ${lonfield}`);
        
        csv2geojson.csv2geojson(csv, {
          latfield,
          lonfield,
          delimiter
        }, (err: Error | null, data: any) => {
          if (err) {
            console.error('[Error] CSV to GeoJSON conversion failed:', err);
            reject(new McpError(
              ErrorCode.InternalError,
              `CSV to GeoJSON conversion failed: ${err.message}`
            ));
            return;
          }
          
          resolve(this.formatToolResponse(JSON.stringify(data, null, 2)));
        });
      } catch (error) {
        console.error('[Error] CSV to GeoJSON conversion failed:', error);
        reject(new McpError(
          ErrorCode.InternalError,
          `CSV to GeoJSON conversion failed: ${error instanceof Error ? error.message : String(error)}`
        ));
      }
    });
  }

  async geojsonToCSV(args: any): Promise<ToolResponse> {
    const { geojson, includeAllProperties = true } = args;

    if (!geojson || !geojson.features) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid GeoJSON: missing features array'
      );
    }

    try {
      console.error('[Converting] GeoJSON to CSV');
      
      // Extract all unique property keys
      const properties = new Set<string>();
      geojson.features.forEach((feature: any) => {
        if (feature.properties) {
          Object.keys(feature.properties).forEach(key => properties.add(key));
        }
      });
      
      // Always include geometry columns
      const headers = ['latitude', 'longitude', ...Array.from(properties)];
      
      // Generate CSV rows
      let csvRows = [headers.join(',')];
      
      geojson.features.forEach((feature: any) => {
        // Extract coordinates (handling different geometry types)
        let lat: number | string = '';
        let lon: number | string = '';
        
        if (feature.geometry.type === 'Point') {
          [lon, lat] = feature.geometry.coordinates;
        } else if (feature.geometry.type === 'Polygon') {
          const centroid = this.getCentroid(feature.geometry.coordinates[0]);
          lon = centroid[0];
          lat = centroid[1];
        } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiPoint') {
          // Use first coordinate for these types
          [lon, lat] = feature.geometry.coordinates[0];
        } else if (feature.geometry.type === 'MultiPolygon') {
          // Use the centroid of the first polygon
          const centroid = this.getCentroid(feature.geometry.coordinates[0][0]);
          lon = centroid[0];
          lat = centroid[1];
        } else if (feature.geometry.type === 'MultiLineString') {
          // Use the first point of the first linestring
          [lon, lat] = feature.geometry.coordinates[0][0];
        } else if (feature.geometry.type === 'GeometryCollection') {
          // Use the first geometry
          if (feature.geometry.geometries && feature.geometry.geometries.length > 0) {
            const firstGeom = feature.geometry.geometries[0];
            if (firstGeom.type === 'Point') {
              [lon, lat] = firstGeom.coordinates;
            } else if (firstGeom.type === 'Polygon') {
              const centroid = this.getCentroid(firstGeom.coordinates[0]);
              lon = centroid[0];
              lat = centroid[1];
            }
          }
        }
        
        // Convert coordinates to strings for CSV
        const latStr = String(lat);
        const lonStr = String(lon);
        
        // Build row with all properties
        const row = [latStr, lonStr];
        properties.forEach(prop => {
          const value = feature.properties && feature.properties[prop] !== undefined ? 
            feature.properties[prop] : '';
          // Make sure strings with commas are properly quoted
          row.push(typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value);
        });
        
        csvRows.push(row.join(','));
      });
      
      return this.formatToolResponse(csvRows.join('\n'));
    } catch (error) {
      console.error('[Error] GeoJSON to CSV conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `GeoJSON to CSV conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async geojsonToTopoJSON(args: any): Promise<ToolResponse> {
    const { geojson, objectName = 'data', quantization = 1e4 } = args;
    
    if (!geojson) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: geojson'
      );
    }
    
    try {
      console.error('[Converting] GeoJSON to TopoJSON');
      
      // Create a topology object from the GeoJSON
      const objectsMap: Record<string, any> = {};
      objectsMap[objectName] = geojson;
      
      // Generate the topology
      const topology = topojsonServer.topology(objectsMap);
      
      // Apply quantization if specified
      let result = topology;
      if (quantization > 0) {
        // Use type assertion to work around TypeScript type incompatibility
        result = topojsonClient.quantize(topology as any, quantization);
      }
      
      return this.formatToolResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('[Error] GeoJSON to TopoJSON conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `GeoJSON to TopoJSON conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  async topojsonToGeoJSON(args: any): Promise<ToolResponse> {
    const { topojson, objectName } = args;
    
    if (!topojson) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: topojson'
      );
    }
    
    try {
      console.error('[Converting] TopoJSON to GeoJSON');
      
      // Determine which object to convert
      let objName = objectName;
      
      // If no object name provided, use the first object in the topology
      if (!objName && topojson.objects) {
        objName = Object.keys(topojson.objects)[0];
      }
      
      if (!objName || !topojson.objects || !topojson.objects[objName]) {
        throw new Error('No valid object found in TopoJSON');
      }
      
      // Convert TopoJSON to GeoJSON
      const geojson = topojsonClient.feature(topojson, topojson.objects[objName]);
      
      return this.formatToolResponse(JSON.stringify(geojson, null, 2));
    } catch (error) {
      console.error('[Error] TopoJSON to GeoJSON conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `TopoJSON to GeoJSON conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  async kmlToGeoJSON(args: any): Promise<ToolResponse> {
    const { kml } = args;
    
    if (!kml) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: kml'
      );
    }
    
    try {
      console.error('[Converting] KML to GeoJSON');
      
      // Parse KML string to XML DOM
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kml, 'text/xml');
      
      // Convert KML to GeoJSON
      const geojson = kmlToGeoJSON(kmlDoc);
      
      return this.formatToolResponse(JSON.stringify(geojson, null, 2));
    } catch (error) {
      console.error('[Error] KML to GeoJSON conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `KML to GeoJSON conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async geojsonToKML(args: any): Promise<ToolResponse> {
    const { 
      geojson, 
      documentName = 'GeoJSON Conversion', 
      documentDescription = 'Converted from GeoJSON by GIS Format Conversion MCP', 
      nameProperty = 'name',
      descriptionProperty = 'description'
    } = args;
    
    if (!geojson) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: geojson'
      );
    }
    
    try {
      console.error('[Converting] GeoJSON to KML');
      
      // Set up options for tokml
      const options = {
        documentName: documentName,
        documentDescription: documentDescription,
        name: nameProperty,
        description: descriptionProperty
      };
      
      // Convert GeoJSON to KML using tokml
      const kml = tokml(geojson, options);
      
      return this.formatToolResponse(kml);
    } catch (error) {
      console.error('[Error] GeoJSON to KML conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `GeoJSON to KML conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async coordinatesToLocation(args: any): Promise<ToolResponse> {
    const { latitude, longitude } = args;
    
    if (latitude === undefined || longitude === undefined) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: latitude, longitude'
      );
    }
    
    try {
      console.error(`[Converting] Coordinates (${latitude}, ${longitude}) to location name`);
      
      // Using Nominatim OSM service (free, but has usage limitations)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
      
      return new Promise<ToolResponse>((resolve, reject) => {
        // Use the imported https module directly
        const req = https.request(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'GisFormatMcpServer/1.0'
          }
        }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Geocoding service returned ${res.statusCode}: ${res.statusMessage}`));
            return;
          }
          
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const parsedData = JSON.parse(data);
              
              // Always return detailed format
              const result = {
                displayName: parsedData.display_name,
                address: parsedData.address,
                type: parsedData.type,
                osmId: parsedData.osm_id,
                osmType: parsedData.osm_type,
                category: parsedData.category
              };
              
              resolve(this.formatToolResponse(JSON.stringify(result, null, 2)));
            } catch (error) {
              reject(new Error(`Failed to parse geocoding response: ${error instanceof Error ? error.message : String(error)}`));
            }
          });
        });
        
        req.on('error', (error) => {
          reject(new Error(`Geocoding request failed: ${error.message}`));
        });
        
        req.end();
      });
    } catch (error) {
      console.error('[Error] Coordinates to location conversion failed:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Coordinates to location conversion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GIS Format Conversion MCP server running on stdio');
  }
}

const server = new GisFormatServer();
server.run().catch(console.error);