import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useLocale } from '../../src/contexts/LocaleContext';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const { t } = useLocale();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    restaurantName: '',
    ownerName: '',
    email: '',
    phone: '',
    city: ''
  });
  const [detectedCity, setDetectedCity] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
          if (data.city) {
            setDetectedCity(data.city);
            setFormData(prev => ({ ...prev, city: data.city }));
          }
        })
        .catch(err => console.error('Failed to detect location', err));
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the data to your backend
    console.log('Waitlist submission:', formData);
    setIsSubmitted(true);
    setTimeout(() => {
      onClose();
      setIsSubmitted(false);
      setFormData({ restaurantName: '', ownerName: '', email: '', phone: '', city: '' });
    }, 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-warm-charcoal border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="p-8">
              {isSubmitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-display text-white mb-2">
                    {t('sections.waitlist.form.success')}
                  </h3>
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Left Column: Standard Waitlist */}
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-paprika/20 border border-paprika/40 rounded-full mb-4">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-paprika opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-paprika"></span>
                        </span>
                        <span className="text-xs font-medium text-paprika uppercase tracking-wider">Limited Availability</span>
                      </div>
                      <h2 className="text-3xl font-display font-thin text-white mb-2">
                        {t('sections.waitlist.headline')}
                      </h2>
                      <p className="text-gray-400 mb-6">
                        {t('sections.waitlist.description')}
                      </p>

                      <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
                        <p className="text-sm text-saffron font-medium mb-2">{t('sections.waitlist.offer')}</p>
                        <ul className="text-sm text-gray-300 space-y-1">
                          <li>• {t('sections.waitlist.benefit1')}</li>
                          <li>• {t('sections.waitlist.benefit2')}</li>
                        </ul>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">{t('sections.waitlist.form.name')}</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-saffron transition-colors"
                            value={formData.restaurantName}
                            onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">{t('sections.waitlist.form.owner')}</label>
                          <input
                            type="text"
                            required
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-saffron transition-colors"
                            value={formData.ownerName}
                            onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">{t('sections.waitlist.form.email')}</label>
                            <input
                              type="email"
                              required
                              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-saffron transition-colors"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">{t('sections.waitlist.form.phone')}</label>
                            <input
                              type="tel"
                              required
                              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-saffron transition-colors"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-sm text-gray-400 mb-1">{t('sections.waitlist.form.city')}</label>
                            <div className="relative">
                              <select
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-saffron transition-colors appearance-none"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                              >
                                <option value="" disabled>Select Location</option>
                                {detectedCity && <option value={detectedCity}>{detectedCity}</option>}
                                <option value="Multi-city">Multi-city Operations</option>
                                <option value="Other">Other</option>
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-white/10 border border-white/20 text-white font-medium py-4 rounded-lg mt-4 hover:bg-white/20 transition-colors"
                        >
                          {t('sections.waitlist.form.submit')}
                        </button>
                      </form>
                    </div>

                    {/* Right Column: Fast Track */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-warm opacity-10 blur-2xl rounded-3xl" />
                      <div className="relative h-full bg-gradient-to-b from-white/10 to-transparent border border-white/20 rounded-2xl p-8 flex flex-col">
                        <div className="mb-6">
                          <h3 className="text-xl font-display font-medium text-white mb-2">
                            {t('sections.waitlist.fast_track.headline')}
                          </h3>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-saffron">{t('sections.waitlist.fast_track.price')}</span>
                            <span className="text-gray-400">{t('sections.waitlist.fast_track.period')}</span>
                          </div>
                        </div>

                        <ul className="space-y-4 mb-8 flex-1">
                          <li className="flex items-center gap-3 text-gray-200">
                            <div className="w-6 h-6 rounded-full bg-saffron/20 flex items-center justify-center">
                              <Check size={14} className="text-saffron" />
                            </div>
                            {t('sections.waitlist.fast_track.benefits.instant')}
                          </li>
                          <li className="flex items-center gap-3 text-gray-200">
                            <div className="w-6 h-6 rounded-full bg-saffron/20 flex items-center justify-center">
                              <Check size={14} className="text-saffron" />
                            </div>
                            {t('sections.waitlist.fast_track.benefits.support')}
                          </li>
                          <li className="flex items-center gap-3 text-gray-200">
                            <div className="w-6 h-6 rounded-full bg-saffron/20 flex items-center justify-center">
                              <Check size={14} className="text-saffron" />
                            </div>
                            {t('sections.waitlist.fast_track.benefits.free_month')}
                          </li>
                        </ul>

                        <button
                          onClick={() => window.open('https://buy.stripe.com/test_waitlist', '_blank')}
                          className="w-full bg-gradient-warm text-white font-bold py-4 rounded-lg shadow-lg shadow-paprika/30 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                        >
                          {t('sections.waitlist.fast_track.cta')}
                        </button>
                        <p className="text-center text-xs text-gray-500 mt-4">
                          Secure payment via Stripe
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
