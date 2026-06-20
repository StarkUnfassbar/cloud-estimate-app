import maplibregl from 'maplibre-gl';
import cloudAreasJSON from './cloud/cloudAreas.json';
import cloudAreas1JSON from './cloud/cloudAreas1.json';
import cloudAreas2JSON from './cloud/cloudAreas2.json';
import cloudAreas3JSON from './cloud/cloudAreas3.json';

export interface Bounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface TemperatureGrid {
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
    cloudGrid?: any;
    temperatureGrid?: TemperatureGrid;
    analysis?: any;
}

// Массив всех наборов данных
const ALL_DATA_SETS: CloudData[] = [
    cloudAreasJSON as CloudData,
    cloudAreas1JSON as CloudData,
    cloudAreas2JSON as CloudData,
    cloudAreas3JSON as CloudData
];

// Функция для проверки соответствия координат
function checkBoundsMatch(
    userBounds: Bounds,
    dataBounds: { north: number; south: number; east: number; west: number },
    tolerance: number = 0.5
): boolean {
    return (
        Math.abs(userBounds.north - dataBounds.north) <= tolerance &&
        Math.abs(userBounds.south - dataBounds.south) <= tolerance &&
        Math.abs(userBounds.east - dataBounds.east) <= tolerance &&
        Math.abs(userBounds.west - dataBounds.west) <= tolerance
    );
}

// Функция для поиска подходящего файла данных
function findMatchingData(bounds: Bounds): CloudData | null {
    for (const dataSet of ALL_DATA_SETS) {
        if (dataSet.bounds && checkBoundsMatch(bounds, dataSet.bounds)) {
            return dataSet;
        }
    }
    return null;
}

// Получаем данные для текущих границ с кэшированием
let cachedData: CloudData | null = null;
let cachedBoundsKey: string = '';

function getDataForBounds(bounds: Bounds): CloudData | null {
    const boundsKey = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
    
    if (boundsKey !== cachedBoundsKey) {
        cachedBoundsKey = boundsKey;
        cachedData = findMatchingData(bounds);
    }
    
    return cachedData;
}

// Проверяет, есть ли данные для указанных границ
function hasDataForBounds(bounds: Bounds): boolean {
    const data = getDataForBounds(bounds);
    if (!data) return false;
    return data.status !== 'no_data' && 
           data.temperatureGrid !== undefined && 
           data.temperatureGrid !== null &&
           data.temperatureGrid.data !== undefined &&
           data.temperatureGrid.data !== null &&
           data.temperatureGrid.data.length > 0;
}

function getGridValue(grid: (number | null)[][] | undefined, row: number, col: number): number | null {
    if (!grid || row < 0 || row >= grid.length || col < 0 || col >= grid[row].length) {
        return null;
    }
    return grid[row][col];
}

function getTemperatureFromGrid(lat: number, lng: number, bounds: Bounds): number | null {
    const cloudData = getDataForBounds(bounds);
    if (!cloudData || !cloudData.temperatureGrid || !cloudData.bounds) {
        return null;
    }
    
    const { temperatureGrid, bounds: dataBounds } = cloudData;
    
    if (!temperatureGrid.data || temperatureGrid.data.length === 0) {
        return null;
    }
    
    if (lat < dataBounds.south || lat > dataBounds.north || lng < dataBounds.west || lng > dataBounds.east) {
        return null;
    }
    
    const latRange = dataBounds.north - dataBounds.south;
    const lngRange = dataBounds.east - dataBounds.west;
    
    if (latRange === 0 || lngRange === 0) {
        return null;
    }
    
    const latNorm = (lat - dataBounds.south) / latRange;
    const lngNorm = (lng - dataBounds.west) / lngRange;
    
    const row = Math.floor(latNorm * (temperatureGrid.rows - 1));
    const col = Math.floor(lngNorm * (temperatureGrid.cols - 1));
    
    return getGridValue(temperatureGrid.data, row, col);
}

function getTemperatureBilinear(lat: number, lng: number, bounds: Bounds): number | null {
    const cloudData = getDataForBounds(bounds);
    if (!cloudData || !cloudData.temperatureGrid || !cloudData.bounds) {
        return null;
    }
    
    const { temperatureGrid, bounds: dataBounds } = cloudData;
    
    if (!temperatureGrid.data || temperatureGrid.data.length === 0) {
        return null;
    }
    
    if (lat < dataBounds.south || lat > dataBounds.north || lng < dataBounds.west || lng > dataBounds.east) {
        return null;
    }
    
    const latRange = dataBounds.north - dataBounds.south;
    const lngRange = dataBounds.east - dataBounds.west;
    
    if (latRange === 0 || lngRange === 0) {
        return null;
    }
    
    const latNorm = (lat - dataBounds.south) / latRange;
    const lngNorm = (lng - dataBounds.west) / lngRange;
    
    const rowFloat = latNorm * (temperatureGrid.rows - 1);
    const colFloat = lngNorm * (temperatureGrid.cols - 1);
    
    const row1 = Math.floor(rowFloat);
    const col1 = Math.floor(colFloat);
    const row2 = Math.min(row1 + 1, temperatureGrid.rows - 1);
    const col2 = Math.min(col1 + 1, temperatureGrid.cols - 1);
    
    const dr = rowFloat - row1;
    const dc = colFloat - col1;
    
    const v11 = getGridValue(temperatureGrid.data, row1, col1);
    const v12 = getGridValue(temperatureGrid.data, row1, col2);
    const v21 = getGridValue(temperatureGrid.data, row2, col1);
    const v22 = getGridValue(temperatureGrid.data, row2, col2);
    
    if (v11 === null && v12 === null && v21 === null && v22 === null) {
        return null;
    }
    
    const safeV11 = v11 ?? v21 ?? v12 ?? v22 ?? 0;
    const safeV12 = v12 ?? v11 ?? v22 ?? v21 ?? 0;
    const safeV21 = v21 ?? v11 ?? v22 ?? v12 ?? 0;
    const safeV22 = v22 ?? v12 ?? v21 ?? v11 ?? 0;
    
    const top = safeV11 + (safeV12 - safeV11) * dc;
    const bottom = safeV21 + (safeV22 - safeV21) * dc;
    
    return top + (bottom - top) * dr;
}

function createTemperatureFeatures(bounds: Bounds): GeoJSON.FeatureCollection {
    const cloudData = getDataForBounds(bounds);
    const features: GeoJSON.Feature[] = [];
    
    if (!cloudData || !cloudData.temperatureGrid || !cloudData.bounds) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const { temperatureGrid, bounds: dataBounds } = cloudData;
    
    if (!temperatureGrid.data || temperatureGrid.data.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const cellSizeLat = (dataBounds.north - dataBounds.south) / temperatureGrid.rows;
    const cellSizeLng = (dataBounds.east - dataBounds.west) / temperatureGrid.cols;
    
    if (cellSizeLat === 0 || cellSizeLng === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    const tempValues: number[] = [];
    
    for (let row = 0; row < temperatureGrid.rows; row++) {
        for (let col = 0; col < temperatureGrid.cols; col++) {
            const value = temperatureGrid.data[row]?.[col];
            if (value !== null && value !== undefined) {
                if (value < minTemp) minTemp = value;
                if (value > maxTemp) maxTemp = value;
                tempValues.push(value);
            }
        }
    }
    
    if (tempValues.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const tempRange = maxTemp - minTemp;
    
    for (let row = 0; row < temperatureGrid.rows; row++) {
        for (let col = 0; col < temperatureGrid.cols; col++) {
            const value = temperatureGrid.data[row]?.[col];
            
            if (value === null || value === undefined) continue;
            
            const south = dataBounds.south + (row * cellSizeLat);
            const north = dataBounds.south + ((row + 1) * cellSizeLat);
            const west = dataBounds.west + (col * cellSizeLng);
            const east = dataBounds.west + ((col + 1) * cellSizeLng);
            
            const normalizedTemp = tempRange > 0 ? (value - minTemp) / tempRange : 0.5;
            
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
                    temperature: value,
                    normalizedTemp: Math.min(Math.max(normalizedTemp, 0), 1),
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

function createSmoothTemperatureFeatures(bounds: Bounds, subdivision: number = 2): GeoJSON.FeatureCollection {
    const cloudData = getDataForBounds(bounds);
    const features: GeoJSON.Feature[] = [];
    
    if (!cloudData || !cloudData.temperatureGrid || !cloudData.bounds) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const { temperatureGrid, bounds: dataBounds } = cloudData;
    
    if (!temperatureGrid.data || temperatureGrid.data.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const subRows = temperatureGrid.rows * subdivision;
    const subCols = temperatureGrid.cols * subdivision;
    
    const cellSizeLat = (dataBounds.north - dataBounds.south) / subRows;
    const cellSizeLng = (dataBounds.east - dataBounds.west) / subCols;
    
    if (cellSizeLat === 0 || cellSizeLng === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    const tempValues: number[] = [];
    const tempMap: Map<string, number> = new Map();
    
    for (let row = 0; row < subRows; row++) {
        for (let col = 0; col < subCols; col++) {
            const centerLat = dataBounds.south + (row * cellSizeLat) + cellSizeLat / 2;
            const centerLng = dataBounds.west + (col * cellSizeLng) + cellSizeLng / 2;
            
            const temp = getTemperatureBilinear(centerLat, centerLng, bounds);
            if (temp !== null) {
                const key = `${row},${col}`;
                tempMap.set(key, temp);
                tempValues.push(temp);
            }
        }
    }
    
    if (tempValues.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }
    
    let minTemp = Math.min(...tempValues);
    let maxTemp = Math.max(...tempValues);
    const tempRange = maxTemp - minTemp;
    
    for (let row = 0; row < subRows; row++) {
        for (let col = 0; col < subCols; col++) {
            const key = `${row},${col}`;
            const temp = tempMap.get(key);
            
            if (temp === undefined) continue;
            
            const south = dataBounds.south + (row * cellSizeLat);
            const north = dataBounds.south + ((row + 1) * cellSizeLat);
            const west = dataBounds.west + (col * cellSizeLng);
            const east = dataBounds.west + ((col + 1) * cellSizeLng);
            
            const normalizedTemp = tempRange > 0 ? (temp - minTemp) / tempRange : 0.5;
            
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
                    temperature: Math.round(temp * 10) / 10,
                    normalizedTemp: Math.min(Math.max(normalizedTemp, 0), 1),
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
    const cloudData = getDataForBounds(bounds);
    if (!cloudData || !cloudData.temperatureGrid || !cloudData.bounds) {
        return;
    }
    
    if (!map.getSource('temperature-layer-source')) {
        const geojson = smoothMode 
            ? createSmoothTemperatureFeatures(bounds, subdivisionFactor)
            : createTemperatureFeatures(bounds);
        
        if (geojson.features.length === 0) {
            return;
        }
        
        map.addSource('temperature-layer-source', {
            type: 'geojson',
            data: geojson
        });

        map.addLayer({
            id: 'temperature-layer-fill',
            type: 'fill',
            source: 'temperature-layer-source',
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'normalizedTemp'],
                    0, '#0000ff',
                    0.15, '#0066ff',
                    0.3, '#00ccff',
                    0.4, '#66ff99',
                    0.5, '#ffff00',
                    0.6, '#ffcc00',
                    0.7, '#ff8800',
                    0.85, '#ff4400',
                    1, '#ff0000'
                ],
                'fill-opacity': opacity
            }
        });

        map.addLayer({
            id: 'temperature-layer-outline',
            type: 'line',
            source: 'temperature-layer-source',
            paint: {
                'line-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'normalizedTemp'],
                    0, '#0000ff',
                    0.15, '#0066ff',
                    0.3, '#00ccff',
                    0.4, '#66ff99',
                    0.5, '#ffff00',
                    0.6, '#ffcc00',
                    0.7, '#ff8800',
                    0.85, '#ff4400',
                    1, '#ff0000'
                ],
                'line-width': 0.5,
                'line-opacity': opacity * 0.2
            }
        });
        
        map.addLayer({
            id: 'temperature-layer-contours',
            type: 'line',
            source: 'temperature-layer-source',
            paint: {
                'line-color': '#ffffff',
                'line-width': 1,
                'line-opacity': opacity * 0.3,
                'line-dasharray': [2, 2]
            },
            filter: ['has', 'temperature']
        });
        
        lastBoundsStr = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
    }
}

export function setOpacityOnly(map: maplibregl.Map, opacity: number): void {
    if (!map.getSource('temperature-layer-source')) return;
    
    try {
        map.setPaintProperty('temperature-layer-fill', 'fill-opacity', opacity);
        map.setPaintProperty('temperature-layer-outline', 'line-opacity', opacity * 0.2);
        map.setPaintProperty('temperature-layer-contours', 'line-opacity', opacity * 0.3);
    } catch (error) {
        console.warn('Error setting opacity:', error);
    }
}

export function updateLayer(map: maplibregl.Map, bounds: Bounds, opacity: number): void {
    const cloudData = getDataForBounds(bounds);
    
    if (!cloudData || !cloudData.temperatureGrid || !cloudData.bounds) {
        if (map.getSource('temperature-layer-source')) {
            try {
                if (map.getLayer('temperature-layer-fill')) {
                    map.removeLayer('temperature-layer-fill');
                }
                if (map.getLayer('temperature-layer-outline')) {
                    map.removeLayer('temperature-layer-outline');
                }
                if (map.getLayer('temperature-layer-contours')) {
                    map.removeLayer('temperature-layer-contours');
                }
                if (map.getSource('temperature-layer-source')) {
                    map.removeSource('temperature-layer-source');
                }
            } catch (e) {
                // Игнорируем ошибки удаления
            }
        }
        return;
    }
    
    if (!map.getSource('temperature-layer-source')) {
        addLayer(map, bounds, opacity);
    } else {
        const boundsKey = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
        
        if (lastBoundsStr !== boundsKey) {
            const geojson = smoothMode 
                ? createSmoothTemperatureFeatures(bounds, subdivisionFactor)
                : createTemperatureFeatures(bounds);
            
            if (geojson.features.length > 0) {
                try {
                    (map.getSource('temperature-layer-source') as maplibregl.GeoJSONSource).setData(geojson);
                    lastBoundsStr = boundsKey;
                } catch (error) {
                    console.warn('Error updating temperature data:', error);
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