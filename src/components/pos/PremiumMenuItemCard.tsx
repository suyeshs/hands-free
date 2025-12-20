import { MenuItem } from '../../types/pos';
import { cn } from '../../lib/utils';

interface PremiumMenuItemCardProps {
    item: MenuItem;
    onAddToCart: (item: MenuItem) => void;
    className?: string;
    disabled?: boolean;
    disabledMessage?: string;
}

export function PremiumMenuItemCard({ item, onAddToCart, className, disabled, disabledMessage }: PremiumMenuItemCardProps) {
    return (
        <div
            onClick={() => !disabled && onAddToCart(item)}
            title={disabled ? disabledMessage : undefined}
            className={cn(
                "glass-card group relative flex flex-col p-3 rounded-xl transition-all border border-white/5",
                disabled
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer hover:bg-white/5",
                className
            )}
        >
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-accent transition-colors leading-tight">
                        {item.name}
                    </h3>
                    <div className="mt-1 flex gap-1">
                        {item.tags?.includes('veg') && <span className="h-1.5 w-1.5 rounded-full bg-green-500" title="Vegetarian" />}
                        {item.tags?.includes('popular') && <span className="text-[8px] font-black uppercase text-amber-500 tracking-tighter">Popular</span>}
                    </div>
                </div>
                <div className="text-xs font-black text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                    ₹{item.price}
                </div>
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground line-clamp-1 opacity-60">
                {item.description || 'No description'}
            </p>

            <div className="mt-3 flex justify-end">
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all">
                    <span className="text-sm font-bold">+</span>
                </div>
            </div>
        </div>
    );
}
