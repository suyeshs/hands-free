import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Box } from 'lucide-react';
import { BentoGrid } from './BentoGrid';
import { Carousel3D } from './Carousel3D';

type ViewMode = 'bento' | 'carousel';

export function TemplateShowcase() {
  const [viewMode, setViewMode] = useState<ViewMode>('carousel');

  return (
    <section className="relative py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-saffron bg-saffron/10 rounded-full mb-6">
            Website Templates
          </span>
          <h2 className="text-5xl md:text-7xl font-display font-thin mb-6">
            Beautiful Designs,<br />
            <span className="text-saffron">Ready to Launch</span>
          </h2>
          <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto">
            Choose from our collection of restaurant website templates.
            Each one is optimized for voice ordering and mobile-first experiences.
          </p>
        </motion.div>

        {/* View Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex justify-center mb-12"
        >
          <div className="inline-flex bg-white/5 rounded-full p-1 border border-white/10">
            <button
              onClick={() => setViewMode('carousel')}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
                ${viewMode === 'carousel'
                  ? 'bg-gradient-warm text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              <Box size={16} />
              3D View
            </button>
            <button
              onClick={() => setViewMode('bento')}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all
                ${viewMode === 'bento'
                  ? 'bg-gradient-warm text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              <LayoutGrid size={16} />
              Grid View
            </button>
          </div>
        </motion.div>

        {/* View Content */}
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {viewMode === 'bento' ? <BentoGrid /> : <Carousel3D />}
        </motion.div>
      </div>
    </section>
  );
}
