'use client';

import { useEffect, useState } from 'react';
import styles from './Notification.module.css';

interface NotificationProps {
    message: string;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export default function Notification({ 
    message, 
    isVisible, 
    onClose, 
    duration = 5000 
}: NotificationProps) {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setIsAnimating(true);
            const timer = setTimeout(() => {
                setIsAnimating(false);
                setTimeout(onClose, 300);
            }, duration);
            
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);

    if (!isVisible && !isAnimating) return null;

    return (
        <div className={`${styles['notification-container']} ${isAnimating ? styles['show'] : styles['hide']}`}>
            <div className={styles['notification']}>
                <div className={styles['notification-content']}>
                    <p className={styles['notification-message']}>{message}</p>
                    <button 
                        className={styles['notification-close']} 
                        onClick={() => {
                            setIsAnimating(false);
                            setTimeout(onClose, 300);
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                            <path d="M6 18L18 6M6 6L18 18" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}