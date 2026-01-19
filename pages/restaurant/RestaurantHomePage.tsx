import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { UploadCloud, Play, ChevronDown, X, Mic, Globe, Monitor, ChefHat, CreditCard, Megaphone, Users, Shield, Layers, Utensils } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { PhoneInterface } from '../../components/PhoneInterface';
import { Footer } from '../../components/Footer';
import { CookieConsent } from '../../components/CookieConsent';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useLocale } from '../../src/contexts/LocaleContext';
import { WaitlistModal } from '../../components/restaurant/WaitlistModal';
import { ProductShowcase } from '../../components/restaurant/ProductShowcase';
import { HowItWorks } from '../../components/restaurant/HowItWorks';

// Hook to detect mobile screens
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export function RestaurantHomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const { t } = useLocale();
  const isMobile = useIsMobile();

  // Global scroll progress for ambient orbs
  const { scrollYProgress } = useScroll({ target: containerRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Hero-specific scroll progress for parallax layers
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const smoothHeroProgress = useSpring(heroProgress, { stiffness: 50, damping: 20 });

  // Parallax multiplier for mobile (reduced intensity)
  const pm = isMobile ? 0.5 : 1;

  // Layer 2: Title - fastest parallax with scale
  const titleY = useTransform(smoothHeroProgress, [0, 1], ['0%', `${-80 * pm}%`]);
  const titleScale = useTransform(smoothHeroProgress, [0, 0.5], [1, 0.9]);

  // Layer 3: Subtitle - medium-fast
  const subtitleY = useTransform(smoothHeroProgress, [0, 1], ['0%', `${-50 * pm}%`]);

  // Layer 4: CTA buttons - medium speed
  const ctaY = useTransform(smoothHeroProgress, [0, 1], ['0%', `${-30 * pm}%`]);

  // Split headline with line breaks
  const headlineParts = (t('hero.headline') as string).split('\n');
  const subheadlineParts = (t('hero.subheadline') as string).split('\n');

  const features = [
    {
      key: 'online_presence',
      icon: Globe,
      color: 'text-blue-400'
    },
    {
      key: 'menu_management',
      icon: Utensils,
      color: 'text-yellow-400'
    },
    {
      key: 'aggregator_integration',
      icon: Layers,
      color: 'text-purple-400'
    },
    {
      key: 'pos',
      icon: Monitor,
      color: 'text-green-400'
    },
    {
      key: 'kis',
      icon: ChefHat,
      color: 'text-orange-400'
    },
    {
      key: 'customer_intelligence',
      icon: Users,
      color: 'text-pink-400'
    },
    {
      key: 'data_security',
      icon: Shield,
      color: 'text-teal-400'
    },
    {
      key: 'waitlist_cta',
      icon: ChevronDown, // Placeholder, won't be used for CTA
      color: 'text-white',
      isCta: true
    }
  ];

  return (
    <div ref={containerRef} className="bg-warm-charcoal text-warm-white overflow-x-hidden relative">
      {/* Language Selector - Fixed Position */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      {/* Cookie Consent Banner */}
      <CookieConsent />

      {/* Waitlist Modal */}
      <WaitlistModal isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />

      {/* Demo Modal */}
      <AnimatePresence>
        {isDemoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setIsDemoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsDemoOpen(false)}
                className="absolute -top-4 -right-4 z-[110] w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-warm-charcoal" />
              </button>
              <div className="w-[340px] h-[700px] md:w-[400px] md:h-[820px] bg-black/90 rounded-[3rem] border-8 border-warm-charcoal/80 shadow-2xl overflow-hidden backdrop-blur-2xl ring-4 ring-white/10">
                <PhoneInterface />
              </div>
              <p className="text-center text-gray-400 text-sm mt-4">
                {t('demo.helper_text')}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div style={{ y: useTransform(smoothProgress, [0, 1], ['0%', '120%']) }}
          className="absolute top-[-30%] left-[-20%] w-[1000px] h-[1000px] bg-paprika/20 rounded-full blur-[140px]" />
        <motion.div style={{ y: useTransform(smoothProgress, [0, 1], ['20%', '-100%']) }}
          className="absolute bottom-[-40%] right-[-20%] w-[900px] h-[900px] bg-saffron/20 rounded-full blur-[140px]" />
      </div>

      {/* 1. HERO with Multi-Layer Parallax */}
      <section ref={heroRef} className="relative min-h-screen">
        <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden py-20 px-8">
          {/* All hero content in a single container for proper flow */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="max-w-6xl text-center z-40"
          >
            {/* Title Layer - Fastest parallax */}
            <motion.div
              style={{ y: titleY, scale: titleScale }}
              className="will-change-transform"
            >
              {/* Tagline */}
              <div className="mb-8 space-y-2">
                <p className="text-saffron text-sm font-medium tracking-widest uppercase">
                  {t('hero.tagline')}
                </p>
                <p className="text-white/60 text-sm font-light tracking-wide italic">
                  {t('hero.built_by')}
                </p>
              </div>

              {/* Main Headline */}
              <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-thin tracking-tighter leading-none text-warm-white mb-8 drop-shadow-2xl">
                {headlineParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < headlineParts.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </h1>
            </motion.div>

            {/* Subtitle Layer */}
            <motion.div
              style={{ y: subtitleY }}
              className="mt-6 will-change-transform max-w-4xl mx-auto"
            >
              <div className="mb-8 space-y-4">
                {subheadlineParts.map((part, i) => (
                  <p
                    key={i}
                    className={i === 0
                      ? "text-2xl md:text-3xl text-white font-light drop-shadow-lg"
                      : "text-lg md:text-xl text-saffron font-medium tracking-wide drop-shadow-md"
                    }
                  >
                    {part}
                  </p>
                ))}
              </div>
              <p className="text-lg text-gray-400 font-light max-w-2xl mx-auto">
                {t('hero.description')}
              </p>
              <p className="text-xs text-gray-500 mt-4 italic">
                {t('hero.disclaimer')}
              </p>
            </motion.div>

            {/* CTA Layer - Medium parallax */}
            <motion.div
              style={{ y: ctaY }}
              className="mt-12 flex flex-col sm:flex-row gap-6 justify-center items-center will-change-transform"
            >
              <button
                onClick={() => setIsWaitlistOpen(true)}
                className="px-10 py-5 bg-gradient-warm text-white rounded-full font-medium text-lg shadow-warm-glow hover:shadow-xl hover:scale-105 transition-all pointer-events-auto"
              >
                {t('hero.cta_primary')}
              </button>
              <button
                onClick={() => setIsDemoOpen(true)}
                className="px-8 py-5 border border-white/20 text-white rounded-full font-medium text-lg backdrop-blur-sm hover:bg-white/5 transition-all flex items-center gap-2 pointer-events-auto"
              >
                <Play size={20} fill="currentColor" /> {t('hero.cta_demo')}
              </button>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-600 z-30"
          >
            <ChevronDown size={32} />
          </motion.div>
        </div>
      </section>

      {/* 2. FEATURES GRID */}
      <section id="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-7xl font-display font-thin mb-8 leading-tight">
              {(t('sections.features.headline') as string).split('\n').map((part, i) => (
                <React.Fragment key={i}>
                  {part}
                  {i < (t('sections.features.headline') as string).split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="h-full"
              >
                {feature.isCta ? (
                  <div
                    onClick={() => setIsWaitlistOpen(true)}
                    className="h-full p-10 rounded-3xl bg-gradient-warm relative overflow-hidden cursor-pointer group hover:scale-[1.02] transition-transform shadow-2xl shadow-paprika/20"
                  >
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <h3 className="text-3xl font-display font-medium mb-4 text-white">
                          {t(`sections.features.${feature.key}.title`)}
                        </h3>
                        <p className="text-xl text-white/90 font-light leading-relaxed mb-8">
                          {t(`sections.features.${feature.key}.description`)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-white font-medium text-lg">
                        {t(`sections.features.${feature.key}.button`)} <ChevronDown className="-rotate-90" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <GlassCard variant="panel" className="p-10 h-full hover:bg-white/5 transition-colors group">
                    <feature.icon size={48} className={`mb-6 ${feature.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                    <h3 className="text-3xl font-display font-thin mb-4 text-white">
                      {t(`sections.features.${feature.key}.title`)}
                    </h3>
                    <p className="text-xl text-gray-400 font-light leading-relaxed">
                      {t(`sections.features.${feature.key}.description`)}
                    </p>
                  </GlassCard>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PRODUCT SHOWCASE */}
      <ProductShowcase />

      {/* 4. HOW IT WORKS */}
      <HowItWorks />

      {/* 5. WAITLIST / FINAL CTA */}
      <section className="relative min-h-[80vh] flex items-center justify-center py-32">
        <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center max-w-5xl mx-auto px-6"
        >
          <h2 className="text-6xl md:text-8xl font-display font-thin mb-8 leading-tight">
            {t('sections.final_cta.headline')}<br />
            <span className="font-bold bg-clip-text text-transparent bg-gradient-warm">{t('sections.final_cta.headline_highlight')}</span> {t('sections.final_cta.headline_suffix')}
          </h2>

          <p className="text-2xl text-gray-400 mb-10">
            {t('sections.final_cta.pricing')}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button
              onClick={() => setIsWaitlistOpen(true)}
              className="px-12 py-6 bg-gradient-warm text-white text-xl font-medium rounded-full shadow-2xl shadow-paprika/50 hover:scale-105 transition-all"
            >
              {t('sections.final_cta.cta_primary')}
            </button>
            <button
              onClick={() => window.location.href = 'mailto:sales@handsfree.tech'}
              className="px-10 py-5 border border-white/20 text-white text-lg rounded-full backdrop-blur-sm hover:bg-white/5 transition-all"
            >
              {t('sections.final_cta.cta_secondary')}
            </button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
