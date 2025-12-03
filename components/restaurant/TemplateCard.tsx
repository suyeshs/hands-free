import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Monitor, Sparkles } from 'lucide-react';
import type { Template } from '../../src/config/templates';

interface TemplateCardProps {
  template: Template;
  index: number;
  onClick?: () => void;
  layoutId?: string;
}

export function TemplateCard({ template, index, onClick, layoutId }: TemplateCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Mouse position for 3D tilt effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animation for tilt
  const springConfig = { stiffness: 300, damping: 30 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      layoutId={layoutId}
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`
        relative cursor-pointer group
        ${template.size === 'large' ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'}
      `}
    >
      {/* Card Container */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-warm-charcoal/50 backdrop-blur-sm"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Gradient Background - Template Preview Placeholder */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${template.gradient} opacity-80`}
        />

        {/* Browser Mockup Frame */}
        <div
          className="absolute inset-4 rounded-lg border border-white/20 bg-black/30 overflow-hidden"
          style={{ transform: 'translateZ(20px)' }}
        >
          {/* Browser Header */}
          <div className="h-8 bg-black/50 flex items-center px-3 gap-2 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <div className="flex-1 mx-2">
              <div className="h-4 bg-white/10 rounded text-[10px] text-gray-500 flex items-center justify-center">
                yourrestaurant.com
              </div>
            </div>
          </div>

          {/* Template Content Placeholder */}
          <div className="p-4 h-full flex flex-col items-center justify-center text-center">
            <Monitor className="w-12 h-12 text-white/40 mb-3" />
            <p className="text-white/60 text-sm font-medium">{template.name}</p>
            <p className="text-white/40 text-xs mt-1">{template.category}</p>
          </div>
        </div>

        {/* Hover Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6"
          style={{ transform: 'translateZ(40px)' }}
        >
          {/* Template Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-saffron" />
              <span className="text-saffron text-xs font-medium uppercase tracking-wider">
                {template.category}
              </span>
            </div>
            <h3 className="text-xl font-display font-light text-white">
              {template.name}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {template.description}
            </p>

            {/* Features */}
            <div className="flex flex-wrap gap-2 pt-2">
              {template.features.map((feature) => (
                <span
                  key={feature}
                  className="px-2 py-1 text-xs bg-white/10 rounded-full text-gray-300"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Glow Effect on Hover */}
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            boxShadow: '0 0 40px 10px rgba(242, 140, 56, 0.15)',
            transform: 'translateZ(-10px)',
          }}
        />
      </motion.div>
    </motion.div>
  );
}
