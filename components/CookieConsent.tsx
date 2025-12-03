import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Cookie, X, Settings, Check } from 'lucide-react';
import { useLocale } from '../src/contexts/LocaleContext';

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
}

const CONSENT_KEY = 'handsfree_cookie_consent';
const PREFERENCES_KEY = 'handsfree_cookie_preferences';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true, cannot be disabled
    functional: true,
    analytics: true
  });
  const { locale } = useParams<{ locale: string }>();
  const { t } = useLocale();

  // Helper to create locale-aware links
  const localePath = (path: string) => `/${locale}${path}`;

  useEffect(() => {
    // Check if consent has already been given
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      const savedPrefs = localStorage.getItem(PREFERENCES_KEY);
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      functional: true,
      analytics: true
    };
    localStorage.setItem(CONSENT_KEY, 'true');
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(allAccepted));
    setPreferences(allAccepted);
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    setIsVisible(false);
  };

  const handleRejectOptional = () => {
    const essentialOnly = {
      essential: true,
      functional: false,
      analytics: false
    };
    localStorage.setItem(CONSENT_KEY, 'true');
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(essentialOnly));
    setPreferences(essentialOnly);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-warm-charcoal/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

          {!showPreferences ? (
            // Main Banner
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-saffron/20 flex items-center justify-center flex-shrink-0">
                  <Cookie className="text-saffron" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-display font-medium text-warm-white mb-2">
                    {t('cookies.banner.title')}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">
                    {t('cookies.banner.description')}{' '}
                    <Link to={localePath('/cookies')} className="text-saffron hover:underline">
                      {t('cookies.banner.cookie_policy_link')}
                    </Link>.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleAcceptAll}
                      className="px-5 py-2.5 bg-gradient-warm text-white rounded-lg font-medium text-sm hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <Check size={16} />
                      {t('cookies.banner.accept_all')}
                    </button>
                    <button
                      onClick={handleRejectOptional}
                      className="px-5 py-2.5 bg-white/5 border border-white/10 text-warm-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
                    >
                      {t('cookies.banner.essential_only')}
                    </button>
                    <button
                      onClick={() => setShowPreferences(true)}
                      className="px-5 py-2.5 text-gray-400 hover:text-warm-white font-medium text-sm transition-colors flex items-center gap-2"
                    >
                      <Settings size={16} />
                      {t('cookies.banner.manage_preferences')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Preferences Panel
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-display font-medium text-warm-white">
                  {t('cookies.preferences.title')}
                </h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="p-2 text-gray-400 hover:text-warm-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Essential Cookies */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-warm-white mb-1">
                        {t('cookies.preferences.essential.title')}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {t('cookies.preferences.essential.description')}
                      </p>
                    </div>
                    <div className="w-12 h-6 bg-saffron/30 rounded-full flex items-center justify-end px-1">
                      <div className="w-4 h-4 bg-saffron rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-warm-white mb-1">
                        {t('cookies.preferences.functional.title')}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {t('cookies.preferences.functional.description')}
                      </p>
                    </div>
                    <button
                      onClick={() => setPreferences(prev => ({ ...prev, functional: !prev.functional }))}
                      className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                        preferences.functional ? 'bg-saffron/30 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full transition-colors ${
                        preferences.functional ? 'bg-saffron' : 'bg-gray-500'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-warm-white mb-1">
                        {t('cookies.preferences.analytics.title')}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {t('cookies.preferences.analytics.description')}
                      </p>
                    </div>
                    <button
                      onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                      className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
                        preferences.analytics ? 'bg-saffron/30 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full transition-colors ${
                        preferences.analytics ? 'bg-saffron' : 'bg-gray-500'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSavePreferences}
                  className="flex-1 px-5 py-2.5 bg-gradient-warm text-white rounded-lg font-medium text-sm hover:shadow-lg transition-all"
                >
                  {t('cookies.preferences.save')}
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-5 py-2.5 bg-white/5 border border-white/10 text-warm-white rounded-lg font-medium text-sm hover:bg-white/10 transition-colors"
                >
                  {t('cookies.banner.accept_all')}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                {t('cookies.preferences.learn_more')}{' '}
                <Link to={localePath('/cookies')} className="text-saffron hover:underline">
                  {t('cookies.banner.cookie_policy_link')}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
