"use client";

import { useSearchParams } from 'next/navigation';
import dynamic from "next/dynamic";
import { useState, Suspense, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import { ClipLoader } from 'react-spinners';

import styles from './page.module.css';

import HeaderSelect from '../../components/HeaderSelect/HeaderSelect';
import CoordinatesInput from '../../components/CoordinatesInput/CoordinatesInput';
import CustomRange from '../../components/CustomRange/CustomRange';
import MapTypeSelect from '../../components/MapTypeSelect/MapTypeSelect';
import { DownloadButton } from '../../components/DownloadMap/DownloadMap';

// Импортируем JSON данные
import cloudData from '../../components/Map/layers/cloud/cloudAreas.json';
import cloudData1 from '../../components/Map/layers/cloud/cloudAreas1.json';
import cloudData2 from '../../components/Map/layers/cloud/cloudAreas2.json';
import cloudData3 from '../../components/Map/layers/cloud/cloudAreas3.json';

const MapComponent = dynamic(() => import("../../components/Map/Map"), {
    ssr: false,
    loading: () => (
        <div style={{ 
            width: '100%', 
            height: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#f0f0f0',
            fontSize: '18px'
        }}>
            Загрузка карты...
        </div>
    )
});

// Тип для данных
interface CloudData {
    status: string;
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    analysis: any;
    cloudGrid: any;
    temperatureGrid: any;
    surface?: any;
    spectralGrids?: any;
}

// Массив всех доступных наборов данных
const ALL_DATA_SETS: CloudData[] = [
    cloudData as CloudData,
    cloudData1 as CloudData,
    cloudData2 as CloudData,
    cloudData3 as CloudData
];

// Функция для проверки соответствия координат
function checkBoundsMatch(
    userBounds: { north: string; south: string; east: string; west: string },
    dataBounds: { north: number; south: number; east: number; west: number },
    tolerance: number = 0.5
): boolean {
    const userNorth = parseFloat(userBounds.north);
    const userSouth = parseFloat(userBounds.south);
    const userEast = parseFloat(userBounds.east);
    const userWest = parseFloat(userBounds.west);

    if (isNaN(userNorth) || isNaN(userSouth) || isNaN(userEast) || isNaN(userWest)) {
        return false;
    }

    return (
        Math.abs(userNorth - dataBounds.north) <= tolerance &&
        Math.abs(userSouth - dataBounds.south) <= tolerance &&
        Math.abs(userEast - dataBounds.east) <= tolerance &&
        Math.abs(userWest - dataBounds.west) <= tolerance
    );
}

// Функция для поиска подходящего файла данных
function findMatchingData(
    coordinates: { north: string; south: string; east: string; west: string }
): CloudData | null {
    for (const dataSet of ALL_DATA_SETS) {
        if (checkBoundsMatch(coordinates, dataSet.bounds)) {
            return dataSet;
        }
    }
    return null;
}

function MapContent() {
    const searchParams = useSearchParams();
    const mapRef = useRef<maplibregl.Map | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [mapKey, setMapKey] = useState(0);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [rawData, setRawData] = useState<any>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [dataFound, setDataFound] = useState<boolean>(true);

    const north = searchParams.get('north');
    const south = searchParams.get('south');
    const east = searchParams.get('east');
    const west = searchParams.get('west');

    const dataSourceFromUrl = searchParams.get('dataSource');
    
    const dateFromUrl = searchParams.get('date');
    const timeFromUrl = searchParams.get('time');

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [selectedMapType, setSelectedMapType] = useState('cloud');

    const dataSourceOptions = [
        { value: 'nasa', label: 'NASA', recommended: true },
        { value: 'roscosmos', label: 'Роскосмос' },
        { value: 'eumetsat', label: 'EUMETSAT' },
        { value: 'copernicus', label: 'Copernicus' }
    ];

    const [selectedDataSource, setSelectedDataSource] = useState(
        dataSourceFromUrl && dataSourceOptions.some(opt => opt.value === dataSourceFromUrl) 
            ? dataSourceFromUrl 
            : 'nasa'
    );

    const [coordinates, setCoordinates] = useState({
        north: north || '40.7128',
        south: south || '40.0000',
        east: east || '74.0060',
        west: west || '74.0000'
    });

    const [selectedDate, setSelectedDate] = useState(dateFromUrl || '');
    const [selectedTime, setSelectedTime] = useState(timeFromUrl || '');

    const [tempDate, setTempDate] = useState(dateFromUrl || '');
    const [tempTime, setTempTime] = useState(timeFromUrl || '');

    // Функция для загрузки данных из JSON файла по координатам
    const loadDataFromJSON = useCallback(() => {
        try {
            setLoadError(null);
            
            const matchedData = findMatchingData(coordinates);
            
            if (!matchedData) {
                setDataFound(false);
                setRawData({ status: 'no_data' });
                
                const defaultAnalysis = {
                    cloudPercentage: null,
                    verdict: { 
                        status: 'no_data', 
                        title: 'Данные не найдены', 
                        description: 'Для указанных координат нет доступных данных' 
                    },
                    temperature: { max: null, avg: null },
                    dynamics: { 
                        status: 'unknown', 
                        title: 'Нет данных', 
                        description: '' 
                    }
                };
                
                setAnalysisData(defaultAnalysis);
                setIsLoading(false);
                return null;
            }
            
            setDataFound(true);
            
            const data = matchedData;
            
            setRawData(data);
            
            const analysis = data.analysis || {
                cloudPercentage: null,
                verdict: { status: 'no_data', title: 'Нет данных', description: 'Не удалось получить данные для указанной даты' },
                temperature: { max: null, avg: null },
                dynamics: { status: 'unknown', title: 'Нет данных', description: '' }
            };
            
            setAnalysisData(analysis);
            
            setIsLoading(false);
            
            return data;
        } catch (error) {
            console.error('Error loading cloud data from JSON:', error);
            setLoadError(error instanceof Error ? error.message : 'Ошибка загрузки данных');
            setDataFound(false);
            
            const defaultAnalysis = {
                cloudPercentage: null,
                verdict: { 
                    status: 'no_data', 
                    title: 'Ошибка загрузки', 
                    description: 'Не удалось загрузить данные' 
                },
                temperature: { max: null, avg: null },
                dynamics: { status: 'unknown', title: 'Ошибка', description: '' }
            };
            
            setAnalysisData(defaultAnalysis);
            setRawData({ status: 'no_data' });
            setIsLoading(false);
            
            throw error;
        }
    }, [coordinates]);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            loadDataFromJSON();
        }, 1500);
        
        return () => clearTimeout(timer);
    }, [coordinates, loadDataFromJSON]);

    const dateInputRef = useRef<HTMLInputElement>(null);
    const timeInputRef = useRef<HTMLInputElement>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);

    const [baseLayers] = useState([
        { id: 'selectedArea', layerFile: 'SelectedAreaLayer', label: 'Выбранная область', opacity: 1 },
    ]);

    const [analysisLayers, setAnalysisLayers] = useState([
        { id: 'cloud', layerFile: 'FirstLayer', label: 'Облачность', opacity: 1 },
        { id: 'temperature', layerFile: 'SecondLayer', label: 'Температурная карта', opacity: 0 },
        { id: 'surface', layerFile: 'ThirdLayer', label: 'Композит ЛВО', opacity: 0 },
        { id: 'spectral', layerFile: 'FourthLayer', label: 'Спектральная карта', opacity: 0 },
    ]);

    const [isMapTypeChanging, setIsMapTypeChanging] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMobileMenuOpen(false);
            }
        };

        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };

        if (isMobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscKey);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen]);

    let bounds = undefined;
    let centerCoordinates = {
        lng: 37.618423,
        lat: 55.751244
    };

    if (north && south && east && west) {
        const northNum = parseFloat(north);
        const southNum = parseFloat(south);
        const eastNum = parseFloat(east);
        const westNum = parseFloat(west);
        
        if (!isNaN(northNum) && !isNaN(southNum) && !isNaN(eastNum) && !isNaN(westNum)) {
            centerCoordinates = {
                lng: (eastNum + westNum) / 2,
                lat: (northNum + southNum) / 2
            };
            
            bounds = {
                north: northNum,
                south: southNum,
                east: eastNum,
                west: westNum
            };
        }
    }

    const reloadData = useCallback(() => {
        setIsLoading(true);
        setMapKey(prev => prev + 1);
        mapRef.current = null;
        setAnalysisData(null);
        setRawData(null);
        setDataFound(true);
    }, []);

    const applyDateTimeChanges = useCallback(() => {
        if (tempDate !== selectedDate || tempTime !== selectedTime) {
            setSelectedDate(tempDate);
            setSelectedTime(tempTime);
            reloadData();
        }
    }, [tempDate, tempTime, selectedDate, selectedTime, reloadData]);

    const handleDateTimeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyDateTimeChanges();
        }
    }, [applyDateTimeChanges]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (inputWrapperRef.current && !inputWrapperRef.current.contains(event.target as Node)) {
                applyDateTimeChanges();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [applyDateTimeChanges]);

    const toggleLayerVisibility = (layerId: string) => {
        setAnalysisLayers(prevLayers => 
            prevLayers.map(layer => 
                layer.id === layerId 
                    ? { ...layer, opacity: layer.opacity === 1 ? 0 : 1 }
                    : layer
            )
        );
    };

    const handleMapTypeChange = (config: number[]) => {
        setIsMapTypeChanging(true);
        setAnalysisLayers(prevLayers => 
            prevLayers.map((layer, index) => ({
                ...layer,
                opacity: config[index] !== undefined ? config[index] : layer.opacity
            }))
        );
        setTimeout(() => setIsMapTypeChanging(false), 0);
    };

    const allLayers = [...baseLayers, ...analysisLayers];

    const activeLayers = allLayers.map(layer => ({
        layerFile: layer.layerFile,
        opacity: layer.opacity
    }));

    useEffect(() => {
        if (isLoading) return;
        
        const params = new URLSearchParams();
        
        if (coordinates.north) params.set('north', coordinates.north);
        if (coordinates.south) params.set('south', coordinates.south);
        if (coordinates.east) params.set('east', coordinates.east);
        if (coordinates.west) params.set('west', coordinates.west);
        if (selectedDataSource) params.set('dataSource', selectedDataSource);
        if (selectedDate) params.set('date', selectedDate);
        if (selectedTime) params.set('time', selectedTime);
        
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({}, '', newUrl);
    }, [coordinates, selectedDataSource, selectedDate, selectedTime, isLoading]);

    const handleCoordinatesChange = (newCoordinates: typeof coordinates) => {
        setCoordinates(newCoordinates);
        reloadData();
    };

    const handleTempDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempDate(e.target.value);
    };

    const handleTempTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempTime(e.target.value);
    };

    const handleDataSourceChange = (value: string) => {
        setSelectedDataSource(value);
        reloadData();
    };

    const getAnalysisData = () => {
        if (!analysisData) {
            return {
                cloudPercentage: null,
                verdict: { status: 'no_data', title: 'Загрузка...', description: 'Данные загружаются' },
                temperature: { max: null, avg: null },
                dynamics: { status: 'unknown', title: 'Загрузка', description: '' }
            };
        }
        return analysisData;
    };

    const getRawData = () => {
        if (!rawData) {
            return { status: 'no_data' };
        }
        return rawData;
    };

    const currentAnalysisData = getAnalysisData();
    const currentRawData = getRawData();
    const hasData = currentRawData.status !== 'no_data' && dataFound;

    const verdictState = currentAnalysisData.verdict.status;
    const dynamicsState = currentAnalysisData.dynamics.status;

    const cloudPercentage = currentAnalysisData.cloudPercentage;
    const maxTemp = currentAnalysisData.temperature.max;
    const avgTemp = currentAnalysisData.temperature.avg;
    
    const getTemperatureState = (value: number, type: 'max' | 'avg'): 'low' | 'medium' | 'high' => {
        if (type === 'max') {
            if (value < 15) return 'low';
            if (value < 25) return 'medium';
            return 'high';
        } else {
            if (value < 5) return 'low';
            if (value < 15) return 'medium';
            return 'high';
        }
    };

    const maxTempState = maxTemp !== null ? getTemperatureState(maxTemp, 'max') : 'no-data';
    const avgTempState = avgTemp !== null ? getTemperatureState(avgTemp, 'avg') : 'no-data';

    const CloudLayersContent = () => (
        <div className={styles['cloud-layers']}>
            <div className={styles['type-analysis']}>
                <p>Тип карты</p>
                
                <MapTypeSelect 
                    layersCount={analysisLayers.length}
                    onLayerConfigChange={handleMapTypeChange}
                    value={selectedMapType}
                    onChange={setSelectedMapType}
                />
            </div>

            <div className={styles['layers-analysis']}>
                <span>Слои</span>

                {analysisLayers.map((layer) => (
                    <div key={layer.id} className={styles['layer-visibility']}>
                        <div className={styles['upper-part']}>
                            <p>{layer.label}</p>

                            <button 
                                className={styles['enable-visible']}
                                onClick={() => toggleLayerVisibility(layer.id)}
                                data-visible={layer.opacity === 1}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 11" fill="none">
                                    <path d="M4.84766 5.5C4.84766 6.88071 5.96694 8 7.34766 8C8.72837 8 9.84766 6.88071 9.84766 5.5C9.84766 4.11929 8.72837 3 7.34766 3C5.96694 3 4.84766 4.11929 4.84766 5.5Z" stroke="white" strokeLinecap="round"/>
                                    <path d="M7.59766 0.5C4.00417 0.5 1.47784 3.77617 0.645592 5.02462C0.451971 5.31507 0.451971 5.68493 0.645592 5.97538C1.47784 7.22383 4.00417 10.5 7.59766 10.5C11.1911 10.5 13.7175 7.22383 14.5497 5.97538C14.7433 5.68493 14.7433 5.31507 14.5497 5.02462C13.7175 3.77617 11.1911 0.5 7.59766 0.5Z" stroke="white" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>

                        <div className={styles['down-part']}>
                            <CustomRange 
                                value={layer.opacity}
                                onChange={(newValue) => {
                                    setAnalysisLayers(prevLayers => 
                                        prevLayers.map(l => 
                                            l.id === layer.id 
                                                ? { ...l, opacity: newValue }
                                                : l
                                        )
                                    );
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const FinishAnalysisContent = () => (
        <div className={styles['finish-analysis']}>
            <DownloadButton
                mapRef={mapRef}
                analysisData={currentAnalysisData}
                bounds={bounds}
                coordinates={coordinates}
                selectedDataSource={selectedDataSource}
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                layers={analysisLayers}
                className={styles['button-download']}
            />

            <div className={styles['result-analysis']}>
                <h3>Результаты анализа</h3>

                {!dataFound ? (
                    <p>Данные не найдены для указанных координат</p>
                ) : (
                    <>
                        <div className={styles['percentage']}>
                            <span>Процент облачности</span>
                            <h1>{cloudPercentage !== null ? cloudPercentage + '%' : '—'}</h1>
                        </div>

                        <div className={`${styles['verdict']} ${styles[verdictState]}`}>
                            <span>Вердикт</span>

                            <div className={styles['text']}>
                                <h4>{currentAnalysisData.verdict.title}</h4>
                                <p>{currentAnalysisData.verdict.description}</p>
                            </div>
                        </div>

                        <div className={styles['temperature']}>
                            <span>Температурные показатели</span>

                            <div className={styles['temperature-indicators']}>
                                <div className={`${styles['indicator']} ${styles[maxTempState]}`}>
                                    <span>Макс. температура</span>
                                    <p>{maxTemp !== null ? maxTemp + ' °C' : '—'}</p>
                                </div>

                                <div className={`${styles['indicator']} ${styles[avgTempState]}`}>
                                    <span>Сред. температура</span>
                                    <p>{avgTemp !== null ? avgTemp + ' °C' : '—'}</p>
                                </div>
                            </div>
                        </div>

                        <div className={`${styles['dynamics']} ${styles[dynamicsState]}`}>
                            <span>Динамика облачности</span>

                            <div className={styles['text']}>
                                <h4>{currentAnalysisData.dynamics.title}</h4>
                                <p>{currentAnalysisData.dynamics.description}</p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className={styles['loading-overlay']}>
                <div className={styles['loading-content']}>
                    <ClipLoader
                        color="#FC7644"
                        size={60}
                        speedMultiplier={1}
                    />
                    <p>{loadError ? 'Ошибка загрузки. Повторная попытка...' : 'Поиск данных для указанных координат...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles['map-page']}>
            <div className={styles['map-wrapper']}>
                <MapComponent 
                    key={mapKey}
                    ref={mapRef}
                    initialCoordinates={centerCoordinates} 
                    bounds={bounds}
                    layers={activeLayers}
                />
            </div>

            <div className={styles['ui-overlay']}>
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <Link href="/" className={styles['icon']}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 277 54" fill="none">
                                <path d="M7.46484 47.8965H8.30566C8.2373 48.5664 8.05273 49.1452 7.75195 49.6328C7.45117 50.1159 7.04102 50.4873 6.52148 50.7471C6.00195 51.0068 5.37533 51.1367 4.6416 51.1367C4.0765 51.1367 3.5638 51.0296 3.10352 50.8154C2.64779 50.6012 2.25586 50.2982 1.92773 49.9062C1.59961 49.5098 1.34668 49.0358 1.16895 48.4844C0.991211 47.9329 0.902344 47.32 0.902344 46.6455V45.4014C0.902344 44.7269 0.991211 44.1162 1.16895 43.5693C1.34668 43.0179 1.60189 42.5439 1.93457 42.1475C2.26725 41.751 2.66602 41.4456 3.13086 41.2314C3.5957 41.0173 4.11979 40.9102 4.70312 40.9102C5.40951 40.9102 6.02018 41.04 6.53516 41.2998C7.05013 41.555 7.45573 41.9242 7.75195 42.4072C8.05273 42.8903 8.2373 43.4736 8.30566 44.1572H7.46484C7.40104 43.6195 7.25977 43.1637 7.04102 42.79C6.82227 42.4163 6.51921 42.1315 6.13184 41.9355C5.74902 41.735 5.27279 41.6348 4.70312 41.6348C4.23828 41.6348 3.82357 41.7236 3.45898 41.9014C3.0944 42.0791 2.78451 42.3343 2.5293 42.667C2.27409 42.9951 2.07812 43.3893 1.94141 43.8496C1.80924 44.3099 1.74316 44.8226 1.74316 45.3877V46.6455C1.74316 47.1924 1.80697 47.696 1.93457 48.1562C2.06217 48.6165 2.24902 49.0153 2.49512 49.3525C2.74577 49.6898 3.05111 49.9518 3.41113 50.1387C3.77116 50.3255 4.18132 50.4189 4.6416 50.4189C5.22949 50.4189 5.7194 50.3255 6.11133 50.1387C6.50781 49.9473 6.81543 49.6647 7.03418 49.291C7.25293 48.9173 7.39648 48.4525 7.46484 47.8965ZM15.1758 43.6035V44.3145H10.8486V43.6035H15.1758ZM11.0332 43.6035V51H10.2197V43.6035H11.0332ZM15.8457 43.6035V51H15.0254V43.6035H15.8457ZM20.2344 50.2617L22.5381 43.6035H23.4199L20.2891 52.1895C20.2253 52.3581 20.1432 52.5449 20.043 52.75C19.9473 52.9551 19.8197 53.151 19.6602 53.3379C19.5052 53.5293 19.3092 53.6842 19.0723 53.8027C18.8398 53.9258 18.555 53.9873 18.2178 53.9873C18.1312 53.9873 18.0195 53.9759 17.8828 53.9531C17.7507 53.9349 17.6549 53.9167 17.5957 53.8984L17.5889 53.208C17.639 53.2217 17.7119 53.2331 17.8076 53.2422C17.9033 53.2513 17.9694 53.2559 18.0059 53.2559C18.3021 53.2559 18.5505 53.2057 18.751 53.1055C18.9561 53.0052 19.127 52.8548 19.2637 52.6543C19.4004 52.4583 19.5212 52.2122 19.626 51.916L20.2344 50.2617ZM18.0811 43.6035L20.4395 49.9541L20.6582 50.8086L20.0635 51.1436L17.1924 43.6035H18.0811ZM27.3096 43.6035V51H26.4961V43.6035H27.3096ZM30.0029 43.6035V44.3008H23.8984V43.6035H30.0029ZM36.4014 46.9121V47.6094H32.0127V46.9121H36.4014ZM32.2246 43.6035V51H31.4111V43.6035H32.2246ZM37.0303 43.6035V51H36.21V43.6035H37.0303ZM40.0928 49.6738L44.0918 43.6035H44.9121V51H44.0918V44.9297L40.0928 51H39.2861V43.6035H40.0928V49.6738ZM47.9746 43.6035V51H47.1543V43.6035H47.9746ZM52.8418 43.6035L49.4512 47.6094H47.6875L47.5986 46.8779H49.1025L51.8096 43.6035H52.8418ZM52.1035 51L49.0205 47.5L49.54 46.8711L53.1836 51H52.1035ZM53.7783 47.418V47.1924C53.7783 46.6546 53.8558 46.1579 54.0107 45.7021C54.1657 45.2464 54.3867 44.8522 54.6738 44.5195C54.9655 44.1868 55.3141 43.9294 55.7197 43.7471C56.1253 43.5602 56.5765 43.4668 57.0732 43.4668C57.5745 43.4668 58.028 43.5602 58.4336 43.7471C58.8392 43.9294 59.1878 44.1868 59.4795 44.5195C59.7712 44.8522 59.9945 45.2464 60.1494 45.7021C60.3044 46.1579 60.3818 46.6546 60.3818 47.1924V47.418C60.3818 47.9557 60.3044 48.4525 60.1494 48.9082C59.9945 49.3594 59.7712 49.7513 59.4795 50.084C59.1924 50.4167 58.846 50.6764 58.4404 50.8633C58.0348 51.0456 57.5837 51.1367 57.0869 51.1367C56.5856 51.1367 56.1322 51.0456 55.7266 50.8633C55.321 50.6764 54.9723 50.4167 54.6807 50.084C54.389 49.7513 54.1657 49.3594 54.0107 48.9082C53.8558 48.4525 53.7783 47.9557 53.7783 47.418ZM54.5918 47.1924V47.418C54.5918 47.8236 54.6465 48.2087 54.7559 48.5732C54.8652 48.9333 55.0247 49.2546 55.2344 49.5371C55.444 49.8151 55.7038 50.0339 56.0137 50.1934C56.3236 50.3529 56.6813 50.4326 57.0869 50.4326C57.488 50.4326 57.8411 50.3529 58.1465 50.1934C58.4564 50.0339 58.7161 49.8151 58.9258 49.5371C59.1354 49.2546 59.2926 48.9333 59.3975 48.5732C59.5068 48.2087 59.5615 47.8236 59.5615 47.418V47.1924C59.5615 46.7913 59.5068 46.4108 59.3975 46.0508C59.2926 45.6908 59.1331 45.3695 58.9189 45.0869C58.7093 44.8044 58.4495 44.5811 58.1396 44.417C57.8298 44.2529 57.4743 44.1709 57.0732 44.1709C56.6722 44.1709 56.3167 44.2529 56.0068 44.417C55.7015 44.5811 55.4417 44.8044 55.2275 45.0869C55.0179 45.3695 54.8584 45.6908 54.749 46.0508C54.6442 46.4108 54.5918 46.7913 54.5918 47.1924ZM65.3447 47.5889H62.7471L62.7334 46.9053H64.9482C65.3949 46.9053 65.7663 46.8574 66.0625 46.7617C66.3633 46.6615 66.5889 46.5133 66.7393 46.3174C66.8942 46.1214 66.9717 45.8799 66.9717 45.5928C66.9717 45.374 66.9261 45.1826 66.835 45.0186C66.7484 44.8545 66.6162 44.7201 66.4385 44.6152C66.2653 44.5104 66.0465 44.4329 65.7822 44.3828C65.5225 44.3281 65.2194 44.3008 64.873 44.3008H62.9795V51H62.166V43.6035H64.873C65.3242 43.6035 65.7275 43.6445 66.083 43.7266C66.443 43.804 66.7507 43.9225 67.0059 44.082C67.2611 44.2415 67.4548 44.4466 67.5869 44.6973C67.7236 44.9434 67.792 45.235 67.792 45.5723C67.792 45.8001 67.7487 46.0143 67.6621 46.2148C67.5755 46.4108 67.4479 46.5885 67.2793 46.748C67.1152 46.903 66.9124 47.0306 66.6709 47.1309C66.4294 47.2266 66.1514 47.2858 65.8369 47.3086L65.3447 47.5889ZM65.3447 51H62.4941L62.8086 50.3027H65.3447C65.7549 50.3027 66.1035 50.2503 66.3906 50.1455C66.6777 50.0407 66.8942 49.8857 67.04 49.6807C67.1904 49.4756 67.2656 49.2272 67.2656 48.9355C67.2656 48.6621 67.1904 48.4251 67.04 48.2246C66.8942 48.0241 66.6777 47.8691 66.3906 47.7598C66.1035 47.6458 65.7549 47.5889 65.3447 47.5889H63.458L63.4717 46.9053H65.8984L66.2471 47.165C66.6208 47.1969 66.9443 47.2972 67.2178 47.4658C67.4912 47.6344 67.7031 47.8486 67.8535 48.1084C68.0039 48.3636 68.0791 48.6439 68.0791 48.9492C68.0791 49.2865 68.0153 49.585 67.8877 49.8447C67.7601 50.0999 67.5755 50.3141 67.334 50.4873C67.097 50.6559 66.8099 50.7835 66.4727 50.8701C66.1354 50.9567 65.7594 51 65.3447 51ZM70.5195 46.2832H72.9326C73.516 46.2832 74.0081 46.3857 74.4092 46.5908C74.8102 46.7913 75.1133 47.0693 75.3184 47.4248C75.528 47.7803 75.6328 48.1813 75.6328 48.6279C75.6328 48.9652 75.5736 49.2796 75.4551 49.5713C75.3411 49.8584 75.168 50.109 74.9355 50.3232C74.7077 50.5374 74.4251 50.7038 74.0879 50.8223C73.7552 50.9408 73.3701 51 72.9326 51H70V43.6035H70.8135V50.2959H72.9326C73.3838 50.2959 73.7484 50.2184 74.0264 50.0635C74.3044 49.904 74.5049 49.6989 74.6279 49.4482C74.7555 49.1976 74.8193 48.931 74.8193 48.6484C74.8193 48.3704 74.7555 48.1061 74.6279 47.8555C74.5049 47.6003 74.3044 47.3929 74.0264 47.2334C73.7484 47.0693 73.3838 46.9873 72.9326 46.9873H70.5195V46.2832ZM78.1416 43.6035V51H77.3281V43.6035H78.1416ZM81.2861 49.6738L85.2852 43.6035H86.1055V51H85.2852V44.9297L81.2861 51H80.4795V43.6035H81.2861V49.6738ZM84.5332 40.9512H85.2305C85.2305 41.293 85.1507 41.596 84.9912 41.8604C84.8363 42.1247 84.6107 42.332 84.3145 42.4824C84.0182 42.6328 83.6673 42.708 83.2617 42.708C82.651 42.708 82.168 42.5439 81.8125 42.2158C81.4616 41.8877 81.2861 41.4661 81.2861 40.9512H81.9766C81.9766 41.2656 82.0723 41.5391 82.2637 41.7715C82.4596 41.9993 82.7923 42.1133 83.2617 42.1133C83.7174 42.1133 84.0433 41.9971 84.2393 41.7646C84.4352 41.5322 84.5332 41.2611 84.5332 40.9512ZM94.4453 50.4326C94.7917 50.4326 95.1152 50.3688 95.416 50.2412C95.7214 50.109 95.972 49.9154 96.168 49.6602C96.3685 49.4004 96.4824 49.0837 96.5098 48.71H97.2891C97.2663 49.1794 97.1227 49.5986 96.8584 49.9678C96.5986 50.3324 96.2568 50.6195 95.833 50.8291C95.4137 51.0342 94.9512 51.1367 94.4453 51.1367C93.9303 51.1367 93.4746 51.0433 93.0781 50.8564C92.6862 50.6696 92.3581 50.4098 92.0938 50.0771C91.8294 49.7399 91.6289 49.348 91.4922 48.9014C91.36 48.4502 91.2939 47.9648 91.2939 47.4453V47.1582C91.2939 46.6387 91.36 46.1556 91.4922 45.709C91.6289 45.2578 91.8294 44.8659 92.0938 44.5332C92.3581 44.196 92.6862 43.9339 93.0781 43.7471C93.4701 43.5602 93.9235 43.4668 94.4385 43.4668C94.9671 43.4668 95.4411 43.5739 95.8604 43.7881C96.2842 44.0023 96.6214 44.3053 96.8721 44.6973C97.1273 45.0892 97.2663 45.554 97.2891 46.0918H96.5098C96.487 45.6953 96.3822 45.3535 96.1953 45.0664C96.0085 44.7793 95.7624 44.5583 95.457 44.4033C95.1517 44.2484 94.8122 44.1709 94.4385 44.1709C94.0192 44.1709 93.6615 44.2529 93.3652 44.417C93.069 44.5765 92.8275 44.7975 92.6406 45.0801C92.4583 45.3581 92.3239 45.6771 92.2373 46.0371C92.1507 46.3926 92.1074 46.7663 92.1074 47.1582V47.4453C92.1074 47.8418 92.1484 48.2201 92.2305 48.5801C92.3171 48.9355 92.4515 49.2523 92.6338 49.5303C92.8206 49.8083 93.0622 50.0293 93.3584 50.1934C93.6592 50.3529 94.0215 50.4326 94.4453 50.4326ZM101.794 51.1367C101.311 51.1367 100.867 51.0479 100.461 50.8701C100.06 50.6924 99.709 50.4417 99.4082 50.1182C99.112 49.7946 98.8818 49.4118 98.7178 48.9697C98.5583 48.5231 98.4785 48.0355 98.4785 47.5068V47.2129C98.4785 46.6432 98.5628 46.1283 98.7314 45.668C98.9001 45.2077 99.1325 44.8135 99.4287 44.4854C99.7249 44.1572 100.062 43.9066 100.44 43.7334C100.823 43.5557 101.224 43.4668 101.644 43.4668C102.113 43.4668 102.53 43.5511 102.895 43.7197C103.259 43.8838 103.564 44.1185 103.811 44.4238C104.061 44.7246 104.25 45.0824 104.378 45.4971C104.506 45.9072 104.569 46.3607 104.569 46.8574V47.3564H98.9707V46.6592H103.756V46.5635C103.747 46.1488 103.662 45.7614 103.503 45.4014C103.348 45.0368 103.116 44.7406 102.806 44.5127C102.496 44.2848 102.108 44.1709 101.644 44.1709C101.297 44.1709 100.978 44.2438 100.687 44.3896C100.399 44.5355 100.151 44.7451 99.9414 45.0186C99.7363 45.2874 99.5768 45.6087 99.4629 45.9824C99.3535 46.3516 99.2988 46.7617 99.2988 47.2129V47.5068C99.2988 47.917 99.3581 48.2998 99.4766 48.6553C99.5996 49.0062 99.7728 49.3161 99.9961 49.585C100.224 49.8538 100.493 50.0635 100.803 50.2139C101.113 50.3643 101.454 50.4395 101.828 50.4395C102.266 50.4395 102.653 50.3597 102.99 50.2002C103.327 50.0361 103.631 49.7786 103.899 49.4277L104.412 49.8242C104.253 50.0612 104.052 50.2799 103.811 50.4805C103.574 50.681 103.289 50.8405 102.956 50.959C102.623 51.0775 102.236 51.1367 101.794 51.1367ZM106.989 45.0254V53.8438H106.169V43.6035H106.935L106.989 45.0254ZM112.13 47.2334V47.377C112.13 47.9284 112.066 48.4342 111.938 48.8945C111.811 49.3548 111.626 49.7536 111.385 50.0908C111.148 50.4235 110.854 50.681 110.503 50.8633C110.152 51.0456 109.753 51.1367 109.307 51.1367C108.865 51.1367 108.47 51.0684 108.124 50.9316C107.778 50.7949 107.479 50.6012 107.229 50.3506C106.982 50.0954 106.784 49.7992 106.634 49.4619C106.488 49.1201 106.385 48.7464 106.326 48.3408V46.4473C106.395 46.0007 106.506 45.5951 106.661 45.2305C106.816 44.8659 107.014 44.5514 107.256 44.2871C107.502 44.0228 107.794 43.82 108.131 43.6787C108.468 43.5374 108.853 43.4668 109.286 43.4668C109.737 43.4668 110.138 43.5557 110.489 43.7334C110.845 43.9066 111.143 44.1595 111.385 44.4922C111.631 44.8203 111.815 45.2168 111.938 45.6816C112.066 46.1419 112.13 46.6592 112.13 47.2334ZM111.31 47.377V47.2334C111.31 46.8005 111.264 46.3994 111.173 46.0303C111.086 45.6611 110.952 45.3398 110.77 45.0664C110.592 44.7884 110.364 44.5719 110.086 44.417C109.812 44.262 109.487 44.1846 109.108 44.1846C108.716 44.1846 108.382 44.2507 108.104 44.3828C107.83 44.5104 107.602 44.6813 107.42 44.8955C107.238 45.1051 107.094 45.3353 106.989 45.5859C106.884 45.8366 106.807 46.0827 106.757 46.3242V48.5049C106.843 48.8512 106.982 49.1725 107.174 49.4688C107.365 49.7604 107.62 49.9951 107.939 50.1729C108.263 50.346 108.657 50.4326 109.122 50.4326C109.496 50.4326 109.819 50.3551 110.093 50.2002C110.366 50.0452 110.592 49.8288 110.77 49.5508C110.952 49.2728 111.086 48.9492 111.173 48.5801C111.264 48.2109 111.31 47.8099 111.31 47.377ZM117.216 47.5889H114.618L114.604 46.9053H116.819C117.266 46.9053 117.637 46.8574 117.934 46.7617C118.234 46.6615 118.46 46.5133 118.61 46.3174C118.765 46.1214 118.843 45.8799 118.843 45.5928C118.843 45.374 118.797 45.1826 118.706 45.0186C118.619 44.8545 118.487 44.7201 118.31 44.6152C118.136 44.5104 117.918 44.4329 117.653 44.3828C117.394 44.3281 117.09 44.3008 116.744 44.3008H114.851V51H114.037V43.6035H116.744C117.195 43.6035 117.599 43.6445 117.954 43.7266C118.314 43.804 118.622 43.9225 118.877 44.082C119.132 44.2415 119.326 44.4466 119.458 44.6973C119.595 44.9434 119.663 45.235 119.663 45.5723C119.663 45.8001 119.62 46.0143 119.533 46.2148C119.447 46.4108 119.319 46.5885 119.15 46.748C118.986 46.903 118.784 47.0306 118.542 47.1309C118.3 47.2266 118.022 47.2858 117.708 47.3086L117.216 47.5889ZM117.216 51H114.365L114.68 50.3027H117.216C117.626 50.3027 117.975 50.2503 118.262 50.1455C118.549 50.0407 118.765 49.8857 118.911 49.6807C119.062 49.4756 119.137 49.2272 119.137 48.9355C119.137 48.6621 119.062 48.4251 118.911 48.2246C118.765 48.0241 118.549 47.8691 118.262 47.7598C117.975 47.6458 117.626 47.5889 117.216 47.5889H115.329L115.343 46.9053H117.77L118.118 47.165C118.492 47.1969 118.815 47.2972 119.089 47.4658C119.362 47.6344 119.574 47.8486 119.725 48.1084C119.875 48.3636 119.95 48.6439 119.95 48.9492C119.95 49.2865 119.886 49.585 119.759 49.8447C119.631 50.0999 119.447 50.3141 119.205 50.4873C118.968 50.6559 118.681 50.7835 118.344 50.8701C118.007 50.9567 117.631 51 117.216 51ZM122.644 49.6738L126.643 43.6035H127.463V51H126.643V44.9297L122.644 51H121.837V43.6035H122.644V49.6738ZM132.385 50.4326C132.731 50.4326 133.055 50.3688 133.355 50.2412C133.661 50.109 133.911 49.9154 134.107 49.6602C134.308 49.4004 134.422 49.0837 134.449 48.71H135.229C135.206 49.1794 135.062 49.5986 134.798 49.9678C134.538 50.3324 134.196 50.6195 133.772 50.8291C133.353 51.0342 132.891 51.1367 132.385 51.1367C131.87 51.1367 131.414 51.0433 131.018 50.8564C130.626 50.6696 130.298 50.4098 130.033 50.0771C129.769 49.7399 129.568 49.348 129.432 48.9014C129.299 48.4502 129.233 47.9648 129.233 47.4453V47.1582C129.233 46.6387 129.299 46.1556 129.432 45.709C129.568 45.2578 129.769 44.8659 130.033 44.5332C130.298 44.196 130.626 43.9339 131.018 43.7471C131.41 43.5602 131.863 43.4668 132.378 43.4668C132.907 43.4668 133.381 43.5739 133.8 43.7881C134.224 44.0023 134.561 44.3053 134.812 44.6973C135.067 45.0892 135.206 45.554 135.229 46.0918H134.449C134.426 45.6953 134.322 45.3535 134.135 45.0664C133.948 44.7793 133.702 44.5583 133.396 44.4033C133.091 44.2484 132.752 44.1709 132.378 44.1709C131.959 44.1709 131.601 44.2529 131.305 44.417C131.008 44.5765 130.767 44.7975 130.58 45.0801C130.398 45.3581 130.263 45.6771 130.177 46.0371C130.09 46.3926 130.047 46.7663 130.047 47.1582V47.4453C130.047 47.8418 130.088 48.2201 130.17 48.5801C130.257 48.9355 130.391 49.2523 130.573 49.5303C130.76 49.8083 131.002 50.0293 131.298 50.1934C131.599 50.3529 131.961 50.4326 132.385 50.4326ZM144.792 49.6738V45.8594C144.792 45.5085 144.719 45.2054 144.573 44.9502C144.427 44.695 144.213 44.499 143.931 44.3623C143.648 44.2256 143.299 44.1572 142.885 44.1572C142.502 44.1572 142.16 44.2256 141.859 44.3623C141.563 44.4945 141.328 44.6745 141.155 44.9023C140.987 45.1257 140.902 45.374 140.902 45.6475L140.082 45.6406C140.082 45.3626 140.15 45.0938 140.287 44.834C140.424 44.5742 140.618 44.3418 140.868 44.1367C141.119 43.9316 141.417 43.7699 141.764 43.6514C142.115 43.5283 142.5 43.4668 142.919 43.4668C143.448 43.4668 143.912 43.5557 144.313 43.7334C144.719 43.9111 145.036 44.1777 145.264 44.5332C145.492 44.8887 145.605 45.3353 145.605 45.873V49.4482C145.605 49.7035 145.624 49.9678 145.66 50.2412C145.701 50.5146 145.758 50.7402 145.831 50.918V51H144.963C144.908 50.8359 144.865 50.6309 144.833 50.3848C144.806 50.1341 144.792 49.8971 144.792 49.6738ZM144.983 46.6934L144.997 47.3223H143.391C142.971 47.3223 142.595 47.361 142.263 47.4385C141.935 47.5114 141.657 47.6208 141.429 47.7666C141.201 47.9079 141.025 48.0788 140.902 48.2793C140.784 48.4798 140.725 48.7077 140.725 48.9629C140.725 49.2272 140.791 49.4688 140.923 49.6875C141.06 49.9062 141.251 50.0817 141.497 50.2139C141.748 50.3415 142.044 50.4053 142.386 50.4053C142.841 50.4053 143.243 50.321 143.589 50.1523C143.94 49.9837 144.229 49.7627 144.457 49.4893C144.685 49.2158 144.838 48.9173 144.915 48.5938L145.271 49.0654C145.211 49.2933 145.102 49.528 144.942 49.7695C144.787 50.0065 144.585 50.2298 144.334 50.4395C144.083 50.6445 143.787 50.8132 143.445 50.9453C143.108 51.0729 142.725 51.1367 142.297 51.1367C141.814 51.1367 141.392 51.0456 141.032 50.8633C140.677 50.681 140.399 50.4326 140.198 50.1182C140.002 49.7992 139.904 49.4391 139.904 49.0381C139.904 48.6735 139.982 48.3477 140.137 48.0605C140.292 47.7689 140.515 47.5228 140.807 47.3223C141.103 47.1172 141.458 46.9622 141.873 46.8574C142.292 46.748 142.762 46.6934 143.281 46.6934H144.983ZM152.845 46.9121V47.6094H148.456V46.9121H152.845ZM148.668 43.6035V51H147.854V43.6035H148.668ZM153.474 43.6035V51H152.653V43.6035H153.474ZM160.173 49.6738V45.8594C160.173 45.5085 160.1 45.2054 159.954 44.9502C159.808 44.695 159.594 44.499 159.312 44.3623C159.029 44.2256 158.68 44.1572 158.266 44.1572C157.883 44.1572 157.541 44.2256 157.24 44.3623C156.944 44.4945 156.709 44.6745 156.536 44.9023C156.368 45.1257 156.283 45.374 156.283 45.6475L155.463 45.6406C155.463 45.3626 155.531 45.0938 155.668 44.834C155.805 44.5742 155.998 44.3418 156.249 44.1367C156.5 43.9316 156.798 43.7699 157.145 43.6514C157.495 43.5283 157.881 43.4668 158.3 43.4668C158.828 43.4668 159.293 43.5557 159.694 43.7334C160.1 43.9111 160.417 44.1777 160.645 44.5332C160.872 44.8887 160.986 45.3353 160.986 45.873V49.4482C160.986 49.7035 161.005 49.9678 161.041 50.2412C161.082 50.5146 161.139 50.7402 161.212 50.918V51H160.344C160.289 50.8359 160.246 50.6309 160.214 50.3848C160.187 50.1341 160.173 49.8971 160.173 49.6738ZM160.364 46.6934L160.378 47.3223H158.771C158.352 47.3223 157.976 47.361 157.644 47.4385C157.315 47.5114 157.037 47.6208 156.81 47.7666C156.582 47.9079 156.406 48.0788 156.283 48.2793C156.165 48.4798 156.105 48.7077 156.105 48.9629C156.105 49.2272 156.172 49.4688 156.304 49.6875C156.44 49.9062 156.632 50.0817 156.878 50.2139C157.129 50.3415 157.425 50.4053 157.767 50.4053C158.222 50.4053 158.623 50.321 158.97 50.1523C159.321 49.9837 159.61 49.7627 159.838 49.4893C160.066 49.2158 160.218 48.9173 160.296 48.5938L160.651 49.0654C160.592 49.2933 160.483 49.528 160.323 49.7695C160.168 50.0065 159.965 50.2298 159.715 50.4395C159.464 50.6445 159.168 50.8132 158.826 50.9453C158.489 51.0729 158.106 51.1367 157.678 51.1367C157.195 51.1367 156.773 51.0456 156.413 50.8633C156.058 50.681 155.78 50.4326 155.579 50.1182C155.383 49.7992 155.285 49.4391 155.285 49.0381C155.285 48.6735 155.363 48.3477 155.518 48.0605C155.673 47.7689 155.896 47.5228 156.188 47.3223C156.484 47.1172 156.839 46.9622 157.254 46.8574C157.673 46.748 158.143 46.6934 158.662 46.6934H160.364ZM168.198 43.6035V44.3145H164.452V43.6035H168.198ZM168.861 43.6035V51H168.048V43.6035H168.861ZM164.233 43.6035H165.047L164.883 47.0693C164.855 47.6299 164.81 48.1266 164.746 48.5596C164.687 48.9925 164.605 49.3639 164.5 49.6738C164.395 49.9792 164.261 50.2298 164.097 50.4258C163.937 50.6217 163.743 50.7676 163.516 50.8633C163.288 50.9544 163.021 51 162.716 51H162.408V50.2617L162.661 50.2549C162.857 50.2458 163.028 50.2048 163.174 50.1318C163.324 50.0589 163.452 49.9427 163.557 49.7832C163.666 49.6237 163.755 49.4141 163.823 49.1543C163.896 48.8945 163.953 48.5778 163.994 48.2041C164.04 47.8258 164.074 47.3815 164.097 46.8711L164.233 43.6035ZM171.931 49.6738L175.93 43.6035H176.75V51H175.93V44.9297L171.931 51H171.124V43.6035H171.931V49.6738ZM181.501 47.418H180.312V46.8643H181.433C181.888 46.8643 182.251 46.8118 182.52 46.707C182.788 46.5977 182.982 46.445 183.101 46.249C183.219 46.0531 183.278 45.8229 183.278 45.5586C183.278 45.3034 183.215 45.071 183.087 44.8613C182.964 44.6517 182.766 44.4831 182.492 44.3555C182.219 44.2279 181.856 44.1641 181.405 44.1641C181.059 44.1641 180.74 44.2256 180.448 44.3486C180.157 44.4717 179.922 44.6403 179.744 44.8545C179.571 45.0687 179.484 45.3171 179.484 45.5996H178.664C178.664 45.1621 178.792 44.7839 179.047 44.4648C179.302 44.1458 179.637 43.8997 180.052 43.7266C180.471 43.5534 180.922 43.4668 181.405 43.4668C181.825 43.4668 182.201 43.5124 182.533 43.6035C182.866 43.6947 183.148 43.8291 183.381 44.0068C183.613 44.1846 183.791 44.4056 183.914 44.6699C184.037 44.9297 184.099 45.2282 184.099 45.5654C184.099 45.8206 184.039 46.0599 183.921 46.2832C183.807 46.5065 183.638 46.7048 183.415 46.8779C183.196 47.0465 182.925 47.1787 182.602 47.2744C182.283 47.3701 181.916 47.418 181.501 47.418ZM180.312 47.042H181.501C181.957 47.042 182.355 47.0853 182.697 47.1719C183.039 47.2539 183.324 47.377 183.552 47.541C183.78 47.7051 183.948 47.9079 184.058 48.1494C184.172 48.3864 184.229 48.6598 184.229 48.9697C184.229 49.307 184.16 49.61 184.023 49.8789C183.891 50.1478 183.7 50.3757 183.449 50.5625C183.199 50.7493 182.9 50.8906 182.554 50.9863C182.207 51.082 181.825 51.1299 181.405 51.1299C180.954 51.1299 180.507 51.0501 180.065 50.8906C179.628 50.7311 179.266 50.485 178.979 50.1523C178.691 49.8197 178.548 49.3958 178.548 48.8809H179.361C179.361 49.1634 179.45 49.4232 179.628 49.6602C179.806 49.8971 180.047 50.0863 180.353 50.2275C180.662 50.3688 181.013 50.4395 181.405 50.4395C181.847 50.4395 182.216 50.3779 182.513 50.2549C182.809 50.1273 183.032 49.9541 183.183 49.7354C183.333 49.5166 183.408 49.266 183.408 48.9834C183.408 48.6507 183.335 48.3818 183.189 48.1768C183.048 47.9717 182.832 47.8213 182.54 47.7256C182.248 47.6299 181.879 47.582 181.433 47.582H180.312V47.042ZM190.538 49.6738V45.8594C190.538 45.5085 190.465 45.2054 190.319 44.9502C190.174 44.695 189.959 44.499 189.677 44.3623C189.394 44.2256 189.046 44.1572 188.631 44.1572C188.248 44.1572 187.906 44.2256 187.605 44.3623C187.309 44.4945 187.075 44.6745 186.901 44.9023C186.733 45.1257 186.648 45.374 186.648 45.6475L185.828 45.6406C185.828 45.3626 185.896 45.0938 186.033 44.834C186.17 44.5742 186.364 44.3418 186.614 44.1367C186.865 43.9316 187.163 43.7699 187.51 43.6514C187.861 43.5283 188.246 43.4668 188.665 43.4668C189.194 43.4668 189.659 43.5557 190.06 43.7334C190.465 43.9111 190.782 44.1777 191.01 44.5332C191.238 44.8887 191.352 45.3353 191.352 45.873V49.4482C191.352 49.7035 191.37 49.9678 191.406 50.2412C191.447 50.5146 191.504 50.7402 191.577 50.918V51H190.709C190.654 50.8359 190.611 50.6309 190.579 50.3848C190.552 50.1341 190.538 49.8971 190.538 49.6738ZM190.729 46.6934L190.743 47.3223H189.137C188.717 47.3223 188.341 47.361 188.009 47.4385C187.681 47.5114 187.403 47.6208 187.175 47.7666C186.947 47.9079 186.771 48.0788 186.648 48.2793C186.53 48.4798 186.471 48.7077 186.471 48.9629C186.471 49.2272 186.537 49.4688 186.669 49.6875C186.806 49.9062 186.997 50.0817 187.243 50.2139C187.494 50.3415 187.79 50.4053 188.132 50.4053C188.588 50.4053 188.989 50.321 189.335 50.1523C189.686 49.9837 189.975 49.7627 190.203 49.4893C190.431 49.2158 190.584 48.9173 190.661 48.5938L191.017 49.0654C190.957 49.2933 190.848 49.528 190.688 49.7695C190.534 50.0065 190.331 50.2298 190.08 50.4395C189.829 50.6445 189.533 50.8132 189.191 50.9453C188.854 51.0729 188.471 51.1367 188.043 51.1367C187.56 51.1367 187.138 51.0456 186.778 50.8633C186.423 50.681 186.145 50.4326 185.944 50.1182C185.748 49.7992 185.65 49.4391 185.65 49.0381C185.65 48.6735 185.728 48.3477 185.883 48.0605C186.038 47.7689 186.261 47.5228 186.553 47.3223C186.849 47.1172 187.204 46.9622 187.619 46.8574C188.038 46.748 188.508 46.6934 189.027 46.6934H190.729ZM196.513 47.418V47.1924C196.513 46.6546 196.59 46.1579 196.745 45.7021C196.9 45.2464 197.121 44.8522 197.408 44.5195C197.7 44.1868 198.049 43.9294 198.454 43.7471C198.86 43.5602 199.311 43.4668 199.808 43.4668C200.309 43.4668 200.762 43.5602 201.168 43.7471C201.574 43.9294 201.922 44.1868 202.214 44.5195C202.506 44.8522 202.729 45.2464 202.884 45.7021C203.039 46.1579 203.116 46.6546 203.116 47.1924V47.418C203.116 47.9557 203.039 48.4525 202.884 48.9082C202.729 49.3594 202.506 49.7513 202.214 50.084C201.927 50.4167 201.58 50.6764 201.175 50.8633C200.769 51.0456 200.318 51.1367 199.821 51.1367C199.32 51.1367 198.867 51.0456 198.461 50.8633C198.055 50.6764 197.707 50.4167 197.415 50.084C197.123 49.7513 196.9 49.3594 196.745 48.9082C196.59 48.4525 196.513 47.9557 196.513 47.418ZM197.326 47.1924V47.418C197.326 47.8236 197.381 48.2087 197.49 48.5732C197.6 48.9333 197.759 49.2546 197.969 49.5371C198.178 49.8151 198.438 50.0339 198.748 50.1934C199.058 50.3529 199.416 50.4326 199.821 50.4326C200.222 50.4326 200.576 50.3529 200.881 50.1934C201.191 50.0339 201.451 49.8151 201.66 49.5371C201.87 49.2546 202.027 48.9333 202.132 48.5732C202.241 48.2087 202.296 47.8236 202.296 47.418V47.1924C202.296 46.7913 202.241 46.4108 202.132 46.0508C202.027 45.6908 201.868 45.3695 201.653 45.0869C201.444 44.8044 201.184 44.5811 200.874 44.417C200.564 44.2529 200.209 44.1709 199.808 44.1709C199.407 44.1709 199.051 44.2529 198.741 44.417C198.436 44.5811 198.176 44.8044 197.962 45.0869C197.752 45.3695 197.593 45.6908 197.483 46.0508C197.379 46.4108 197.326 46.7913 197.326 47.1924ZM209.61 40.3838H210.314C210.314 40.7256 210.253 41.0104 210.13 41.2383C210.011 41.4661 209.843 41.6507 209.624 41.792C209.405 41.9333 209.148 42.0449 208.852 42.127C208.56 42.2044 208.241 42.2705 207.895 42.3252C207.471 42.389 207.081 42.528 206.726 42.7422C206.375 42.9564 206.074 43.2503 205.823 43.624C205.573 43.9932 205.383 44.4512 205.256 44.998C205.133 45.5404 205.083 46.1761 205.105 46.9053V47.541H204.401V46.9053C204.401 46.1032 204.479 45.3923 204.634 44.7725C204.793 44.1481 205.019 43.6149 205.311 43.1729C205.607 42.7308 205.958 42.3799 206.363 42.1201C206.773 41.8558 207.227 41.6826 207.724 41.6006C208.188 41.5277 208.558 41.4388 208.831 41.334C209.109 41.2292 209.307 41.0993 209.426 40.9443C209.549 40.7894 209.61 40.6025 209.61 40.3838ZM207.792 44.0889C208.275 44.0889 208.71 44.1709 209.098 44.335C209.485 44.499 209.815 44.7314 210.089 45.0322C210.367 45.3285 210.579 45.6794 210.725 46.085C210.875 46.486 210.95 46.9258 210.95 47.4043V47.623C210.95 48.1335 210.873 48.6029 210.718 49.0312C210.567 49.4596 210.349 49.8311 210.062 50.1455C209.779 50.46 209.435 50.7038 209.029 50.877C208.628 51.0501 208.179 51.1367 207.683 51.1367C207.181 51.1367 206.73 51.0501 206.329 50.877C205.928 50.7038 205.584 50.46 205.297 50.1455C205.01 49.8311 204.789 49.4596 204.634 49.0312C204.479 48.6029 204.401 48.1335 204.401 47.623V47.4043C204.401 47.2721 204.415 47.1423 204.442 47.0146C204.474 46.887 204.513 46.7617 204.559 46.6387C204.604 46.5111 204.65 46.3857 204.695 46.2627C204.855 45.848 205.08 45.4788 205.372 45.1553C205.664 44.8271 206.012 44.5674 206.418 44.376C206.828 44.1846 207.286 44.0889 207.792 44.0889ZM207.669 44.7861C207.136 44.7861 206.687 44.9092 206.322 45.1553C205.962 45.3968 205.689 45.7181 205.502 46.1191C205.315 46.5156 205.222 46.944 205.222 47.4043V47.623C205.222 48.0013 205.274 48.359 205.379 48.6963C205.484 49.0335 205.639 49.3343 205.844 49.5986C206.053 49.8584 206.311 50.0635 206.616 50.2139C206.922 50.3643 207.277 50.4395 207.683 50.4395C208.084 50.4395 208.437 50.3643 208.742 50.2139C209.048 50.0635 209.303 49.8584 209.508 49.5986C209.713 49.3343 209.868 49.0335 209.973 48.6963C210.077 48.359 210.13 48.0013 210.13 47.623V47.4043C210.13 47.0579 210.077 46.7275 209.973 46.4131C209.868 46.0986 209.711 45.8206 209.501 45.5791C209.296 45.333 209.038 45.1393 208.729 44.998C208.423 44.8568 208.07 44.7861 207.669 44.7861ZM217.54 43.6035V44.3145H213.794V43.6035H217.54ZM218.203 43.6035V51H217.39V43.6035H218.203ZM213.575 43.6035H214.389L214.225 47.0693C214.197 47.6299 214.152 48.1266 214.088 48.5596C214.029 48.9925 213.947 49.3639 213.842 49.6738C213.737 49.9792 213.603 50.2298 213.438 50.4258C213.279 50.6217 213.085 50.7676 212.857 50.8633C212.63 50.9544 212.363 51 212.058 51H211.75V50.2617L212.003 50.2549C212.199 50.2458 212.37 50.2048 212.516 50.1318C212.666 50.0589 212.794 49.9427 212.898 49.7832C213.008 49.6237 213.097 49.4141 213.165 49.1543C213.238 48.8945 213.295 48.5778 213.336 48.2041C213.382 47.8258 213.416 47.3815 213.438 46.8711L213.575 43.6035ZM224.909 49.6738V45.8594C224.909 45.5085 224.836 45.2054 224.69 44.9502C224.545 44.695 224.33 44.499 224.048 44.3623C223.765 44.2256 223.417 44.1572 223.002 44.1572C222.619 44.1572 222.277 44.2256 221.977 44.3623C221.68 44.4945 221.446 44.6745 221.272 44.9023C221.104 45.1257 221.02 45.374 221.02 45.6475L220.199 45.6406C220.199 45.3626 220.268 45.0938 220.404 44.834C220.541 44.5742 220.735 44.3418 220.985 44.1367C221.236 43.9316 221.535 43.7699 221.881 43.6514C222.232 43.5283 222.617 43.4668 223.036 43.4668C223.565 43.4668 224.03 43.5557 224.431 43.7334C224.836 43.9111 225.153 44.1777 225.381 44.5332C225.609 44.8887 225.723 45.3353 225.723 45.873V49.4482C225.723 49.7035 225.741 49.9678 225.777 50.2412C225.818 50.5146 225.875 50.7402 225.948 50.918V51H225.08C225.025 50.8359 224.982 50.6309 224.95 50.3848C224.923 50.1341 224.909 49.8971 224.909 49.6738ZM225.101 46.6934L225.114 47.3223H223.508C223.089 47.3223 222.713 47.361 222.38 47.4385C222.052 47.5114 221.774 47.6208 221.546 47.7666C221.318 47.9079 221.143 48.0788 221.02 48.2793C220.901 48.4798 220.842 48.7077 220.842 48.9629C220.842 49.2272 220.908 49.4688 221.04 49.6875C221.177 49.9062 221.368 50.0817 221.614 50.2139C221.865 50.3415 222.161 50.4053 222.503 50.4053C222.959 50.4053 223.36 50.321 223.706 50.1523C224.057 49.9837 224.346 49.7627 224.574 49.4893C224.802 49.2158 224.955 48.9173 225.032 48.5938L225.388 49.0654C225.328 49.2933 225.219 49.528 225.06 49.7695C224.905 50.0065 224.702 50.2298 224.451 50.4395C224.201 50.6445 223.904 50.8132 223.562 50.9453C223.225 51.0729 222.842 51.1367 222.414 51.1367C221.931 51.1367 221.509 51.0456 221.149 50.8633C220.794 50.681 220.516 50.4326 220.315 50.1182C220.119 49.7992 220.021 49.4391 220.021 49.0381C220.021 48.6735 220.099 48.3477 220.254 48.0605C220.409 47.7689 220.632 47.5228 220.924 47.3223C221.22 47.1172 221.576 46.9622 221.99 46.8574C222.41 46.748 222.879 46.6934 223.398 46.6934H225.101ZM233.174 43.6035V51H232.36V43.6035H233.174ZM232.894 46.96V47.6641C232.684 47.7643 232.442 47.86 232.169 47.9512C231.9 48.0423 231.615 48.1175 231.314 48.1768C231.018 48.2314 230.722 48.2588 230.426 48.2588C229.815 48.2588 229.298 48.1699 228.874 47.9922C228.455 47.8145 228.138 47.5228 227.924 47.1172C227.71 46.707 227.603 46.1602 227.603 45.4766V43.5967H228.416V45.4766C228.416 46.0007 228.489 46.4154 228.635 46.7207C228.781 47.0215 229.002 47.2357 229.298 47.3633C229.594 47.4909 229.97 47.5547 230.426 47.5547C230.74 47.5456 231.052 47.5137 231.362 47.459C231.672 47.3997 231.959 47.3268 232.224 47.2402C232.493 47.1491 232.716 47.0557 232.894 46.96ZM240.413 46.9121V47.6094H236.024V46.9121H240.413ZM236.236 43.6035V51H235.423V43.6035H236.236ZM241.042 43.6035V51H240.222V43.6035H241.042ZM242.792 47.418V47.1924C242.792 46.6546 242.869 46.1579 243.024 45.7021C243.179 45.2464 243.4 44.8522 243.688 44.5195C243.979 44.1868 244.328 43.9294 244.733 43.7471C245.139 43.5602 245.59 43.4668 246.087 43.4668C246.588 43.4668 247.042 43.5602 247.447 43.7471C247.853 43.9294 248.201 44.1868 248.493 44.5195C248.785 44.8522 249.008 45.2464 249.163 45.7021C249.318 46.1579 249.396 46.6546 249.396 47.1924V47.418C249.396 47.9557 249.318 48.4525 249.163 48.9082C249.008 49.3594 248.785 49.7513 248.493 50.084C248.206 50.4167 247.86 50.6764 247.454 50.8633C247.049 51.0456 246.597 51.1367 246.101 51.1367C245.599 51.1367 245.146 51.0456 244.74 50.8633C244.335 50.6764 243.986 50.4167 243.694 50.084C243.403 49.7513 243.179 49.3594 243.024 48.9082C242.869 48.4525 242.792 47.9557 242.792 47.418ZM243.605 47.1924V47.418C243.605 47.8236 243.66 48.2087 243.77 48.5732C243.879 48.9333 244.038 49.2546 244.248 49.5371C244.458 49.8151 244.717 50.0339 245.027 50.1934C245.337 50.3529 245.695 50.4326 246.101 50.4326C246.502 50.4326 246.855 50.3529 247.16 50.1934C247.47 50.0339 247.73 49.8151 247.939 49.5371C248.149 49.2546 248.306 48.9333 248.411 48.5732C248.521 48.2087 248.575 47.8236 248.575 47.418V47.1924C248.575 46.7913 248.521 46.4108 248.411 46.0508C248.306 45.6908 248.147 45.3695 247.933 45.0869C247.723 44.8044 247.463 44.5811 247.153 44.417C246.843 44.2529 246.488 44.1709 246.087 44.1709C245.686 44.1709 245.33 44.2529 245.021 44.417C244.715 44.5811 244.455 44.8044 244.241 45.0869C244.032 45.3695 243.872 45.6908 243.763 46.0508C243.658 46.4108 243.605 46.7913 243.605 47.1924ZM253.818 50.4326C254.165 50.4326 254.488 50.3688 254.789 50.2412C255.094 50.109 255.345 49.9154 255.541 49.6602C255.742 49.4004 255.855 49.0837 255.883 48.71H256.662C256.639 49.1794 256.496 49.5986 256.231 49.9678C255.972 50.3324 255.63 50.6195 255.206 50.8291C254.787 51.0342 254.324 51.1367 253.818 51.1367C253.303 51.1367 252.848 51.0433 252.451 50.8564C252.059 50.6696 251.731 50.4098 251.467 50.0771C251.202 49.7399 251.002 49.348 250.865 48.9014C250.733 48.4502 250.667 47.9648 250.667 47.4453V47.1582C250.667 46.6387 250.733 46.1556 250.865 45.709C251.002 45.2578 251.202 44.8659 251.467 44.5332C251.731 44.196 252.059 43.9339 252.451 43.7471C252.843 43.5602 253.297 43.4668 253.812 43.4668C254.34 43.4668 254.814 43.5739 255.233 43.7881C255.657 44.0023 255.994 44.3053 256.245 44.6973C256.5 45.0892 256.639 45.554 256.662 46.0918H255.883C255.86 45.6953 255.755 45.3535 255.568 45.0664C255.382 44.7793 255.135 44.5583 254.83 44.4033C254.525 44.2484 254.185 44.1709 253.812 44.1709C253.392 44.1709 253.035 44.2529 252.738 44.417C252.442 44.5765 252.201 44.7975 252.014 45.0801C251.831 45.3581 251.697 45.6771 251.61 46.0371C251.524 46.3926 251.48 46.7663 251.48 47.1582V47.4453C251.48 47.8418 251.521 48.2201 251.604 48.5801C251.69 48.9355 251.825 49.2523 252.007 49.5303C252.194 49.8083 252.435 50.0293 252.731 50.1934C253.032 50.3529 253.395 50.4326 253.818 50.4326ZM260.921 43.6035V51H260.107V43.6035H260.921ZM263.614 43.6035V44.3008H257.51V43.6035H263.614ZM265.829 49.6738L269.828 43.6035H270.648V51H269.828V44.9297L265.829 51H265.022V43.6035H265.829V49.6738Z" fill="#C4D1E0"/>
                                <path d="M72.91 30.42C69.77 30.42 67.16 29.37 65.08 27.27C63.02 25.19 61.99 22.6 61.99 19.5C61.99 16.38 63.02 13.79 65.08 11.73C67.16 9.63 69.77 8.58 72.91 8.58C74.81 8.58 76.56 9.03 78.16 9.93C79.78 10.81 81.04 12.01 81.94 13.53L78.37 15.6C77.85 14.66 77.11 13.93 76.15 13.41C75.19 12.87 74.11 12.6 72.91 12.6C70.87 12.6 69.22 13.24 67.96 14.52C66.72 15.82 66.1 17.48 66.1 19.5C66.1 21.5 66.72 23.15 67.96 24.45C69.22 25.73 70.87 26.37 72.91 26.37C74.11 26.37 75.19 26.11 76.15 25.59C77.13 25.05 77.87 24.32 78.37 23.4L81.94 25.47C81.04 26.99 79.78 28.2 78.16 29.1C76.56 29.98 74.81 30.42 72.91 30.42ZM88.4076 30H84.5376V8.1H88.4076V30ZM104.73 28.14C103.21 29.66 101.33 30.42 99.0897 30.42C96.8497 30.42 94.9697 29.66 93.4497 28.14C91.9297 26.62 91.1697 24.74 91.1697 22.5C91.1697 20.28 91.9297 18.41 93.4497 16.89C94.9897 15.35 96.8697 14.58 99.0897 14.58C101.31 14.58 103.19 15.35 104.73 16.89C106.27 18.43 107.04 20.3 107.04 22.5C107.04 24.72 106.27 26.6 104.73 28.14ZM96.1797 25.47C96.9597 26.25 97.9297 26.64 99.0897 26.64C100.25 26.64 101.22 26.25 102 25.47C102.78 24.69 103.17 23.7 103.17 22.5C103.17 21.3 102.78 20.31 102 19.53C101.22 18.75 100.25 18.36 99.0897 18.36C97.9297 18.36 96.9597 18.75 96.1797 19.53C95.4197 20.33 95.0397 21.32 95.0397 22.5C95.0397 23.68 95.4197 24.67 96.1797 25.47ZM119.662 23.1V15H123.532V30H119.662V28.32C118.742 29.72 117.252 30.42 115.192 30.42C113.552 30.42 112.192 29.87 111.112 28.77C110.052 27.65 109.522 26.13 109.522 24.21V15H113.392V23.73C113.392 24.71 113.652 25.47 114.172 26.01C114.712 26.55 115.442 26.82 116.362 26.82C117.382 26.82 118.182 26.51 118.762 25.89C119.362 25.25 119.662 24.32 119.662 23.1ZM138.447 16.77V9H142.317V30H138.447V28.23C137.307 29.69 135.687 30.42 133.587 30.42C131.567 30.42 129.837 29.66 128.397 28.14C126.977 26.6 126.267 24.72 126.267 22.5C126.267 20.3 126.977 18.43 128.397 16.89C129.837 15.35 131.567 14.58 133.587 14.58C135.687 14.58 137.307 15.31 138.447 16.77ZM131.307 25.56C132.127 26.34 133.127 26.73 134.307 26.73C135.507 26.73 136.497 26.34 137.277 25.56C138.057 24.76 138.447 23.74 138.447 22.5C138.447 21.26 138.057 20.25 137.277 19.47C136.497 18.67 135.507 18.27 134.307 18.27C133.107 18.27 132.107 18.67 131.307 19.47C130.527 20.25 130.137 21.26 130.137 22.5C130.137 23.74 130.527 24.76 131.307 25.56Z" fill="white"/>
                                <path d="M157.676 21.33V26.04H166.526V30H153.536V9H166.376V12.96H157.676V17.43H165.626V21.33H157.676ZM172.834 19.26C172.834 19.9 173.744 20.45 175.564 20.91C176.204 21.05 176.784 21.22 177.304 21.42C177.824 21.6 178.344 21.87 178.864 22.23C179.404 22.57 179.824 23.03 180.124 23.61C180.424 24.19 180.574 24.86 180.574 25.62C180.574 27.16 179.994 28.35 178.834 29.19C177.674 30.01 176.244 30.42 174.544 30.42C171.464 30.42 169.364 29.23 168.244 26.85L171.604 24.96C172.064 26.26 173.044 26.91 174.544 26.91C175.924 26.91 176.614 26.48 176.614 25.62C176.614 24.98 175.704 24.43 173.884 23.97C173.204 23.79 172.624 23.61 172.144 23.43C171.664 23.25 171.144 22.99 170.584 22.65C170.024 22.29 169.594 21.84 169.294 21.3C169.014 20.74 168.874 20.09 168.874 19.35C168.874 17.87 169.414 16.71 170.494 15.87C171.594 15.01 172.954 14.58 174.574 14.58C175.794 14.58 176.904 14.86 177.904 15.42C178.904 15.96 179.694 16.74 180.274 17.76L176.974 19.56C176.494 18.54 175.694 18.03 174.574 18.03C174.074 18.03 173.654 18.15 173.314 18.39C172.994 18.61 172.834 18.9 172.834 19.26ZM191.204 15V18.72H187.814V24.96C187.814 25.48 187.944 25.86 188.204 26.1C188.464 26.34 188.844 26.48 189.344 26.52C189.844 26.54 190.464 26.53 191.204 26.49V30C188.584 30.3 186.714 30.06 185.594 29.28C184.494 28.48 183.944 27.04 183.944 24.96V18.72H181.334V15H183.944V11.97L187.814 10.8V15H191.204ZM195.852 13.2C195.212 13.2 194.652 12.97 194.172 12.51C193.712 12.03 193.482 11.47 193.482 10.83C193.482 10.19 193.712 9.63 194.172 9.15C194.652 8.67 195.212 8.43 195.852 8.43C196.512 8.43 197.072 8.67 197.532 9.15C198.012 9.63 198.252 10.19 198.252 10.83C198.252 11.47 198.012 12.03 197.532 12.51C197.072 12.97 196.512 13.2 195.852 13.2ZM197.802 30H193.932V15H197.802V30ZM217.934 14.58C219.654 14.58 221.024 15.14 222.044 16.26C223.084 17.38 223.604 18.88 223.604 20.76V30H219.734V21.03C219.734 20.13 219.514 19.43 219.074 18.93C218.634 18.43 218.014 18.18 217.214 18.18C216.334 18.18 215.644 18.47 215.144 19.05C214.664 19.63 214.424 20.47 214.424 21.57V30H210.554V21.03C210.554 20.13 210.334 19.43 209.894 18.93C209.454 18.43 208.834 18.18 208.034 18.18C207.174 18.18 206.484 18.48 205.964 19.08C205.464 19.66 205.214 20.49 205.214 21.57V30H201.344V15H205.214V16.59C206.114 15.25 207.504 14.58 209.384 14.58C211.244 14.58 212.604 15.3 213.464 16.74C214.444 15.3 215.934 14.58 217.934 14.58ZM238.291 16.77V15H242.161V30H238.291V28.23C237.131 29.69 235.501 30.42 233.401 30.42C231.401 30.42 229.681 29.66 228.241 28.14C226.821 26.6 226.111 24.72 226.111 22.5C226.111 20.3 226.821 18.43 228.241 16.89C229.681 15.35 231.401 14.58 233.401 14.58C235.501 14.58 237.131 15.31 238.291 16.77ZM231.151 25.56C231.931 26.34 232.921 26.73 234.121 26.73C235.321 26.73 236.311 26.34 237.091 25.56C237.891 24.76 238.291 23.74 238.291 22.5C238.291 21.26 237.891 20.25 237.091 19.47C236.311 18.67 235.321 18.27 234.121 18.27C232.921 18.27 231.931 18.67 231.151 19.47C230.371 20.25 229.981 21.26 229.981 22.5C229.981 23.74 230.371 24.76 231.151 25.56ZM254.25 15V18.72H250.86V24.96C250.86 25.48 250.99 25.86 251.25 26.1C251.51 26.34 251.89 26.48 252.39 26.52C252.89 26.54 253.51 26.53 254.25 26.49V30C251.63 30.3 249.76 30.06 248.64 29.28C247.54 28.48 246.99 27.04 246.99 24.96V18.72H244.38V15H246.99V11.97L250.86 10.8V15H254.25ZM271.09 24.09H259.78C260.28 25.97 261.69 26.91 264.01 26.91C265.49 26.91 266.61 26.41 267.37 25.41L270.49 27.21C269.01 29.35 266.83 30.42 263.95 30.42C261.47 30.42 259.48 29.67 257.98 28.17C256.48 26.67 255.73 24.78 255.73 22.5C255.73 20.26 256.47 18.38 257.95 16.86C259.41 15.34 261.31 14.58 263.65 14.58C265.87 14.58 267.68 15.34 269.08 16.86C270.52 18.38 271.24 20.26 271.24 22.5C271.24 22.92 271.19 23.45 271.09 24.09ZM259.72 21.09H267.37C267.15 20.11 266.7 19.36 266.02 18.84C265.36 18.32 264.57 18.06 263.65 18.06C262.61 18.06 261.75 18.33 261.07 18.87C260.39 19.39 259.94 20.13 259.72 21.09Z" fill="url(#paint0_linear_382_11)"/>
                                <path d="M9.4228 14.0319C9.4228 14.0319 8.81389 2 20.8663 2C27.702 2 30.0042 6.34459 30.7434 8.63891C30.9561 9.29898 31.7423 9.71879 32.4126 9.54088C33.7212 9.19354 35.7341 8.99105 37.2679 10.3298C38.7753 11.6455 39.1348 13.5337 39.1855 14.8085C39.2127 15.4905 39.8315 16.1191 40.5058 16.2246C42.243 16.4963 45 17.793 45 23.2872C45 28.5293 41.2886 31 38.4954 31C31.0726 31 13.7431 31 9.4228 31C5.10249 31 2.00494 28.2208 2 22.6702C1.99342 15.266 9.4228 14.0319 9.4228 14.0319ZM9.4228 14.0319C9.4228 14.0319 16.8552 15.266 18.0924 20.1996" stroke="url(#paint1_linear_382_11)" strokeWidth="4" strokeLinecap="round"/>
                                <defs>
                                <linearGradient id="paint0_linear_382_11" x1="61" y1="18.5" x2="277" y2="18.5" gradientUnits="userSpaceOnUse">
                                    <stop offset="0.55" stopColor="#FC7644"/>
                                    <stop offset="0.85" stopColor="#B43F6E"/>
                                    <stop offset="1" stopColor="#6D39CA"/>
                                </linearGradient>
                                <linearGradient id="paint1_linear_382_11" x1="2" y1="16.5" x2="51.0571" y2="32.854" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#FC7644"/>
                                    <stop offset="0.6" stopColor="#B43F6E"/>
                                    <stop offset="1" stopColor="#6D39CA"/>
                                </linearGradient>
                                </defs>
                            </svg>
                        </Link>
                    </div>

                    <div className={styles['header-right']}>
                        <CoordinatesInput
                            label="Координаты области"
                            onChange={handleCoordinatesChange}
                            initialCoordinates={coordinates}
                        />
                        
                        <HeaderSelect
                            options={dataSourceOptions}
                            value={selectedDataSource}
                            label="Источник данных"
                            placeholder="Выберите источник данных"
                            onChange={handleDataSourceChange}
                        />

                        <div className={styles['input-wrapper']} ref={inputWrapperRef}>
                            <div className={styles['input-container']}>
                                <div className={styles['block-inputs']}>
                                    <input 
                                        ref={dateInputRef}
                                        type="date" 
                                        value={tempDate}
                                        onChange={handleTempDateChange}
                                        onKeyDown={handleDateTimeKeyDown}
                                    />

                                    <input 
                                        ref={timeInputRef}
                                        type="time" 
                                        value={tempTime}
                                        onChange={handleTempTimeChange}
                                        onKeyDown={handleDateTimeKeyDown}
                                    />
                                </div>

                                <span className={styles['icon']}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 15" fill="none">
                                        <path d="M10.2674 2.35209L1.31139 10.6585L0.506261 13.8169C0.469405 13.9614 0.59812 14.094 0.743726 14.0614L4.13427 13.3029L13.0457 4.95479L14.6467 3.45496C15.0685 3.05984 15.0685 2.39048 14.6467 1.99537L13.3388 0.770122C12.9555 0.41104 12.3597 0.409693 11.9748 0.767037L10.2674 2.35209ZM1.31139 10.6585L4.13427 13.3029M13.0457 4.95479L10.2674 2.35209" stroke="white"/>
                                    </svg>
                                </span>
                            </div>
                        </div>
                    </div>

                    <button 
                        className={styles['mobile-menu-toggle']}
                        onClick={() => setIsMobileMenuOpen(true)}
                        aria-label="Открыть меню"
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="white"/>
                        </svg>
                    </button>
                </header>

                <div className={styles['desktop-controls']}>
                    <CloudLayersContent />
                    <FinishAnalysisContent />
                </div>

                <div 
                    className={`${styles['mobile-menu-overlay']} ${isMobileMenuOpen ? styles['active'] : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                />

                <div 
                    ref={menuRef}
                    className={`${styles['mobile-menu']} ${isMobileMenuOpen ? styles['active'] : ''}`}
                >
                    <div className={styles['mobile-menu-header']}>
                        <h2>Настройки</h2>
                        <button 
                            className={styles['mobile-menu-close']}
                            onClick={() => setIsMobileMenuOpen(false)}
                            aria-label="Закрыть меню"
                        >
                            <svg viewBox="0 0 24 24">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="white"/>
                            </svg>
                        </button>
                    </div>

                    <div className={styles['mobile-menu-content']}>
                        <CoordinatesInput
                            label="Координаты области"
                            onChange={handleCoordinatesChange}
                            initialCoordinates={coordinates}
                        />
                        
                        <div className={styles['header-select-wrapper']}>
                            <HeaderSelect
                                options={dataSourceOptions}
                                value={selectedDataSource}
                                label="Источник данных"
                                placeholder="Выберите источник данных"
                                onChange={handleDataSourceChange}
                            />
                        </div>

                        <div className={styles['input-wrapper']} ref={inputWrapperRef}>
                            <div className={styles['input-label']}>Дата и время</div>
                            <div className={styles['input-container']}>
                                <div className={styles['block-inputs']}>
                                    <input 
                                        type="date" 
                                        value={tempDate}
                                        onChange={handleTempDateChange}
                                        onKeyDown={handleDateTimeKeyDown}
                                    />

                                    <input 
                                        type="time" 
                                        value={tempTime}
                                        onChange={handleTempTimeChange}
                                        onKeyDown={handleDateTimeKeyDown}
                                    />
                                </div>

                                <span className={styles['icon']}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 15" fill="none">
                                        <path d="M10.2674 2.35209L1.31139 10.6585L0.506261 13.8169C0.469405 13.9614 0.59812 14.094 0.743726 14.0614L4.13427 13.3029L13.0457 4.95479L14.6467 3.45496C15.0685 3.05984 15.0685 2.39048 14.6467 1.99537L13.3388 0.770122C12.9555 0.41104 12.3597 0.409693 11.9748 0.767037L10.2674 2.35209ZM1.31139 10.6585L4.13427 13.3029M13.0457 4.95479L10.2674 2.35209" stroke="white"/>
                                    </svg>
                                </span>
                            </div>
                        </div>

                        <div className={styles['mobile-menu-divider']} />

                        <CloudLayersContent />
                        <FinishAnalysisContent />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Map() {
    return (
        <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Загрузка...</div>}>
            <MapContent />
        </Suspense>
    );
}