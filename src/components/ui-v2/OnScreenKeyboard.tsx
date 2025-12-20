import { useState } from 'react';
import { cn } from '../../lib/utils';

interface OnScreenKeyboardProps {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onChange: (value: string) => void;
    onEnter?: () => void;
    type?: 'text' | 'number';
    title?: string;
}

export function OnScreenKeyboard({
    isOpen,
    onClose,
    value,
    onChange,
    onEnter,
    type = 'text',
    title
}: OnScreenKeyboardProps) {
    const [layout, setLayout] = useState<'lowercase' | 'uppercase' | 'symbols'>('uppercase');

    if (!isOpen) return null;

    const handleKeyClick = (key: string) => {
        if (key === 'BACKSPACE') {
            onChange(value.slice(0, -1));
        } else if (key === 'ENTER') {
            onEnter?.();
            onClose();
        } else if (key === 'SHIFT') {
            setLayout(layout === 'lowercase' ? 'uppercase' : 'lowercase');
        } else if (key === '123' || key === 'ABC') {
            setLayout(layout === 'symbols' ? 'uppercase' : 'symbols');
        } else if (key === 'SPACE') {
            onChange(value + ' ');
        } else {
            onChange(value + key);
        }
    };

    const rows = layout === 'symbols'
        ? [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
            ['ABC', '.', ',', '?', '!', "'", 'BACKSPACE']
        ]
        : layout === 'uppercase'
            ? [
                ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
                ['123', 'SPACE', 'ENTER']
            ]
            : [
                ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'BACKSPACE'],
                ['123', 'SPACE', 'ENTER']
            ];

    const numericRows = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['CLEAR', '0', 'BACKSPACE'],
        ['CANCEL', 'ENTER']
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:p-6 pointer-events-none">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
            />

            <div className="relative w-full max-w-3xl bg-card border border-border rounded-3xl shadow-2xl p-6 pointer-events-auto animate-slide-in-bottom">
                {title && (
                    <div className="text-center mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
                        <div className="text-2xl font-black text-accent mt-1 h-8 flex items-center justify-center">
                            {value || <span className="opacity-20">Type something...</span>}
                            <span className="w-1 h-6 bg-accent ml-1 animate-pulse" />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {(type === 'number' ? numericRows : rows).map((row, i) => (
                        <div key={i} className="flex justify-center gap-2">
                            {row.map((key) => {
                                const isAction = ['BACKSPACE', 'ENTER', 'SHIFT', '123', 'ABC', 'SPACE', 'CLEAR', 'CANCEL'].includes(key);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            if (key === 'CLEAR') onChange('');
                                            else if (key === 'CANCEL') onClose();
                                            else handleKeyClick(key);
                                        }}
                                        className={cn(
                                            "h-14 sm:h-16 flex items-center justify-center rounded-xl font-bold transition-all active:scale-95",
                                            key === 'SPACE' ? "flex-[4]" : "flex-1",
                                            key === 'ENTER' ? "bg-accent text-white" :
                                                isAction ? "bg-white/10 text-foreground" : "bg-white/5 text-foreground hover:bg-white/10",
                                            "text-sm sm:text-base border border-white/5"
                                        )}
                                    >
                                        {key === 'BACKSPACE' ? '⌫' :
                                            key === 'SHIFT' ? '⇧' :
                                                key === 'SPACE' ? 'SPACE' :
                                                    key === 'ENTER' ? 'DONE' : key}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
