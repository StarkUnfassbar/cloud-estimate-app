"use client";

import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import maplibregl from 'maplibre-gl';

export interface AnalysisData {
    cloudPercentage: number;
    verdict: {
        status: 'good' | 'neutral' | 'bad';
        title: string;
        description: string;
    };
    temperature: {
        max: number;
        avg: number;
    };
    dynamics: {
        status: 'good' | 'neutral' | 'bad';
        title: string;
        description: string;
    };
}

interface DownloadButtonProps {
    mapRef: React.RefObject<maplibregl.Map | null>;
    analysisData: AnalysisData;
    bounds: { north: number; south: number; east: number; west: number } | undefined;
    coordinates: {
        north: string;
        south: string;
        east: string;
        west: string;
    };
    selectedDataSource: string;
    selectedDate: string;
    selectedTime: string;
    layers: { id: string; label: string; opacity: number }[];
    className?: string;
    children?: React.ReactNode;
}

// Генерация HTML для текстовой части отчета
function generateReportHTML(analysisData: AnalysisData, coordinates: any, dataSource: string, date: string, time: string): string {
    const statusMap: Record<string, string> = {
        'good': '✅ Благоприятные',
        'neutral': '🟡 Нейтральные',
        'bad': '❌ Неблагоприятные'
    };

    const tempStatusMap: Record<string, string> = {
        'low': 'Низкая',
        'medium': 'Средняя',
        'high': 'Высокая'
    };

    const getTemperatureState = (value: number, type: 'max' | 'avg'): string => {
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

    const maxTempState = getTemperatureState(analysisData.temperature.max, 'max');
    const avgTempState = getTemperatureState(analysisData.temperature.avg, 'avg');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Результаты анализа</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #f0f2f5;
            margin: 0;
            padding: 30px;
            color: #1a202c;
        }
        .report {
            max-width: 900px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
            overflow: hidden;
        }
        .report-header {
            background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%);
            color: white;
            padding: 30px 40px;
        }
        .report-header h1 {
            margin: 0 0 8px 0;
            font-size: 28px;
            font-weight: 700;
        }
        .report-header .subtitle {
            font-size: 16px;
            opacity: 0.8;
        }
        .report-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            padding: 16px 40px;
            background: #f7fafc;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
            color: #4a5568;
        }
        .report-meta .label {
            font-weight: 600;
            color: #2d3748;
        }
        .report-body {
            padding: 30px 40px;
        }
        .section {
            margin-bottom: 32px;
        }
        .section:last-child { margin-bottom: 0; }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin: 0 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #edf2f7;
        }
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .stat-card {
            background: #f7fafc;
            border-radius: 10px;
            padding: 16px 20px;
        }
        .stat-card .stat-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #a0aec0;
        }
        .stat-card .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #2d3748;
            margin-top: 4px;
        }
        .card {
            background: #f7fafc;
            border-radius: 10px;
            padding: 16px 20px;
            border-left: 4px solid #cbd5e0;
        }
        .card.good { border-left-color: #48bb78; }
        .card.neutral { border-left-color: #ecc94b; }
        .card.bad { border-left-color: #fc8181; }
        .card .card-title {
            font-weight: 600;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card .card-desc {
            color: #4a5568;
            font-size: 14px;
            margin-top: 4px;
        }
        .badge {
            display: inline-block;
            padding: 2px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge.good { background: #c6f6d5; color: #22543d; }
        .badge.neutral { background: #fefcbf; color: #744210; }
        .badge.bad { background: #fed7d7; color: #9b2c2c; }
        .temp-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .temp-card {
            background: #f7fafc;
            border-radius: 10px;
            padding: 16px 20px;
            border-left: 4px solid #cbd5e0;
        }
        .temp-card.low { border-left-color: #63b3ed; }
        .temp-card.medium { border-left-color: #ecc94b; }
        .temp-card.high { border-left-color: #fc8181; }
        .temp-card .temp-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #a0aec0;
        }
        .temp-card .temp-value {
            font-size: 22px;
            font-weight: 700;
            color: #2d3748;
            margin-top: 2px;
        }
        .temp-card .temp-status {
            font-size: 12px;
            color: #718096;
            margin-top: 2px;
        }
        .report-footer {
            padding: 16px 40px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #a0aec0;
            text-align: center;
            background: #f7fafc;
        }
        @media (max-width: 640px) {
            body { padding: 16px; }
            .report-header { padding: 20px; }
            .report-meta { padding: 12px 20px; grid-template-columns: 1fr; }
            .report-body { padding: 20px; }
            .grid-2 { grid-template-columns: 1fr; }
            .temp-grid { grid-template-columns: 1fr; }
            .report-footer { padding: 12px 20px; }
        }
        @media print {
            body { background: white; padding: 0; }
            .report { box-shadow: none; border-radius: 0; }
        }
    </style>
</head>
<body>
    <div class="report">
        <div class="report-header">
            <h1>📊 Результаты анализа</h1>
            <div class="subtitle">Детальный отчет по выбранной области</div>
        </div>
        <div class="report-meta">
            <div><span class="label">📅 Дата:</span> ${date || 'Не указана'}</div>
            <div><span class="label">🕐 Время:</span> ${time || 'Не указано'}</div>
            <div><span class="label">📡 Источник:</span> ${dataSource}</div>
            <div><span class="label">📍 Координаты:</span> ${coordinates.north}°N, ${coordinates.south}°S, ${coordinates.east}°E, ${coordinates.west}°W</div>
        </div>
        <div class="report-body">
            <!-- Облачность -->
            <div class="section">
                <div class="section-title">☁️ Облачность</div>
                <div class="grid-2">
                    <div class="stat-card">
                        <div class="stat-label">Процент облачности</div>
                        <div class="stat-value">${analysisData.cloudPercentage}%</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Статус</div>
                        <div class="stat-value" style="font-size: 20px;">
                            <span class="badge ${analysisData.verdict.status}">${statusMap[analysisData.verdict.status]}</span>
                        </div>
                    </div>
                </div>
                <div class="card ${analysisData.verdict.status}" style="margin-top: 12px;">
                    <div class="card-title">${analysisData.verdict.title}</div>
                    <div class="card-desc">${analysisData.verdict.description}</div>
                </div>
            </div>

            <!-- Температура -->
            <div class="section">
                <div class="section-title">🌡️ Температурные показатели</div>
                <div class="temp-grid">
                    <div class="temp-card ${maxTempState}">
                        <div class="temp-label">Максимальная температура</div>
                        <div class="temp-value">${analysisData.temperature.max}°C</div>
                        <div class="temp-status">${tempStatusMap[maxTempState]}</div>
                    </div>
                    <div class="temp-card ${avgTempState}">
                        <div class="temp-label">Средняя температура</div>
                        <div class="temp-value">${analysisData.temperature.avg}°C</div>
                        <div class="temp-status">${tempStatusMap[avgTempState]}</div>
                    </div>
                </div>
            </div>

            <!-- Динамика -->
            <div class="section">
                <div class="section-title">📈 Динамика облачности</div>
                <div class="card ${analysisData.dynamics.status}">
                    <div class="card-title">
                        <span class="badge ${analysisData.dynamics.status}">${statusMap[analysisData.dynamics.status]}</span>
                        ${analysisData.dynamics.title}
                    </div>
                    <div class="card-desc">${analysisData.dynamics.description}</div>
                </div>
            </div>
        </div>
        <div class="report-footer">
            Отчет сгенерирован автоматически • ${new Date().toLocaleString('ru-RU')}
        </div>
    </div>
</body>
</html>`;
}

// Вспомогательная функция для ожидания
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Основная функция скачивания - теперь только отчет и JSON
async function downloadMapContent(
    mapRef: React.RefObject<maplibregl.Map | null>,
    analysisData: AnalysisData,
    bounds: { north: number; south: number; east: number; west: number } | undefined,
    coordinates: { north: string; south: string; east: string; west: string },
    selectedDataSource: string,
    selectedDate: string,
    selectedTime: string,
    layers: { id: string; label: string; opacity: number }[],
    onProgress?: (message: string) => void,
    onError?: (error: Error) => void
): Promise<void> {
    const map = mapRef.current;
    
    if (!map) {
        const error = new Error('Карта не инициализирована');
        if (onError) onError(error);
        throw error;
    }

    try {
        onProgress?.('Начинаем создание архива...');

        const zip = new JSZip();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const folderName = `analysis_${timestamp}`;

        // 1. Создаем HTML-отчет
        onProgress?.('Создаем HTML-отчет...');
        const reportHTML = generateReportHTML(
            analysisData,
            coordinates,
            selectedDataSource,
            selectedDate,
            selectedTime
        );
        zip.file(`${folderName}/report.html`, reportHTML);

        // 2. Создаем JSON с данными
        onProgress?.('Создаем JSON-данные...');
        const jsonData = {
            timestamp: new Date().toISOString(),
            bounds: bounds || null,
            coordinates: coordinates,
            dataSource: selectedDataSource,
            date: selectedDate,
            time: selectedTime,
            analysis: {
                cloudPercentage: analysisData.cloudPercentage,
                verdict: analysisData.verdict,
                temperature: analysisData.temperature,
                dynamics: analysisData.dynamics
            },
            layers: layers
        };
        zip.file(`${folderName}/data.json`, JSON.stringify(jsonData, null, 2));

        // 3. Создаем и скачиваем архив
        onProgress?.('Упаковываем архив...');
        const zipBlob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        onProgress?.('Сохраняем файл...');
        saveAs(zipBlob, `analysis_${timestamp}.zip`);

        onProgress?.('Готово!');

    } catch (error) {
        console.error('Ошибка при скачивании:', error);
        if (onError) onError(error as Error);
        throw error;
    }
}

// React компонент кнопки - использует CSS класс из page.module.css
export function DownloadButton({
    mapRef,
    analysisData,
    bounds,
    coordinates,
    selectedDataSource,
    selectedDate,
    selectedTime,
    layers,
    className = '',
    children
}: DownloadButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDownload = async () => {
        if (isLoading) return;
        
        setError(null);
        setProgress(null);
        setIsLoading(true);

        try {
            await downloadMapContent(
                mapRef,
                analysisData,
                bounds,
                coordinates,
                selectedDataSource,
                selectedDate,
                selectedTime,
                layers,
                (msg) => setProgress(msg),
                (err) => {
                    setError(err.message);
                    setIsLoading(false);
                }
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setIsLoading(false);
            setTimeout(() => setProgress(null), 3000);
        }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <button
                onClick={handleDownload}
                disabled={isLoading}
                className={className}
            >
                {isLoading ? (
                    <>
                        <span style={{ 
                            display: 'inline-block',
                            width: '16px',
                            height: '16px',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTop: '2px solid white',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                        <span>{progress || 'Подготовка...'}</span>
                    </>
                ) : (
                    <span>{children || 'Скачать карту'}</span>
                )}
            </button>
            
            {error && (
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#f8d7da',
                    color: '#721c24',
                    padding: '8px 14px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    maxWidth: '280px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    border: '1px solid #f5c6cb'
                }}>
                    ❌ {error}
                </div>
            )}
            
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export { downloadMapContent };