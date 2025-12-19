import { useState } from 'react';
import { MenuItem, CartModifier } from '../../types/pos';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';

import { cn } from '../../lib/utils';

export interface IndustrialModifierModalProps {
    isOpen: boolean;
    onClose: () => void;
    menuItem: MenuItem | null;
    onAddToCart: (menuItem: MenuItem, quantity: number, modifiers: CartModifier[], specialInstructions?: string) => void;
}

export function IndustrialModifierModal({
    isOpen,
    onClose,
    menuItem,
    onAddToCart,
}: IndustrialModifierModalProps) {
    const [quantity, setQuantity] = useState(1);
    const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
    const [specialInstructions, setSpecialInstructions] = useState('');

    if (!menuItem) return null;

    const handleToggleModifier = (modifierId: string) => {
        setSelectedModifiers((prev) => {
            const next = new Set(prev);
            if (next.has(modifierId)) {
                next.delete(modifierId);
            } else {
                next.add(modifierId);
            }
            return next;
        });
    };

    const handleAddToCart = () => {
        const modifiers: CartModifier[] = menuItem.modifiers
            ? menuItem.modifiers
                .filter((mod) => selectedModifiers.has(mod.id))
                .map((mod) => ({
                    id: mod.id,
                    name: mod.name,
                    price: mod.price,
                }))
            : [];

        onAddToCart(menuItem, quantity, modifiers, specialInstructions || undefined);

        // Reset and close
        setQuantity(1);
        setSelectedModifiers(new Set());
        setSpecialInstructions('');
        onClose();
    };

    const modifiersTotal = menuItem.modifiers
        ? menuItem.modifiers
            .filter((mod) => selectedModifiers.has(mod.id))
            .reduce((sum, mod) => sum + mod.price, 0)
        : 0;

    const itemTotal = (menuItem.price + modifiersTotal) * quantity;

    return (
        <IndustrialModal open={isOpen} onClose={onClose} title={menuItem.name} size="lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Side: Info & Modifiers */}
                <div className="space-y-6">
                    <div className="bg-gray-50 p-4 border border-gray-200">
                        <p className="text-gray-700 font-medium text-lg leading-relaxed">
                            {menuItem.description || "No description available."}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                            <span className="font-bold text-gray-500 uppercase">Base Price</span>
                            <span className="font-black text-2xl text-slate-800">₹{menuItem.price}</span>
                        </div>
                    </div>

                    {/* Modifiers Grid */}
                    {menuItem.modifiers && menuItem.modifiers.length > 0 && (
                        <div>
                            <h4 className="font-black text-slate-800 uppercase tracking-wide mb-3 border-b-2 border-slate-200 pb-1">
                                Customize Order
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                                {menuItem.modifiers.map((modifier) => {
                                    const isSelected = selectedModifiers.has(modifier.id);
                                    return (
                                        <button
                                            key={modifier.id}
                                            onClick={() => handleToggleModifier(modifier.id)}
                                            disabled={!modifier.available}
                                            className={cn(
                                                'w-full p-4 border-2 font-bold text-left flex justify-between items-center transition-all',
                                                isSelected
                                                    ? 'bg-slate-800 text-white border-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                                                !modifier.available && 'opacity-50 cursor-not-allowed'
                                            )}
                                        >
                                            <span className="uppercase">{modifier.name}</span>
                                            <span>{modifier.price > 0 ? `+₹${modifier.price}` : 'FREE'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Instructions & Total */}
                <div className="flex flex-col h-full space-y-6">
                    <div className="flex-1">
                        <label className="block font-black text-slate-800 uppercase tracking-wide mb-2">
                            Special Instructions
                        </label>
                        <textarea
                            value={specialInstructions}
                            onChange={(e) => setSpecialInstructions(e.target.value)}
                            placeholder="ALLERGIES? EXTRA SAUCE? TYPE HERE."
                            className="w-full h-32 p-4 border-2 border-gray-300 bg-gray-50 text-lg font-medium focus:border-slate-800 focus:bg-white focus:outline-none placeholder:text-gray-400"
                        />
                    </div>

                    <div>
                        <label className="block font-black text-slate-800 uppercase tracking-wide mb-2">
                            Quantity
                        </label>
                        <div className="flex items-center gap-0 border-2 border-slate-800 bg-white">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-16 h-16 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 font-black text-3xl text-slate-800 flex items-center justify-center border-r-2 border-slate-800"
                            >
                                −
                            </button>
                            <div className="flex-1 text-center font-black text-4xl text-slate-900">
                                {quantity}
                            </div>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-16 h-16 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 font-black text-3xl text-slate-800 flex items-center justify-center border-l-2 border-slate-800"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-2 border-black">
                        <span className="font-bold uppercase tracking-wider">Total Amount</span>
                        <span className="font-black text-3xl">₹{itemTotal.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <IndustrialButton variant="secondary" onClick={onClose} size="lg">
                            CANCEL
                        </IndustrialButton>
                        <IndustrialButton variant="success" onClick={handleAddToCart} size="lg">
                            ADD TO CART
                        </IndustrialButton>
                    </div>
                </div>
            </div>
        </IndustrialModal>
    );
}
