import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLocale, supportedLocales, SupportedLocale } from '../src/contexts/LocaleContext';

interface Language {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'pt-BR', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', flag: '🇵🇭' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
];

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(l => l.code === locale) || languages[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLanguageSelect = (lang: Language) => {
    setLocale(lang.code);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-warm-charcoal/80 backdrop-blur-xl border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-sm"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe size={16} className="text-saffron" />
        <span className="text-warm-white">{currentLanguage.flag}</span>
        <span className="text-warm-white hidden sm:inline">{currentLanguage.nativeName}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-warm-charcoal/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50"
          role="listbox"
        >
          <div className="p-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  locale === lang.code
                    ? 'bg-saffron/20 text-saffron'
                    : 'text-warm-white hover:bg-white/5'
                }`}
                role="option"
                aria-selected={locale === lang.code}
              >
                <span className="text-lg">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{lang.nativeName}</div>
                  <div className="text-xs text-gray-500 truncate">{lang.name}</div>
                </div>
                {locale === lang.code && (
                  <div className="w-2 h-2 bg-saffron rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
