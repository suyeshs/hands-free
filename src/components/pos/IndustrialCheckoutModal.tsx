import { useState, useMemo } from 'react';
import { OrderType, CartItem } from '../../types/pos';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { billService } from '../../lib/billService';

export interface IndustrialCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    tax: number;
    total: number;
    orderType: OrderType;
    tableNumber: number | null;
    cartItems?: CartItem[];
    onGenerateBill: () => Promise<void>;
}

export function IndustrialCheckoutModal({
    isOpen,
    onClose,
    subtotal,
    orderType,
    tableNumber,
    onGenerateBill,
}: IndustrialCheckoutModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { settings, isConfigured } = useRestaurantSettingsStore();

    // Calculate taxes using bill service
    const billTotals = useMemo(() => {
        return billService.calculateBillTotals(subtotal, 0);
    }, [subtotal]);

    const handleGenerateBill = async () => {
        setIsSubmitting(true);
        try {
            await onGenerateBill();
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

                    <div className="flex justify-between font-black text-3xl uppercase pt-2">
                        <span>Total</span>
                        <span>₹{billTotals.grandTotal.toFixed(0)}</span>
                    </div>
                    <p className="text-xs text-slate-500 text-center mt-2">
                        (Inclusive of all taxes)
                    </p>
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
