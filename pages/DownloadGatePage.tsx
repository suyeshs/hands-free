import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../src/contexts/LocaleContext';
import { GlassCard } from '../components/GlassCard';
import { detectOS, getOSInfo } from '../src/utils/osDetection';

export function DownloadGatePage() {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const osInfo = getOSInfo();

      const response = await fetch('/api/download-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          osDetected: `${osInfo.type}${osInfo.isAppleSilicon ? ' (Apple Silicon)' : ''}`,
        }),
      });

      const data = await response.json();

      if (data.success && data.accessToken) {
        // Store access token in sessionStorage
        sessionStorage.setItem('download_access', data.accessToken);
        sessionStorage.setItem('download_name', formData.name);

        // Redirect to downloads page
        setTimeout(() => {
          navigate(`/${locale}/downloads`);
        }, 500);
      } else {
        throw new Error('Failed to submit form');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to submit. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-paprika/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-saffron/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-warm rounded-2xl shadow-warm-glow mb-6"
            >
              <Download className="w-10 h-10 text-white" />
            </motion.div>

            <h1 className="text-5xl md:text-6xl font-display font-semibold text-warm-white mb-4">
              {t('downloadGate.headline')}
            </h1>
            <p className="text-xl text-gray-400">
              {t('downloadGate.subheadline')}
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <GlassCard variant="overlay" className="p-8 md:p-12">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name Field */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-400 mb-2"
                  >
                    {t('downloadGate.form.name')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={String(t('downloadGate.form.namePlaceholder'))}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 text-warm-white placeholder-gray-500 focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron transition-all duration-300"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Phone Field */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-400 mb-2"
                  >
                    {t('downloadGate.form.phone')}
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    required
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder={String(t('downloadGate.form.phonePlaceholder'))}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 text-warm-white placeholder-gray-500 focus:outline-none focus:border-saffron focus:ring-1 focus:ring-saffron transition-all duration-300"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                  className="w-full bg-gradient-warm text-white font-semibold py-4 px-6 rounded-xl shadow-warm-glow hover:shadow-[0_4px_24px_rgba(242,140,56,0.6)] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('downloadGate.success')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>{t('downloadGate.form.submit')}</span>
                    </>
                  )}
                </motion.button>
              </form>

              {/* Privacy Note */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center text-sm text-gray-500 mt-6"
              >
                {t('downloadGate.privacy')}
              </motion.p>
            </GlassCard>
          </motion.div>

          {/* Features List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { icon: '🚀', titleKey: 'downloadGate.features.fast.title', descKey: 'downloadGate.features.fast.desc' },
              { icon: '🔒', titleKey: 'downloadGate.features.secure.title', descKey: 'downloadGate.features.secure.desc' },
              { icon: '🔄', titleKey: 'downloadGate.features.updates.title', descKey: 'downloadGate.features.updates.desc' },
            ].map((feature, index) => (
              <GlassCard key={index} variant="panel" className="p-6 text-center">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-warm-white font-semibold mb-1">{String(t(feature.titleKey))}</h3>
                <p className="text-sm text-gray-400">{String(t(feature.descKey))}</p>
              </GlassCard>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
