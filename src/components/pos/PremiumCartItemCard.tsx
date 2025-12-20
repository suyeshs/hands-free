import { CartItem } from '../../types/pos';
import { cn } from '../../lib/utils';

interface PremiumCartItemCardProps {
    item: CartItem;
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
    className?: string;
}

export function PremiumCartItemCard({
    item,
    onUpdateQuantity,
    onRemove,
    className,
}: PremiumCartItemCardProps) {
    return (
        <div className={cn("glass-card p-3 rounded-xl flex gap-3 animate-fade-in", className)}>
            {/* Item Info */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm text-foreground truncate">{item.menuItem.name}</h4>
                    <button
                        onClick={() => onRemove(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                    >
                        <span className="text-lg">×</span>
                    </button>
                </div>

                <div className="text-xs text-muted-foreground mt-0.5">
                    ₹{item.menuItem.price} × {item.quantity}
                </div>

                {/* Modifiers */}
                {item.modifiers && item.modifiers.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {item.modifiers.map((mod, idx) => (
                            <span key={idx} className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-muted-foreground">
                                + {mod.name}
                            </span>
                        ))}
                    </div>
                )}

                {/* Quantity Controls */}
                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center bg-black/20 rounded-lg border border-white/5 p-0.5">
                        <button
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors text-lg"
                        >
                            −
                        </button>
                        <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                        <button
                            onClick={() => onUpdateQuantity(item.id, 1)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors text-lg"
                        >
                            +
                        </button>
                    </div>
                    <div className="font-bold text-accent">
                        ₹{(item.menuItem.price * item.quantity).toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
}
