# GIS Data Conversion MCP

[![smithery badge](https://smithery.ai/badge/@ronantakizawa/gis-dataconvertersion-mcp)](https://smithery.ai/server/@ronantakizawa/gis-dataconvertersion-mcp)

![Copy of Untitled Design](https://github.com/user-attachments/assets/c143d9f0-710f-4164-ada9-128563746d66)

The GIS Data Conversion MCP is an MCP (Model Context Protocol) server that gives LLMs access to geographic data conversion tools.

This server uses various GIS libraries to allow LLMs to convert between different geographic data formats, coordinate systems, and spatial references.

## Features

- **Reverse Geocoding** - Convert coordinates to location information
- **WKT/GeoJSON Conversion** - Convert between Well-Known Text and GeoJSON formats
- **CSV/GeoJSON Conversion** - Transform tabular data with coordinates to GeoJSON and vice versa
- **TopoJSON/GeoJSON Conversion** - Convert between GeoJSON and TopoJSON (topology-preserving format)
- **KML/GeoJSON Conversion** - Transform KML files to GeoJSON format

## Demo
### Reverse Geocoding
https://github.com/user-attachments/assets/e21b10c3-bb67-4322-9742-efa8c7d8b332

### TopoJSON to GeoJSON
https://github.com/user-attachments/assets/a5d56051-8aed-48bb-8de1-820df8d34fe3

## Installation
To use this server with Claude Desktop, you need to configure it in the MCP settings:

**For macOS:**
Edit the file at `'~/Library/Application Support/Claude/claude_desktop_config.json'`

```
{
  "mcpServers": {
    "gis-dataconversion-mcp": {
    "command": "npx",
    "args": [
      "-y",
      "a11y-mcp-server"
    ]
   }
  }
}
```

**For Windows:**
Edit the file at `%APPDATA%\Claude\settings\claude_mcp_settings.json`

**For Linux:**
Edit the file at `~/.config/Claude/settings/claude_mcp_settings.json`
Replace `/path/to/axe-mcp-server/build/index.js` with the actual path to your compiled server file.


## Available Tools

### wkt_to_geojson
Converts Well-Known Text (WKT) to GeoJSON format.

### geojson_to_wkt
Converts GeoJSON to Well-Known Text (WKT) format.

### csv_to_geojson
Converts CSV with geographic data to GeoJSON.

**Parameters:**

- `csv` (required): CSV string to convert
- `latfield` (required): Field name for latitude
- `lonfield` (required): Field name for longitude
- `delimiter` (optional): CSV delimiter (default is comma)

### geojson_to_csv
Converts GeoJSON to CSV format.

### geojson_to_topojson
Converts GeoJSON to TopoJSON format (more compact with shared boundaries).

**Parameters:**

- `geojson` (required): GeoJSON object to convert
- `objectName` (optional): Name of the TopoJSON object to create (default: "data")
- `quantization` (optional): Quantization parameter for simplification (default: 1e4, 0 to disable)

### topojson_to_geojson
Converts TopoJSON to GeoJSON format.

**Parameters:**

- `geojson` (required): GeoJSON object to convert
- `objectName` (optional): Name of the TopoJSON object to create (default: "data")

### kml_to_geojson
Converts KML to GeoJSON format.

### geojson_to_kml
Converts GeoJSON to KML format.

### coordinates_to_location
Converts latitude/longitude coordinates to location name using reverse geocoding.


## Dependencies

- @modelcontextprotocol/sdk
- wellknown
- csv2geojson
- topojson-client
- topojson-server
- @tmcw/togeojson
- xmldom
