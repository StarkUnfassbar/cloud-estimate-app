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

function MapContent() {
    const searchParams = useSearchParams();
    const mapRef = useRef<maplibregl.Map | null>(null);

    // Состояние загрузки
    const [isLoading, setIsLoading] = useState(true);
    // Ключ для пересоздания карты
    const [mapKey, setMapKey] = useState(0);
    // Состояние для данных анализа
    const [analysisData, setAnalysisData] = useState<any>(null);
    // Состояние для rawData
    const [rawData, setRawData] = useState<any>(null);
    // Состояние для ошибки загрузки
    const [loadError, setLoadError] = useState<string | null>(null);

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

    // Функция для загрузки данных с бэкенда
    const fetchCloudData = useCallback(async (params: {
        north: string;
        south: string;
        east: string;
        west: string;
        dataSource: string;
        date?: string;
        time?: string;
    }) => {
        try {
            setLoadError(null);
            
            // Строим URL с параметрами
            const urlParams = new URLSearchParams();
            urlParams.set('north', params.north);
            urlParams.set('south', params.south);
            urlParams.set('east', params.east);
            urlParams.set('west', params.west);
            urlParams.set('dataSource', params.dataSource);
            if (params.date) urlParams.set('date', params.date);
            if (params.time) urlParams.set('time', params.time);
            
            // Замените URL на ваш актуальный адрес бэкенда
            const apiUrl = `http://186.246.12.72:5000/api/cloud-data?${urlParams.toString()}`;
            
            console.log('Fetching data from:', apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Сохраняем полученные данные
            setRawData(data);
            
            // Извлекаем анализ из данных
            const analysis = data.analysis || {
                cloudPercentage: null,
                verdict: { status: 'no_data', title: 'Нет данных', description: 'Не удалось получить данные для указанной даты' },
                temperature: { max: null, avg: null },
                dynamics: { status: 'unknown', title: 'Нет данных', description: '' }
            };
            
            setAnalysisData(analysis);
            
            // Завершаем загрузку
            setIsLoading(false);
            
            return data;
        } catch (error) {
            console.error('Error fetching cloud data:', error);
            setLoadError(error instanceof Error ? error.message : 'Ошибка загрузки данных');
            
            // Устанавливаем данные по умолчанию в случае ошибки
            const defaultAnalysis = {
                cloudPercentage: null,
                verdict: { status: 'no_data', title: 'Ошибка загрузки', description: 'Не удалось загрузить данные с сервера' },
                temperature: { max: null, avg: null },
                dynamics: { status: 'unknown', title: 'Ошибка', description: '' }
            };
            
            setAnalysisData(defaultAnalysis);
            setRawData({ status: 'no_data' });
            setIsLoading(false);
            
            throw error;
        }
    }, []);

    const dataSourceOptions = [
        { value: 'nasa', label: 'NASA', recommended: true },
        { value: 'esa', label: 'ESA' },
        { value: 'roscosmos', label: 'Роскосмос' },
        { value: 'cnsa', label: 'CNSA' }
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

    // Временные состояния для даты и времени (для контроля перезагрузки)
    const [tempDate, setTempDate] = useState(dateFromUrl || '');
    const [tempTime, setTempTime] = useState(timeFromUrl || '');

    // Единый useEffect для загрузки данных
    useEffect(() => {
        const params = {
            north: coordinates.north,
            south: coordinates.south,
            east: coordinates.east,
            west: coordinates.west,
            dataSource: selectedDataSource || 'nasa',
            date: selectedDate || undefined,
            time: selectedTime || undefined
        };
        
        fetchCloudData(params);
    }, [coordinates, selectedDataSource, selectedDate, selectedTime, fetchCloudData]);

    // Ссылки на input элементы
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

    // Функция для перезагрузки карты и данных
    const reloadData = useCallback(() => {
        // Показываем загрузочный экран
        setIsLoading(true);
        // Увеличиваем ключ для пересоздания компонента карты
        setMapKey(prev => prev + 1);
        // Сбрасываем ref карты
        mapRef.current = null;
        // Сбрасываем данные
        setAnalysisData(null);
        setRawData(null);
    }, []);

    // Функция для применения изменений даты и времени
    const applyDateTimeChanges = useCallback(() => {
        // Проверяем, изменились ли значения
        if (tempDate !== selectedDate || tempTime !== selectedTime) {
            setSelectedDate(tempDate);
            setSelectedTime(tempTime);
            reloadData();
        }
    }, [tempDate, tempTime, selectedDate, selectedTime, reloadData]);

    // Обработчик нажатия Enter
    const handleDateTimeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyDateTimeChanges();
        }
    }, [applyDateTimeChanges]);

    // Обработчик клика вне input-wrapper
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

    // Обновляем URL при изменении параметров
    useEffect(() => {
        // Не обновляем URL во время загрузки
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
        // Перезагружаем данные при изменении координат
        reloadData();
    };

    // Обработчики для временных значений даты и времени
    const handleTempDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempDate(e.target.value);
    };

    const handleTempTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempTime(e.target.value);
    };

    const handleDataSourceChange = (value: string) => {
        setSelectedDataSource(value);
        // Перезагружаем данные при изменении источника данных
        reloadData();
    };

    // Используем данные из состояния вместо импорта
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
    const hasData = currentRawData.status !== 'no_data';

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
            </div>
        </div>
    );

    // Экран загрузки
    if (isLoading) {
        return (
            <div className={styles['loading-overlay']}>
                <div className={styles['loading-content']}>
                    <ClipLoader
                        color="#FC7644"
                        size={60}
                        speedMultiplier={1}
                    />
                    <p>{loadError ? 'Ошибка загрузки. Повторная попытка...' : 'Загрузка данных...'}</p>
                </div>
            </div>
        );
    }

    // Если произошла ошибка, показываем сообщение, но все равно рендерим карту с данными по умолчанию
    if (loadError) {
        console.warn('Load error:', loadError);
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
                                {/* ... SVG код ... */}
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