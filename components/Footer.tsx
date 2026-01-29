import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Zap, Mail, Shield, Globe } from 'lucide-react';
import { useLocale } from '../src/contexts/LocaleContext';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { locale } = useParams<{ locale: string }>();
  const { t } = useLocale();

  // Helper to create locale-aware links
  const localePath = (path: string) => `/${locale}${path}`;

  return (
    <footer className="py-16 border-t border-white/5 bg-black/20">
      <div className="max-w-7xl mx-auto px-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-warm flex items-center justify-center">
                <Zap size={18} className="text-white" fill="currentColor" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">handsfree.tech</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield size={14} className="text-saffron" />
              <span>{t('footer.secured_by')}</span>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="font-display font-medium text-warm-white mb-4">{t('footer.product.title')}</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <a href={`${localePath('/')}#features`} className="hover:text-warm-white transition-colors">
                  {t('footer.product.features')}
                </a>
              </li>
              <li>
                <a href={`${localePath('/')}#how-it-works`} className="hover:text-warm-white transition-colors">
                  {t('footer.product.how_it_works')}
                </a>
              </li>
              <li>
                <a href={`${localePath('/')}#pricing`} className="hover:text-warm-white transition-colors">
                  {t('footer.product.pricing')}
                </a>
              </li>
              <li>
                <a href={`${localePath('/')}#interactive-demo`} className="hover:text-warm-white transition-colors">
                  {t('footer.product.try_demo')}
                </a>
              </li>
              <li>
                <Link to={localePath('/download')} className="hover:text-warm-white transition-colors">
                  {t('footer.product.download')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="font-display font-medium text-warm-white mb-4">{t('footer.company.title')}</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <Link to={localePath('/contact')} className="hover:text-warm-white transition-colors">
                  {t('footer.company.contact')}
                </Link>
              </li>
              <li>
                <a href="mailto:hello@handsfree.tech" className="hover:text-warm-white transition-colors flex items-center gap-2">
                  <Mail size={14} />
                  hello@handsfree.tech
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="font-display font-medium text-warm-white mb-4">{t('footer.legal.title')}</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <Link to={localePath('/terms')} className="hover:text-warm-white transition-colors">
                  {t('footer.legal.terms')}
                </Link>
              </li>
              <li>
                <Link to={localePath('/privacy')} className="hover:text-warm-white transition-colors">
                  {t('footer.legal.privacy')}
                </Link>
              </li>
              <li>
                <Link to={localePath('/cookies')} className="hover:text-warm-white transition-colors">
                  {t('footer.legal.cookies')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Key Features Bar */}
        <div className="border-t border-white/5 pt-8 mb-8">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-saffron" />
              <span>{t('footer.features_bar.languages')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-saffron" />
              <span>{t('footer.features_bar.security')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-saffron" />
              <span>{t('footer.features_bar.availability')}</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            {t('footer.copyright', { year: currentYear })}
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link to={localePath('/terms')} className="hover:text-warm-white transition-colors">
              {t('footer.bottom_links.terms')}
            </Link>
            <Link to={localePath('/privacy')} className="hover:text-warm-white transition-colors">
              {t('footer.bottom_links.privacy')}
            </Link>
            <Link to={localePath('/cookies')} className="hover:text-warm-white transition-colors">
              {t('footer.bottom_links.cookies')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
