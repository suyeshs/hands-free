import React, { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Cookies } from './pages/Cookies';
import { Contact } from './pages/Contact';
import { HomePage } from './pages/HomePage';
import { RestaurantHomePage } from './pages/restaurant';
import { LocaleProvider, supportedLocales, useDetectedLocale } from './src/contexts/LocaleContext';

// Locale redirect component for root path
function LocaleRedirect() {
  const navigate = useNavigate();
  const detectedLocale = useDetectedLocale();

  useEffect(() => {
    // Check for stored preference first
    const cookies = document.cookie;
    const preferredLocale = cookies.match(/preferred_locale=([\w-]+)/)?.[1];

    if (preferredLocale && supportedLocales.includes(preferredLocale as typeof supportedLocales[number])) {
      navigate(`/${preferredLocale}`, { replace: true });
    } else {
      navigate(`/${detectedLocale}`, { replace: true });
    }
  }, [navigate, detectedLocale]);

  return (
    <div className="min-h-screen bg-warm-charcoal flex items-center justify-center">
      <div className="text-warm-white text-xl">Redirecting...</div>
    </div>
  );
}

// Layout wrapper with LocaleProvider
function LocaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      {children}
    </LocaleProvider>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Root redirects to detected locale */}
      <Route path="/" element={<LocaleRedirect />} />

      {/* Locale-prefixed routes */}
      <Route path="/:locale" element={<LocaleLayout><HomePage /></LocaleLayout>} />
      <Route path="/:locale/restaurant" element={<LocaleLayout><RestaurantHomePage /></LocaleLayout>} />
      <Route path="/:locale/terms" element={<LocaleLayout><Terms /></LocaleLayout>} />
      <Route path="/:locale/privacy" element={<LocaleLayout><Privacy /></LocaleLayout>} />
      <Route path="/:locale/cookies" element={<LocaleLayout><Cookies /></LocaleLayout>} />
      <Route path="/:locale/contact" element={<LocaleLayout><Contact /></LocaleLayout>} />

      {/* Legacy routes redirect to locale version */}
      <Route path="/terms" element={<LocaleRedirect />} />
      <Route path="/privacy" element={<LocaleRedirect />} />
      <Route path="/cookies" element={<LocaleRedirect />} />
      <Route path="/contact" element={<LocaleRedirect />} />
      <Route path="/restaurant" element={<LocaleRedirect />} />
    </Routes>
  );
}
