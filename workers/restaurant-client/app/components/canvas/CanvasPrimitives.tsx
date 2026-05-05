'use client';

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export const GlassCard = ({ children, className = '', onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
    <div
        onClick={onClick}
        className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 transition-all duration-500 hover:bg-white/10 hover:border-white/20 active:scale-[0.98] ${className}`}
    >
        {children}
    </div>
);

export const AdaptiveDishCard = ({ dish, onAdd, animation = 'fade-in' }: { dish: any, onAdd: (dish: any) => void, animation?: string }) => (
    <GlassCard className={`w-full max-w-sm animate-${animation} group`}>
        <div className="relative h-48 w-full mb-4 overflow-hidden rounded-2xl">
            <img
                src={dish.photo_url || dish.imageUrl}
                alt={dish.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold tracking-wider">
                ${dish.price}
            </div>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">{dish.name}</h3>
        <p className="text-white/60 text-sm font-light leading-relaxed mb-6 line-clamp-2">{dish.description}</p>
        <button
            onClick={() => onAdd(dish)}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/20 active:translate-y-0.5"
        >
            Add to Order
        </button>
    </GlassCard>
);

export const AIAdviceCard = ({ text, type = 'suggestion' }: { text: string, type?: string }) => (
    <div className={`flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br ${type === 'warning' ? 'from-amber-500/10 to-amber-600/5 border-amber-500/20' : 'from-indigo-500/10 to-purple-600/5 border-indigo-500/20'
        } border backdrop-blur-md animate-slide-up`}>
        <div className={`mt-1 text-xl ${type === 'warning' ? 'text-amber-400' : 'text-indigo-400'}`}>
            {type === 'warning' ? '⚠️' : '✨'}
        </div>
        <p className="text-white/80 text-sm font-light leading-relaxed italic">"{text}"</p>
    </div>
);

export const TranscriptionOsd = ({ text, speaker }: { text: string, speaker: 'user' | 'assistant' }) => (
    <div className={`flex flex-col ${speaker === 'user' ? 'items-end' : 'items-start'} mb-4`}>
        <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-light ${speaker === 'user'
            ? 'bg-indigo-500/20 text-white border border-indigo-500/30'
            : 'bg-white/5 text-white/90 border border-white/10'
            }`}>
            {text}
        </div>
    </div>
);

export const AnchorStack = ({ items, onSelect }: { items: any[], onSelect: (item: any) => void }) => (
    <div className="flex flex-wrap justify-center gap-3">
        {items.map((item, i) => (
            <button
                key={i}
                onClick={() => onSelect(item)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-white/80 hover:text-white px-5 py-2 rounded-full text-xs font-medium transition-all duration-300 transform hover:-translate-y-1"
            >
                {item.name}
            </button>
        ))}
    </div>
);

export const PulseMic = ({ isActive, volume = 0 }: { isActive: boolean, volume?: number }) => (
    <div className="relative flex items-center justify-center">
        {/* Outer glowing rings */}
        <div className={`absolute w-32 h-32 rounded-full bg-indigo-500/10 transition-all duration-300 ${isActive ? 'animate-ping scale-150 op-30' : 'scale-0'}`} />
        <div className={`absolute w-24 h-24 rounded-full bg-indigo-500/20 transition-all duration-500 ${isActive ? 'animate-pulse scale-125 op-50' : 'scale-0'}`} />

        {/* Main mic body */}
        <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${isActive ? 'bg-indigo-500 text-white scale-110' : 'bg-white/5 text-white/40 border border-white/10'
            }`}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" />
            </svg>

            {/* Dynamic volume bars */}
            {isActive && (
                <div className="absolute -bottom-8 flex gap-1 h-6 items-end">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div
                            key={i}
                            className="w-1 bg-indigo-400 rounded-full transition-all duration-75"
                            style={{ height: `${Math.random() * volume * 100}%`, minHeight: '4px' }}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>
);

export const GestureSlider = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => {
    const [isDragging, setIsDragging] = React.useState(false);

    return (
        <div className="w-full max-w-xs bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/10">
            <div className="flex justify-between items-center mb-3">
                <span className="text-white/60 text-xs font-bold tracking-widest uppercase">{label}</span>
                <span className="text-indigo-400 font-mono text-sm">{Math.round(value * 100)}%</span>
            </div>
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer group">
                <div
                    className="absolute h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    style={{ width: `${value * 100}%` }}
                />
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
        </div>
    );
};
