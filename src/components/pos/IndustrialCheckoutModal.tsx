import { useState, useMemo, useRef, useEffect } from 'react';
import { OrderType, CartItem } from '../../types/pos';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { billService } from '../../lib/billService';
import { Percent, Tag } from 'lucide-react';

export interface IndustrialCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    tax: number;
    total: number;
    orderType: OrderType;
    tableNumber: number | null;
    cartItems?: CartItem[];
    onGenerateBill: (cashDiscount?: number) => Promise<void>;
}

export function IndustrialCheckoutModal({
    isOpen,
    onClose,
    subtotal,
    orderType,
    tableNumber,
    cartItems,
    onGenerateBill,
}: IndustrialCheckoutModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDiscountInput, setShowDiscountInput] = useState(true); // Start expanded
    const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
    const [discountValue, setDiscountValue] = useState('');
    const discountInputRef = useRef<HTMLInputElement>(null);

    const { settings, isConfigured, calculatePackingCharges } = useRestaurantSettingsStore();

    // Reset discount when modal closes, expand when opens
    useEffect(() => {
        if (isOpen) {
            // Start expanded when modal opens
            setShowDiscountInput(true);
        } else {
            setShowDiscountInput(false);
            setDiscountValue('');
            setDiscountType('amount');
        }
    }, [isOpen]);

    // Focus input when discount panel opens
    useEffect(() => {
        if (showDiscountInput && discountInputRef.current) {
            setTimeout(() => discountInputRef.current?.focus(), 100);
        }
    }, [showDiscountInput]);

    // Calculate actual discount amount
    const discountAmount = useMemo(() => {
        const value = parseFloat(discountValue) || 0;
        if (discountType === 'percent') {
            return (subtotal * value) / 100;
        }
        return value;
    }, [discountValue, discountType, subtotal]);

    // Calculate packing charges for takeout orders
    const packingChargesResult = useMemo(() => {
        if (!cartItems || cartItems.length === 0) {
            return { items: [], totalCharge: 0 };
        }
        return calculatePackingCharges(
            cartItems.map(item => ({
                name: item.menuItem.name,
                category: item.menuItem.category || '',
                quantity: item.quantity,
            })),
            orderType
        );
    }, [cartItems, orderType, calculatePackingCharges]);

    const packingCharges = packingChargesResult.totalCharge;

    // Calculate taxes using bill service (with discount applied)
    const billTotals = useMemo(() => {
        const totals = billService.calculateBillTotals(subtotal, discountAmount);
        // Add packing charges to grand total
        return {
            ...totals,
            packingCharges,
            grandTotal: totals.grandTotal + packingCharges,
        };
    }, [subtotal, discountAmount, packingCharges]);

    // Quick discount buttons
    const quickDiscounts = [
        { label: '₹50', value: 50, type: 'amount' as const },
        { label: '₹100', value: 100, type: 'amount' as const },
        { label: '5%', value: 5, type: 'percent' as const },
        { label: '10%', value: 10, type: 'percent' as const },
    ];

    const handleGenerateBill = async () => {
        setIsSubmitting(true);
        try {
            await onGenerateBill(discountAmount > 0 ? discountAmount : undefined);
            onClose();
        } catch (error) {
            console.error('Failed to generate bill:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <IndustrialModal open={isOpen} onClose={onClose} title="GENERATE BILL" size="md">
            <div className="space-y-6">
                {/* Restaurant Header */}
                {isConfigured && (
                    <div className="text-center border-b border-slate-300 pb-3">
                        <h3 className="font-bold text-lg text-slate-800">{settings.name}</h3>
                        {settings.gstNumber && (
                            <p className="text-xs text-slate-500 font-mono">GSTIN: {settings.gstNumber}</p>
                        )}
                    </div>
                )}

                {/* Receipt-like summary */}
                <div className="bg-yellow-50 border-2 border-yellow-200 p-4 text-slate-800 font-mono">
                    <div className="border-b-2 border-dashed border-slate-300 pb-2 mb-2">
                        <div className="flex justify-between font-bold uppercase text-sm">
                            <span>Order Type</span>
                            <span>{orderType}</span>
                        </div>
                        {orderType === 'dine-in' && tableNumber && (
                            <div className="flex justify-between font-bold uppercase text-sm">
                                <span>Table</span>
                                <span>#{tableNumber}</span>
                            </div>
                        )}
                    </div>

                    {/* Subtotal */}
                    <div className="flex justify-between text-sm py-1">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toFixed(0)}</span>
                    </div>

                    {/* Packing Charges (for takeout) */}
                    {packingCharges > 0 && (
                        <div className="flex justify-between text-sm py-1 text-amber-700">
                            <span>Packing Charges</span>
                            <span>+₹{packingCharges.toFixed(0)}</span>
                        </div>
                    )}

                    {/* Cash Discount */}
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-sm py-1 text-emerald-700">
                            <span>Cash Discount</span>
                            <span>-₹{discountAmount.toFixed(0)}</span>
                        </div>
                    )}

                    <div className="flex justify-between font-black text-3xl uppercase pt-2 border-t-2 border-dashed border-slate-300 mt-2">
                        <span>Total</span>
                        <span>₹{billTotals.grandTotal.toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-slate-500 text-center mt-2">
                        (Inclusive of all taxes)
                    </p>
                </div>

                {/* Cash Discount Section */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setShowDiscountInput(!showDiscountInput)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Tag size={18} className="text-emerald-600" />
                            <span className="font-bold text-slate-700">Cash Discount</span>
                        </div>
                        {discountAmount > 0 ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-bold text-sm">
                                -₹{discountAmount.toFixed(0)}
                            </span>
                        ) : (
                            <span className="text-slate-400 text-sm">Add discount →</span>
                        )}
                    </button>

                    {showDiscountInput && (
                        <div className="p-3 bg-white border-t border-slate-200 space-y-3">
                            {/* Discount Type Toggle */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setDiscountType('amount');
                                        setDiscountValue('');
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-1 ${
                                        discountType === 'amount'
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    ₹ Amount
                                </button>
                                <button
                                    onClick={() => {
                                        setDiscountType('percent');
                                        setDiscountValue('');
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-1 ${
                                        discountType === 'percent'
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <Percent size={14} /> Percent
                                </button>
                            </div>

                            {/* Input Field */}
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                                    {discountType === 'amount' ? '₹' : '%'}
                                </span>
                                <input
                                    ref={discountInputRef}
                                    type="number"
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(e.target.value)}
                                    placeholder={discountType === 'amount' ? 'Enter amount' : 'Enter percentage'}
                                    className="w-full pl-8 pr-4 py-3 border-2 border-slate-200 rounded-lg text-lg font-bold focus:outline-none focus:border-emerald-500"
                                    min="0"
                                    max={discountType === 'percent' ? 100 : subtotal}
                                />
                            </div>

                            {/* Quick Discount Buttons */}
                            <div className="grid grid-cols-4 gap-2">
                                {quickDiscounts.map((qd) => (
                                    <button
                                        key={qd.label}
                                        onClick={() => {
                                            setDiscountType(qd.type);
                                            setDiscountValue(qd.value.toString());
                                        }}
                                        className={`py-2 rounded-lg font-bold text-sm transition-colors ${
                                            discountType === qd.type && discountValue === qd.value.toString()
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {qd.label}
                                    </button>
                                ))}
                            </div>

                            {/* Clear Button */}
                            {discountValue && (
                                <button
                                    onClick={() => setDiscountValue('')}
                                    className="w-full py-2 text-sm text-red-600 hover:text-red-700 font-bold"
                                >
                                    Clear Discount
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Payment info note */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                        Payment will be collected on the handheld terminal (Cash / Card / UPI).
                    </p>
                </div>

                {/* Warning if not configured */}
                {!isConfigured && (
                    <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg">
                        <p className="text-xs text-amber-800">
                            <span className="font-bold">Note:</span> Restaurant settings not configured.
                            Configure GST, FSSAI, and other details in Manager Dashboard for proper tax invoices.
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <IndustrialButton variant="secondary" onClick={onClose} disabled={isSubmitting} size="lg">
                        BACK
                    </IndustrialButton>
                    <IndustrialButton variant="success" onClick={handleGenerateBill} disabled={isSubmitting} size="lg" className={isSubmitting ? 'animate-pulse' : ''}>
                        {isSubmitting ? 'GENERATING...' : 'GENERATE BILL'}
                    </IndustrialButton>
                </div>
            </div>
        </IndustrialModal>
    );
}
