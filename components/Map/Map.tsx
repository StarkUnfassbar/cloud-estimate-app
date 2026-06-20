"use client"

import { useEffect, useRef, forwardRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Bounds } from "./layers/FirstLayer";

// Импортируем все слои
import * as FirstLayer from "./layers/FirstLayer";
import * as SecondLayer from "./layers/SecondLayer";
import * as ThirdLayer from "./layers/ThirdLayer";
import * as FourthLayer from "./layers/FourthLayer";
import * as SelectedAreaLayer from "./layers/SelectedAreaLayer";

// Регистр слоев - сопоставление имени файла с его модулем
const LAYER_MODULES: Record<string, any> = {
    'FirstLayer': FirstLayer,
    'SecondLayer': SecondLayer,
    'ThirdLayer': ThirdLayer,
    'FourthLayer': FourthLayer,
    'SelectedAreaLayer': SelectedAreaLayer,
};

export interface LayerConfig {
    layerFile: string;
    opacity: number;
}

interface MapProps {
    initialCoordinates: {
        lng: number;
        lat: number;
    };
    bounds?: Bounds;
    layers?: LayerConfig[];
}

// Хук для debounce
function useDebounce<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    return useCallback((...args: Parameters<T>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]) as T;
}

const Map = forwardRef<maplibregl.Map | null, MapProps>(({ initialCoordinates, bounds, layers = [] }, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<maplibregl.Map | null>(null);
    const isInitialized = useRef(false);
    const addedLayers = useRef<Set<string>>(new Set());
    const isUpdating = useRef(false);
    const prevBoundsRef = useRef<Bounds | null>(null);

    // Создаем debounced версию fitBounds
    const debouncedFitBounds = useDebounce((boundsArray: [maplibregl.LngLatLike, maplibregl.LngLatLike]) => {
        if (mapInstanceRef.current && !isUpdating.current) {
            isUpdating.current = true;
            mapInstanceRef.current.fitBounds(boundsArray, { 
                padding: 50,
                duration: 300
            });
            setTimeout(() => {
                isUpdating.current = false;
            }, 400);
        }
    }, 250);

    useEffect(() => {
        if (!mapContainer.current || isInitialized.current) return;
        
        isInitialized.current = true;

        mapInstanceRef.current = new maplibregl.Map({
            container: mapContainer.current,
            style: "https://tiles.openfreemap.org/styles/liberty",
            center: [initialCoordinates.lng, initialCoordinates.lat],
            zoom: bounds ? 8 : 15,
        });

        mapInstanceRef.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

        // Передаем экземпляр карты в ref
        if (ref && typeof ref === 'object') {
            ref.current = mapInstanceRef.current;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                isInitialized.current = false;
                addedLayers.current.clear();
                if (ref && typeof ref === 'object') {
                    ref.current = null;
                }
            }
        };
    }, [initialCoordinates.lng, initialCoordinates.lat]);

    useEffect(() => {
        if (!mapInstanceRef.current || !bounds) return;

        const updateLayers = () => {
            if (!mapInstanceRef.current) return;

            // Сначала обновляем SelectedAreaLayer (он не зависит от opacity)
            const hasSelectedArea = layers.some(l => l.layerFile === 'SelectedAreaLayer');
            
            if (hasSelectedArea && bounds) {
                if (!addedLayers.current.has('SelectedAreaLayer')) {
                    SelectedAreaLayer.addLayer(mapInstanceRef.current, bounds);
                    addedLayers.current.add('SelectedAreaLayer');
                } else {
                    SelectedAreaLayer.updateLayer(mapInstanceRef.current, bounds);
                }
            } else if (addedLayers.current.has('SelectedAreaLayer')) {
                try {
                    if (mapInstanceRef.current.getLayer('selected-area-layer')) {
                        mapInstanceRef.current.removeLayer('selected-area-layer');
                    }
                    if (mapInstanceRef.current.getSource('selected-area-source')) {
                        mapInstanceRef.current.removeSource('selected-area-source');
                    }
                    addedLayers.current.delete('SelectedAreaLayer');
                } catch (e) {
                    console.warn('Error removing SelectedAreaLayer:', e);
                }
            }

            // Обновляем остальные слои (с opacity)
            layers.forEach((layer) => {
                if (layer.layerFile === 'SelectedAreaLayer') return;
                
                const layerModule = LAYER_MODULES[layer.layerFile];
                if (!layerModule) {
                    console.warn(`Layer module "${layer.layerFile}" not found`);
                    return;
                }

                if (!addedLayers.current.has(layer.layerFile)) {
                    layerModule.addLayer(mapInstanceRef.current, bounds, layer.opacity);
                    addedLayers.current.add(layer.layerFile);
                } else {
                    if (layerModule.setOpacityOnly) {
                        layerModule.setOpacityOnly(mapInstanceRef.current, layer.opacity);
                    } else {
                        layerModule.updateLayer(mapInstanceRef.current, bounds, layer.opacity);
                    }
                }
            });

            // Проверяем, изменились ли границы
            const currentBounds = mapInstanceRef.current.getBounds();
            const isBoundsChanged = !prevBoundsRef.current ||
                Math.abs(prevBoundsRef.current.north - bounds.north) > 0.0001 ||
                Math.abs(prevBoundsRef.current.south - bounds.south) > 0.0001 ||
                Math.abs(prevBoundsRef.current.east - bounds.east) > 0.0001 ||
                Math.abs(prevBoundsRef.current.west - bounds.west) > 0.0001;

            if (isBoundsChanged) {
                prevBoundsRef.current = bounds;
                const boundsArray: [maplibregl.LngLatLike, maplibregl.LngLatLike] = [
                    [bounds.west, bounds.south],
                    [bounds.east, bounds.north]
                ];
                debouncedFitBounds(boundsArray);
            }
        };

        if (mapInstanceRef.current.loaded()) {
            updateLayers();
        } else {
            mapInstanceRef.current.once('load', updateLayers);
        }
    }, [bounds, layers, debouncedFitBounds]);

    return <div ref={mapContainer} style={{ width: "100%", height: "100vh" }} />;
});

Map.displayName = 'Map';

export default Map;