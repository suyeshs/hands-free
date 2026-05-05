/**
 * Plugin Detail Modal
 * Detailed view of a plugin with reviews, permissions, and installation
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Star,
  CheckCircle2,
  Shield,
  Users,
  ExternalLink,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { usePluginManager } from '@/hooks/usePluginManager';
import type { PluginMetadata, PluginReview, DependencyConflict } from '@/types/plugin';
import { cn } from '@/lib/utils';

interface Props {
  plugin: PluginMetadata;
  isInstalled: boolean;
  onClose: () => void;
  onInstall: () => void;
}

export function PluginDetailModal({ plugin, isInstalled, onClose, onInstall }: Props) {
  const { getReviews, submitReview, checkConflicts } = usePluginManager();

  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'permissions' | 'changelog'>(
    'overview'
  );
  const [reviews, setReviews] = useState<PluginReview[]>([]);
  const [conflicts, setConflicts] = useState<DependencyConflict[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    // Load reviews
    getReviews(plugin.id, 10).then(setReviews);

    // Check for conflicts
    checkConflicts(plugin.id).then(setConflicts);
  }, [plugin.id, getReviews, checkConflicts]);

  const handleSubmitReview = async () => {
    if (!reviewComment.trim()) {
      alert('Please add a comment');
      return;
    }

    setSubmittingReview(true);
    const result = await submitReview(plugin.id, reviewRating, reviewComment);
    setSubmittingReview(false);

    if (result.success) {
      alert('Review submitted successfully!');
      setShowReviewForm(false);
      setReviewComment('');
      setReviewRating(5);

      // Refresh reviews
      const updatedReviews = await getReviews(plugin.id, 10);
      setReviews(updatedReviews);
    } else {
      alert(`Failed to submit review: ${result.error}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-3xl">
                  {plugin.icon || '🔌'}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {plugin.name}
                    {plugin.verified && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" aria-label="Verified by Guanix" />
                    )}
                    {plugin.featured && (
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" aria-label="Featured" />
                    )}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    by {plugin.author} • v{plugin.version}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium">{(plugin.rating ?? 0).toFixed(1)}</span>
                      <span>({plugin.reviews_count ?? 0} reviews)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      <span>{((plugin.download_count ?? 0) / 1000).toFixed(1)}k downloads</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{plugin.active_installations} active</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Conflicts Warning */}
            {conflicts.length > 0 && (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      Dependency Conflicts Detected
                    </h4>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      This plugin has conflicts with: {conflicts.map((c) => c.plugin_id).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6">
            <div className="flex gap-6">
              {(['overview', 'reviews', 'permissions', 'changelog'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'py-3 px-1 border-b-2 font-medium text-sm transition-colors capitalize',
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    About
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{plugin.description}</p>
                </div>

                {/* Categories & Tags */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Categories & Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {plugin.category && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                        {plugin.category}
                      </span>
                    )}
                    {plugin.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Compatibility */}
                {plugin.compatibility && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Compatibility
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Min App Version:</span>
                        <span className="font-mono text-gray-900 dark:text-white">
                          {plugin.compatibility.min_app_version}
                        </span>
                      </div>
                      {plugin.compatibility.platforms && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Platforms:</span>
                          <span className="text-gray-900 dark:text-white">
                            {plugin.compatibility.platforms.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <span className="ml-2 text-gray-900 dark:text-white capitalize">{plugin.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {formatDate(plugin.updated_at)}
                    </span>
                  </div>
                  {plugin.homepage && (
                    <div className="col-span-2">
                      <a
                        href={plugin.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Visit Homepage
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {/* Review Form */}
                {isInstalled && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    {!showReviewForm ? (
                      <button
                        onClick={() => setShowReviewForm(true)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                      >
                        Write a review
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 dark:text-white">Write a Review</h4>

                        {/* Rating */}
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setReviewRating(star)}
                              className="p-1"
                            >
                              <Star
                                className={cn(
                                  'w-6 h-6 transition-colors',
                                  star <= reviewRating
                                    ? 'text-yellow-500 fill-yellow-500'
                                    : 'text-gray-300 dark:text-gray-600'
                                )}
                              />
                            </button>
                          ))}
                        </div>

                        {/* Comment */}
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Share your experience with this plugin..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSubmitReview}
                            disabled={submittingReview}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                          </button>
                          <button
                            onClick={() => setShowReviewForm(false)}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reviews List */}
                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No reviews yet. Be the first to review!
                    </div>
                  ) : (
                    reviews.map((review) => (
                      <div
                        key={review.id}
                        className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    'w-4 h-4',
                                    i < review.rating
                                      ? 'text-yellow-500 fill-yellow-500'
                                      : 'text-gray-300 dark:text-gray-600'
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              v{review.plugin_version}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(review.created_at)}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">{review.comment}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'permissions' && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Required Permissions
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        This plugin requires the following permissions to function properly
                      </p>
                    </div>
                  </div>
                </div>

                {plugin.requires_permissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No special permissions required
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plugin.requires_permissions.map((permission) => (
                      <div
                        key={permission}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                      >
                        <Shield className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1">
                          <code className="text-sm font-mono text-gray-900 dark:text-white">
                            {permission}
                          </code>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {getPermissionDescription(permission)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'changelog' && (
              <div className="space-y-4">
                {plugin.changelog ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      {plugin.changelog}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No changelog available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {plugin.theme_aware && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Theme-aware
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Close
              </button>
              {!isInstalled && (
                <button
                  onClick={onInstall}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Install Plugin
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    'database.read.*': 'Read access to all database tables',
    'database.write.*': 'Write access to all database tables',
    'ui.mount.*': 'Ability to add UI components',
    'events.subscribe.*': 'Subscribe to all system events',
    'events.emit.*': 'Emit system events',
    'network.fetch.*': 'Make network requests to any URL',
    'storage.*': 'Store and retrieve plugin data',
  };

  // Check for exact match
  if (descriptions[permission]) {
    return descriptions[permission];
  }

  // Check for pattern matches
  if (permission.startsWith('database.read.')) {
    return `Read access to ${permission.split('.')[2]} table`;
  }
  if (permission.startsWith('database.write.')) {
    return `Write access to ${permission.split('.')[2]} table`;
  }
  if (permission.startsWith('network.fetch.')) {
    return `Fetch data from ${permission.split('.')[2]}`;
  }

  return 'Permission details not available';
}
