'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useMenu } from '../../contexts/MenuContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useParams, useSearchParams } from 'next/navigation';
import RestaurantOrderingApp from '../../components/RestaurantOrderingApp';
import CallWaiterButton from '../../components/CallWaiterButton';
import { cartStore } from '../../stores/cartStore';
import { getTenantId } from '../../lib/restaurant-config-loader';

const TableOrderPage = observer(function TableOrderPage() {
    const { items: menuItems } = useMenu();
    const { theme } = useTheme();
    const params = useParams();
    const searchParams = useSearchParams();
    const tableId = params.tableId as string;

    const [sessionValid, setSessionValid] = useState<boolean | null>(null); // null = checking, true = valid, false = invalid
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    // Validate table session on mount
    useEffect(() => {
        async function validateSession() {
            // Extract session parameters from URL
            const token = searchParams.get('token');
            const expires = searchParams.get('expires');
            const sig = searchParams.get('sig');

            // Check if this is a secured URL
            if (!token || !expires || !sig) {
                // No session parameters - table not activated
                setSessionValid(false);
                setSessionError('Table not activated. Please ask staff to activate your table.');
                return;
            }

            // Check if session expired locally first
            const expiresAt = parseInt(expires);
            if (expiresAt < Date.now()) {
                setSessionValid(false);
                setSessionError('Session expired. Please ask staff to reactivate your table.');
                return;
            }

            try {
                // Validate with backend - use getTenantId() to correctly resolve custom domains
                // (e.g. thecoorgfoodco.com -> coorg-food-company-1413)
                const tenantId = getTenantId();
                const response = await fetch(
                    `https://handsfree-orders.suyesh.workers.dev/api/orders/${tenantId}/tables/${tableId}/validate`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionToken: token,
                            expires: expiresAt,
                            signature: sig,
                        }),
                    }
                );

                const data = await response.json() as { valid: boolean; error?: string; session?: any };

                if (data.valid) {
                    setSessionValid(true);
                    setSessionToken(token);
                    console.log('[TableOrderPage] Session validated successfully');
                } else {
                    setSessionValid(false);
                    setSessionError(data.error || 'Invalid session. Please ask staff for a new QR code.');
                }
            } catch (error: any) {
                console.error('[TableOrderPage] Session validation error:', error);
                setSessionValid(false);
                setSessionError('Unable to validate session. Please try again or contact staff.');
            }
        }

        validateSession();
    }, [tableId, searchParams]);

    // Set table context in cart store
    useEffect(() => {
        if (tableId && sessionValid) {
            cartStore.setTableId(tableId);
            // Store session token for order submission
            if (sessionToken) {
                (cartStore as any).sessionToken = sessionToken;
            }
            console.log('[TableOrderPage] Set table context:', tableId);
        }
    }, [tableId, sessionValid, sessionToken]);

    // Detect if we should use the Grab Food theme layout
    const isGrabFoodTheme = theme?.meta?.name === 'KHAO PIYO' ||
        theme?.meta?.id === 'khao-piyo-custom' ||
        theme?.config?.layout === 'grab-food';

    // Show loading state while validating
    if (sessionValid === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
                <div className="text-center p-8">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Validating Table Session</h2>
                    <p className="text-gray-600">Please wait...</p>
                </div>
            </div>
        );
    }

    // Show error state if session invalid
    if (sessionValid === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Access Restricted</h2>
                    <p className="text-gray-700 mb-6 leading-relaxed">
                        {sessionError}
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors"
                        >
                            Try Again
                        </button>
                        <p className="text-sm text-gray-500">
                            Table: {tableId.replace('tab-', '#')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Show main ordering interface if session valid
    return (
        <>
            <div className="min-h-screen">
                {/* Table indicator banner */}
                <div className="bg-green-600 text-white px-4 py-2 text-center text-sm font-medium sticky top-0 z-50 shadow-md">
                    🟢 Active Session • Table {tableId.replace('tab-', '#')}
                </div>

                <RestaurantOrderingApp
                    isGrabFoodTheme={isGrabFoodTheme}
                    themeConfig={theme?.config}
                    menuItems={menuItems}
                />
            </div>

            {/* Floating call waiter button */}
            <CallWaiterButton tableId={tableId} />
        </>
    );
});

export default TableOrderPage;
