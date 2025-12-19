import { useState } from 'react';
import { PaymentMethod, OrderType } from '../../types/pos';
import { IndustrialModal } from '../ui-industrial/IndustrialModal';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { cn } from '../../lib/utils';

export interface IndustrialCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    tax: number;
    total: number;
    orderType: OrderType;
    tableNumber: number | null;
    onSubmit: (paymentMethod: PaymentMethod) => Promise<void>;
}

export function IndustrialCheckoutModal({
    isOpen,
    onClose,
    subtotal,
    tax,
    total,
    orderType,
    tableNumber,
    onSubmit,
}: IndustrialCheckoutModalProps) {
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const paymentMethods: { id: PaymentMethod; label: string; icon: string }[] = [
        { id: 'cash', label: 'CASH', icon: '💵' },
        { id: 'card', label: 'CARD', icon: '💳' },
        { id: 'upi', label: 'UPI', icon: '📱' },
        { id: 'wallet', label: 'WALLET', icon: '👛' },
    ];

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onSubmit(selectedPayment);
            onClose();
        } catch (error) {
            console.error('Failed to submit order:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <IndustrialModal open={isOpen} onClose={onClose} title="CONFIRM & PAY" size="md">
            <div className="space-y-6">
                {/* Receipt-like summary */}
                <div className="bg-yellow-50 border-2 border-yellow-200 p-4 text-slate-800 font-mono">
                    <div className="border-b-2 border-dashed border-slate-300 pb-2 mb-2">
                        <div className="flex justify-between font-bold uppercase">
                            <span>Order Type</span>
                            <span>{orderType}</span>
                        </div>
                        {orderType === 'dine-in' && tableNumber && (
                            <div className="flex justify-between font-bold uppercase">
                                <span>Table</span>
                                <span>#{tableNumber}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tax (5%)</span>
                            <span>₹{tax.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="border-t-2 border-dashed border-slate-300 pt-2 mt-2 flex justify-between font-black text-2xl uppercase">
                        <span>Total</span>
                        <span>₹{total.toFixed(2)}</span>
                    </div>
                </div>

                {/* Payment Methods */}
                <div>
                    <h4 className="font-black text-slate-800 uppercase tracking-wide mb-3">
                        Select Payment Method
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {paymentMethods.map((method) => (
                            <button
                                key={method.id}
                                onClick={() => setSelectedPayment(method.id)}
                                disabled={isSubmitting}
                                className={cn(
                                    'p-4 border-2 flex flex-col items-center gap-2 transition-all',
                                    selectedPayment === method.id
                                        ? 'bg-slate-800 text-white border-slate-900 shadow-md transform scale-105'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400',
                                    isSubmitting && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <span className="text-3xl">{method.icon}</span>
                                <span className="font-bold tracking-wider">{method.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <IndustrialButton variant="secondary" onClick={onClose} disabled={isSubmitting} size="lg">
                        BACK
                    </IndustrialButton>
                    <IndustrialButton variant="success" onClick={handleSubmit} disabled={isSubmitting} size="lg" className={isSubmitting ? 'animate-pulse' : ''}>
                        {isSubmitting ? 'PROCESSING...' : 'PAY NOW'}
                    </IndustrialButton>
                </div>
            </div>
        </IndustrialModal>
    );
}
