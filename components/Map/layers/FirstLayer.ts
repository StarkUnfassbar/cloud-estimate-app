import maplibregl from 'maplibre-gl';
import cloudAreasJSON from './cloud/cloudAreas.json';

export interface Bounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface CloudGrid {
    rows: number;
    cols: number;
    data: (number | null)[][];
    rowLabels?: string[];
    colLabels?: string[];
}

interface CloudData {
    status?: string;
    message?: string;
    gridSize?: number;
    bounds?: Bounds;
    cloudGrid?: CloudGrid;
    analysis?: any;
}

const rawData = cloudAreasJSON as any;
const cloudData: CloudData = {
    status: rawData.status || 'data_available',
    message: rawData.message || '',
    gridSize: rawData.gridSize || 50,
    bounds: rawData.bounds,
    cloudGrid: rawData.cloudGrid,
    analysis: rawData.analysis
};

const hasData = cloudData.status !== 'no_data' && 
                cloudData.cloudGrid && 
                cloudData.cloudGrid.data && 
                cloudData.cloudGrid.data.length > 0;

function getGridValue(grid: (number | null)[][] | undefined, row: number, col: number): number | null {
    if (!grid || row < 0 || row >= grid.length || col < 0 || col >= grid[row].length) {
        return null;
    }
    return grid[row][col];
}

function getCloudCoverFromGrid(lat: number, lng: number): number {
    if (!hasData || !cloudData.cloudGrid || !cloudData.bounds) {
        return 0;
    }
    
    const { cloudGrid, bounds } = cloudData;
    
    if (!cloudGrid.data || cloudGrid.data.length === 0) {
        return 0;
    }
    
    if (lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east) {
        return 0;
    }
    
    const latRange = bounds.north - bounds.south;
    const lngRange = bounds.east - bounds.west;
    
    if (latRange === 0 || lngRange === 0) {
        return 0;
    }
    
    const latNorm = (lat - bounds.south) / latRange;
    const lngNorm = (lng - bounds.west) / lngRange;
    
    const row = Math.floor(latNorm * (cloudGrid.rows - 1));
    const col = Math.floor(lngNorm * (cloudGrid.cols - 1));
    
    const value = getGridValue(cloudGrid.data, row, col);
    
    if (value === null || value === undefined) {
        return 0;
    }
    
    return Math.min(Math.max(value, 0), 1);
}

function getCloudCoverBilinear(lat: number, lng: number): number {
    if (!hasData || !cloudData.cloudGrid || !cloudData.bounds) {
        return 0;
    }
    
    const { cloudGrid, bounds } = cloudData;
    
    if (!cloudGrid.data || cloudGrid.data.length === 0) {
        return 0;
    }
    
    if (lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east) {
        return 0;
    }
    
    const latRange = bounds.north - bounds.south;
    const lngRange = bounds.east - bounds.west;
    
    if (latRange === 0 || lngRange === 0) {
        return 0;
    }
    
    const latNorm = (lat - bounds.south) / latRange;
    const lngNorm = (lng - bounds.west) / lngRange;
    
    const rowFloat = latNorm * (cloudGrid.rows - 1);
    const colFloat = lngNorm * (cloudGrid.cols - 1);
    
    const row1 = Math.floor(rowFloat);
    const col1 = Math.floor(colFloat);
    const row2 = Math.min(row1 + 1, cloudGrid.rows - 1);
    const col2 = Math.min(col1 + 1, cloudGrid.cols - 1);
    
    const dr = rowFloat - row1;
    const dc = colFloat - col1;
    
    const v11 = getGridValue(cloudGrid.data, row1, col1) ?? 0;
    const v12 = getGridValue(cloudGrid.data, row1, col2) ?? 0;
    const v21 = getGridValue(cloudGrid.data, row2, col1) ?? 0;
    const v22 = getGridValue(cloudGrid.data, row2, col2) ?? 0;
    
    const top = v11 + (v12 - v11) * dc;
    const bottom = v21 + (v22 - v21) * dc;
    
    return Math.min(Math.max(top + (bottom - top) * dr, 0), 1);
}

function createCloudFeatures(bounds: Bounds): GeoJSON.FeatureCollection {
    if (!hasData || !cloudData.cloudGrid) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const features: GeoJSON.Feature[] = [];
    const { cloudGrid } = cloudData;
    
    if (!cloudGrid.data || cloudGrid.data.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const cellSizeLat = (bounds.north - bounds.south) / cloudGrid.rows;
    const cellSizeLng = (bounds.east - bounds.west) / cloudGrid.cols;
    
    if (cellSizeLat === 0 || cellSizeLng === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    for (let row = 0; row < cloudGrid.rows; row++) {
        const rowData = cloudGrid.data[row];
        if (!rowData) continue;
        
        for (let col = 0; col < cloudGrid.cols; col++) {
            const value = rowData[col];
            
            if (value === null || value === undefined) continue;
            if (value <= 0.01) continue;
            
            const south = bounds.south + (row * cellSizeLat);
            const north = bounds.south + ((row + 1) * cellSizeLat);
            const west = bounds.west + (col * cellSizeLng);
            const east = bounds.west + ((col + 1) * cellSizeLng);
            
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [west, north],
                        [east, north],
                        [east, south],
                        [west, south],
                        [west, north]
                    ]]
                },
                properties: {
                    cloudCover: Math.min(Math.max(value, 0), 1),
                    row: row,
                    col: col,
                    hasData: true
                }
            });
        }
    }
    
    return {
        type: 'FeatureCollection',
        features
    };
}

function createSmoothCloudFeatures(bounds: Bounds, subdivision: number = 2): GeoJSON.FeatureCollection {
    if (!hasData || !cloudData.cloudGrid) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const features: GeoJSON.Feature[] = [];
    const { cloudGrid } = cloudData;
    
    if (!cloudGrid.data || cloudGrid.data.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const subRows = cloudGrid.rows * subdivision;
    const subCols = cloudGrid.cols * subdivision;
    
    const cellSizeLat = (bounds.north - bounds.south) / subRows;
    const cellSizeLng = (bounds.east - bounds.west) / subCols;
    
    if (cellSizeLat === 0 || cellSizeLng === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    for (let row = 0; row < subRows; row++) {
        for (let col = 0; col < subCols; col++) {
            const centerLat = bounds.south + (row * cellSizeLat) + cellSizeLat / 2;
            const centerLng = bounds.west + (col * cellSizeLng) + cellSizeLng / 2;
            
            const cloudCover = getCloudCoverBilinear(centerLat, centerLng);
            
            if (cloudCover <= 0.01) continue;
            
            const south = bounds.south + (row * cellSizeLat);
            const north = bounds.south + ((row + 1) * cellSizeLat);
            const west = bounds.west + (col * cellSizeLng);
            const east = bounds.west + ((col + 1) * cellSizeLng);
            
            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [west, north],
                        [east, north],
                        [east, south],
                        [west, south],
                        [west, north]
                    ]]
                },
                properties: {
                    cloudCover: cloudCover,
                    row: row,
                    col: col,
                    hasData: true
                }
            });
        }
    }
    
    return {
        type: 'FeatureCollection',
        features
    };
}

let lastBoundsStr = '';
let smoothMode = true;
let subdivisionFactor = 2;

export function addLayer(map: maplibregl.Map, bounds: Bounds, opacity: number): void {
    if (!hasData) {
        return;
    }
    
    if (!map.getSource('cloud-layer-source')) {
        const geojson = smoothMode 
            ? createSmoothCloudFeatures(bounds, subdivisionFactor)
            : createCloudFeatures(bounds);
        
        if (geojson.features.length === 0) {
            return;
        }
        
        map.addSource('cloud-layer-source', {
            type: 'geojson',
            data: geojson
        });

        map.addLayer({
            id: 'cloud-layer-fill',
            type: 'fill',
            source: 'cloud-layer-source',
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'cloudCover'],
                    0, 'rgba(200, 200, 200, 0)',
                    0.1, 'rgba(200, 200, 200, 0.1)',
                    0.2, 'rgba(200, 200, 200, 0.2)',
                    0.3, 'rgba(200, 200, 200, 0.35)',
                    0.4, 'rgba(190, 190, 190, 0.5)',
                    0.5, 'rgba(185, 185, 185, 0.65)',
                    0.6, 'rgba(175, 175, 175, 0.8)',
                    0.7, 'rgba(165, 165, 165, 0.9)',
                    0.8, 'rgba(150, 150, 150, 0.95)',
                    0.9, 'rgba(140, 140, 140, 0.98)',
                    1, 'rgba(130, 130, 130, 1.0)'
                ],
                'fill-opacity': opacity
            }
        });

        map.addLayer({
            id: 'cloud-layer-outline',
            type: 'line',
            source: 'cloud-layer-source',
            paint: {
                'line-color': '#888888',
                'line-width': 0.5,
                'line-opacity': opacity * 0.3
            }
        });
        
        lastBoundsStr = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
    }
}

export function setOpacityOnly(map: maplibregl.Map, opacity: number): void {
    if (!hasData || !map.getSource('cloud-layer-source')) return;
    
    try {
        map.setPaintProperty('cloud-layer-fill', 'fill-opacity', opacity);
        map.setPaintProperty('cloud-layer-outline', 'line-opacity', opacity * 0.3);
    } catch (error) {
        console.warn('Error setting opacity:', error);
    }
}

export function updateLayer(map: maplibregl.Map, bounds: Bounds, opacity: number): void {
    if (!hasData) {
        if (map.getSource('cloud-layer-source')) {
            try {
                if (map.getLayer('cloud-layer-fill')) {
                    map.removeLayer('cloud-layer-fill');
                }
                if (map.getLayer('cloud-layer-outline')) {
                    map.removeLayer('cloud-layer-outline');
                }
                if (map.getSource('cloud-layer-source')) {
                    map.removeSource('cloud-layer-source');
                }
            } catch (e) {
                // Игнорируем ошибки удаления
            }
        }
        return;
    }
    
    if (!map.getSource('cloud-layer-source')) {
        addLayer(map, bounds, opacity);
    } else {
        const boundsKey = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
        
        if (lastBoundsStr !== boundsKey) {
            const geojson = smoothMode 
                ? createSmoothCloudFeatures(bounds, subdivisionFactor)
                : createCloudFeatures(bounds);
            
            if (geojson.features.length > 0) {
                try {
                    (map.getSource('cloud-layer-source') as maplibregl.GeoJSONSource).setData(geojson);
                    lastBoundsStr = boundsKey;
                } catch (error) {
                    console.warn('Error updating cloud data:', error);
                }
            }
        }
        
        setOpacityOnly(map, opacity);
    }
}

export function setSmoothMode(enabled: boolean): void {
    smoothMode = enabled;
}

export function setSubdivisionFactor(factor: number): void {
    subdivisionFactor = Math.max(1, Math.floor(factor));
}