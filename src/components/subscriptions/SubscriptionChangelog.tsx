/**
 * Subscription Plugin Changelog Component
 * Displays version history and update information to users
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wrench,
  AlertCircle,
  BookOpen,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChangelogEntry {
  type: 'feature' | 'improvement' | 'bugfix' | 'documentation' | 'breaking';
  title: string;
  description: string;
}

interface VersionChangelog {
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: ChangelogEntry[];
  breaking_changes?: string[];
  migration_notes?: string;
}

interface PluginChangelog {
  [version: string]: VersionChangelog;
}

// This would normally be fetched from the plugin manifest
const PLUGIN_CHANGELOG: PluginChangelog = {
  '1.1.0': {
    date: '2026-02-09',
    type: 'minor',
    changes: [
      {
        type: 'feature',
        title: 'Theme Integration Complete',
        description:
          'Integrated coorg-subscription theme with voice features disabled for optimal subscription management experience',
      },
      {
        type: 'feature',
        title: 'Menu Import System',
        description:
          'Added one-click import for 150+ menu items including 5 cuisine types, 3 subscription plans, and complete menu categories',
      },
      {
        type: 'feature',
        title: 'Core Menu Conflict Resolution',
        description:
          'Automatic detection and hiding of core menu management when subscription plugin is active, preventing conflicts',
      },
      {
        type: 'improvement',
        title: 'Plugin Architecture Refactor',
        description:
          'Refactored to self-contained WASM plugin - no core app modifications required for installation',
      },
      {
        type: 'improvement',
        title: 'Event System',
        description:
          'Added subscription:activated and subscription:deactivated events for seamless core app integration',
      },
      {
        type: 'documentation',
        title: 'Comprehensive Documentation',
        description:
          'Added detailed README with installation guide, usage examples, troubleshooting, and API documentation',
      },
    ],
    breaking_changes: [],
    migration_notes:
      'This is a feature update with no breaking changes. Existing installations will automatically benefit from new features.',
  },
  '1.0.0': {
    date: '2026-02-06',
    type: 'major',
    changes: [
      {
        type: 'feature',
        title: 'Initial Release',
        description:
          'Complete subscription meal service with 8-table database schema, admin dashboard, KDS, and customer portal',
      },
    ],
  },
};

const CURRENT_VERSION = '1.1.0';

export function SubscriptionChangelog() {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set([CURRENT_VERSION])
  );
  const [showBanner, setShowBanner] = useState(true);

  // Check if user has seen this update
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('subscription-plugin-last-seen-version');
    if (lastSeenVersion === CURRENT_VERSION) {
      setShowBanner(false);
    }
  }, []);

  const toggleVersion = (version: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('subscription-plugin-last-seen-version', CURRENT_VERSION);
  };

  const getChangeIcon = (type: ChangelogEntry['type']) => {
    switch (type) {
      case 'feature':
        return <Sparkles className="w-4 h-4 text-primary" />;
      case 'improvement':
        return <Wrench className="w-4 h-4 text-blue-400" />;
      case 'bugfix':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'documentation':
        return <BookOpen className="w-4 h-4 text-cyan-400" />;
      case 'breaking':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Package className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getVersionBadgeColor = (type: VersionChangelog['type']) => {
    switch (type) {
      case 'major':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'minor':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'patch':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Update Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-panel p-6 rounded-xl border-2 border-primary/30"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-2">
                  🎉 Version 1.1.0 - Theme Integration & Import System
                </h3>
                <p className="text-foreground text-sm mb-4">
                  New features: Coorg theme integration, 150+ menu items import, and automatic
                  core menu conflict resolution. Explore what's new below!
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={dismissBanner}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Got it, thanks!
                  </button>
                  <button
                    onClick={dismissBanner}
                    className="px-4 py-2 glass-panel text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              <button
                onClick={dismissBanner}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">📦 What's New</h1>
        <p className="text-muted-foreground">
          See the latest updates and improvements to the Subscription Meals plugin
        </p>
      </div>

      {/* Version List */}
      <div className="space-y-4">
        {Object.entries(PLUGIN_CHANGELOG)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([version, changelog]) => {
            const isExpanded = expandedVersions.has(version);
            const isLatest = version === CURRENT_VERSION;

            return (
              <motion.div
                key={version}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'glass-panel rounded-xl overflow-hidden',
                  isLatest && 'border-2 border-primary/30'
                )}
              >
                {/* Version Header */}
                <button
                  onClick={() => toggleVersion(version)}
                  className="w-full p-6 flex items-center justify-between hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-bold border',
                        getVersionBadgeColor(changelog.type)
                      )}
                    >
                      v{version}
                    </div>

                    {isLatest && (
                      <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded">
                        LATEST
                      </span>
                    )}

                    <span className="text-sm text-muted-foreground">{changelog.date}</span>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                {/* Version Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border"
                    >
                      <div className="p-6 space-y-4">
                        {/* Changes */}
                        {changelog.changes.map((change, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 glass-panel p-4 rounded-lg"
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {getChangeIcon(change.type)}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-foreground mb-1">
                                {change.title}
                              </h4>
                              <p className="text-sm text-muted-foreground">{change.description}</p>
                            </div>
                          </div>
                        ))}

                        {/* Breaking Changes */}
                        {changelog.breaking_changes && changelog.breaking_changes.length > 0 && (
                          <div className="glass-panel p-4 rounded-lg border border-red-500/30">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-red-400 mb-2">
                                  Breaking Changes
                                </h4>
                                <ul className="space-y-1">
                                  {changelog.breaking_changes.map((change, index) => (
                                    <li key={index} className="text-sm text-foreground">
                                      • {change}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Migration Notes */}
                        {changelog.migration_notes && (
                          <div className="glass-panel p-4 rounded-lg border border-blue-500/30">
                            <div className="flex items-start gap-3">
                              <BookOpen className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-semibold text-blue-400 mb-2">
                                  Migration Notes
                                </h4>
                                <p className="text-sm text-foreground">
                                  {changelog.migration_notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="glass-panel p-6 rounded-xl text-center">
        <p className="text-sm text-muted-foreground">
          For detailed documentation, visit the{' '}
          <a
            href="https://plugins.handsfree.com/subscription-meals"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary underline"
          >
            plugin homepage
          </a>
        </p>
      </div>
    </div>
  );
}
