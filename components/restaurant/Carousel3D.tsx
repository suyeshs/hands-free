import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Monitor, Sparkles } from 'lucide-react';
import { templates, type Template } from '../../src/config/templates';

export function Carousel3D() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  const itemCount = templates.length;
  const angleStep = 360 / itemCount;

  // Auto-rotate
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % itemCount);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, itemCount]);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
    setIsPaused(true);
    // Resume auto-rotation after 10 seconds of inactivity
    setTimeout(() => setIsPaused(false), 10000);
  }, []);

  const next = useCallback(() => {
    goToSlide((activeIndex + 1) % itemCount);
  }, [activeIndex, itemCount, goToSlide]);

  const prev = useCallback(() => {
    goToSlide((activeIndex - 1 + itemCount) % itemCount);
  }, [activeIndex, itemCount, goToSlide]);

  // Drag handling
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragStart(clientX);
  };

  const handleDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const diff = dragStart - clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  };

  return (
    <div
      className="relative py-12"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 3D Carousel Container */}
      <div
        className="relative h-[400px] md:h-[500px] mx-auto"
        style={{ perspective: '1200px' }}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {templates.map((template, index) => {
            const offset = index - activeIndex;
            const normalizedOffset = ((offset % itemCount) + itemCount) % itemCount;
            const adjustedOffset = normalizedOffset > itemCount / 2
              ? normalizedOffset - itemCount
              : normalizedOffset;

            const isActive = index === activeIndex;
            const rotateY = adjustedOffset * angleStep;
            const translateZ = isActive ? 280 : 100;
            const scale = isActive ? 1 : 0.75;
            const opacity = Math.abs(adjustedOffset) <= 2 ? (isActive ? 1 : 0.5) : 0;
            const zIndex = isActive ? 10 : 5 - Math.abs(adjustedOffset);

            return (
              <motion.div
                key={template.id}
                animate={{
                  rotateY,
                  translateZ,
                  scale,
                  opacity,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 20,
                }}
                onClick={() => goToSlide(index)}
                className="absolute w-[280px] md:w-[360px] h-[320px] md:h-[400px] cursor-pointer"
                style={{
                  transformStyle: 'preserve-3d',
                  zIndex,
                }}
              >
                <CarouselCard template={template} isActive={isActive} />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prev}
        className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
      >
        <ChevronLeft size={24} className="text-white" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
      >
        <ChevronRight size={24} className="text-white" />
      </button>

      {/* Navigation Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {templates.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? 'w-8 bg-saffron'
                : 'bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>

      {/* Active Template Details */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="text-center mt-8 px-4"
        >
          <span className="inline-block px-3 py-1 text-xs font-medium uppercase tracking-wider text-saffron bg-saffron/10 rounded-full mb-3">
            {templates[activeIndex].category}
          </span>
          <h3 className="text-2xl md:text-3xl font-display font-light text-white mb-2">
            {templates[activeIndex].name}
          </h3>
          <p className="text-gray-400 max-w-lg mx-auto">
            {templates[activeIndex].description}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {templates[activeIndex].features.map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 text-xs bg-white/10 rounded-full text-gray-300"
              >
                {feature}
              </span>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Individual Carousel Card
function CarouselCard({ template, isActive }: { template: Template; isActive: boolean }) {
  return (
    <div
      className={`
        relative h-full overflow-hidden rounded-2xl border bg-warm-charcoal/80 backdrop-blur-sm
        transition-all duration-300
        ${isActive ? 'border-saffron/50 shadow-2xl shadow-saffron/20' : 'border-white/10'}
      `}
      style={{
        filter: isActive ? 'none' : 'blur(1px)',
      }}
    >
      {/* Gradient Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${template.gradient} opacity-70`}
      />

      {/* Browser Mockup */}
      <div className="absolute inset-3 rounded-lg border border-white/20 bg-black/30 overflow-hidden">
        {/* Browser Header */}
        <div className="h-7 bg-black/50 flex items-center px-2 gap-1.5 border-b border-white/10">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500/70" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
            <div className="w-2 h-2 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 mx-2">
            <div className="h-3.5 bg-white/10 rounded text-[8px] text-gray-500 flex items-center justify-center">
              yourrestaurant.com
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="h-full flex flex-col items-center justify-center p-4 text-center">
          <Monitor className="w-10 h-10 text-white/40 mb-2" />
          <p className="text-white/60 text-sm font-medium">{template.name}</p>
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-8 h-8 bg-saffron rounded-full flex items-center justify-center"
        >
          <Sparkles size={16} className="text-white" />
        </motion.div>
      )}
    </div>
  );
}
