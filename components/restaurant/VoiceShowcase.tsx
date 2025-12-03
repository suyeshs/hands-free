import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Globe, MessageSquare, Zap, Volume2, Languages } from 'lucide-react';
import { PhoneInterface } from '../PhoneInterface';

export function VoiceShowcase() {
  const features = [
    {
      icon: <Languages className="w-5 h-5" />,
      title: '14+ Languages',
      description: 'Native-quality voice in English, Spanish, French, German, Japanese, and more',
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: 'Natural Conversations',
      description: 'Customers speak naturally - our AI understands context, modifications, and questions',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Instant Response',
      description: 'Sub-second response times for seamless, human-like interactions',
    },
    {
      icon: <Volume2 className="w-5 h-5" />,
      title: 'Lifelike Voice',
      description: 'Advanced text-to-speech that sounds natural, not robotic',
    },
  ];

  return (
    <section className="relative py-32 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-saffron bg-saffron/10 rounded-full mb-6">
            Voice Interface
          </span>
          <h2 className="text-5xl md:text-7xl font-display font-thin mb-6">
            Talk to Order,<br />
            <span className="text-saffron">In Any Language</span>
          </h2>
          <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto">
            Your customers speak, our AI listens. Natural voice ordering
            that feels like talking to your best server.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Phone Demo */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative flex justify-center"
          >
            {/* Decorative Elements */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-saffron/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-paprika/10 rounded-full blur-3xl" />

            {/* Sound Waves Animation */}
            <SoundWaves />

            {/* Phone Frame with Live Demo */}
            <div className="relative z-10">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="w-[300px] h-[620px] md:w-[340px] md:h-[700px] bg-black/90 rounded-[3rem] border-8 border-warm-charcoal/80 shadow-2xl overflow-hidden ring-4 ring-white/10"
              >
                <PhoneInterface />
              </motion.div>

              {/* Try It Badge */}
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="absolute -top-4 -right-4 px-4 py-2 bg-gradient-warm rounded-full shadow-lg"
              >
                <div className="flex items-center gap-2 text-white text-sm font-medium">
                  <Mic size={16} />
                  Try it live!
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right: Features */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="space-y-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-saffron/30 transition-all"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-saffron/20 to-paprika/20 rounded-xl flex items-center justify-center text-saffron group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Language Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-8 p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-saffron/5 to-paprika/5"
            >
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5 text-saffron" />
                <span className="text-sm font-medium text-gray-300">
                  Supported Languages
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'English', 'Spanish', 'French', 'German', 'Italian',
                  'Portuguese', 'Japanese', 'Thai', 'Vietnamese', 'Hindi', '+4 more'
                ].map((lang) => (
                  <span
                    key={lang}
                    className="px-3 py-1 text-xs bg-white/10 rounded-full text-gray-400"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Animated Sound Waves
function SoundWaves() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute w-[400px] h-[400px] rounded-full border border-saffron/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 1.5],
            opacity: [0.3, 0],
          }}
          transition={{
            duration: 3,
            delay: i * 0.8,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}
