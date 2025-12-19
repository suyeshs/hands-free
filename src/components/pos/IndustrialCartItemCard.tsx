import { CartItem } from '../../types/pos';
import { cn } from '../../lib/utils';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';

export interface IndustrialCartItemCardProps {
    item: CartItem;
    onUpdateQuantity: (cartItemId: string, quantity: number) => void;
    onRemove: (cartItemId: string) => void;
    className?: string;
}

export function IndustrialCartItemCard({
    item,
    onUpdateQuantity,
    onRemove,
    className,
}: IndustrialCartItemCardProps) {
    return (
        <div className={cn('bg-white border-2 border-gray-300 p-3 mb-2', className)}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-lg uppercase leading-tight">
                        {item.menuItem.name}
                    </div>
                    {item.modifiers.length > 0 && (
                        <div className="text-sm font-medium text-gray-600 mt-1 uppercase">
                            {item.modifiers.map((mod) => mod.name).join(', ')}
                        </div>
                    )}
                    {item.specialInstructions && (
                        <div className="text-sm font-bold text-yellow-600 mt-1 bg-yellow-50 p-1 border border-yellow-200 inline-block uppercase">
                            Note: {item.specialInstructions}
                        </div>
                    )}
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="font-black text-gray-900 text-lg">
                        ₹{item.subtotal.toFixed(2)}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t-2 border-gray-100 pt-2">
                <div className="flex items-center gap-1">
                    <IndustrialButton
                        size="sm"
                        variant="secondary"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-10 h-10 flex items-center justify-center p-0 text-xl"
                    >
                        −
                    </IndustrialButton>
                    <span className="w-12 text-center font-black text-xl text-gray-900">
                        {item.quantity}
                    </span>
                    <IndustrialButton
                        size="sm"
                        variant="secondary"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-10 h-10 flex items-center justify-center p-0 text-xl"
                    >
                        +
                    </IndustrialButton>
                </div>

                <button
                    onClick={() => onRemove(item.id)}
                    className="text-sm font-bold text-red-600 hover:text-red-800 uppercase tracking-wider underline decoration-2 underline-offset-4"
                >
                    Remove
                </button>
            </div>
        </div>
    );
}
