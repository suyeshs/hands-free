'use client';
import { useState, useEffect } from 'react';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  imageUrl?: string;
  bgColor: string;
}

const FeaturedSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 1,
      title: "🎄 Holiday Special Menu",
      subtitle: "Celebrate the season with our festive dishes",
      bgColor: "from-red-600 to-red-700",
    },
    {
      id: 2,
      title: "⭐ Chef's Recommendations",
      subtitle: "Handpicked favorites for you this season",
      bgColor: "from-green-600 to-green-700",
    },
    {
      id: 3,
      title: "🎁 Special Offers",
      subtitle: "Limited time festive deals & combos",
      bgColor: "from-amber-600 to-amber-700",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <div className="relative w-full mb-6 neu-card rounded-2xl overflow-hidden">
      {/* Slides */}
      <div className="relative h-40 md:h-48">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-500 ${
              index === currentSlide
                ? 'opacity-100 translate-x-0'
                : index < currentSlide
                ? 'opacity-0 -translate-x-full'
                : 'opacity-0 translate-x-full'
            }`}
          >
            <div className={`w-full h-full bg-gradient-to-r ${slide.bgColor} flex items-center justify-center text-white p-6`}>
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{slide.title}</h2>
                <p className="text-sm md:text-base opacity-90">{slide.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Dots */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'bg-white w-6'
                : 'bg-white/50 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => goToSlide((currentSlide - 1 + slides.length) % slides.length)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all"
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        onClick={() => goToSlide((currentSlide + 1) % slides.length)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all"
        aria-label="Next slide"
      >
        ›
      </button>
    </div>
  );
};

export default FeaturedSlider;
