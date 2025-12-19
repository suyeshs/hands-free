import { MenuItem } from '../../types/pos';
import { IndustrialCard } from '../ui-industrial/IndustrialCard';

import { cn } from '../../lib/utils';
import { IndustrialBadge } from '../ui-industrial/IndustrialBadge';

export interface IndustrialMenuItemCardProps {
    item: MenuItem;
    onAddToCart: (item: MenuItem) => void;
    className?: string;
}

export function IndustrialMenuItemCard({ item, onAddToCart, className }: IndustrialMenuItemCardProps) {
    const isVeg = item.tags?.includes('veg');
    const isNonVeg = item.tags?.includes('non-veg');

    return (
        <IndustrialCard
            variant="bordered"
            padding="none"
            className={cn('flex flex-col h-full bg-white', !item.available && 'opacity-60 grayscale', className)}
        >
            <button
                onClick={() => item.available && onAddToCart(item)}
                disabled={!item.available}
                className="w-full text-left flex-1 flex flex-col h-full"
            >
                {/* Header/Image Area */}
                <div className="bg-gray-100 p-4 border-b-2 border-gray-200 flex justify-between items-start">
                    <div className="flex gap-1">
                        {isVeg && <IndustrialBadge variant="success" size="sm">VEG</IndustrialBadge>}
                        {isNonVeg && <IndustrialBadge variant="danger" size="sm">NON-VEG</IndustrialBadge>}
                    </div>

                    {item.preparationTime && (
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {item.preparationTime} MIN
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-xl text-gray-900 leading-tight mb-2 uppercase">{item.name}</h3>

                    {item.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-4 font-medium">
                            {item.description}
                        </p>
                    )}

                    <div className="mt-auto flex items-center justify-between">
                        <span className="text-2xl font-black text-slate-800">
                            ₹{item.price}
                        </span>

                        {item.modifiers && item.modifiers.length > 0 && (
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 uppercase">
                                Custom
                            </span>
                        )}
                    </div>
                </div>

                {/* Action Bar */}
                <div className="bg-slate-900 p-2 text-center text-white font-bold uppercase tracking-widest text-sm group-hover:bg-slate-800 transition-colors">
                    {item.available ? 'Add to Order' : 'Unavailable'}
                </div>
            </button>
        </IndustrialCard>
    );
}
