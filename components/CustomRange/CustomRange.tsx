"use client";

import { useState, useRef, useEffect } from 'react';
import styles from './CustomRange.module.css';

interface CustomRangeProps {
    value: number; // 0 to 1
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
}

export default function CustomRange({ 
    value, 
    onChange, 
    min = 0, 
    max = 1, 
    step = 0.01,
    disabled = false 
}: CustomRangeProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [showPercent, setShowPercent] = useState(false);
    const [hoverPercent, setHoverPercent] = useState<number | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    
    const percent = Math.round(value * 100);
    
    const getValueFromPosition = (clientX: number): number => {
        if (!trackRef.current) return value;
        
        const rect = trackRef.current.getBoundingClientRect();
        let ratio = (clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        
        let newValue = min + ratio * (max - min);
        newValue = Math.round(newValue / step) * step;
        newValue = Math.max(min, Math.min(max, newValue));
        
        return newValue;
    };
    
    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        setIsDragging(true);
        
        const newValue = getValueFromPosition(e.clientX);
        onChange(newValue);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newValue = getValueFromPosition(e.clientX);
        onChange(newValue);
    };
    
    const handleMouseUp = () => {
        setIsDragging(false);
    };
    
    const handleMouseEnter = () => {
        setShowPercent(true);
    };
    
    const handleMouseLeave = () => {
        setShowPercent(false);
        setHoverPercent(null);
    };
    
    const handleTrackHover = (e: React.MouseEvent) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        let ratio = (e.clientX - rect.left) / rect.width;
        ratio = Math.max(0, Math.min(1, ratio));
        setHoverPercent(Math.round(ratio * 100));
    };
    
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, value]);
    
    return (
        <div 
            className={`${styles['custom-range']} ${disabled ? styles['disabled'] : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div 
                ref={trackRef}
                className={styles['track']}
                onMouseDown={handleMouseDown}
                onMouseMove={handleTrackHover}
            >
                <div 
                    className={styles['filled-track']}
                    style={{ width: `${percent}%` }}
                />
                
                {/* Ховер процент на треке */}
                {showPercent && hoverPercent !== null && !isDragging && (
                    <div 
                        className={styles['hover-percent']}
                        style={{ left: `${hoverPercent}%` }}
                    >
                        {hoverPercent}%
                    </div>
                )}
                
                {/* Кружок с процентом */}
                <div 
                    ref={thumbRef}
                    className={`${styles['thumb']} ${isDragging ? styles['dragging'] : ''}`}
                    style={{ left: `${percent}%` }}
                    onMouseDown={handleMouseDown}
                >
                    <span className={styles['percent-label']}>
                        {percent}%
                    </span>
                </div>
            </div>
        </div>
    );
}