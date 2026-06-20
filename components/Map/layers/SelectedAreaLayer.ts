// SelectedAreaLayer.ts
import maplibregl from 'maplibre-gl';

export interface Bounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

export function addLayer(map: maplibregl.Map, bounds: Bounds): void {
    // Удаляем старый слой если он существует
    if (map.getSource('selected-area-source')) {
        try {
            map.removeLayer('selected-area-layer');
            map.removeSource('selected-area-source');
        } catch (e) {
            // Игнорируем ошибки при удалении
        }
    }

    // Создаем GeoJSON с границей выбранной области
    const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [bounds.west, bounds.north],
                    [bounds.east, bounds.north],
                    [bounds.east, bounds.south],
                    [bounds.west, bounds.south],
                    [bounds.west, bounds.north]
                ]]
            },
            properties: {}
        }]
    };

    map.addSource('selected-area-source', {
        type: 'geojson',
        data: geojson
    });

    // Добавляем слой с границей
    map.addLayer({
        id: 'selected-area-layer',
        type: 'line',
        source: 'selected-area-source',
        paint: {
            'line-color': '#FF4444',
            'line-width': 3,
            'line-dasharray': [6, 4]
        }
    });
}

export function updateLayer(map: maplibregl.Map, bounds: Bounds): void {
    if (map.getSource('selected-area-source')) {
        const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [bounds.west, bounds.north],
                        [bounds.east, bounds.north],
                        [bounds.east, bounds.south],
                        [bounds.west, bounds.south],
                        [bounds.west, bounds.north]
                    ]]
                },
                properties: {}
            }]
        };
        (map.getSource('selected-area-source') as maplibregl.GeoJSONSource).setData(geojson);
    } else {
        addLayer(map, bounds);
    }
}