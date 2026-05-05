'use client';

import React from 'react';

interface SpeechIconProps {
    className?: string;
    size?: number | string;
    primaryColor?: string;
    secondaryColor?: string;
}

/**
 * A unique, stylized speech icon designed for the handsfree branding.
 * Features a modern profile and adaptive sound waves.
 */
export const SpeechIcon = ({
    className = '',
    size = 48,
    primaryColor = '#6366f1', // indigo-500
    secondaryColor = '#a855f7' // purple-500
}: SpeechIconProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-[0_0_8px_rgba(99,102,241,0.3)] ${className}`}
    >
        <defs>
            <linearGradient id="speech-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={primaryColor} />
                <stop offset="100%" stopColor={secondaryColor} />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        {/* Stylized Face Profile - Fluid and Minimal */}
        <path
            d="M 35 15 
               C 40 25, 45 40, 52 45 
               C 55 48, 56 50, 50 54 
               C 44 58, 42 62, 50 68 
               C 55 72, 52 80, 45 85 
               C 40 90, 30 95, 20 98"
            stroke="url(#speech-icon-gradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-500"
        />

        {/* Dynamic Sound Waves - Variable intensity/opacity */}
        <g filter="url(#glow)">
            <path
                d="M 68 42 Q 76 52, 68 62"
                stroke="url(#speech-icon-gradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="opacity-90"
            />
            <path
                d="M 80 32 Q 95 52, 80 72"
                stroke="url(#speech-icon-gradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="opacity-60"
            />
            <path
                d="M 92 22 Q 115 52, 92 82"
                stroke="url(#speech-icon-gradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="opacity-30"
            />
        </g>
    </svg>
);
