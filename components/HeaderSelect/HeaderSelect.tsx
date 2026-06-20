'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './HeaderSelect.module.css';

interface Option {
    value: string;
    label: string;
    recommended?: boolean;
}

interface HeaderSelectProps {
    options: Option[];
    defaultValue?: string;
    value?: string;
    label?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    gap?: number;
}

export default function HeaderSelect({
    options,
    defaultValue,
    value,
    label,
    onChange,
    placeholder = 'Выберите опцию',
    gap = 10
}: HeaderSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState<Option | null>(
        value ? options.find(opt => opt.value === value) || null : options.find(opt => opt.value === defaultValue) || null
    );
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const [isPositionReady, setIsPositionReady] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isSelectingRef = useRef(false);

    useEffect(() => {
        if (value !== undefined) {
            const newSelected = options.find(opt => opt.value === value) || null;
            setSelectedOption(newSelected);
        }
    }, [value, options]);

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
            if (isSelectingRef.current) {
                return;
            }

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

    const handleSelect = (option: Option) => {
        isSelectingRef.current = true;

        setSelectedOption(option);
        setIsOpen(false);
        setIsPositionReady(false);
        onChange?.(option.value);

        setTimeout(() => {
            isSelectingRef.current = false;
        }, 100);
    };

    const getDisplayValue = () => {
        if (selectedOption) return selectedOption.label;
        return placeholder;
    };

    return (
        <div className={styles['header-select-wrapper']} ref={selectRef}>
            <div className={styles['header-select']}>
                <div
                    ref={triggerRef}
                    className={`${styles['select-container']} ${isOpen ? styles['open'] : ''}`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {label && <label className={styles['select-label']}>{label}</label>}

                    <div className={styles['select-trigger']}>
                        <span className={styles['select-value']}>{getDisplayValue()}</span>

                        <span className={`${styles['arrow']} ${isOpen ? styles['arrow-up'] : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9" fill="none">
                                <path d="M1 1L7.64692 7.17214C7.844 7.35514 8.15053 7.34947 8.3407 7.1593L14.5 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                        </span>
                    </div>
                </div>

                {isOpen && createPortal(
                    <div
                        ref={dropdownRef}
                        className={`${styles['select-dropdown-portal']} ${isPositionReady ? styles['visible'] : styles['hidden']}`}
                        style={{
                            position: 'absolute',
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                            zIndex: 9999
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        {options.map((option) => (
                            <div
                                key={option.value}
                                className={`${styles['select-option']} ${
                                    selectedOption?.value === option.value ? styles['selected'] : ''
                                }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(option);
                                }}
                            >
                                <span>{option.label}</span>
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
}