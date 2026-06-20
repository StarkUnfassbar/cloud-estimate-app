'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './CoordinatesInput.module.css';

interface Coordinates {
    north: string;
    south: string;
    east: string;
    west: string;
}

interface CoordinatesInputProps {
    label?: string;
    onChange?: (coordinates: Coordinates) => void;
    gap?: number;
    initialCoordinates?: Coordinates;
}

const defaultCoordinates: Coordinates = {
    north: '40.7128',
    south: '40.0000',
    east: '74.0060',
    west: '74.0000'
};

const formatToFourDecimals = (value: string): string => {
    if (value === '' || value === '-') return '';
    
    let normalized = value.replace(',', '.');
    
    const num = parseFloat(normalized);
    if (isNaN(num)) return '';
    
    return num.toFixed(4);
};

const validateAndCleanInput = (value: string): string => {
    let cleaned = value.replace(/[^\d.,-]/g, '');
    
    if (cleaned.includes('-') && cleaned.indexOf('-') !== 0) {
        cleaned = cleaned.replace(/-/g, '');
    }
    
    if (cleaned.startsWith('--')) {
        cleaned = '-';
    }
    
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    
    if (hasComma && hasDot) {
        const firstCommaIndex = cleaned.indexOf(',');
        const firstDotIndex = cleaned.indexOf('.');
        if (firstCommaIndex < firstDotIndex) {
            cleaned = cleaned.replace(/\./g, '');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    }
    
    const separator = cleaned.includes('.') ? '.' : (cleaned.includes(',') ? ',' : null);
    if (separator) {
        const parts = cleaned.split(separator);
        if (parts[1] && parts[1].length > 4) {
            cleaned = parts[0] + separator + parts[1].slice(0, 4);
        }
    }
    
    return cleaned;
};

export default function CoordinatesInput({
    label = 'Координаты',
    onChange,
    gap = 10,
    initialCoordinates
}: CoordinatesInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [coordinates, setCoordinates] = useState<Coordinates>(() => {
        if (initialCoordinates) {
            return {
                north: formatToFourDecimals(initialCoordinates.north),
                south: formatToFourDecimals(initialCoordinates.south),
                east: formatToFourDecimals(initialCoordinates.east),
                west: formatToFourDecimals(initialCoordinates.west)
            };
        }
        return defaultCoordinates;
    });
    const [tempCoordinates, setTempCoordinates] = useState<Coordinates>(() => {
        if (initialCoordinates) {
            return {
                north: formatToFourDecimals(initialCoordinates.north),
                south: formatToFourDecimals(initialCoordinates.south),
                east: formatToFourDecimals(initialCoordinates.east),
                west: formatToFourDecimals(initialCoordinates.west)
            };
        }
        return defaultCoordinates;
    });
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const [isPositionReady, setIsPositionReady] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const isApplyingRef = useRef(false);

    useEffect(() => {
        if (initialCoordinates) {
            const formatted = {
                north: formatToFourDecimals(initialCoordinates.north),
                south: formatToFourDecimals(initialCoordinates.south),
                east: formatToFourDecimals(initialCoordinates.east),
                west: formatToFourDecimals(initialCoordinates.west)
            };
            setCoordinates(formatted);
            setTempCoordinates(formatted);
        }
    }, [initialCoordinates]);

    const updatePopupPosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            let popupHeight = 280;
            if (popupRef.current) {
                popupHeight = popupRef.current.scrollHeight;
            }

            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;

            let top;
            if (spaceBelow >= popupHeight + gap) {
                top = rect.bottom + window.scrollY + gap;
            } else if (spaceAbove >= popupHeight + gap) {
                top = rect.top + window.scrollY - popupHeight - gap;
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

    const handleClickOutside = (event: MouseEvent) => {
        if (isApplyingRef.current) {
            return;
        }

        const isClickInsideContainer = containerRef.current && containerRef.current.contains(event.target as Node);
        const isClickInsidePopup = popupRef.current && popupRef.current.contains(event.target as Node);

        if (!isClickInsideContainer && !isClickInsidePopup && isOpen) {
            const formattedCoordinates = {
                north: formatToFourDecimals(tempCoordinates.north),
                south: formatToFourDecimals(tempCoordinates.south),
                east: formatToFourDecimals(tempCoordinates.east),
                west: formatToFourDecimals(tempCoordinates.west)
            };
            setCoordinates(formattedCoordinates);
            onChange?.(formattedCoordinates);
            setIsOpen(false);
            setIsPositionReady(false);
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            if (isOpen) {
                setIsPositionReady(false);
                updatePopupPosition();
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
    }, [isOpen, tempCoordinates]);

    useEffect(() => {
        if (isOpen) {
            setIsPositionReady(false);
            setTempCoordinates(coordinates);
            updatePopupPosition();
        } else {
            setIsPositionReady(false);
            isApplyingRef.current = false;
        }
    }, [isOpen]);

    const handleFieldChange = (field: keyof Coordinates, value: string) => {
        const cleanedValue = validateAndCleanInput(value);
        
        setTempCoordinates(prev => ({
            ...prev,
            [field]: cleanedValue
        }));
    };

    const handleApply = () => {
        isApplyingRef.current = true;
        
        const formattedCoordinates = {
            north: formatToFourDecimals(tempCoordinates.north),
            south: formatToFourDecimals(tempCoordinates.south),
            east: formatToFourDecimals(tempCoordinates.east),
            west: formatToFourDecimals(tempCoordinates.west)
        };
        
        if (formattedCoordinates.north === '') formattedCoordinates.north = '0.0000';
        if (formattedCoordinates.south === '') formattedCoordinates.south = '0.0000';
        if (formattedCoordinates.east === '') formattedCoordinates.east = '0.0000';
        if (formattedCoordinates.west === '') formattedCoordinates.west = '0.0000';
        
        setCoordinates(formattedCoordinates);
        onChange?.(formattedCoordinates);
        setIsOpen(false);
        setIsPositionReady(false);
        
        setTimeout(() => {
            isApplyingRef.current = false;
        }, 100);
    };

    const formatDisplayValue = () => {
        const { north, south, east, west } = coordinates;
        return `${north}°N, ${south}°S, ${west}°W, ${east}°E`;
    };

    return (
        <div className={styles['coordinates-input-wrapper']} ref={containerRef}>
            <div className={styles['coordinates-input-container']}>
                <div
                    ref={triggerRef}
                    className={`${styles['coordinates-trigger']} ${isOpen ? styles['open'] : ''}`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <label className={styles['coordinates-label']}>{label}</label>
                    
                    <div className={styles['coordinates-value']}>
                        <span className={styles['coordinates-value-text']}>
                            {formatDisplayValue()}
                        </span>
                        
                        <span className={styles['coordinates-icon']}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 15" fill="none">
                                <path d="M10.2674 2.35209L1.31139 10.6585L0.506261 13.8169C0.469405 13.9614 0.59812 14.094 0.743726 14.0614L4.13427 13.3029L13.0457 4.95479L14.6467 3.45496C15.0685 3.05984 15.0685 2.39048 14.6467 1.99537L13.3388 0.770122C12.9555 0.41104 12.3597 0.409693 11.9748 0.767037L10.2674 2.35209ZM1.31139 10.6585L4.13427 13.3029M13.0457 4.95479L10.2674 2.35209" stroke="white"/>
                            </svg>
                        </span>
                    </div>
                </div>

                {isOpen && createPortal(
                    <div
                        ref={popupRef}
                        className={`${styles['coordinates-popup-portal']} ${isPositionReady ? styles['visible'] : styles['hidden']}`}
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
                        <div className={styles['coordinates-grid']}>
                            <div className={styles['coordinate-field']}>
                                <label className={styles['coordinate-label']}>Северная широта (°N)</label>
                                <input
                                    type="text"
                                    className={styles['coordinate-input']}
                                    value={tempCoordinates.north}
                                    onChange={(e) => handleFieldChange('north', e.target.value)}
                                    placeholder="40.7128"
                                />
                            </div>
                            
                            <div className={styles['coordinate-field']}>
                                <label className={styles['coordinate-label']}>Южная широта (°S)</label>
                                <input
                                    type="text"
                                    className={styles['coordinate-input']}
                                    value={tempCoordinates.south}
                                    onChange={(e) => handleFieldChange('south', e.target.value)}
                                    placeholder="40.0000"
                                />
                            </div>
                            
                            <div className={styles['coordinate-field']}>
                                <label className={styles['coordinate-label']}>Западная долгота (°W)</label>
                                <input
                                    type="text"
                                    className={styles['coordinate-input']}
                                    value={tempCoordinates.west}
                                    onChange={(e) => handleFieldChange('west', e.target.value)}
                                    placeholder="74.0000"
                                />
                            </div>
                            
                            <div className={styles['coordinate-field']}>
                                <label className={styles['coordinate-label']}>Восточная долгота (°E)</label>
                                <input
                                    type="text"
                                    className={styles['coordinate-input']}
                                    value={tempCoordinates.east}
                                    onChange={(e) => handleFieldChange('east', e.target.value)}
                                    placeholder="74.0060"
                                />
                            </div>
                        </div>
                        
                        <div className={styles['coordinates-actions']}>
                            <button 
                                className={styles['cancel-button']}
                                onClick={() => {
                                    setTempCoordinates(coordinates);
                                    setIsOpen(false);
                                    setIsPositionReady(false);
                                }}
                            >
                                Отмена
                            </button>
                            <button 
                                className={styles['apply-button']}
                                onClick={handleApply}
                            >
                                Применить
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
}