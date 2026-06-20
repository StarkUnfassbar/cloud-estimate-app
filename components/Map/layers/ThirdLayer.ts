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

interface SurfaceGrid {
    rows: number;
    cols: number;
    data: number[][];
    rowLabels?: string[];
    colLabels?: string[];
}

interface CloudData {
    status?: string;
    message?: string;
    gridSize?: number;
    bounds?: Bounds;
    cloudGrid?: any;
    temperatureGrid?: any;
    surface?: SurfaceGrid;
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

const SURFACE_COLORS: Record<number, { r: number; g: number; b: number; label: string }> = {
    [-1]: { r: 0, g: 0, b: 0, label: 'undefined' },
    [0]: { r: 30, g: 144, b: 255, label: 'water' },
    [1]: { r: 173, g: 216, b: 230, label: 'sea_ice' },
    [2]: { r: 255, g: 255, b: 255, label: 'snow' },
    [3]: { r: 190, g: 190, b: 200, label: 'cloud' },
    [4]: { r: 139, g: 69, b: 19, label: 'land' },
};

function createSurfaceFeatures(bounds: Bounds): GeoJSON.FeatureCollection {
    const cloudData = getDataForBounds(bounds);
    const features: GeoJSON.Feature[] = [];
    
    if (!cloudData || !cloudData.surface || !cloudData.bounds) {
        return { type: 'FeatureCollection', features: [] };
    }

    const { surface, bounds: dataBounds } = cloudData;
    
    if (!surface.data || surface.data.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }

    const cellSizeLat = (dataBounds.north - dataBounds.south) / surface.rows;
    const cellSizeLng = (dataBounds.east - dataBounds.west) / surface.cols;

    if (cellSizeLat === 0 || cellSizeLng === 0) {
        return { type: 'FeatureCollection', features: [] };
    }

    for (let row = 0; row < surface.rows; row++) {
        const rowData = surface.data[row];
        if (!rowData) continue;

        for (let col = 0; col < surface.cols; col++) {
            const value = rowData[col];

            if (value === -1 || value === undefined) continue;

            const south = dataBounds.south + (row * cellSizeLat);
            const north = dataBounds.south + ((row + 1) * cellSizeLat);
            const west = dataBounds.west + (col * cellSizeLng);
            const east = dataBounds.west + ((col + 1) * cellSizeLng);

            const colorObj = SURFACE_COLORS[value];
            const color = colorObj ? colorObj : { r: 128, g: 128, b: 128 };

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
                    surfaceType: value,
                    surfaceLabel: SURFACE_COLORS[value]?.label || 'unknown',
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

export function addLayer(map: maplibregl.Map, bounds: Bounds, opacity: number): void {
    const cloudData = getDataForBounds(bounds);
    if (!cloudData || !cloudData.surface || !cloudData.bounds) {
        return;
    }
    
    if (!map.getSource('surface-layer-source')) {
        const geojson = createSurfaceFeatures(bounds);

        if (geojson.features.length === 0) {
            return;
        }

        map.addSource('surface-layer-source', {
            type: 'geojson',
            data: geojson
        });

        map.addLayer({
            id: 'surface-layer-fill',
            type: 'fill',
            source: 'surface-layer-source',
            paint: {
                'fill-color': [
                    'get',
                    'color'
                ],
                'fill-opacity': opacity
            }
        });

        map.addLayer({
            id: 'surface-layer-outline',
            type: 'line',
            source: 'surface-layer-source',
            paint: {
                'line-color': [
                    'match',
                    ['get', 'surfaceType'],
                    0, '#1e90ff',
                    1, '#add8e6',
                    2, '#ffffff',
                    3, '#bebec8',
                    4, '#8b4513',
                    '#808080'
                ],
                'line-width': 0.3,
                'line-opacity': opacity * 0.2
            }
        });

        lastBoundsStr = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
    }
}

export function setOpacityOnly(map: maplibregl.Map, opacity: number): void {
    if (!map.getSource('surface-layer-source')) return;

    try {
        map.setPaintProperty('surface-layer-fill', 'fill-opacity', opacity);
        map.setPaintProperty('surface-layer-outline', 'line-opacity', opacity * 0.2);
    } catch (error) {
        console.warn('Error setting opacity:', error);
    }
}

export function updateLayer(map: maplibregl.Map, bounds: Bounds, opacity: number): void {
    const cloudData = getDataForBounds(bounds);
    
    if (!cloudData || !cloudData.surface || !cloudData.bounds) {
        if (map.getSource('surface-layer-source')) {
            try {
                if (map.getLayer('surface-layer-fill')) {
                    map.removeLayer('surface-layer-fill');
                }
                if (map.getLayer('surface-layer-outline')) {
                    map.removeLayer('surface-layer-outline');
                }
                if (map.getSource('surface-layer-source')) {
                    map.removeSource('surface-layer-source');
                }
            } catch (e) {
                // Игнорируем ошибки удаления
            }
        }
        return;
    }
    
    if (!map.getSource('surface-layer-source')) {
        addLayer(map, bounds, opacity);
    } else {
        const boundsKey = `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;

        if (lastBoundsStr !== boundsKey) {
            const geojson = createSurfaceFeatures(bounds);

            if (geojson.features.length > 0) {
                try {
                    (map.getSource('surface-layer-source') as maplibregl.GeoJSONSource).setData(geojson);
                    lastBoundsStr = boundsKey;
                } catch (error) {
                    console.warn('Error updating surface data:', error);
                }
            }
        }

        setOpacityOnly(map, opacity);
    }
}