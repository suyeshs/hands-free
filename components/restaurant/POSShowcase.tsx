import React from 'react';
import { motion } from 'framer-motion';
import { Mic, ArrowRight, Receipt, ChefHat, CreditCard, Check } from 'lucide-react';
import { POSTerminalMockup } from './DeviceMockup';
import { posIntegrations } from '../../src/config/templates';

export function POSShowcase() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-saffron bg-saffron/10 rounded-full mb-6">
              POS Integration
            </span>
            <h2 className="text-5xl md:text-6xl font-display font-thin mb-6">
              Seamless<br />
              <span className="text-saffron">POS Connection</span>
            </h2>
            <p className="text-xl text-gray-400 font-light mb-8 leading-relaxed">
              Voice orders flow directly to your existing POS system.
              No double entry, no missed orders, no friction.
            </p>

            {/* Flow Steps */}
            <div className="space-y-6 mb-10">
              <FlowStep
                icon={<Mic className="w-5 h-5" />}
                title="Customer speaks order"
                description="Natural voice conversation captures complete order details"
                delay={0}
              />
              <FlowStep
                icon={<Receipt className="w-5 h-5" />}
                title="Order validated & confirmed"
                description="AI confirms items, modifications, and total with customer"
                delay={0.1}
              />
              <FlowStep
                icon={<ChefHat className="w-5 h-5" />}
                title="Sent to kitchen display"
                description="Order appears on your KDS instantly, ready for prep"
                delay={0.2}
              />
            </div>

            {/* Integrations */}
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-4">
                Integrations
              </p>
              <div className="flex flex-wrap gap-3">
                {posIntegrations.map((integration) => (
                  <div
                    key={integration.id}
                    className={`
                      px-4 py-2 rounded-lg border flex items-center gap-2
                      ${integration.status === 'available'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-white/5 border-white/10 text-gray-500'
                      }
                    `}
                  >
                    {integration.status === 'available' && <Check size={14} />}
                    <span className="text-sm font-medium">{integration.name}</span>
                    {integration.status === 'coming-soon' && (
                      <span className="text-xs text-gray-600">Soon</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: Visual */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* POS Terminal */}
            <POSTerminalMockup className="w-72 mx-auto">
              <div className="aspect-[4/3] bg-black p-4">
                {/* POS Screen Content */}
                <div className="h-full bg-gray-900 rounded-lg p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-700">
                    <span className="text-xs text-gray-400">Order #2847</span>
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      Voice Order
                    </span>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-300">
                      <span>1x Pandi Curry Combo</span>
                      <span>$18.99</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>2x Akki Otti</span>
                      <span>$6.00</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>1x Filter Coffee</span>
                      <span>$3.50</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="pt-2 border-t border-gray-700 flex justify-between font-medium text-white">
                    <span>Total</span>
                    <span>$28.49</span>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <div className="w-full py-2 bg-saffron rounded text-center text-xs font-medium text-white">
                      Send to Kitchen
                    </div>
                  </div>
                </div>
              </div>
            </POSTerminalMockup>

            {/* Animated Connection Lines */}
            <ConnectionLines />

            {/* Floating Icons */}
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 4, delay: 0 }}
              className="absolute top-10 left-10 w-14 h-14 bg-gradient-to-br from-saffron/20 to-paprika/20 rounded-xl flex items-center justify-center border border-saffron/30"
            >
              <Mic className="w-6 h-6 text-saffron" />
            </motion.div>

            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, delay: 0.5 }}
              className="absolute bottom-20 right-0 w-14 h-14 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center border border-green-500/30"
            >
              <CreditCard className="w-6 h-6 text-green-400" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FlowStep({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="flex gap-4"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-warm rounded-lg flex items-center justify-center text-white">
        {icon}
      </div>
      <div>
        <h4 className="text-white font-medium mb-1">{title}</h4>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </motion.div>
  );
}

function ConnectionLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: -1 }}
    >
      {/* Animated dashed line from mic to terminal */}
      <motion.path
        d="M 80 80 Q 150 150 180 200"
        fill="none"
        stroke="url(#gradient1)"
        strokeWidth="2"
        strokeDasharray="8 4"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 0.5 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
      {/* Animated line from terminal to payment */}
      <motion.path
        d="M 280 350 Q 320 380 350 360"
        fill="none"
        stroke="url(#gradient2)"
        strokeWidth="2"
        strokeDasharray="8 4"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 0.5 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, delay: 1 }}
      />
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F28C38" />
          <stop offset="100%" stopColor="#D9453E" />
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
    </svg>
  );
}
