/**
 * Mobile Aggregator Browser Component
 * Provides in-app WebView for Swiggy/Zomato order extraction on mobile devices
 *
 * On mobile browsers, this uses an iframe approach with message passing.
 * The user logs into their aggregator account within the app, and we inject
 * JavaScript to extract order data from the DOM.
 *
 * Note: This has limitations due to cross-origin restrictions in browsers.
 * For full functionality, the native Tauri desktop app is recommended.
 */

import { useState, useEffect } from 'react';
import { NeoButton } from '../ui-v2/NeoButton';
import { NeoCard } from '../ui-v2/NeoCard';

interface MobileAggregatorBrowserProps {
  platform: 'swiggy' | 'zomato';
  onClose: () => void;
}

// Platform configurations
const platformConfig = {
  swiggy: {
    name: 'Swiggy',
    icon: '🟠',
    loginUrl: 'https://partner.swiggy.com/',
    dashboardUrl: 'https://partner.swiggy.com/orders',
    color: 'orange',
  },
  zomato: {
    name: 'Zomato',
    icon: '🔴',
    loginUrl: 'https://www.zomato.com/partners/login',
    dashboardUrl: 'https://www.zomato.com/partners/orders',
    color: 'red',
  },
};

export function MobileAggregatorBrowser({ platform, onClose }: MobileAggregatorBrowserProps) {
  const config = platformConfig[platform];
  const [isLoading, setIsLoading] = useState(true);
  const [extractionStatus] = useState<'idle' | 'extracting' | 'success' | 'error'>('idle');
  const [lastExtractedCount] = useState(0);

  // Note: Due to cross-origin restrictions, iframe-based extraction won't work
  // for external domains. This component primarily serves as a portal to open
  // the aggregator dashboard in a new tab and provides manual order entry fallback.

  useEffect(() => {
    // Check if we're in a context where we can use advanced features
    const checkCapabilities = async () => {
      // In a React Native WebView or Capacitor app, we could use plugins
      // For now, we'll provide a simplified flow
      setIsLoading(false);
    };

    checkCapabilities();
  }, []);

  const openInNewTab = () => {
    window.open(config.loginUrl, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg neo-raised-sm flex items-center justify-center touch-target"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{config.icon}</span>
            <h1 className="font-bold text-lg">{config.name} Partner</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {extractionStatus === 'success' && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">
              {lastExtractedCount} extracted
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Limitations Notice */}
        <NeoCard className="p-4 bg-amber-900/20 border-amber-500/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-amber-300 mb-1">Mobile Browser Limitations</h3>
              <p className="text-sm text-amber-200/80">
                Due to browser security restrictions, automatic order extraction is not available on mobile browsers.
                Please use one of these alternatives:
              </p>
            </div>
          </div>
        </NeoCard>

        {/* Option 1: Open in Browser */}
        <NeoCard className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-2xl">
              🌐
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">Option 1: Open in Browser</h3>
              <p className="text-sm text-muted-foreground">
                Open the {config.name} partner portal in your browser. Log in and manage orders directly.
              </p>
            </div>
          </div>
          <NeoButton
            variant="primary"
            onClick={openInNewTab}
            className="w-full"
          >
            Open {config.name} Partner Portal →
          </NeoButton>
        </NeoCard>

        {/* Option 2: Desktop App */}
        <NeoCard className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-2xl">
              🖥️
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">Option 2: Use Desktop App</h3>
              <p className="text-sm text-muted-foreground">
                For automatic order extraction, use the POS desktop application which can embed the partner dashboards and extract orders automatically.
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-surface-2 rounded-lg p-3">
            <p className="font-semibold mb-1">Desktop features include:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Automatic order extraction every 5 seconds</li>
              <li>Background monitoring (minimized window)</li>
              <li>Session persistence (stay logged in)</li>
              <li>DOM observer for instant order detection</li>
            </ul>
          </div>
        </NeoCard>

        {/* Option 3: API Integration (Future) */}
        <NeoCard className="p-4 opacity-60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-2xl">
              🔌
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground mb-1">Option 3: API Integration (Coming Soon)</h3>
              <p className="text-sm text-muted-foreground">
                We're working on direct API integrations with Swiggy and Zomato for seamless order sync. This will work on all devices including mobile.
              </p>
              <div className="mt-2 inline-block px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">
                Requires Partner API Access
              </div>
            </div>
          </div>
        </NeoCard>

        {/* How Orders Appear */}
        <NeoCard className="p-4 bg-surface-2">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <span>📱</span>
            How Orders Appear on Mobile
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Even without automatic extraction, orders from aggregators will appear in your dashboard through:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span><strong>Cloud Sync:</strong> When the desktop app extracts orders, they sync to all devices</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span><strong>Webhook Integration:</strong> If configured, aggregators push orders directly</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span><strong>Real-time Updates:</strong> All connected devices see orders instantly</span>
              </div>
            </div>
          </div>
        </NeoCard>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card safe-area-bottom">
        <NeoButton
          variant="ghost"
          onClick={onClose}
          className="w-full"
        >
          Close
        </NeoButton>
      </div>
    </div>
  );
}

/**
 * Compact button to open the mobile aggregator browser
 */
export function MobileAggregatorButton({ platform }: { platform: 'swiggy' | 'zomato' }) {
  const [isOpen, setIsOpen] = useState(false);
  const config = platformConfig[platform];

  return (
    <>
      <NeoButton
        variant="default"
        onClick={() => setIsOpen(true)}
        className="flex-1"
      >
        <span className="mr-2">{config.icon}</span>
        {config.name}
      </NeoButton>

      {isOpen && (
        <MobileAggregatorBrowser
          platform={platform}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
