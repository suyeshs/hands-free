import React from 'react';
import { motion } from 'framer-motion';
import { useLocale } from '../../src/contexts/LocaleContext';

export function ProductShowcase() {
    const { t } = useLocale();

    const items = [
        {
            key: 'website',
            image: '/images/restaurant/themes_collage.png',
            colSpan: 'md:col-span-2',
            height: 'h-64 md:h-96'
        },
        {
            key: 'pos',
            image: '/images/restaurant/pos.png',
            colSpan: 'md:col-span-1',
            height: 'h-64'
        },
        {
            key: 'kds',
            image: '/images/restaurant/kds.png',
            colSpan: 'md:col-span-1',
            height: 'h-64'
        },
        {
            key: 'crm',
            image: '/images/restaurant/crm.png',
            colSpan: 'md:col-span-2',
            height: 'h-64 md:h-80'
        }
    ];

    return (
        <section className="relative py-20">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-5xl md:text-7xl font-display font-thin mb-6">
                        {t('sections.showcase.headline')}
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {items.map((item, index) => (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative rounded-3xl overflow-hidden group ${item.colSpan} ${item.height}`}
                        >
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                            <img
                                src={item.image}
                                alt={t(`sections.showcase.${item.key}`) as string}
                                className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent z-20">
                                <h3 className="text-2xl font-display font-medium text-white">
                                    {t(`sections.showcase.${item.key}`)}
                                </h3>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
