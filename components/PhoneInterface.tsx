import React, { useState } from 'react';
import { useLocale } from '../src/contexts/LocaleContext';
import { getDemoRestaurant } from '../src/config/demoRestaurants';

interface PhoneInterfaceProps {
  isActive?: boolean;
}

export const PhoneInterface: React.FC<PhoneInterfaceProps> = ({ isActive = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);

  const { country, t } = useLocale();
  const restaurant = getDemoRestaurant(country);

  // Build iframe URL with language parameter
  const iframeUrl = `${restaurant.url}?lang=${showEnglish ? 'en' : restaurant.defaultLocale}`;

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className="w-full h-full bg-warm-darker overflow-hidden relative">
      {/* Language Toggle - positioned at top */}
      <div className="absolute top-3 right-3 z-20 flex gap-1 bg-black/60 backdrop-blur-sm rounded-full p-1">
        <button
          onClick={() => setShowEnglish(false)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !showEnglish
              ? 'bg-saffron text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          {restaurant.defaultLocale.toUpperCase()}
        </button>
        <button
          onClick={() => setShowEnglish(true)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            showEnglish
              ? 'bg-saffron text-white'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-warm-charcoal z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-saffron/30 border-t-saffron rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">{t('demo.loading')}</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-warm-charcoal z-10">
          <div className="text-center px-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">{t('demo.error')}</p>
            <button
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
              }}
              className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-medium"
            >
              {t('demo.retry')}
            </button>
          </div>
        </div>
      )}

      {/* Embedded Restaurant Client */}
      <iframe
        src={iframeUrl}
        title={showEnglish ? restaurant.name.en : restaurant.name.local}
        className="w-full h-full border-0"
        allow="microphone; camera; accelerometer; gyroscope; autoplay"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        style={{
          display: isLoading || hasError ? 'none' : 'block',
        }}
      />
    </div>
  );
};
