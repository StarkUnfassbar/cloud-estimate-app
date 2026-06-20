'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './MapTypeSelect.module.css';

interface MapTypeOption {
    value: string;
    label: string;
    layerConfig: number[];
}

interface MapTypeSelectProps {
    layersCount: number;
    onLayerConfigChange: (config: number[]) => void;
    value?: string;
    onChange?: (value: string) => void;
}

// Обновленные опции с поддержкой 4-х слоев
// Порядок слоев: [Облачность, Температура, Композит ЛВО, Спектральная]
const mapTypeOptions: MapTypeOption[] = [
    { value: 'cloud', label: 'Облачность', layerConfig: [1, 0, 0, 0] },
    { value: 'temperature', label: 'Температура', layerConfig: [0, 1, 0, 0] },
    { value: 'surface', label: 'Композит ЛВО', layerConfig: [0, 0, 1, 0] },
    { value: 'spectral', label: 'Спектральная', layerConfig: [0, 0, 0, 1] },
];

export default function MapTypeSelect({
    layersCount,
    onLayerConfigChange,
    value,
    onChange
}: MapTypeSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const [isPositionReady, setIsPositionReady] = useState(false);
    
    const selectRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isSelectingRef = useRef(false);

    // Определяем текущий выбранный элемент на основе пропа value
    const getSelectedOption = (): MapTypeOption => {
        if (value) {
            const found = mapTypeOptions.find(opt => opt.value === value);
            if (found) return found;
        }
        return mapTypeOptions[0];
    };

    const selectedOption = getSelectedOption();

    // Используем value из пропсов для отображения
    useEffect(() => {
        // Если value изменился извне, проверяем его валидность
        if (value) {
            const isValid = mapTypeOptions.some(opt => opt.value === value);
            if (!isValid) {
                // Если невалидный, устанавливаем дефолтный
                onChange?.(mapTypeOptions[0].value);
                // Обрезаем или дополняем конфиг до нужного количества слоев
                const config = mapTypeOptions[0].layerConfig.slice(0, layersCount);
                while (config.length < layersCount) {
                    config.push(0);
                }
                onLayerConfigChange(config);
            }
        }
    }, [value, onChange, onLayerConfigChange, layersCount]);

    const updateDropdownPosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            
            let dropdownHeight = 300;
            if (dropdownRef.current) {
                dropdownHeight = dropdownRef.current.scrollHeight;
            }
            
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;
            const gap = 5;
            
            let top;
            if (spaceBelow >= dropdownHeight + gap) {
                top = rect.bottom + window.scrollY + gap;
            } else if (spaceAbove >= dropdownHeight + gap) {
                top = rect.top + window.scrollY - dropdownHeight - gap;
            } else {
                top = rect.bottom + window.scrollY + gap;
            }
            
            setDropdownPosition({
                top: top,
                left: rect.left + window.scrollX,
                width: rect.width
            });
            
            setTimeout(() => {
                setIsPositionReady(true);
            }, 10);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isSelectingRef.current) return;
            
            const isClickInsideSelect = selectRef.current && selectRef.current.contains(event.target as Node);
            const isClickInsideDropdown = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
            
            if (!isClickInsideSelect && !isClickInsideDropdown) {
                setIsOpen(false);
                setIsPositionReady(false);
            }
        };

        const handleScroll = () => {
            if (isOpen) {
                setIsPositionReady(false);
                updateDropdownPosition();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setIsPositionReady(false);
            updateDropdownPosition();
        } else {
            setIsPositionReady(false);
            isSelectingRef.current = false;
        }
    }, [isOpen]);

    const handleSelect = (option: MapTypeOption) => {
        isSelectingRef.current = true;
        
        // Подготавливаем конфиг для нужного количества слоев
        let config = option.layerConfig.slice(0, layersCount);
        while (config.length < layersCount) {
            config.push(0);
        }
        
        // Обновляем родителя
        onLayerConfigChange(config);
        onChange?.(option.value);
        
        // Закрываем дропдаун
        setIsOpen(false);
        setIsPositionReady(false);
        
        setTimeout(() => {
            isSelectingRef.current = false;
        }, 100);
    };

    return (
        <div className={styles['map-type-select']} ref={selectRef}>
            <div 
                ref={triggerRef}
                className={`${styles['select-trigger']} ${isOpen ? styles['open'] : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={styles['select-value']}>{selectedOption.label}</span>
                
                <span className={`${styles['arrow']} ${isOpen ? styles['arrow-up'] : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9" fill="none">
                        <path d="M1 1L7.64692 7.17214C7.844 7.35514 8.15053 7.34947 8.3407 7.1593L14.5 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                </span>
            </div>

            {isOpen && createPortal(
                <div 
                    ref={dropdownRef}
                    className={`${styles['select-dropdown']} ${isPositionReady ? styles['visible'] : styles['hidden']}`}
                    style={{
                        position: 'absolute',
                        top: dropdownPosition.top,
                        left: dropdownPosition.left,
                        width: dropdownPosition.width,
                        zIndex: 9999
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {mapTypeOptions.map((option) => (
                        <div
                            key={option.value}
                            className={`${styles['select-option']} ${
                                selectedOption.value === option.value ? styles['selected'] : ''
                            }`}
                            onClick={() => handleSelect(option)}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}