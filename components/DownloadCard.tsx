import React from 'react';
import { Download, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import type { OSType } from '../src/utils/osDetection';

export interface DownloadOption {
  os: OSType;
  name: string;
  icon: React.ReactNode;
  version: string;
  fileSize: string;
  requirements: string;
  downloadUrl: string;
}

interface DownloadCardProps {
  option: DownloadOption;
  isRecommended: boolean;
  t: (key: string, params?: Record<string, any>) => string | string[];
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  option,
  isRecommended,
  t,
}) => {
  const handleDownload = () => {
    // In a real implementation, this would trigger the download
    window.location.href = option.downloadUrl;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300
          ${
            isRecommended
              ? 'bg-white/[0.06] border-2 border-saffron/50 shadow-warm-glow hover:shadow-[0_0_30px_rgba(242,140,56,0.4)]'
              : 'bg-white/[0.03] border border-white/[0.08] shadow-warm-glass hover:bg-white/[0.05] hover:border-white/[0.12]'
          }
          hover:-translate-y-1 cursor-pointer
        `}
        onClick={handleDownload}
      >
        {/* Subtle warm glow at top */}
        <div
          className={`absolute top-0 left-0 w-full h-1/3 pointer-events-none ${
            isRecommended
              ? 'bg-gradient-to-b from-saffron/10 to-transparent'
              : 'bg-gradient-to-b from-saffron/5 to-transparent'
          }`}
        />

        {/* Recommended badge */}
        {isRecommended && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="absolute top-4 right-4 z-10"
          >
            <div className="bg-gradient-warm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
              <Check size={14} />
              <span>{String(t('downloads.recommended'))}</span>
            </div>
          </motion.div>
        )}

        {/* Card content */}
        <div className="relative p-8 flex flex-col items-center text-center">
          {/* OS Icon */}
          <motion.div
            className={`mb-6 ${isRecommended ? 'text-saffron' : 'text-warm-white/80'}`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <div className="w-20 h-20 flex items-center justify-center">
              {option.icon}
            </div>
          </motion.div>

          {/* OS Name */}
          <h3 className="text-2xl font-display font-semibold text-warm-white mb-2">
            {option.name}
          </h3>

          {/* Version */}
          <p className="text-sm text-gray-400 mb-1">
            {String(t('downloads.version', { version: option.version }))}
          </p>

          {/* File Size */}
          <p className="text-sm text-gray-400 mb-6">
            {option.fileSize}
          </p>

          {/* System Requirements */}
          <div className="w-full mb-6">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">
              {String(t('downloads.requirements'))}
            </p>
            <p className="text-sm text-gray-400">{option.requirements}</p>
          </div>

          {/* Download Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            className={`
              w-full py-3.5 px-6 rounded-xl font-medium text-white
              flex items-center justify-center gap-2
              transition-all duration-300
              ${
                isRecommended
                  ? 'bg-gradient-warm shadow-warm-glow hover:shadow-[0_4px_20px_rgba(242,140,56,0.5)]'
                  : 'bg-white/10 hover:bg-white/15 border border-white/10'
              }
            `}
          >
            <Download size={18} />
            <span>{String(t('downloads.downloadFor', { os: option.name }))}</span>
          </motion.button>
        </div>
      </div>

      {/* Pulse effect for recommended card */}
      {isRecommended && (
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-saffron/50 pointer-events-none"
          animate={{
            opacity: [0.5, 0, 0.5],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
};
