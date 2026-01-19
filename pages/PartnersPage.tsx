import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import {
    Handshake,
    TrendingUp,
    Puzzle,
    Headphones,
    ArrowRight,
    ChevronDown,
    Cloud,
    Layers,
    BarChart3,
    Users,
    Globe,
    MessageSquare,
    Settings
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Footer } from '../components/Footer';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLocale } from '../src/contexts/LocaleContext';

// --- Components ---

const GridBackground = () => (
    <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
            backgroundImage: `linear-gradient(to right, #FFF8F0 1px, transparent 1px), linear-gradient(to bottom, #FFF8F0 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
        }}
    />
);

const NodeConnection = ({ className, delay = 0 }: { className?: string, delay?: number }) => (
    <svg className={`absolute pointer-events-none ${className}`} width="400" height="300" viewBox="0 0 400 300" fill="none">
        <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#F28C38" />
                <stop offset="100%" stopColor="transparent" />
            </linearGradient>
        </defs>
        <path
            d="M0 150 C 100 150, 150 50, 250 50 S 400 0, 400 0"
            stroke="rgba(242, 140, 56, 0.1)"
            strokeWidth="2"
        />
        <motion.path
            d="M0 150 C 100 150, 150 50, 250 50 S 400 0, 400 0"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            initial={{ strokeDasharray: "0 1000", strokeDashoffset: 0 }}
            animate={{ strokeDasharray: "150 850", strokeDashoffset: -1000 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear", delay }}
        />
    </svg>
);

const DashboardMockup = () => (
    <div className="w-full aspect-[16/10] bg-[#120D0B] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-12 border-b border-white/5 bg-white/[0.02] flex items-center px-6 justify-between">
            <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                <div className="ml-4 h-4 w-32 bg-white/10 rounded-full" />
            </div>
            <div className="flex gap-3">
                <div className="w-6 h-6 rounded bg-white/5" />
                <div className="w-6 h-6 rounded bg-white/5" />
            </div>
        </div>

        {/* Body */}
        <div className="flex-grow flex">
            {/* Sidebar */}
            <div className="w-20 border-r border-white/5 flex flex-col items-center py-6 gap-6 bg-white/[0.01]">
                <div className="p-2 text-saffron bg-saffron/10 rounded-lg"><BarChart3 size={20} /></div>
                <div className="p-2 text-gray-500 hover:text-white transition-colors"><Users size={20} /></div>
                <div className="p-2 text-gray-500 hover:text-white transition-colors"><MessageSquare size={20} /></div>
                <div className="p-2 text-gray-500 hover:text-white transition-colors"><Globe size={20} /></div>
                <div className="mt-auto p-2 text-gray-500 hover:text-white transition-colors"><Settings size={20} /></div>
            </div>

            {/* Main Content */}
            <div className="flex-grow p-8 grid grid-cols-3 gap-6">
                <div className="col-span-3 h-10 w-48 bg-white/10 rounded-lg mb-4" />

                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
                        <div className="h-4 w-20 bg-white/10 rounded-full mb-4" />
                        <div className="h-8 w-32 bg-white/20 rounded-lg" />
                    </div>
                ))}

                <div className="col-span-2 bg-white/[0.02] border border-white/5 rounded-xl p-6 h-48 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <div className="h-4 w-24 bg-white/10 rounded-full" />
                        <div className="flex gap-2">
                            <div className="h-2 w-8 bg-saffron/30 rounded-full" />
                            <div className="h-2 w-12 bg-saffron/50 rounded-full" />
                        </div>
                    </div>
                    {/* Faux Chart */}
                    <div className="absolute inset-x-0 bottom-0 h-24 flex items-end px-4 gap-1">
                        {[30, 45, 25, 60, 40, 75, 55, 90, 65, 80, 45, 70].map((h, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 0 }}
                                whileInView={{ height: `${h}%` }}
                                className="flex-grow bg-gradient-to-t from-saffron/20 to-saffron/40 rounded-t-sm"
                            />
                        ))}
                    </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 flex flex-col gap-4">
                    <div className="h-4 w-24 bg-white/10 rounded-full" />
                    <div className="flex-grow flex flex-col gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/10" />
                                <div className="h-3 flex-grow bg-white/5 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const DashboardShowcase = () => {
    const targetRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "center center"]
    });

    const rotateX = useTransform(scrollYProgress, [0, 1], [45, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1]);
    const translateY = useTransform(scrollYProgress, [0, 1], [100, 0]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

    return (
        <section ref={targetRef} className="relative py-48 overflow-visible flex flex-col items-center">
            <div className="max-w-4xl mx-auto px-6 text-center mb-24 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-block px-4 py-1.5 rounded-full bg-saffron/10 border border-saffron/20 mb-6">
                        <span className="text-[10px] font-bold text-saffron uppercase tracking-[0.2em]">Partner Dashboard</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-display font-thin mb-8 tracking-tighter">Your Platform, <span className="text-saffron">Your Way.</span></h2>
                    <p className="text-xl text-gray-500 font-light max-w-2xl mx-auto leading-relaxed">
                        Manage your entire partner network, track commissions, and onboard restaurants with a single, powerful command center.
                    </p>
                </motion.div>
            </div>

            <div className="w-full max-w-6xl mx-auto px-6" style={{ perspective: "1500px" }}>
                <motion.div
                    style={{
                        rotateX,
                        scale,
                        translateY,
                        opacity,
                        transformStyle: "preserve-3d"
                    }}
                    className="relative"
                >
                    {/* Subtle Glow behind the dashboard */}
                    <div className="absolute inset-0 bg-saffron/20 blur-[150px] -z-10 rounded-full scale-75" />

                    <DashboardMockup />

                    {/* Floating UI Elements during 3D scroll */}
                    <motion.div
                        style={{ translateZ: 100 }}
                        className="absolute top-[-40px] right-[-40px] hidden md:block"
                    >
                        <GlassCard variant="panel" className="p-6 border border-saffron/30 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-saffron/10 flex items-center justify-center text-saffron">
                                    <BarChart3 size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Total Revenue</div>
                                    <div className="text-xl font-display font-light text-warm-white">$124,500.00</div>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>

                    <motion.div
                        style={{ translateZ: 150 }}
                        className="absolute bottom-[-20px] left-[-60px] hidden md:block"
                    >
                        <GlassCard variant="panel" className="p-6 border border-blue-500/30 shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Status</div>
                                    <div className="text-xl font-display font-light text-warm-white">Certified</div>
                                </div>
                            </div>
                        </GlassCard>
                        <motion.div
                            style={{ translateZ: 20 }}
                            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-blue-500 animate-ping opacity-50"
                        />
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

const CheckCircle2 = ({ size, className = "" }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M9 12L11 14L15 10" />
    </svg>
);

// --- Main Page Component ---

export function PartnersPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: containerRef });
    const { t } = useLocale();

    const opacityHero = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
    const yHero = useTransform(scrollYProgress, [0, 0.15], [0, -50]);

    return (
        <div ref={containerRef} className="bg-[#0A0705] text-warm-white overflow-x-hidden relative min-h-screen font-sans selection:bg-saffron/30 selection:text-white">
            <GridBackground />

            {/* Language Selector */}
            <div className="fixed top-4 right-4 z-50">
                <LanguageSelector />
            </div>

            {/* Ambient Background Orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-saffron/10 rounded-full blur-[140px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-paprika/10 rounded-full blur-[140px]" />
                <div className="absolute top-[20%] left-[10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[140px]" />
            </div>

            {/* 1. HERO SECTION */}
            <section className="relative min-h-[90vh] flex items-center justify-center pt-32 pb-20">
                <NodeConnection className="top-[10%] left-0 -translate-x-1/3 opacity-60" delay={0} />
                <NodeConnection className="bottom-[10%] right-0 translate-x-1/3 rotate-180 opacity-60" delay={2} />

                <motion.div
                    style={{ opacity: opacityHero, y: yHero }}
                    className="max-w-7xl mx-auto px-6 text-center z-10"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm mb-10">
                            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">{t('partners.hero.tagline')}</span>
                        </div>

                        <h1 className="text-[3.5rem] md:text-[6.5rem] lg:text-[8rem] font-display font-thin tracking-[-0.04em] mb-10 leading-[0.95] max-w-[15ch] mx-auto text-warm-white">
                            {(t('partners.hero.headline') as string).split(' ').map((word, i) => (
                                <span key={i} className={word === 'Voice' ? 'font-light text-transparent bg-clip-text bg-gradient-to-r from-saffron to-[#FFAC63]' : ''}>
                                    {word}{' '}
                                </span>
                            ))}
                        </h1>

                        <p className="text-lg md:text-xl text-gray-400 font-light max-w-2xl mx-auto mb-16 leading-relaxed">
                            {t('partners.hero.subheadline')}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                            <a
                                href="#apply"
                                className="px-10 py-5 bg-warm-white text-warm-charcoal rounded-full font-semibold text-lg hover:bg-white transition-all flex items-center gap-3 group shadow-2xl"
                            >
                                {t('partners.hero.cta')}
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </motion.div>
                </motion.div>

                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-700"
                >
                    <ChevronDown size={32} />
                </motion.div>
            </section>

            {/* 2. DASHBOARD SHOWCASE (The 3D Scroll Perspective Effect) */}
            <DashboardShowcase />

            {/* 3. WHY PARTNER SECTION */}
            <section className="relative py-48">
                <div className="max-w-7xl mx-auto px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-32"
                    >
                        <h2 className="text-5xl md:text-7xl font-display font-thin mb-8 tracking-tighter">{t('partners.why_partner.headline')}</h2>
                        <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-saffron to-transparent mx-auto opacity-30" />
                    </motion.div>

                    <div className="grid lg:grid-cols-3 gap-6">
                        {[
                            { id: 'revenue', icon: <TrendingUp size={28} className="text-saffron" />, colorColor: '#FFB84C' },
                            { id: 'integration', icon: <Puzzle size={28} className="text-blue-400" />, colorColor: '#60A5FA' },
                            { id: 'support', icon: <Headphones size={28} className="text-emerald-400" />, colorColor: '#34D399' }
                        ].map((item, i) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <GlassCard variant="panel" className="p-12 h-full group" hoverEffect>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500`} style={{ backgroundColor: `${item.colorColor}15` }}>
                                        {item.icon}
                                    </div>
                                    <h3 className="text-2xl font-display font-light mb-6 tracking-tight">{(t(`partners.why_partner.${item.id}.title`) as string)}</h3>
                                    <p className="text-gray-400 leading-relaxed text-lg font-light">{(t(`partners.why_partner.${item.id}.description`) as string)}</p>
                                </GlassCard>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. HOW IT WORKS SECTION */}
            <section className="relative py-48 bg-white/[0.01]">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-24 items-center">
                        <div>
                            <h2 className="text-5xl md:text-7xl font-display font-thin mb-12 tracking-tight leading-[1.1]">
                                Scale with <span className="text-saffron">Restaurant OS.</span>
                            </h2>
                            <div className="space-y-12">
                                {[1, 2, 3].map((num) => (
                                    <motion.div
                                        key={num}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        className="flex gap-8 group"
                                    >
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-xl font-display font-light text-saffron group-hover:bg-saffron/10 transition-colors">
                                            0{num}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-display font-light mb-3">{(t(`partners.how_it_works.step${num}.title`) as string)}</h3>
                                            <p className="text-gray-400 leading-relaxed text-lg font-light">{(t(`partners.how_it_works.step${num}.description`) as string)}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 bg-saffron/5 blur-[100px] rounded-full" />
                            <GlassCard variant="panel" className="relative p-8 aspect-square flex items-center justify-center">
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                                        className="absolute w-[85%] h-[85%] border border-dashed border-white/10 rounded-full"
                                    />
                                    <div className="w-40 h-40 rounded-3xl bg-gradient-warm flex items-center justify-center shadow-warm-glow z-10 scale-110">
                                        <Handshake size={80} className="text-white" />
                                    </div>
                                    {/* Floating Icons */}
                                    <motion.div
                                        animate={{ y: [0, -15, 0] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute top-[10%] right-[10%] p-5 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl"
                                    >
                                        <Cloud size={40} className="text-blue-400" />
                                    </motion.div>
                                    <motion.div
                                        animate={{ y: [0, 15, 0] }}
                                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                        className="absolute bottom-[10%] left-[10%] p-5 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl"
                                    >
                                        <Layers size={40} className="text-emerald-400" />
                                    </motion.div>
                                </div>
                            </GlassCard>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. APPLICATION FORM SECTION */}
            <section id="apply" className="relative py-48">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-20 text-warm-white">
                        <h2 className="text-5xl md:text-7xl font-display font-thin mb-8 tracking-tighter">{t('partners.form.headline')}</h2>
                        <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">Join a network of innovators changing how businesses interact. Start earning today.</p>
                    </div>

                    <GlassCard variant="overlay" className="p-12 md:p-20 relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border-white/5">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-saffron/10 blur-[120px] -mr-40 -mt-40" />

                        <form className="space-y-8 relative z-10" onSubmit={(e) => e.preventDefault()}>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block ml-1">{t('partners.form.name')}</label>
                                    <input
                                        type="text"
                                        className="w-full px-7 py-5 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-saffron/30 focus:bg-white/[0.05] outline-none transition-all text-lg font-light text-warm-white font-sans"
                                        placeholder="Business Name"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block ml-1">{t('partners.form.contact')}</label>
                                    <input
                                        type="text"
                                        className="w-full px-7 py-5 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-saffron/30 focus:bg-white/[0.05] outline-none transition-all text-lg font-light text-warm-white font-sans"
                                        placeholder="Your Name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block ml-1">{t('partners.form.email')}</label>
                                <input
                                    type="email"
                                    className="w-full px-7 py-5 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-saffron/30 focus:bg-white/[0.05] outline-none transition-all text-lg font-light text-warm-white font-sans"
                                    placeholder="contact@business.com"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-6 bg-gradient-warm text-white rounded-2xl font-bold text-xl shadow-[0_20px_40px_-15px_rgba(217,69,62,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(217,69,62,0.4)] hover:scale-[1.01] transition-all"
                            >
                                {t('partners.form.submit')}
                            </button>

                            <p className="text-center text-sm text-gray-500 font-light mt-10 font-sans">
                                By applying, you agree to our <a href="#" className="underline hover:text-white transition-colors">Partner Terms</a> and <a href="#" className="underline hover:text-white transition-colors">Privacy Policy</a>.
                            </p>
                        </form>
                    </GlassCard>
                </div>
            </section>

            <Footer />
        </div>
    );
}
