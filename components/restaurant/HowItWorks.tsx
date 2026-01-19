import React from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Sparkles, Activity, ArrowRight } from 'lucide-react';
import { useLocale } from '../../src/contexts/LocaleContext';

export function HowItWorks() {
    const { t } = useLocale();

    const steps = [
        {
            key: 'step1',
            icon: FileSpreadsheet,
            color: 'text-green-400',
            bg: 'bg-green-400/10',
            border: 'border-green-400/20'
        },
        {
            key: 'step2',
            icon: Sparkles,
            color: 'text-purple-400',
            bg: 'bg-purple-400/10',
            border: 'border-purple-400/20'
        },
        {
            key: 'step3',
            icon: Activity,
            color: 'text-blue-400',
            bg: 'bg-blue-400/10',
            border: 'border-blue-400/20'
        }
    ];

    return (
        <section className="relative py-32 bg-black/20">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                >
                    <h2 className="text-5xl md:text-7xl font-display font-thin mb-6">
                        {t('sections.how_it_works.headline')}
                    </h2>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8 relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {steps.map((step, index) => (
                        <motion.div
                            key={step.key}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.2 }}
                            className="relative"
                        >
                            {/* Step Number Badge */}
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-warm-charcoal border border-white/10 flex items-center justify-center z-10 shadow-xl">
                                <span className="font-display text-xl text-white">{index + 1}</span>
                            </div>

                            <div className={`h-full p-8 rounded-3xl border ${step.border} ${step.bg} backdrop-blur-sm pt-12 hover:bg-white/5 transition-colors group`}>
                                <div className="flex flex-col items-center text-center">
                                    <div className={`w-16 h-16 rounded-2xl ${step.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                        <step.icon size={32} className={step.color} />
                                    </div>

                                    <h3 className="text-2xl font-display font-medium text-white mb-4">
                                        {t(`sections.how_it_works.${step.key}.title`)}
                                    </h3>

                                    <p className="text-gray-400 leading-relaxed">
                                        {t(`sections.how_it_works.${step.key}.description`)}
                                    </p>
                                </div>
                            </div>

                            {/* Mobile Arrow */}
                            {index < steps.length - 1 && (
                                <div className="md:hidden flex justify-center py-4 text-white/20">
                                    <ArrowRight size={24} className="rotate-90" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
