import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { TemplateCard } from './TemplateCard';
import { templates, type Template } from '../../src/config/templates';

export function BentoGrid() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  return (
    <>
      {/* Bento Grid Container */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 auto-rows-[200px] md:auto-rows-[240px]">
        {templates.map((template, index) => (
          <TemplateCard
            key={template.id}
            template={template}
            index={index}
            onClick={() => setSelectedTemplate(template)}
            layoutId={`template-${template.id}`}
          />
        ))}
      </div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {selectedTemplate && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTemplate(null)}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
            />

            {/* Expanded Card */}
            <motion.div
              layoutId={`template-${selectedTemplate.id}`}
              className="fixed inset-4 md:inset-12 lg:inset-20 z-[101] overflow-hidden rounded-3xl border border-white/20 bg-warm-charcoal"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedTemplate(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-white" />
              </button>

              <div className="h-full flex flex-col md:flex-row">
                {/* Template Preview */}
                <div className="flex-1 relative">
                  {/* Gradient Background */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${selectedTemplate.gradient} opacity-60`}
                  />

                  {/* Browser Mockup */}
                  <div className="absolute inset-8 md:inset-12 rounded-xl border border-white/20 bg-black/40 overflow-hidden shadow-2xl">
                    {/* Browser Header */}
                    <div className="h-10 bg-black/60 flex items-center px-4 gap-2 border-b border-white/10">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="h-5 bg-white/10 rounded-md text-xs text-gray-400 flex items-center justify-center">
                          https://yourrestaurant.handsfree.tech
                        </div>
                      </div>
                    </div>

                    {/* Template Content Area */}
                    <div className="h-full flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
                          <span className="text-4xl">
                            {selectedTemplate.category === 'Contemporary' && '🍽️'}
                            {selectedTemplate.category === 'Traditional' && '🍝'}
                            {selectedTemplate.category === 'Minimal' && '🍣'}
                            {selectedTemplate.category === 'Vibrant' && '🌮'}
                            {selectedTemplate.category === 'Organic' && '🥗'}
                            {selectedTemplate.category === 'Cozy' && '☕'}
                          </span>
                        </div>
                        <h3 className="text-2xl font-display text-white mb-2">
                          {selectedTemplate.name}
                        </h3>
                        <p className="text-gray-400 text-sm">
                          Template Preview Coming Soon
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Template Details Panel */}
                <div className="w-full md:w-96 bg-black/40 border-t md:border-t-0 md:border-l border-white/10 p-8 overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {/* Category Badge */}
                    <span className="inline-block px-3 py-1 text-xs font-medium uppercase tracking-wider text-saffron bg-saffron/10 rounded-full mb-4">
                      {selectedTemplate.category}
                    </span>

                    {/* Title */}
                    <h2 className="text-3xl font-display font-light text-white mb-4">
                      {selectedTemplate.name}
                    </h2>

                    {/* Description */}
                    <p className="text-gray-400 leading-relaxed mb-8">
                      {selectedTemplate.description}
                    </p>

                    {/* Features */}
                    <div className="mb-8">
                      <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-4">
                        Features
                      </h4>
                      <div className="space-y-3">
                        {selectedTemplate.features.map((feature) => (
                          <div
                            key={feature}
                            className="flex items-center gap-3 text-gray-400"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-saffron" />
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA */}
                    <button className="w-full py-4 bg-gradient-warm text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-paprika/30 transition-shadow">
                      Use This Template
                      <ExternalLink size={16} />
                    </button>

                    <p className="text-center text-gray-500 text-sm mt-4">
                      Customize colors, fonts, and layout to match your brand
                    </p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
