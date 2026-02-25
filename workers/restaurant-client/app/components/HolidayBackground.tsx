'use client';
import { useEffect, useState } from 'react';

const HolidayBackground = () => {
  const [snowflakes, setSnowflakes] = useState<Array<{
    id: number;
    left: number;
    animationDuration: number;
    opacity: number;
    size: number;
  }>>([]);

  const [stars, setStars] = useState<Array<{
    id: number;
    left: number;
    top: number;
    size: number;
    delay: number;
  }>>([]);

  const [spirals, setSpirals] = useState<Array<{
    id: number;
    left: number;
    color: string;
    rotation: number;
  }>>([]);

  useEffect(() => {
    // Generate snowflakes
    const flakes = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      animationDuration: 8 + Math.random() * 15,
      opacity: 0.5 + Math.random() * 0.5,
      size: 4 + Math.random() * 8,
    }));
    setSnowflakes(flakes);

    // Generate gold stars
    const starElements = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 8 + Math.random() * 16,
      delay: Math.random() * 3,
    }));
    setStars(starElements);

    // Generate party spirals
    const spiralElements = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: ['#FFD700', '#C41E3A', '#0F8A5F'][Math.floor(Math.random() * 3)],
      rotation: Math.random() * 360,
    }));
    setSpirals(spiralElements);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Flat solid festive background */}
      <div className="absolute inset-0 bg-slate-50" />

      {/* Christmas tree silhouettes */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={`tree-${i}`}
            className="absolute bottom-0 opacity-20"
            style={{
              left: `${i * 14 + 3}%`,
              transform: `scale(${0.6 + Math.random() * 0.8})`,
            }}
          >
            <div className="relative w-20 h-32">
              {/* Tree triangle */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[40px] border-l-transparent border-r-[40px] border-r-transparent border-b-[100px] border-b-green-700" />
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[35px] border-l-transparent border-r-[35px] border-r-transparent border-b-[80px] border-b-green-600" />
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[30px] border-l-transparent border-r-[30px] border-r-transparent border-b-[60px] border-b-green-500" />
              {/* Trunk */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-8 bg-amber-900" />
            </div>
          </div>
        ))}
      </div>

      {/* Party spirals */}
      <div className="absolute inset-0">
        {spirals.map((spiral) => (
          <div
            key={`spiral-${spiral.id}`}
            className="absolute animate-spiral-float"
            style={{
              left: `${spiral.left}%`,
              top: '-50px',
              animationDelay: `${Math.random() * 5}s`,
            }}
          >
            <svg width="30" height="60" viewBox="0 0 30 60">
              <path
                d="M15,5 Q20,15 15,25 Q10,35 15,45 Q20,55 15,60"
                stroke={spiral.color}
                strokeWidth="3"
                fill="none"
                opacity="0.7"
                style={{ transform: `rotate(${spiral.rotation}deg)` }}
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Gold stars */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={`star-${star.id}`}
            className="absolute animate-star-twinkle"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              fontSize: `${star.size}px`,
              animationDelay: `${star.delay}s`,
            }}
          >
            ⭐
          </div>
        ))}
      </div>

      {/* Santa hats decorations */}
      <div className="absolute top-10 left-10 opacity-30 animate-float">
        <div className="text-6xl">🎅</div>
      </div>
      <div className="absolute top-20 right-20 opacity-30 animate-float" style={{ animationDelay: '1s' }}>
        <div className="text-5xl">🎄</div>
      </div>
      <div className="absolute bottom-20 left-1/4 opacity-30 animate-float" style={{ animationDelay: '2s' }}>
        <div className="text-4xl">🎁</div>
      </div>
      <div className="absolute top-1/3 right-10 opacity-30 animate-float" style={{ animationDelay: '1.5s' }}>
        <div className="text-5xl">⛄</div>
      </div>

      {/* Ornament decorations */}
      {[...Array(12)].map((_, i) => (
        <div
          key={`ornament-${i}`}
          className="absolute animate-swing"
          style={{
            left: `${5 + i * 8}%`,
            top: `${Math.random() * 20}px`,
            animationDelay: `${i * 0.2}s`,
          }}
        >
          <div
            className="w-8 h-8 rounded-full opacity-40"
            style={{
              background: ['#FFD700', '#C41E3A', '#0F8A5F', '#FF6B6B'][i % 4],
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          />
          <div className="w-1 h-4 bg-amber-700 mx-auto" />
        </div>
      ))}

      {/* Enhanced snowfall */}
      <div className="absolute inset-0">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute text-white animate-fall"
            style={{
              left: `${flake.left}%`,
              top: '-10px',
              opacity: flake.opacity,
              fontSize: `${flake.size}px`,
              animationDuration: `${flake.animationDuration}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Festive lights border effect */}
      <div className="absolute top-0 left-0 right-0 h-2 opacity-50">
        <div className="flex h-full">
          {[...Array(20)].map((_, i) => (
            <div
              key={`light-${i}`}
              className="flex-1 animate-pulse"
              style={{
                background: ['#FFD700', '#C41E3A', '#0F8A5F'][i % 3],
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Add keyframe animations */}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-10px) translateX(0) rotate(0deg);
          }
          100% {
            transform: translateY(100vh) translateX(30px) rotate(360deg);
          }
        }

        @keyframes star-twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.2) rotate(180deg);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes swing {
          0%, 100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(5deg);
          }
        }

        @keyframes spiral-float {
          0% {
            transform: translateY(-50px) rotate(0deg);
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
          }
        }

        .animate-fall {
          animation: fall linear infinite;
        }

        .animate-star-twinkle {
          animation: star-twinkle 2s ease-in-out infinite;
        }

        .animate-float {
          animation: float 4s ease-in-out infinite;
        }

        .animate-swing {
          animation: swing 3s ease-in-out infinite;
          transform-origin: top center;
        }

        .animate-spiral-float {
          animation: spiral-float 15s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default HolidayBackground;
