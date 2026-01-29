/**
 * Contextual Setup Guide
 * Dynamic, intelligent onboarding that focuses on the most important next step
 * Highlights menu upload as the most magical experience
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  // Upload,
  // Image,
  MapPin,
  Users,
  ShoppingCart,
  CheckCircle2,
  Sparkles,
  FileText,
  Camera,
} from 'lucide-react';
import { getTenantMetadata, type TenantMetadata, calculateSetupCompletion, getNextAction } from '../../services/tenantProvisioning';

export function ContextualSetupGuide() {
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState<TenantMetadata | null>(null);
  const [completion, setCompletion] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    const data = await getTenantMetadata();
    if (data) {
      setMetadata(data);
      setCompletion(calculateSetupCompletion(data));
    }
  };

  if (!metadata || completion === 100) {
    return null; // Setup complete, hide guide
  }

  if (!isVisible) {
    // Show minimized button
    return (
      <motion.button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-2xl hover:scale-110 transition-transform"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>
    );
  }

  const nextAction = getNextAction(metadata);

  if (!nextAction) return null;

  const { setupProgress } = metadata;

  return (
    <motion.div
      className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-purple-500/10 border-2 border-orange-500/20 backdrop-blur-sm"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: 'spring' }}
    >
      {/* Animated background sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-orange-400/30 rounded-full"
            animate={{
              x: [0, 100, 0],
              y: [0, 50, 0],
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + i * 10}%`,
            }}
          />
        ))}
      </div>

      <div className="relative p-6">
        {/* Header with close button */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Get Started with HandsFree</h3>
              <p className="text-sm text-gray-300">{completion}% Complete</p>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${completion}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Next Action - Large prominent card */}
        {nextAction && (
          <motion.div
            className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-2xl cursor-pointer group hover:scale-[1.02] transition-transform"
            onClick={() => navigate(nextAction.route)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                {nextAction.action === 'upload_menu' && <FileText className="w-8 h-8 text-white" />}
                {nextAction.action === 'upload_photos' && <Camera className="w-8 h-8 text-white" />}
                {nextAction.action === 'complete_details' && <MapPin className="w-8 h-8 text-white" />}
                {nextAction.action === 'add_staff' && <Users className="w-8 h-8 text-white" />}
                {nextAction.action === 'test_order' && <ShoppingCart className="w-8 h-8 text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-2xl font-bold text-white">{nextAction.title}</h4>
                  {nextAction.priority === 'high' && (
                    <span className="px-2 py-1 rounded-full bg-white/30 text-white text-xs font-bold">
                      MOST IMPORTANT
                    </span>
                  )}
                </div>
                <p className="text-white/90 text-base leading-relaxed">
                  {nextAction.description}
                </p>
                <div className="mt-4 flex items-center gap-2 text-white/80 font-semibold group-hover:translate-x-2 transition-transform">
                  <span>Let's do this</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Setup checklist - Compact view */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SetupStep
            icon={FileText}
            label="Menu Upload"
            completed={setupProgress.menuUploaded}
            route="/menu"
          />
          <SetupStep
            icon={Camera}
            label="Photos"
            completed={setupProgress.photosUploaded}
            route="/images"
          />
          <SetupStep
            icon={MapPin}
            label="Details"
            completed={setupProgress.detailsCompleted}
            route="/settings"
          />
          <SetupStep
            icon={Users}
            label="Staff"
            completed={setupProgress.staffAdded}
            route="/staff"
          />
          <SetupStep
            icon={ShoppingCart}
            label="Test Order"
            completed={setupProgress.testOrderCompleted}
            route="/pos"
          />
        </div>

        {/* Pro tip for menu upload */}
        {!setupProgress.menuUploaded && (
          <motion.div
            className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-gray-300">
              <span className="font-bold text-orange-400">💡 Pro Tip:</span> Upload your menu as a PDF, Excel file, or even photos!
              Our AI will extract everything automatically - items, prices, descriptions, categories. It's like magic ✨
            </p>
          </motion.div>
        )}

        {/* Pro tip for photos */}
        {setupProgress.menuUploaded && !setupProgress.photosUploaded && (
          <motion.div
            className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-gray-300">
              <span className="font-bold text-pink-400">📸 Pro Tip:</span> Bulk upload all your food photos at once!
              Our AI will automatically match them to menu items based on names. Upload JPEGs, PDFs with photos, or even screenshots.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

interface SetupStepProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  completed: boolean;
  route: string;
}

function SetupStep({ icon: Icon, label, completed, route }: SetupStepProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => !completed && navigate(route)}
      className={`p-3 rounded-xl border-2 transition-all ${
        completed
          ? 'bg-green-500/20 border-green-500/40 cursor-default'
          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-orange-500/40'
      }`}
      disabled={completed}
    >
      <div className="flex flex-col items-center gap-2">
        {completed ? (
          <CheckCircle2 className="w-6 h-6 text-green-400" />
        ) : (
          <Icon className="w-6 h-6 text-gray-400" />
        )}
        <span className={`text-xs font-semibold ${completed ? 'text-green-300' : 'text-gray-300'}`}>
          {label}
        </span>
      </div>
    </button>
  );
}
