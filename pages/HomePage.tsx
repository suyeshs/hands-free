import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import {
  Mic,
  ShoppingBag,
  Globe,
  Utensils,
  ChevronDown,
  ArrowRight,
  Zap,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Footer } from '../components/Footer';
import { CookieConsent } from '../components/CookieConsent';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLocale } from '../src/contexts/LocaleContext';

interface ProductCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  link: string;
  linkText: string;
  gradient: string;
  available: boolean;
}

function ProductCard({ icon, title, description, features, link, linkText, gradient, available }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <GlassCard variant="panel" className="p-8 h-full flex flex-col">
        <div className={`w-16 h-16 rounded-2xl ${gradient} flex items-center justify-center mb-6`}>
          {icon}
        </div>
        <h3 className="text-2xl font-display font-light mb-4">{title}</h3>
        <p className="text-gray-400 mb-6 flex-grow">{description}</p>
        <ul className="space-y-2 mb-8">
          {features.map((feature, i) => (
            <li key={i} className="text-gray-500 text-sm flex items-center gap-2">
              <Zap size={14} className="text-saffron" />
              {feature}
            </li>
          ))}
        </ul>
        {available ? (
          <Link
            to={link}
            className="inline-flex items-center gap-2 text-saffron hover:text-white transition-colors group"
          >
            {linkText}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 text-gray-500">
            Coming Soon
          </span>
        )}
      </GlassCard>
    </motion.div>
  );
}

export function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const { locale } = useLocale();

  const opacityHero = useTransform(smoothProgress, [0, 0.25], [1, 0]);
  const yTitle = useTransform(smoothProgress, [0, 0.25], ['0vh', '-80vh']);

  const products: ProductCardProps[] = [
    {
      icon: <Utensils size={32} className="text-white" />,
      title: "Restaurant AI",
      description: "Voice-powered ordering system that speaks your customers' language. Handle orders, answer questions, and boost direct sales.",
      features: [
        "14+ language support",
        "Menu understanding & recommendations",
        "Direct order processing",
        "Real-time analytics"
      ],
      link: `/${locale}/restaurant`,
      linkText: "Explore Restaurant AI",
      gradient: "bg-gradient-to-br from-paprika to-saffron",
      available: true
    },
    {
      icon: <ShoppingBag size={32} className="text-white" />,
      title: "Shopify App",
      description: "Transform your Shopify store with conversational AI. Let customers ask questions, get recommendations, and complete purchases through natural voice interactions.",
      features: [
        "Product discovery via voice",
        "Inventory & order queries",
        "Seamless checkout integration",
        "Customer support automation"
      ],
      link: "#",
      linkText: "View on Shopify App Store",
      gradient: "bg-gradient-to-br from-green-500 to-emerald-600",
      available: false
    },
    {
      icon: <Globe size={32} className="text-white" />,
      title: "WordPress Plugin",
      description: "Add voice AI to any WordPress site. Perfect for WooCommerce stores, service businesses, and content-rich websites seeking interactive engagement.",
      features: [
        "WooCommerce integration",
        "Custom voice personas",
        "Lead capture & qualification",
        "Content navigation assistance"
      ],
      link: "#",
      linkText: "Download Plugin",
      gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
      available: false
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

      {/* Ambient Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          style={{ y: useTransform(smoothProgress, [0, 1], ['0%', '120%']) }}
          className="absolute top-[-30%] left-[-20%] w-[1000px] h-[1000px] bg-paprika/15 rounded-full blur-[140px]"
        />
        <motion.div
          style={{ y: useTransform(smoothProgress, [0, 1], ['20%', '-100%']) }}
          className="absolute bottom-[-40%] right-[-20%] w-[900px] h-[900px] bg-saffron/15 rounded-full blur-[140px]"
        />
        <motion.div
          style={{ y: useTransform(smoothProgress, [0, 1], ['10%', '-50%']) }}
          className="absolute top-[20%] right-[10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]"
        />
      </div>

      {/* 1. HERO */}
      <section className="relative min-h-screen">
        <div className="min-h-screen flex items-center justify-center overflow-hidden py-20">
          <motion.div
            style={{ opacity: opacityHero, y: yTitle }}
            className="flex flex-col items-center justify-center text-center px-8 z-40"
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="max-w-6xl"
            >
              <div className="flex items-center justify-center gap-3 mb-8">
                <Mic size={24} className="text-saffron" />
                <p className="text-saffron text-sm font-medium tracking-widest uppercase">
                  Voice AI for Every Business
                </p>
              </div>

              <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-thin tracking-tighter leading-none text-warm-white">
                Your Business,<br />
                <span className="font-light">Now Voice-Enabled</span>
              </h1>

              <p className="mt-10 text-xl md:text-2xl text-gray-400 font-light max-w-3xl mx-auto">
                Handsfree.tech brings conversational AI to your platform.
                Let customers speak naturally, get instant answers, and complete actions - all through voice.
              </p>

              <div className="mt-12 flex flex-col sm:flex-row gap-6 justify-center items-center pointer-events-auto">
                <Link
                  to={`/${locale}/restaurant`}
                  className="px-10 py-5 bg-gradient-warm text-white rounded-full font-medium text-lg shadow-warm-glow hover:shadow-xl hover:scale-105 transition-all"
                >
                  Explore Solutions
                </Link>
                <a
                  href="#products"
                  className="px-8 py-5 border border-white/20 text-white rounded-full font-medium text-lg backdrop-blur-sm hover:bg-white/5 transition-all flex items-center gap-2"
                >
                  View Products
                </a>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-600"
          >
            <ChevronDown size={32} />
          </motion.div>
        </div>
      </section>

      {/* 2. Value Proposition */}
      <section className="relative py-32">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-20%" }}
          className="max-w-7xl mx-auto px-6"
        >
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-display font-thin mb-8">
              One Platform,<br />
              <span className="text-saffron">Endless Possibilities</span>
            </h2>
            <p className="text-xl text-gray-400 font-light max-w-3xl mx-auto">
              From restaurants to e-commerce, Handsfree.tech adapts to your business.
              Our AI understands context, speaks multiple languages, and learns your products.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-paprika/20 to-saffron/20 flex items-center justify-center">
                <MessageSquare size={36} className="text-saffron" />
              </div>
              <h3 className="text-2xl font-display font-light mb-4">Natural Conversations</h3>
              <p className="text-gray-400">
                Customers speak naturally, just like talking to a helpful assistant. No scripts, no limitations.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
                <Globe size={36} className="text-green-400" />
              </div>
              <h3 className="text-2xl font-display font-light mb-4">Global Reach</h3>
              <p className="text-gray-400">
                Support customers in 14+ languages with native-quality voice synthesis and understanding.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center">
                <BarChart3 size={36} className="text-blue-400" />
              </div>
              <h3 className="text-2xl font-display font-light mb-4">Actionable Insights</h3>
              <p className="text-gray-400">
                Understand what customers want with real-time analytics on conversations and conversions.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* 3. Products Section */}
      <section id="products" className="relative py-32 bg-white/[0.02]">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto px-6"
        >
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-display font-thin mb-8">
              Our Products
            </h2>
            <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto">
              Choose the solution that fits your platform. Each product is built for seamless integration and immediate impact.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <ProductCard key={index} {...product} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* 4. How It Works */}
      <section className="relative py-32">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto px-6"
        >
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-display font-thin mb-8">
              Simple Integration
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-6xl font-display font-thin text-saffron mb-6">01</div>
              <h3 className="text-xl font-medium mb-4">Connect Your Platform</h3>
              <p className="text-gray-400">
                Install our app, plugin, or embed our widget. Setup takes minutes, not weeks.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="text-6xl font-display font-thin text-saffron mb-6">02</div>
              <h3 className="text-xl font-medium mb-4">Train Your AI</h3>
              <p className="text-gray-400">
                Upload your menu, catalog, or content. Our AI learns your business automatically.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="text-6xl font-display font-thin text-saffron mb-6">03</div>
              <h3 className="text-xl font-medium mb-4">Go Live</h3>
              <p className="text-gray-400">
                Your customers can now speak to your business. Watch engagement and sales grow.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* 5. CTA */}
      <section className="relative py-32">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto px-6 text-center"
        >
          <GlassCard variant="overlay" className="p-16">
            <h2 className="text-4xl md:text-6xl font-display font-thin mb-8">
              Ready to Give Your<br />Business a Voice?
            </h2>
            <p className="text-xl text-gray-400 mb-10">
              Start with our Restaurant AI today, or join the waitlist for Shopify and WordPress.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={`/${locale}/restaurant`}
                className="px-10 py-5 bg-gradient-warm text-white rounded-full font-medium text-lg shadow-warm-glow hover:shadow-xl hover:scale-105 transition-all"
              >
                Try Restaurant AI
              </Link>
              <Link
                to={`/${locale}/contact`}
                className="px-10 py-5 border border-white/20 text-white rounded-full font-medium text-lg backdrop-blur-sm hover:bg-white/5 transition-all"
              >
                Contact Us
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
