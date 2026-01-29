/**
 * WelcomeScreen Component
 * First screen in the setup wizard - introduction and expectations
 */

import { motion } from 'framer-motion';
import { Sparkles, Clock, CheckCircle } from 'lucide-react';

export function WelcomeScreen() {
  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Logo Animation */}
      <motion.div
        className="mb-12"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
      >
        <div className="w-32 h-32 mx-auto rounded-3xl bg-gradient-to-br from-paprika to-saffron flex items-center justify-center shadow-2xl">
          <Sparkles className="w-16 h-16 text-white" strokeWidth={2.5} />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h1 className="text-5xl font-black uppercase tracking-wider mb-4 bg-gradient-to-r from-paprika to-saffron bg-clip-text text-transparent">
          Welcome to HandsFree
        </h1>
        <p className="text-2xl font-bold text-foreground mb-3">Restaurant OS</p>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Let's get your restaurant set up in just a few minutes
        </p>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {/* Quick Setup */}
        <div className="p-6 rounded-2xl bg-card/50 backdrop-blur border border-border">
          <Clock className="w-8 h-8 mx-auto mb-3 text-saffron" />
          <h3 className="font-bold mb-2">Quick Setup</h3>
          <p className="text-sm text-muted-foreground">5-10 minutes to get started</p>
        </div>

        {/* Easy to Use */}
        <div className="p-6 rounded-2xl bg-card/50 backdrop-blur border border-border">
          <CheckCircle className="w-8 h-8 mx-auto mb-3 text-saffron" />
          <h3 className="font-bold mb-2">Guided Experience</h3>
          <p className="text-sm text-muted-foreground">Step-by-step assistance</p>
        </div>

        {/* Flexible */}
        <div className="p-6 rounded-2xl bg-card/50 backdrop-blur border border-border">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-saffron" />
          <h3 className="font-bold mb-2">Flexible Setup</h3>
          <p className="text-sm text-muted-foreground">Configure now or later</p>
        </div>
      </motion.div>

      {/* What We'll Set Up */}
      <motion.div
        className="text-left max-w-md mx-auto mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">
          We'll help you set up:
        </h3>
        <ul className="space-y-3 text-sm">
          {[
            'Restaurant details and location',
            'Tax and billing configuration',
            'Operating mode (training or live)',
            'Optional: Menu, staff, and more',
          ].map((item, index) => (
            <motion.li
              key={index}
              className="flex items-start gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + index * 0.1 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-saffron mt-2 flex-shrink-0" />
              <span className="text-muted-foreground">{item}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
