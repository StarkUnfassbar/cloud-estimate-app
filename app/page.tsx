'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from './page.module.css';
import CustomSelect from '../components/CustomSelect/CustomSelect';
import Notification from '../components/Notification/Notification';

const regionOptions = [
    { 
        value: 'siberia', 
        label: 'Россия. Сибирь',
        coords: { north: 70.0, south: 57.0, east: 130.5, west: 80.04 }
    },
    { 
        value: 'paraguay', 
        label: 'Южная Америка. Парагвай',
        coords: { north: -20.0, south: -40.0, east: -45.0, west: -70.0 }
    },
    { 
        value: 'atlantic', 
        label: 'Атлантический океан',
        coords: { north: -30.0, south: -60.0, east: 10.0, west: -40.0 }
    },
    { 
        value: 'north_america', 
        label: 'Северная Америка',
        coords: { north: 40.0, south: 27.0, east: -75.0, west: -95.8 }
    }
];

export default function Home() {
    const router = useRouter();

    const [regionInputType, setRegionInputType] = useState("draw");
    const [selectedRegion, setSelectedRegion] = useState('moscow');
    
    const dataSourceOptions = [
        { value: 'nasa', label: 'NASA', recommended: true },
        { value: 'roscosmos', label: 'Роскосмос' },
        { value: 'eumetsat', label: 'EUMETSAT' },
        { value: 'copernicus', label: 'Copernicus' }
    ];

    const [selectedDataSource, setSelectedDataSource] = useState('nasa');

    const [northLat, setNorthLat] = useState('');
    const [eastLng, setEastLng] = useState('');
    const [southLat, setSouthLat] = useState('');
    const [westLng, setWestLng] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');

    const [notification, setNotification] = useState({
        message: '',
        isVisible: false
    });

    const showNotification = (message: string) => {
        setNotification({
            message,
            isVisible: true
        });
    };

    const hideNotification = () => {
        setNotification(prev => ({
            ...prev,
            isVisible: false
        }));
    };

    const formatCoordinate = (value: string): string => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        return num.toFixed(4);
    };

    const validateLatitude = (value: string): string => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        if (num > 90) return '90';
        if (num < -90) return '-90';
        return value;
    };

    const validateLongitude = (value: string): string => {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        if (num > 180) return '180';
        if (num < -180) return '-180';
        return value;
    };

    const handleCoordinateBlur = (
        value: string,
        setter: (val: string) => void,
        validator: (val: string) => string,
        formatter: (val: string) => string
    ) => {
        if (!value) {
            setter('');
            return;
        }
        const validated = validator(value);
        const formatted = formatter(validated);
        setter(formatted);
    };

    const handleCoordinateChange = (
        value: string,
        setter: (val: string) => void
    ) => {
        const filtered = value.replace(/[^0-9.\-]/g, '');
        const dotCount = (filtered.match(/\./g) || []).length;
        const minusCount = (filtered.match(/\-/g) || []).length;
        if (dotCount > 1 || minusCount > 1) return;
        if (filtered.indexOf('-') > 0) return;
        setter(filtered);
    };

    const isDateInFuture = (date: string, time: string): boolean => {
        if (!date || !time) return false;
        
        const selectedDateTime = new Date(`${date}T${time}`);
        const now = new Date();
        
        const selected = new Date(selectedDateTime.getFullYear(), selectedDateTime.getMonth(), selectedDateTime.getDate(), selectedDateTime.getHours(), selectedDateTime.getMinutes());
        const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
        
        return selected > current;
    };

    const resetSettings = () => {
        setNorthLat('');
        setEastLng('');
        setSouthLat('');
        setWestLng('');
        setSelectedDate('');
        setSelectedTime('');
        setSelectedDataSource('nasa');
        setRegionInputType('draw');
        setSelectedRegion('moscow');
    };

    const handleStartAnalysis = () => {
        let north, south, east, west;

        if (regionInputType === 'draw') {
            const region = regionOptions.find(r => r.value === selectedRegion);
            if (!region) {
                showNotification('Пожалуйста, выберите регион');
                return;
            }
            north = region.coords.north;
            south = region.coords.south;
            east = region.coords.east;
            west = region.coords.west;
        } else {
            if (!northLat || !eastLng || !southLat || !westLng) {
                showNotification('Пожалуйста, заполните все координаты');
                return;
            }
            
            north = parseFloat(northLat);
            south = parseFloat(southLat);
            east = parseFloat(eastLng);
            west = parseFloat(westLng);
        }
        
        if (!selectedDate || !selectedTime) {
            showNotification('Пожалуйста, выберите дату и время');
            return;
        }

        if (isDateInFuture(selectedDate, selectedTime)) {
            showNotification('Нельзя выбрать дату и время в будущем');
            return;
        }
        
        if (north <= south) {
            showNotification('Северная широта должна быть больше южной');
            return;
        }
        
        if (east <= west) {
            showNotification('Восточная долгота должна быть больше западной');
            return;
        }
        
        if (north < -90 || north > 90) {
            showNotification('Северная широта должна быть в диапазоне от -90 до 90');
            return;
        }
        
        if (south < -90 || south > 90) {
            showNotification('Южная широта должна быть в диапазоне от -90 до 90');
            return;
        }
        
        if (east < -180 || east > 180) {
            showNotification('Восточная долгота должна быть в диапазоне от -180 до 180');
            return;
        }
        
        if (west < -180 || west > 180) {
            showNotification('Западная долгота должна быть в диапазоне от -180 до 180');
            return;
        }
        
        const queryString = new URLSearchParams({
            north: north.toString(),
            south: south.toString(),
            east: east.toString(),
            west: west.toString(),
            date: selectedDate,
            time: selectedTime,
            dataSource: selectedDataSource
        }).toString();
        
        router.push(`/map?${queryString}`);
    };

    return (
        <div className={styles['page-container']}>
            <div className={styles['background-image']} />

            <div className={styles['centered-container']}>
                <div className={styles['info-container']}>
                    <div className={styles['logo']}>
                        <div className={styles['logo-icon']}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 414 52" fill="none" >
                                <path
                                    d="M115.593 43.1299C110.883 43.1299 106.968 41.5549 103.848 38.4049C100.758 35.2849 99.2129 31.3999 99.2129 26.7499C99.2129 22.0699 100.758 18.1849 103.848 15.0949C106.968 11.9449 110.883 10.3699 115.593 10.3699C118.443 10.3699 121.068 11.0449 123.468 12.3949C125.898 13.7149 127.788 15.5149 129.138 17.7949L123.783 20.8999C123.003 19.4899 121.893 18.3949 120.453 17.6149C119.013 16.8049 117.393 16.3999 115.593 16.3999C112.533 16.3999 110.058 17.3599 108.168 19.2799C106.308 21.2299 105.378 23.7199 105.378 26.7499C105.378 29.7499 106.308 32.2249 108.168 34.1749C110.058 36.0949 112.533 37.0549 115.593 37.0549C117.393 37.0549 119.013 36.6649 120.453 35.8849C121.923 35.0749 123.033 33.9799 123.783 32.5999L129.138 35.7049C127.788 37.9849 125.898 39.7999 123.468 41.1499C121.068 42.4699 118.443 43.1299 115.593 43.1299Z"
                                    fill="white"
                                />
                                <path d="M138.839 42.4999H133.034V9.6499H138.839V42.4999Z" fill="white" />
                                <path
                                    d="M163.322 39.7099C161.042 41.9899 158.222 43.1299 154.862 43.1299C151.502 43.1299 148.682 41.9899 146.402 39.7099C144.122 37.4299 142.982 34.6099 142.982 31.2499C142.982 27.9199 144.122 25.1149 146.402 22.8349C148.712 20.5249 151.532 19.3699 154.862 19.3699C158.192 19.3699 161.012 20.5249 163.322 22.8349C165.632 25.1449 166.787 27.9499 166.787 31.2499C166.787 34.5799 165.632 37.3999 163.322 39.7099ZM150.497 35.7049C151.667 36.8749 153.122 37.4599 154.862 37.4599C156.602 37.4599 158.057 36.8749 159.227 35.7049C160.397 34.5349 160.982 33.0499 160.982 31.2499C160.982 29.4499 160.397 27.9649 159.227 26.7949C158.057 25.6249 156.602 25.0399 154.862 25.0399C153.122 25.0399 151.667 25.6249 150.497 26.7949C149.357 27.9949 148.787 29.4799 148.787 31.2499C148.787 33.0199 149.357 34.5049 150.497 35.7049Z"
                                    fill="white"
                                />
                                <path
                                    d="M185.721 32.1499V19.9999H191.526V42.4999H185.721V39.9799C184.341 42.0799 182.106 43.1299 179.016 43.1299C176.556 43.1299 174.516 42.3049 172.896 40.6549C171.306 38.9749 170.511 36.6949 170.511 33.8149V19.9999H176.316V33.0949C176.316 34.5649 176.706 35.7049 177.486 36.5149C178.296 37.3249 179.391 37.7299 180.771 37.7299C182.301 37.7299 183.501 37.2649 184.371 36.3349C185.271 35.3749 185.721 33.9799 185.721 32.1499Z"
                                    fill="white"
                                />
                                <path
                                    d="M213.898 22.6549V10.9999H219.703V42.4999H213.898V39.8449C212.188 42.0349 209.758 43.1299 206.608 43.1299C203.578 43.1299 200.983 41.9899 198.823 39.7099C196.693 37.3999 195.628 34.5799 195.628 31.2499C195.628 27.9499 196.693 25.1449 198.823 22.8349C200.983 20.5249 203.578 19.3699 206.608 19.3699C209.758 19.3699 212.188 20.4649 213.898 22.6549ZM203.188 35.8399C204.418 37.0099 205.918 37.5949 207.688 37.5949C209.488 37.5949 210.973 37.0099 212.143 35.8399C213.313 34.6399 213.898 33.1099 213.898 31.2499C213.898 29.3899 213.313 27.8749 212.143 26.7049C210.973 25.5049 209.488 24.9049 207.688 24.9049C205.888 24.9049 204.388 25.5049 203.188 26.7049C202.018 27.8749 201.433 29.3899 201.433 31.2499C201.433 33.1099 202.018 34.6399 203.188 35.8399Z"
                                    fill="white"
                                />
                                <path
                                    d="M242.742 29.4949V36.5599H256.017V42.4999H236.532V10.9999H255.792V16.9399H242.742V23.6449H254.667V29.4949H242.742Z"
                                    fill="url(#paint0_linear_311_132)"
                                />
                                <path
                                    d="M265.479 26.3899C265.479 27.3499 266.844 28.1749 269.574 28.8649C270.534 29.0749 271.404 29.3299 272.184 29.6299C272.964 29.8999 273.744 30.3049 274.524 30.8449C275.334 31.3549 275.964 32.0449 276.414 32.9149C276.864 33.7849 277.089 34.7899 277.089 35.9299C277.089 38.2399 276.219 40.0249 274.479 41.2849C272.739 42.5149 270.594 43.1299 268.044 43.1299C263.424 43.1299 260.274 41.3449 258.594 37.7749L263.634 34.9399C264.324 36.8899 265.794 37.8649 268.044 37.8649C270.114 37.8649 271.149 37.2199 271.149 35.9299C271.149 34.9699 269.784 34.1449 267.054 33.4549C266.034 33.1849 265.164 32.9149 264.444 32.6449C263.724 32.3749 262.944 31.9849 262.104 31.4749C261.264 30.9349 260.619 30.2599 260.169 29.4499C259.749 28.6099 259.539 27.6349 259.539 26.5249C259.539 24.3049 260.349 22.5649 261.969 21.3049C263.619 20.0149 265.659 19.3699 268.089 19.3699C269.919 19.3699 271.584 19.7899 273.084 20.6299C274.584 21.4399 275.769 22.6099 276.639 24.1399L271.689 26.8399C270.969 25.3099 269.769 24.5449 268.089 24.5449C267.339 24.5449 266.709 24.7249 266.199 25.0849C265.719 25.4149 265.479 25.8499 265.479 26.3899Z"
                                    fill="url(#paint1_linear_311_132)"
                                />
                                <path
                                    d="M293.033 19.9999V25.5799H287.948V34.9399C287.948 35.7199 288.143 36.2899 288.533 36.6499C288.923 37.0099 289.493 37.2199 290.243 37.2799C290.993 37.3099 291.923 37.2949 293.033 37.2349V42.4999C289.103 42.9499 286.298 42.5899 284.618 41.4199C282.968 40.2199 282.143 38.0599 282.143 34.9399V25.5799H278.228V19.9999H282.143V15.4549L287.948 13.6999V19.9999H293.033Z"
                                    fill="url(#paint2_linear_311_132)"
                                />
                                <path
                                    d="M300.006 17.2999C299.046 17.2999 298.206 16.9549 297.486 16.2649C296.796 15.5449 296.451 14.7049 296.451 13.7449C296.451 12.7849 296.796 11.9449 297.486 11.2249C298.206 10.5049 299.046 10.1449 300.006 10.1449C300.996 10.1449 301.836 10.5049 302.526 11.2249C303.246 11.9449 303.606 12.7849 303.606 13.7449C303.606 14.7049 303.246 15.5449 302.526 16.2649C301.836 16.9549 300.996 17.2999 300.006 17.2999ZM302.931 42.4999H297.126V19.9999H302.931V42.4999Z"
                                    fill="url(#paint3_linear_311_132)"
                                />
                                <path
                                    d="M333.129 19.3699C335.709 19.3699 337.764 20.2099 339.294 21.8899C340.854 23.5699 341.634 25.8199 341.634 28.6399V42.4999H335.829V29.0449C335.829 27.6949 335.499 26.6449 334.839 25.8949C334.179 25.1449 333.249 24.7699 332.049 24.7699C330.729 24.7699 329.694 25.2049 328.944 26.0749C328.224 26.9449 327.864 28.2049 327.864 29.8549V42.4999H322.059V29.0449C322.059 27.6949 321.729 26.6449 321.069 25.8949C320.409 25.1449 319.479 24.7699 318.279 24.7699C316.989 24.7699 315.954 25.2199 315.174 26.1199C314.424 26.9899 314.049 28.2349 314.049 29.8549V42.4999H308.244V19.9999H314.049V22.3849C315.399 20.3749 317.484 19.3699 320.304 19.3699C323.094 19.3699 325.134 20.4499 326.424 22.6099C327.894 20.4499 330.129 19.3699 333.129 19.3699Z"
                                    fill="url(#paint4_linear_311_132)"
                                />
                                <path
                                    d="M363.665 22.6549V19.9999H369.47V42.4999H363.665V39.8449C361.925 42.0349 359.48 43.1299 356.33 43.1299C353.33 43.1299 350.75 41.9899 348.59 39.7099C346.46 37.3999 345.395 34.5799 345.395 31.2499C345.395 27.9499 346.46 25.1449 348.59 22.8349C350.75 20.5249 353.33 19.3699 356.33 19.3699C359.48 19.3699 361.925 20.4649 363.665 22.6549ZM352.955 35.8399C354.125 37.0099 355.61 37.5949 357.41 37.5949C359.21 37.5949 360.695 37.0099 361.865 35.8399C363.065 34.6399 363.665 33.1099 363.665 31.2499C363.665 29.3899 363.065 27.8749 361.865 26.7049C360.695 25.5049 359.21 24.9049 357.41 24.9049C355.61 24.9049 354.125 25.5049 352.955 26.7049C351.785 27.8749 351.2 29.3899 351.2 31.2499C351.2 33.1099 351.785 34.6399 352.955 35.8399Z"
                                    fill="url(#paint5_linear_311_132)"
                                />
                                <path
                                    d="M387.603 19.9999V25.5799H382.518V34.9399C382.518 35.7199 382.713 36.2899 383.103 36.6499C383.493 37.0099 384.063 37.2199 384.813 37.2799C385.563 37.3099 386.493 37.2949 387.603 37.2349V42.4999C383.673 42.9499 380.868 42.5899 379.188 41.4199C377.538 40.2199 376.713 38.0599 376.713 34.9399V25.5799H372.798V19.9999H376.713V15.4549L382.518 13.6999V19.9999H387.603Z"
                                    fill="url(#paint6_linear_311_132)"
                                />
                                <path
                                    d="M412.863 33.6349H395.898C396.648 36.4549 398.763 37.8649 402.243 37.8649C404.463 37.8649 406.143 37.1149 407.283 35.6149L411.963 38.3149C409.743 41.5249 406.473 43.1299 402.153 43.1299C398.433 43.1299 395.448 42.0049 393.198 39.7549C390.948 37.5049 389.823 34.6699 389.823 31.2499C389.823 27.8899 390.933 25.0699 393.153 22.7899C395.343 20.5099 398.193 19.3699 401.703 19.3699C405.033 19.3699 407.748 20.5099 409.848 22.7899C412.008 25.0699 413.088 27.8899 413.088 31.2499C413.088 31.8799 413.013 32.6749 412.863 33.6349ZM395.808 29.1349H407.283C406.953 27.6649 406.278 26.5399 405.258 25.7599C404.268 24.9799 403.083 24.5899 401.703 24.5899C400.143 24.5899 398.853 24.9949 397.833 25.8049C396.813 26.5849 396.138 27.6949 395.808 29.1349Z"
                                    fill="url(#paint7_linear_311_132)"
                                />
                                <path
                                    d="M14.5289 22C14.5289 22 13.5421 2.5 33.0733 2.5C45.069 2.5 48.4496 10.757 49.3279 14.1099C49.5036 14.7808 50.2781 15.1951 50.936 14.9755C52.9378 14.3072 56.8049 13.5141 59.6527 16C62.4644 18.4544 62.8115 22.1382 62.7679 24.1201C62.7529 24.8025 63.3602 25.4225 64.0416 25.462C66.6816 25.615 72.1827 27.1193 72.1827 37C72.1827 45.4958 66.1683 49.5 61.6418 49.5C49.613 49.5 21.53 49.5 14.5289 49.5C7.52768 49.5 2.508 44.9958 2.50001 36C2.48934 24 14.5289 22 14.5289 22ZM14.5289 22C14.5289 22 26.5734 24 28.5782 31.9958"
                                    stroke="url(#paint8_linear_311_132)"
                                    strokeWidth={5}
                                    strokeLinecap="round"
                                />
                                <defs>
                                    <linearGradient
                                    id="paint0_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint1_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint2_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint3_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint4_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint5_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint6_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint7_linear_311_132"
                                    x1={97.7285}
                                    y1={26.5}
                                    x2={419.5}
                                    y2={26.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop offset={0.55} stopColor="#FC7644" />
                                    <stop offset={0.85} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                    <linearGradient
                                    id="paint8_linear_311_132"
                                    x1={2.5}
                                    y1={26}
                                    x2={82}
                                    y2={52.5}
                                    gradientUnits="userSpaceOnUse"
                                    >
                                    <stop stopColor="#FC7644" />
                                    <stop offset={0.6} stopColor="#B43F6E" />
                                    <stop offset={1} stopColor="#6D39CA" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        <p>Спутниковый сервис анализа облачности</p>
                    </div>

                    <p className={styles['description']}>
                        Оцените облачность в любой точке мира по спутниковым данным за пару минут
                    </p>

                    <div className={styles['instruction']}>
                        <p>Как использовать?</p>

                        <ul className={styles['instruction-list']}>
                            <li className={styles['list-element']}>
                                <div className={styles['icon']}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" viewBox="0 0 27 27" fill="none">
                                        <path d="M1 8.40741V4C1 2.34314 2.34315 1 4 1H8.40741M1 18.5926V23C1 24.6569 2.34314 26 4 26H8.40741M26 18.5926V23C26 24.6569 24.6569 26 23 26H18.5926M26 8.40741V4C26 2.34315 24.6569 1 23 1H18.5926" stroke="#E97A54" strokeWidth="2"/>
                                        <path d="M13.5 8C16.5376 8 19 10.4624 19 13.5C19 16.5376 16.5376 19 13.5 19C10.4624 19 8 16.5376 8 13.5C8 10.4624 10.4624 8 13.5 8ZM13.5 11C12.1193 11 11 12.1193 11 13.5C11 14.8807 12.1193 16 13.5 16C14.8807 16 16 14.8807 16 13.5C16 12.1193 14.8807 11 13.5 11Z" fill="#E97A54"/>
                                    </svg>
                                </div>

                                <div className={styles['text']}>
                                    <h5>Выберите область интереса</h5>
                                    <p>Укажите координаты региона <br /> или выберите область</p>
                                </div>
                            </li>

                            <li className={styles['list-element']}>
                                <div className={styles['icon']}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="31" height="22" viewBox="0 0 31 22" fill="none">
                                        <path d="M25.6132 21H6.00607C3.09238 21 1.00333 19.0833 1 15.2553C0.996728 11.4878 3.7233 10.0367 5.15337 9.53477C5.63123 9.36704 5.99206 8.91956 6.0299 8.41453C6.19002 6.27692 7.24176 1 13.7238 1C17.9385 1 19.5977 3.50436 20.2323 5.14302C20.4845 5.79425 21.2906 6.21789 21.9781 6.09536C22.8285 5.94381 23.92 5.97231 24.7853 6.74468C25.6467 7.5135 25.9523 8.56579 26.0464 9.40403C26.1225 10.0823 26.7541 10.7157 27.4085 10.9096C28.5537 11.2489 30 12.339 30 15.6808C30 19.2961 27.497 21 25.6132 21Z" stroke="#E97A54" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                </div>

                                <div className={styles['text']}>
                                    <h5>Настройте параметры анализа</h5>
                                    <p>Выберите источник данных, <br /> дату и время</p>
                                </div>
                            </li>

                            <li className={styles['list-element']}>
                                <div className={styles['icon']}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="21" viewBox="0 0 25 21" fill="none">
                                        <path d="M2 13C2 12.4477 1.55228 12 1 12C0.447715 12 -2.4141e-08 12.4477 0 13L1 13L2 13ZM1 21L2 21L2 13L1 13L0 13L3.4969e-07 21L1 21Z" fill="#E97A54"/>
                                        <path d="M9.5 9C9.5 8.44772 9.05228 8 8.5 8C7.94772 8 7.5 8.44772 7.5 9H8.5H9.5ZM8.5 21H9.5V9H8.5H7.5V21H8.5Z" fill="#E97A54"/>
                                        <path d="M17 5C17 4.44772 16.5523 4 16 4C15.4477 4 15 4.44772 15 5L16 5L17 5ZM16 21L17 21L17 5L16 5L15 5L15 21L16 21Z" fill="#E97A54"/>
                                        <path d="M24.5 1C24.5 0.447715 24.0523 -2.41412e-08 23.5 0C22.9477 2.41412e-08 22.5 0.447715 22.5 1L23.5 1L24.5 1ZM23.5 21L24.5 21L24.5 1L23.5 1L22.5 1L22.5 21L23.5 21Z" fill="#E97A54"/>
                                    </svg>
                                </div>

                                <div className={styles['text']}>
                                    <h5>Получите результат</h5>
                                    <p>Процент и маска облачности, <br /> температура и другое</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className={styles['config-container']}>
                    <div className={styles['menu-container']}>
                        <div className={styles['menu-section']}>
                            <div className={styles['section-header']}>
                                <div className={styles['main-part']}>
                                    <span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 20" fill="none">
                                            <path d="M7.5889 0.000672891C7.5889 0.000672891 15.185 -0.218506 15.1661 7.25458C15.1553 11.3544 10.179 17.4776 8.29789 19.6462C7.91926 20.0824 7.25658 20.0848 6.87504 19.6511C4.98731 17.505 0.0104378 11.4596 3.53004e-05 7.36298C-0.0188198 -0.0760438 7.52027 -0.000173695 7.5889 0.000672891ZM7.59574 3.51727C5.41075 3.51744 3.63968 5.28928 3.63968 7.47431C3.63987 9.65917 5.41087 11.4302 7.59574 11.4304C9.78075 11.4304 11.5526 9.65927 11.5528 7.47431C11.5528 5.28918 9.78086 3.51727 7.59574 3.51727Z" fill="#E97A54"/>
                                        </svg>
                                    </span>

                                    <h3>1. Выберите регион</h3>
                                </div>

                                <div className={styles['additional-part']}>
                                    <button 
                                        className={`${regionInputType === 'draw' ? styles['_active'] : ''}`}
                                        onClick={() => setRegionInputType('draw')}
                                    >
                                        Выбрать регион
                                    </button>

                                    <button 
                                        className={`${regionInputType === 'coords' ? styles['_active'] : ''}`}
                                        onClick={() => setRegionInputType('coords')}
                                    >
                                        Ввести координаты области
                                    </button>
                                </div>
                            </div>

                            <div className={styles['section-content']}>
                                {regionInputType === 'draw' ? (
                                    <>
                                        <span>Выберите один из предустановленных регионов</span>

                                        <div className={styles['region-select-container']}>
                                            <CustomSelect
                                                options={regionOptions.map(r => ({ 
                                                    value: r.value, 
                                                    label: r.label 
                                                }))}
                                                defaultValue="moscow"
                                                placeholder="Выберите регион"
                                                showRecommendationBadge={false}
                                                onChange={(value) => setSelectedRegion(value)}
                                                value={selectedRegion}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span>Задайте прямоугольную область на карте используя координаты</span>

                                        <div className={styles['coordinates-container']}>
                                            <div className={styles['input-group']}>
                                                <label className={styles['input-label']}>Северная широта</label>
                                                
                                                <div className={styles['input-wrapper']}>
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        placeholder="55.0000" 
                                                        value={northLat}
                                                        onChange={(e) => handleCoordinateChange(e.target.value, setNorthLat)}
                                                        onBlur={() => handleCoordinateBlur(northLat, setNorthLat, validateLatitude, formatCoordinate)}
                                                    />
                                                    <span className={styles['degree-symbol']}>°</span>
                                                </div>
                                            </div>

                                            <div className={styles['input-group']}>
                                                <label className={styles['input-label']}>Южная широта</label>
                                                
                                                <div className={styles['input-wrapper']}>
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        placeholder="55.0000" 
                                                        value={southLat}
                                                        onChange={(e) => handleCoordinateChange(e.target.value, setSouthLat)}
                                                        onBlur={() => handleCoordinateBlur(southLat, setSouthLat, validateLatitude, formatCoordinate)}
                                                    />
                                                    <span className={styles['degree-symbol']}>°</span>
                                                </div>
                                            </div>

                                            <div className={styles['input-group']}>
                                                <label className={styles['input-label']}>Западная долгота</label>
                                                
                                                <div className={styles['input-wrapper']}>
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        placeholder="55.0000" 
                                                        value={westLng}
                                                        onChange={(e) => handleCoordinateChange(e.target.value, setWestLng)}
                                                        onBlur={() => handleCoordinateBlur(westLng, setWestLng, validateLongitude, formatCoordinate)}
                                                    />
                                                    <span className={styles['degree-symbol']}>°</span>
                                                </div>
                                            </div>

                                            <div className={styles['input-group']}>
                                                <label className={styles['input-label']}>Восточная долгота</label>
                                                
                                                <div className={styles['input-wrapper']}>
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        placeholder="55.0000" 
                                                        value={eastLng}
                                                        onChange={(e) => handleCoordinateChange(e.target.value, setEastLng)}
                                                        onBlur={() => handleCoordinateBlur(eastLng, setEastLng, validateLongitude, formatCoordinate)}
                                                    />
                                                    <span className={styles['degree-symbol']}>°</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={styles['menu-section']}>
                            <div className={styles['section-header']}>
                                <div className={styles['main-part']}>
                                    <span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 20" fill="none">
                                            <path d="M8.43669 19.5002H0.686452C0.555838 19.5002 0.465781 19.3693 0.512494 19.2473L2.93039 12.934C0.555301 9.95365 -0.00353328 5.85561 2.10539 3.90222C2.17649 3.84533 2.27905 3.85378 2.34343 3.91817L8.09235 9.66697L13.8413 15.4158C13.9118 15.4863 13.9145 15.6003 13.8436 15.6704C12.2757 17.2202 9.41236 17.2422 7.54078 16.3801L8.61121 19.2488C8.65664 19.3705 8.56662 19.5002 8.43669 19.5002Z" fill="#E97A54"/>
                                            <path d="M11.8599 5.91388C12.4965 6.55039 12.4965 7.58239 11.8599 8.2189C11.2234 8.85542 10.1914 8.85542 9.55485 8.2189C8.91833 7.58239 8.91833 6.55039 9.55485 5.91388C10.1914 5.27736 11.2234 5.27736 11.8599 5.91388Z" fill="#E97A54"/>
                                            <path d="M7.54078 16.3801L8.61121 19.2488C8.65664 19.3705 8.56662 19.5002 8.43669 19.5002H0.686452C0.555838 19.5002 0.465781 19.3693 0.512494 19.2473L2.93039 12.934M7.54078 16.3801C5.75432 15.5106 4.27495 14.3976 2.93039 12.934M2.93039 12.934C0.555301 9.95365 -0.00353328 5.85561 2.10539 3.90222C2.17649 3.84533 2.27905 3.85378 2.34343 3.91817L8.09235 9.66697L13.8413 15.4158C13.9118 15.4863 13.9145 15.6003 13.8436 15.6704C12.2757 17.2202 9.41236 17.2422 7.54078 16.3801M9.55485 8.2189C8.91833 7.58239 8.91833 6.55039 9.55485 5.91388C10.1914 5.27736 11.2234 5.27736 11.8599 5.91388C12.4965 6.55039 12.4965 7.58239 11.8599 8.2189C11.2234 8.85542 10.1914 8.85542 9.55485 8.2189ZM9.55485 8.2189L8.09235 9.66697" stroke="#E97A54"/>
                                            <path d="M14.7378 7.69114C14.7378 4.651 12.9079 2.78018 10.1016 3.15435" stroke="#E97A54" strokeLinecap="round"/>
                                            <path d="M17.2668 7.58482C17.2668 2.88633 14.4387 -0.00499643 10.1016 0.573277" stroke="#E97A54" strokeLinecap="round"/>
                                        </svg>
                                    </span>

                                    <h3>2. Выберите источник данных</h3>
                                </div>
                            </div>

                            <div className={styles['section-content']}>
                                <div className={styles['selects-container']}>
                                    <CustomSelect
                                        options={dataSourceOptions}
                                        defaultValue="nasa"
                                        placeholder="Выберите источник данных"
                                        showRecommendationBadge={true}
                                        onChange={setSelectedDataSource}
                                        value={selectedDataSource}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={styles['menu-section']}>
                            <div className={styles['section-header']}>
                                <div className={styles['main-part']}>
                                    <span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 20" fill="none">
                                            <path fillRule="evenodd" clipRule="evenodd" d="M19 18.1176C19 19.1572 18.1701 20 17.1463 20H1.85366C0.829911 20 0 19.1572 0 18.1176V6.82353H19V18.1176ZM4.17073 14.3529C3.78683 14.3529 3.47561 14.669 3.47561 15.0588V16.4706C3.47561 16.8604 3.78683 17.1765 4.17073 17.1765H5.56098C5.94488 17.1765 6.2561 16.8604 6.2561 16.4706V15.0588C6.2561 14.669 5.94488 14.3529 5.56098 14.3529H4.17073ZM8.80488 14.3529C8.42097 14.3529 8.10976 14.669 8.10976 15.0588V16.4706C8.10976 16.8604 8.42097 17.1765 8.80488 17.1765H10.1951C10.579 17.1765 10.8902 16.8604 10.8902 16.4706V15.0588C10.8902 14.669 10.579 14.3529 10.1951 14.3529H8.80488ZM4.17073 9.64706C3.78683 9.64706 3.47561 9.96309 3.47561 10.3529V11.7647C3.47561 12.1546 3.78683 12.4706 4.17073 12.4706H5.56098C5.94488 12.4706 6.2561 12.1546 6.2561 11.7647V10.3529C6.2561 9.96309 5.94488 9.64706 5.56098 9.64706H4.17073ZM8.80488 9.64706C8.42097 9.64706 8.10976 9.96309 8.10976 10.3529V11.7647C8.10976 12.1546 8.42097 12.4706 8.80488 12.4706H10.1951C10.579 12.4706 10.8902 12.1546 10.8902 11.7647V10.3529C10.8902 9.96309 10.579 9.64706 10.1951 9.64706H8.80488ZM13.6707 9.64706C13.2868 9.64706 12.9756 9.96309 12.9756 10.3529V11.7647C12.9756 12.1546 13.2868 12.4706 13.6707 12.4706H15.061C15.4449 12.4706 15.7561 12.1546 15.7561 11.7647V10.3529C15.7561 9.96309 15.4449 9.64706 15.061 9.64706H13.6707Z" fill="#E97A54"/>
                                            <path d="M3.24481 0.712316C3.24464 0.718968 3.24453 0.728757 3.24436 0.741268C3.244 0.766276 3.24367 0.802581 3.24413 0.848575C3.24505 0.940646 3.24869 1.07176 3.25974 1.22886C3.28181 1.54254 3.33352 1.96315 3.4523 2.38534C3.57077 2.80637 3.75847 3.23763 4.05805 3.56526C4.36085 3.8964 4.77469 4.11765 5.3304 4.11765C6.45245 4.11765 7.00052 3.22542 7.26529 2.38902C7.39882 1.96716 7.46526 1.54688 7.49836 1.23323C7.51493 1.0761 7.52316 0.9448 7.52732 0.852711C7.5294 0.806706 7.53064 0.770404 7.53117 0.745404C7.53143 0.732893 7.53155 0.723104 7.53162 0.716452V0.705882H11.4706C11.4706 0.707547 11.4705 0.709695 11.4704 0.712316C11.4703 0.718968 11.4701 0.728757 11.47 0.741268C11.4696 0.766276 11.4693 0.802581 11.4697 0.848575C11.4707 0.940646 11.4743 1.07176 11.4854 1.22886C11.5074 1.54254 11.5591 1.96315 11.6779 2.38534C11.7964 2.80637 11.9841 3.23763 12.2837 3.56526C12.5865 3.8964 13.0003 4.11765 13.556 4.11765C14.6781 4.11765 15.2261 3.22542 15.4909 2.38902C15.6244 1.96716 15.6909 1.54688 15.724 1.23323C15.7405 1.0761 15.7488 0.9448 15.7529 0.852711C15.755 0.806706 15.7562 0.770404 15.7568 0.745404C15.757 0.732893 15.7572 0.723104 15.7572 0.716452V0.705882H17.1463C18.1701 0.705882 19 1.54864 19 2.58824V5.41176H0V2.58824C0 1.54864 0.829911 0.705883 1.85366 0.705882H3.24503C3.24498 0.707547 3.24487 0.709695 3.24481 0.712316Z" fill="#E97A54"/>
                                            <path d="M4.63415 0.823529C4.63415 0.368707 4.99723 0 5.44512 0C5.89301 0 6.2561 0.368707 6.2561 0.823529V2C6.2561 2.45482 5.89301 2.82353 5.44512 2.82353C4.99723 2.82353 4.63415 2.45482 4.63415 2V0.823529Z" fill="#E97A54"/>
                                            <path d="M12.7439 0.823529C12.7439 0.368707 13.107 0 13.5549 0C14.0028 0 14.3659 0.368707 14.3659 0.823529V2C14.3659 2.45482 14.0028 2.82353 13.5549 2.82353C13.107 2.82353 12.7439 2.45482 12.7439 2V0.823529Z" fill="#E97A54"/>
                                        </svg>
                                    </span>

                                    <h3>3. Выберите дату и время</h3>
                                </div>
                            </div>

                            <div className={styles['section-content']}>
                                <div className={styles['inputs-container']}>
                                    <div className={styles['input-wrapper']}>
                                        <label className={styles['input-label']}>Дата</label>

                                        <input 
                                            type="date" 
                                            placeholder='30.05.2026'
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                        />
                                    </div>

                                    <div className={styles['input-wrapper']}>
                                        <label className={styles['input-label']}>Время</label>

                                        <input 
                                            type="time" 
                                            placeholder='00:00'
                                            value={selectedTime}
                                            onChange={(e) => setSelectedTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles['controls']}>
                        <div className={styles['buttons-group']}>
                            <button className={styles['button-reset']} onClick={resetSettings}>
                                <span className={styles['icon']}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" fill="none">
                                        <path d="M1.25226 6.92029H0.252259V7.92029H1.25226V6.92029ZM6.75487 7.92029C7.30715 7.92029 7.75487 7.47257 7.75487 6.92029C7.75487 6.368 7.30715 5.92029 6.75487 5.92029V6.92029V7.92029ZM2.25226 1.27536C2.25226 0.723078 1.80454 0.275362 1.25226 0.275362C0.699974 0.275362 0.252259 0.723078 0.252259 1.27536H1.25226H2.25226ZM19.7878 13.8358H20.7878V12.8358H19.7878V13.8358ZM18.7878 19.7246C18.7878 20.2769 19.2355 20.7246 19.7878 20.7246C20.3401 20.7246 20.7878 20.2769 20.7878 19.7246H19.7878H18.7878ZM14.128 12.8358C13.5757 12.8358 13.128 13.2835 13.128 13.8358C13.128 14.3881 13.5757 14.8358 14.128 14.8358V13.8358V12.8358ZM0.982422 12.25L0.000362396 12.4386C0.940075 17.3325 5.35184 21 10.6127 21V20V19C6.28596 19 2.71865 15.989 1.96448 12.0614L0.982422 12.25ZM19.9824 8.875L20.967 8.70001C20.0849 3.73695 15.6392 0 10.3291 0V1V2C14.6968 2 18.2901 5.068 18.9979 9.04999L19.9824 8.875ZM10.3291 1V0C5.82217 0 1.94378 2.68927 0.330201 6.53324L1.25226 6.92029L2.17432 7.30734C3.47598 4.20645 6.62724 2 10.3291 2V1ZM1.25226 6.92029V7.92029H6.75487V6.92029V5.92029H1.25226V6.92029ZM1.25226 6.92029H2.25226V1.27536H1.25226H0.252259V6.92029H1.25226ZM10.6127 20V21C15.2241 21 19.1781 18.1844 20.7205 14.1965L19.7878 13.8358L18.8551 13.4751C17.6119 16.6896 14.4009 19 10.6127 19V20ZM19.7878 13.8358H18.7878V19.7246H19.7878H20.7878V13.8358H19.7878ZM19.7878 13.8358V12.8358H14.128V13.8358V14.8358H19.7878V13.8358Z" fill="white"/>
                                    </svg>
                                </span>

                                <span className={styles['text']}>Сбросить настройки</span>
                            </button>

                            <button className={styles['button-start']} onClick={handleStartAnalysis}>Приступить к анализу</button>
                        </div>
                    </div>
                </div>
            </div>

            <Notification 
                message={notification.message}
                isVisible={notification.isVisible}
                onClose={hideNotification}
                duration={5000}
            />
        </div>
    );
}