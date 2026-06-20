import maplibregl from 'maplibre-gl';
import cloudAreasJSON from './cloud/cloudAreas.json';

export interface Bounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface SpectralData {
    bands: string[];
    data: number[][][];
    rows: number;
    cols: number;
}

interface CloudData {
    status?: string;
    message?: string;
    gridSize?: number;
    bounds?: Bounds;
    cloudGrid?: any;
    temperatureGrid?: any;
    surface?: any;
    spectralGrids?: SpectralData;
    analysis?: any;
}

const rawData = cloudAreasJSON as any;
const cloudData: CloudData = {
    status: rawData.status || 'data_available',
    message: rawData.message || '',
    gridSize: rawData.gridSize || 50,
    bounds: rawData.bounds,
    cloudGrid: rawData.cloudGrid,
    temperatureGrid: rawData.temperatureGrid,
    surface: rawData.surface,
    spectralGrids: rawData.spectralGrids,
    analysis: rawData.analysis
};

const hasData = cloudData.status !== 'no_data' && 
                cloudData.spectralGrids && 
                cloudData.spectralGrids.data && 
                cloudData.spectralGrids.data.length > 0;

let selectedBandIndex = 0;

function getSpectralColor(value: number, minVal: number, maxVal: number): { r: number; g: number; b: number } {
    if (value === null || value === undefined) {
        return { r: 128, g: 128, b: 128 };
    }
    
    let normalized = (value - minVal) / (maxVal - minVal);
    normalized = Math.min(Math.max(normalized, 0), 1);
    
    let r: number, g: number, b: number;
    
    if (normalized < 0.25) {
        const t = normalized / 0.25;
        r = 0;
        g = t * 255;
        b = 255;
    } else if (normalized < 0.5) {
        const t = (normalized - 0.25) / 0.25;
        r = 0;
        g = 255;
        b = (1 - t) * 255;
    } else if (normalized < 0.75) {
        const t = (normalized - 0.5) / 0.25;
        r = t * 255;
        g = 255;
        b = 0;
    } else {
        const t = (normalized - 0.75) / 0.25;
        r = 255;
        g = (1 - t) * 255;
        b = 0;
    }
    
    return { r, g, b };
}

function getSpectralValue(bandIndex: number, row: number, col: number): number | null {
    const { spectralGrids } = cloudData;
    if (!hasData || !spectralGrids || !spectralGrids.data || spectralGrids.data.length === 0) {
        return null;
    }
    if (bandIndex < 0 || bandIndex >= spectralGrids.data.length) {
        return null;
    }
    const bandData = spectralGrids.data[bandIndex];
    if (!bandData || row < 0 || row >= bandData.length || col < 0 || col >= bandData[row].length) {
        return null;
    }
    return bandData[row][col];
}

function createSpectralFeatures(bounds: Bounds, bandIndex: number): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    const { spectralGrids } = cloudData;
    
    if (!hasData || !spectralGrids || !spectralGrids.data || spectralGrids.data.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const bandData = spectralGrids.data[bandIndex];
    if (!bandData || bandData.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const rows = spectralGrids.rows || bandData.length;
    const cols = spectralGrids.cols || (bandData[0]?.length || 0);
    
    const cellSizeLat = (bounds.north - bounds.south) / rows;
    const cellSizeLng = (bounds.east - bounds.west) / cols;
    
    if (cellSizeLat === 0 || cellSizeLng === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const values: number[] = [];
    for (let row = 0; row < Math.min(rows, bandData.length); row++) {
        const rowData = bandData[row];
        if (!rowData) continue;
        for (let col = 0; col < Math.min(cols, rowData.length); col++) {
            const val = rowData[col];
            if (val !== null && val !== undefined && !isNaN(val)) {
                values.push(val);
            }
        }
    }
    
    if (values.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    const range = maxVal - minVal;
    
    if (range === 0) {
        minVal = minVal - 0.1;
        maxVal = maxVal + 0.1;
    }
    
    const bandName = spectralGrids.bands?.[bandIndex] || `Band ${bandIndex + 1}`;
    
    for (let row = 0; row < Math.min(rows, bandData.length); row++) {
        const rowData = bandData[row];
        if (!rowData) continue;
        
        for (let col = 0; col < Math.min(cols, rowData.length); col++) {
            const value = rowData[col];
            
            if (value === null || value === undefined || isNaN(value)) continue;
            
            const south = bounds.south + (row * cellSizeLat);
            const north = bounds.south + ((row + 1) * cellSizeLat);
            const west = bounds.west + (col * cellSizeLng);
            const east = bounds.west + ((col + 1) * cellSizeLng);
            
            const color = getSpectralColor(value, minVal, maxVal);
            
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
                    spectralValue: value,
                    normalizedValue: (value - minVal) / (maxVal - minVal),
                    band: bandName,
                    bandIndex: bandIndex,
                    color: `rgb(${color.r}, ${color.g}, ${color.b})`,
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
let lastBandIndex = -1;

export function addLayer(map: maplibregl.Map, bounds: Bounds, opacity: number): void {
    if (!hasData) {
        return;
    }
    
    if (!map.getSource('spectral-layer-source')) {
        const geojson = createSpectralFeatures(bounds, selectedBandIndex);
        
        if (geojson.features.length === 0) {
            return;
        }
        
        map.addSource('spectral-layer-source', {
            type: 'geojson',
            data: geojson
        });

        map.addLayer({
            id: 'spectral-layer-fill',
            type: 'fill',
            source: 'spectral-layer-source',
            paint: {
                'fill-color': [
                    'get',
                    'color'
                ],
                'fill-opacity': opacity
            }
        });

        map.addLayer({
            id: 'spectral-layer-outline',
            type: 'line',
            source: 'spectral-layer-source',
            paint: {
                'line-color': '#ffffff',
                'line-width': 0.3,
                'line-opacity': opacity * 0.15
            }
        });
        
        lastBoundsStr = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
        lastBandIndex = selectedBandIndex;
    }
}

export function setOpacityOnly(map: maplibregl.Map, opacity: number): void {
    if (!hasData || !map.getSource('spectral-layer-source')) return;
    
    try {
        map.setPaintProperty('spectral-layer-fill', 'fill-opacity', opacity);
        map.setPaintProperty('spectral-layer-outline', 'line-opacity', opacity * 0.15);
    } catch (error) {
        console.warn('Error setting opacity:', error);
    }
}

export function updateLayer(map: maplibregl.Map, bounds: Bounds, opacity: number): void {
    if (!hasData) {
        if (map.getSource('spectral-layer-source')) {
            try {
                if (map.getLayer('spectral-layer-fill')) {
                    map.removeLayer('spectral-layer-fill');
                }
                if (map.getLayer('spectral-layer-outline')) {
                    map.removeLayer('spectral-layer-outline');
                }
                if (map.getSource('spectral-layer-source')) {
                    map.removeSource('spectral-layer-source');
                }
            } catch (e) {
                // Игнорируем ошибки удаления
            }
        }
        return;
    }
    
    if (!map.getSource('spectral-layer-source')) {
        addLayer(map, bounds, opacity);
    } else {
        const boundsKey = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
        
        if (lastBoundsStr !== boundsKey || lastBandIndex !== selectedBandIndex) {
            const geojson = createSpectralFeatures(bounds, selectedBandIndex);
            
            if (geojson.features.length > 0) {
                try {
                    (map.getSource('spectral-layer-source') as maplibregl.GeoJSONSource).setData(geojson);
                    lastBoundsStr = boundsKey;
                    lastBandIndex = selectedBandIndex;
                } catch (error) {
                    console.warn('Error updating spectral data:', error);
                }
            }
        }
        
        setOpacityOnly(map, opacity);
    }
}

export function setSelectedBand(index: number): void {
    selectedBandIndex = Math.max(0, index);
}

export function getSelectedBand(): number {
    return selectedBandIndex;
}

export function getAvailableBands(): string[] {
    const { spectralGrids } = cloudData;
    return spectralGrids?.bands || [];
}