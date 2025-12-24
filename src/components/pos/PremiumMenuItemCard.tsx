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
                "card-interactive group relative flex flex-col p-3",
                disabled
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer",
                className
            )}
        >
            <div className="flex flex-col">
                <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-accent transition-colors leading-tight">
                    {item.name}
                </h3>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="text-xs font-black text-accent bg-accent/10 px-1.5 py-0.5 rounded-md shadow-sm">
                        ₹{item.price}
                    </div>
                    <div className="flex gap-1 items-center">
                        {item.tags?.includes('veg') && <span className="h-2 w-2 rounded-full bg-success shadow-sm" title="Vegetarian" />}
                        {item.tags?.includes('popular') && <span className="text-[8px] font-black uppercase text-warning tracking-tighter">Popular</span>}
                    </div>
                </div>
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground line-clamp-1">
                {item.description || 'No description'}
            </p>

            <div className="mt-3 flex justify-end">
                <div className="w-7 h-7 rounded-lg neo-raised-sm flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all">
                    <span className="text-sm font-bold">+</span>
                </div>
            </div>
        </div>
    );
}
