import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { UploadCloud, Play, ChevronDown, X, Mic } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { PhoneInterface } from '../../components/PhoneInterface';
import { Footer } from '../../components/Footer';
import { CookieConsent } from '../../components/CookieConsent';
import { LanguageSelector } from '../../components/LanguageSelector';
import { TemplateShowcase } from '../../components/restaurant/TemplateShowcase';
import { POSShowcase } from '../../components/restaurant/POSShowcase';
import { VoiceShowcase } from '../../components/restaurant/VoiceShowcase';
import { FeatureEcosystem } from '../../components/restaurant/FeatureEcosystem';
import { useLocale } from '../../src/contexts/LocaleContext';

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
  const titleScale = useTransform(smoothHeroProgress, [0, 0.5], [1, 0.85]);
  const titleOpacity = useTransform(smoothHeroProgress, [0, 0.4], [1, 0]);

  // Layer 3: Subtitle - medium-fast
  const subtitleY = useTransform(smoothHeroProgress, [0, 1], ['0%', `${-50 * pm}%`]);
  const subtitleOpacity = useTransform(smoothHeroProgress, [0, 0.35], [1, 0]);

  // Layer 4: CTA buttons - medium speed
  const ctaY = useTransform(smoothHeroProgress, [0, 1], ['0%', `${-30 * pm}%`]);
  const ctaOpacity = useTransform(smoothHeroProgress, [0, 0.25], [1, 0]);

  // Layer 5: Floating phone preview (desktop only)
  const phoneY = useTransform(smoothHeroProgress, [0, 0.7], ['20vh', '-30vh']);
  const phoneScale = useTransform(smoothHeroProgress, [0, 0.5], [0.5, 0.85]);
  const phoneOpacity = useTransform(smoothHeroProgress, [0, 0.15, 0.7], [0.3, 1, 0]);
  const phoneRotate = useTransform(smoothHeroProgress, [0, 0.5], [12, 0]);

  // Split headline with line breaks
  const headlineParts = t('hero.headline').split('\n');

  // Helper to safely get array from translations
  const getQuestions = (): string[] => {
    const questions = t('sections.ask_anything.questions');
    if (Array.isArray(questions)) return questions;
    return ['', '', ''];
  };

  return (
    <div ref={containerRef} className="bg-warm-charcoal text-warm-white overflow-x-hidden relative">
      {/* Language Selector - Fixed Position */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      {/* Cookie Consent Banner */}
      <CookieConsent />

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
              style={{ y: titleY, scale: titleScale, opacity: titleOpacity }}
              className="will-change-transform"
            >
              {/* Tagline */}
              <p className="text-saffron text-sm font-medium tracking-widest uppercase mb-8">
                {t('hero.tagline')}
              </p>

              {/* Main Headline */}
              <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-thin tracking-tighter leading-none text-warm-white">
                {headlineParts.map((part, i) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < headlineParts.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </h1>
            </motion.div>

            {/* Feature Ecosystem - Animated diagram replacing text */}
            <motion.div
              style={{ y: subtitleY, opacity: subtitleOpacity }}
              className="mt-10 will-change-transform"
            >
              <FeatureEcosystem />
              <p className="mt-6 text-lg text-gray-500 font-light">
                {t('hero.pricing')}
              </p>
            </motion.div>

            {/* CTA Layer - Medium parallax */}
            <motion.div
              style={{ y: ctaY, opacity: ctaOpacity }}
              className="mt-12 flex flex-col sm:flex-row gap-6 justify-center items-center will-change-transform"
            >
              <button className="px-10 py-5 bg-gradient-warm text-white rounded-full font-medium text-lg shadow-warm-glow hover:shadow-xl hover:scale-105 transition-all pointer-events-auto">
                {t('hero.cta_primary')}
              </button>
              <button
                onClick={() => setIsDemoOpen(true)}
                className="px-8 py-5 border border-white/20 text-white rounded-full font-medium text-lg backdrop-blur-sm hover:bg-white/5 transition-all flex items-center gap-2 pointer-events-auto"
              >
                <Play size={20} fill="currentColor" /> {t('hero.cta_secondary')}
              </button>
            </motion.div>
          </motion.div>

          {/* Floating Phone Preview - Desktop only */}
          <motion.div
            style={{
              y: phoneY,
              scale: phoneScale,
              opacity: phoneOpacity,
              rotate: phoneRotate,
            }}
            className="hidden md:block fixed bottom-0 right-8 lg:right-16 w-40 lg:w-48 h-80 lg:h-96 pointer-events-none z-20 will-change-transform"
          >
            <div className="w-full h-full bg-black/90 rounded-[2rem] border-4 border-gray-700/50 overflow-hidden shadow-2xl shadow-black/50">
              <div className="h-full bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 rounded-full bg-gradient-warm flex items-center justify-center mb-4 animate-pulse">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-500 text-xs text-center">Voice Ordering</p>
              </div>
            </div>
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

      {/* 2. TEMPLATE SHOWCASE - New Section */}
      <TemplateShowcase />

      {/* 3. POS INTEGRATION - New Section */}
      <POSShowcase />

      {/* 4. VOICE INTERFACE - New Section */}
      <VoiceShowcase />

      {/* 5. Multimodal Experience */}
      <section className="relative py-32">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: "-20%" }}
          className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-7xl font-display font-thin mb-12 leading-tight">
            {t('sections.multimodal.headline').split('\n').map((part, i) => (
              <React.Fragment key={i}>
                {part}
                {i < t('sections.multimodal.headline').split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </h2>
          <p className="text-xl text-gray-400 font-light max-w-4xl mx-auto">
            {t('sections.multimodal.description').split('\n').map((part, i) => (
              <React.Fragment key={i}>
                {part}
                {i < t('sections.multimodal.description').split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        </motion.div>
      </section>

      {/* 6. More direct orders. Less reliance. */}
      <section className="relative py-32">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-5xl md:text-6xl font-display font-thin mb-8">
              {t('sections.direct_orders.headline').split('\n').map((part, i) => (
                <React.Fragment key={i}>
                  {part}
                  {i < t('sections.direct_orders.headline').split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </h2>
            <ul className="space-y-6 text-lg text-gray-400 font-light leading-relaxed">
              <li className="flex items-start gap-3">
                <span className="text-saffron mt-1">•</span>
                {t('sections.direct_orders.bullet1')}
              </li>
              <li className="flex items-start gap-3">
                <span className="text-saffron mt-1">•</span>
                {t('sections.direct_orders.bullet2')}
              </li>
              <li className="flex items-start gap-3">
                <span className="text-saffron mt-1">•</span>
                {t('sections.direct_orders.bullet3')}
              </li>
            </ul>
          </div>
          <GlassCard variant="overlay" className="p-16">
            <div className="text-7xl font-thin text-gray-600">{t('sections.direct_orders.card_text')}</div>
          </GlassCard>
        </motion.div>
      </section>

      {/* 7. Live in 10 minutes */}
      <section className="relative py-32">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="max-w-5xl mx-auto px-6 text-center">
          <GlassCard variant="overlay" className="p-16 md:p-20">
            <UploadCloud size={72} className="text-saffron mx-auto mb-8" />
            <h2 className="text-5xl md:text-6xl font-display font-thin mb-6">{t('sections.live_fast.headline')}</h2>
            <p className="text-xl text-gray-400 font-light leading-relaxed">
              {t('sections.live_fast.description').split('\n').map((part, i) => (
                <React.Fragment key={i}>
                  {part}
                  {i < t('sections.live_fast.description').split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          </GlassCard>
        </motion.div>
      </section>

      {/* 8. Talk to your business */}
      <section className="relative py-32 bg-white/[0.02]">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-display font-thin mb-12">
            {t('sections.ask_anything.headline')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {getQuestions().map((q: string, i: number) => (
              <GlassCard key={i} variant="panel" className="p-8 text-left">
                <p className="text-xl text-gray-300 font-light italic leading-relaxed">{q}</p>
                <p className="mt-4 text-saffron text-base">{t('sections.ask_anything.answer_cta')}</p>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      </section>

      {/* 9. Pricing & Final CTA */}
      <section className="relative min-h-[80vh] flex items-center justify-center py-32">
        <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center max-w-5xl mx-auto px-6">
          <h2 className="text-6xl md:text-8xl font-display font-thin mb-8 leading-tight">
            {t('sections.final_cta.headline')}<br />
            <span className="font-bold bg-clip-text text-transparent bg-gradient-warm">{t('sections.final_cta.headline_highlight')}</span> {t('sections.final_cta.headline_suffix')}
          </h2>

          <p className="text-2xl text-gray-400 mb-10">
            {t('sections.final_cta.pricing')}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <button className="px-12 py-6 bg-gradient-warm text-white text-xl font-medium rounded-full shadow-2xl shadow-paprika/50 hover:scale-105 transition-all">
              {t('sections.final_cta.cta_primary')}
            </button>
            <button className="px-10 py-5 border border-white/20 text-white text-lg rounded-full backdrop-blur-sm hover:bg-white/5 transition-all">
              {t('sections.final_cta.cta_secondary')}
            </button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
