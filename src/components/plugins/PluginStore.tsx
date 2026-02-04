/**
 * Plugin Store Component - Glassmorphic Edition
 * Browse and install plugins with warm, modern design
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Star,
  CheckCircle2,
  Package,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { usePluginManager } from '@/hooks/usePluginManager';
import { usePluginUpdates } from '@/hooks/usePluginUpdates';
import type { PluginMetadata, PluginCategory, PluginSearchFilters } from '@/types/plugin';
import { cn } from '@/lib/utils';
import { PluginDetailModal } from './PluginDetailModal';

const CATEGORIES: { id: PluginCategory; label: string; icon: string }[] = [
  { id: 'Analytics', label: 'Analytics', icon: '📊' },
  { id: 'Integrations', label: 'Integrations', icon: '🔌' },
  { id: 'Operations', label: 'Operations', icon: '⚙️' },
  { id: 'Payments', label: 'Payments', icon: '💳' },
  { id: 'Marketing', label: 'Marketing', icon: '📢' },
  { id: 'Inventory', label: 'Inventory', icon: '📦' },
  { id: 'Staff', label: 'Staff', icon: '👥' },
  { id: 'Reporting', label: 'Reporting', icon: '📈' },
  { id: 'Other', label: 'Other', icon: '🔧' },
];

export function PluginStore() {
  const {
    availablePlugins,
    installedPlugins,
    loading,
    error,
    initialized,
    searchPlugins,
    installPlugin,
    checkConflicts,
  } = usePluginManager();

  const {
    updates,
    updating,
    update,
    check,
  } = usePluginUpdates();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | 'all'>('all');
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<'rating' | 'downloads' | 'updated' | 'name'>('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginMetadata | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  // Filter and sort plugins
  const filteredPlugins = useMemo(() => {
    let plugins = [...availablePlugins];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== 'all') {
      plugins = plugins.filter((p) => p.category === selectedCategory);
    }

    if (showVerifiedOnly) {
      plugins = plugins.filter((p) => p.verified);
    }

    if (minRating > 0) {
      plugins = plugins.filter((p) => p.rating >= minRating);
    }

    plugins.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'downloads':
          return b.download_count - a.download_count;
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return plugins;
  }, [availablePlugins, searchQuery, selectedCategory, showVerifiedOnly, minRating, sortBy]);

  const handleSearch = async () => {
    const filters: PluginSearchFilters = {
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      verified: showVerifiedOnly || undefined,
      minRating: minRating > 0 ? minRating : undefined,
      sortBy,
      sortOrder: 'desc',
    };

    await searchPlugins(searchQuery, filters);
  };

  const handleInstall = async (plugin: PluginMetadata) => {
    const conflicts = await checkConflicts(plugin.id);
    if (conflicts.length > 0) {
      alert(`Dependency conflicts detected:\n${conflicts.map((c) => c.plugin_id).join(', ')}`);
      return;
    }

    setInstalling(plugin.id);
    const result = await installPlugin(plugin.id);
    setInstalling(null);

    if (result.success) {
      alert(`${plugin.name} installed successfully!`);
    } else {
      alert(`Failed to install ${plugin.name}: ${result.error}`);
    }
  };

  const isInstalled = (pluginId: string) => {
    return installedPlugins.some((p) => p.manifest.id === pluginId);
  };

  const hasUpdate = (pluginId: string) => {
    return updates.some((u) => u.id === pluginId);
  };

  const getUpdateInfo = (pluginId: string) => {
    return updates.find((u) => u.id === pluginId);
  };

  const handleUpdate = async (pluginId: string) => {
    try {
      await update(pluginId);
      alert('Plugin updated successfully!');
      // Refresh the check after update
      await check();
    } catch (error) {
      alert(`Failed to update plugin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-full bg-[#1a1612] p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#e8d4b8]">Plugin Store</h2>
            <p className="text-sm text-[#e8d4b8]/60 mt-1">
              Browse and install plugins to extend your POS system
            </p>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2',
              showFilters
                ? 'bg-[#d97542] text-white shadow-lg shadow-[#d97542]/20'
                : 'bg-[#e8d4b8]/5 text-[#e8d4b8]/80 hover:bg-[#e8d4b8]/10'
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden md:inline">Filters</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#e8d4b8]/40" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-12 pr-4 py-3 bg-[#e8d4b8]/5 border border-[#e8d4b8]/10 rounded-2xl text-[#e8d4b8] placeholder:text-[#e8d4b8]/40 focus:outline-none focus:border-[#d97542]/50 focus:ring-2 focus:ring-[#d97542]/20 transition-all"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="mb-6">
        <div className="overflow-x-auto hide-scrollbar">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                selectedCategory === 'all'
                  ? 'bg-[#d97542] text-white shadow-lg shadow-[#d97542]/20'
                  : 'bg-[#e8d4b8]/5 text-[#e8d4b8]/80 hover:bg-[#e8d4b8]/10'
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                  selectedCategory === cat.id
                    ? 'bg-[#d97542] text-white shadow-lg shadow-[#d97542]/20'
                    : 'bg-[#e8d4b8]/5 text-[#e8d4b8]/80 hover:bg-[#e8d4b8]/10'
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-[#e8d4b8]/5 backdrop-blur-xl border border-[#e8d4b8]/10 rounded-2xl p-4 space-y-4">
              {/* Verified Only */}
              <label className="flex items-center gap-2 text-sm text-[#e8d4b8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVerifiedOnly}
                  onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-[#e8d4b8]/20 bg-[#e8d4b8]/5 checked:bg-[#d97542] checked:border-[#d97542] focus:ring-2 focus:ring-[#d97542]/20"
                />
                <Shield className="w-4 h-4 text-[#d97542]" />
                <span>Verified plugins only</span>
              </label>

              {/* Min Rating & Sort By */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#e8d4b8]/80 mb-2">
                    Minimum Rating
                  </label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#e8d4b8]/5 border border-[#e8d4b8]/10 rounded-xl text-[#e8d4b8] text-sm focus:outline-none focus:border-[#d97542]/50 focus:ring-2 focus:ring-[#d97542]/20"
                  >
                    <option value="0">Any rating</option>
                    <option value="3">3+ Stars</option>
                    <option value="4">4+ Stars</option>
                    <option value="4.5">4.5+ Stars</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#e8d4b8]/80 mb-2">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#e8d4b8]/5 border border-[#e8d4b8]/10 rounded-xl text-[#e8d4b8] text-sm focus:outline-none focus:border-[#d97542]/50 focus:ring-2 focus:ring-[#d97542]/20"
                  >
                    <option value="rating">Highest Rated</option>
                    <option value="downloads">Most Downloaded</option>
                    <option value="updated">Recently Updated</option>
                    <option value="name">Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-[#d97542]/10 border border-[#d97542]/30 rounded-2xl p-4">
          <p className="text-sm text-[#d97542]">{error}</p>
        </div>
      )}

      {/* Plugin Grid */}
      {!initialized || (loading && availablePlugins.length === 0) ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d97542] mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-[#e8d4b8] mb-2">
            {!initialized ? 'Initializing Plugin Manager...' : 'Loading Plugins...'}
          </h3>
          <p className="text-sm text-[#e8d4b8]/60">
            {!initialized ? 'Setting up plugin system' : 'Fetching available plugins from the registry'}
          </p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#e8d4b8]/5 rounded-2xl p-6 animate-pulse">
              <div className="w-12 h-12 bg-[#e8d4b8]/10 rounded-xl mb-4" />
              <div className="h-5 bg-[#e8d4b8]/10 rounded mb-2" />
              <div className="h-4 bg-[#e8d4b8]/10 rounded mb-4" />
              <div className="h-9 bg-[#e8d4b8]/10 rounded" />
            </div>
          ))}
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-[#e8d4b8]/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#e8d4b8] mb-2">No plugins found</h3>
          <p className="text-sm text-[#e8d4b8]/60">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <motion.div
              key={plugin.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-gradient-to-br from-[#e8d4b8]/5 to-[#e8d4b8]/[0.02] backdrop-blur-xl border border-[#e8d4b8]/10 rounded-2xl p-6 cursor-pointer hover:border-[#d97542]/30 transition-all hover:shadow-lg hover:shadow-[#d97542]/10"
              onClick={() => setSelectedPlugin(plugin)}
            >
              {/* Plugin Icon & Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#d97542] to-[#c85a2a] rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    {plugin.icon || '🔌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#e8d4b8] flex items-center gap-2 text-sm">
                      <span className="truncate">{plugin.name}</span>
                      {plugin.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#d97542] flex-shrink-0" />}
                      {plugin.featured && <Star className="w-3.5 h-3.5 text-[#e8a354] fill-[#e8a354] flex-shrink-0" />}
                    </h3>
                    <p className="text-xs text-[#e8d4b8]/50 truncate">{plugin.author}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-[#e8d4b8]/60 mb-4 line-clamp-2 min-h-[40px]">
                {plugin.description}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-3 mb-4 text-xs text-[#e8d4b8]/50">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-[#e8a354] fill-[#e8a354]" />
                  <span className="text-[#e8d4b8]/70">{plugin.rating.toFixed(1)}</span>
                  <span>({plugin.reviews_count})</span>
                </div>
                <div className="w-px h-3 bg-[#e8d4b8]/10" />
                <div className="flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  <span>{(plugin.download_count / 1000).toFixed(1)}k</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4 min-h-[24px]">
                {plugin.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-[#e8d4b8]/5 text-xs text-[#e8d4b8]/70 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {plugin.tags.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-[#e8d4b8]/50">
                    +{plugin.tags.length - 3}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasUpdate(plugin.id)) {
                    handleUpdate(plugin.id);
                  } else {
                    handleInstall(plugin);
                  }
                }}
                disabled={
                  (!hasUpdate(plugin.id) && isInstalled(plugin.id)) ||
                  installing === plugin.id ||
                  updating === plugin.id ||
                  !initialized
                }
                className={cn(
                  'w-full py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm',
                  hasUpdate(plugin.id)
                    ? 'bg-gradient-to-r from-[#d97542] to-[#c85a2a] text-white hover:shadow-lg hover:shadow-[#d97542]/30 hover:scale-[1.02]'
                    : isInstalled(plugin.id)
                    ? 'bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/30 cursor-not-allowed'
                    : installing === plugin.id || updating === plugin.id || !initialized
                    ? 'bg-[#e8d4b8]/5 text-[#e8d4b8]/40 cursor-wait'
                    : 'bg-gradient-to-r from-[#d97542] to-[#c85a2a] text-white hover:shadow-lg hover:shadow-[#d97542]/30 hover:scale-[1.02]'
                )}
              >
                {hasUpdate(plugin.id) ? (
                  updating === plugin.id ? (
                    <>Updating...</>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Update to {getUpdateInfo(plugin.id)?.latestVersion}
                    </>
                  )
                ) : isInstalled(plugin.id) ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Installed
                  </>
                ) : !initialized ? (
                  <>Initializing...</>
                ) : installing === plugin.id ? (
                  <>Installing...</>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Install
                  </>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Plugin Detail Modal */}
      {selectedPlugin && (
        <PluginDetailModal
          plugin={selectedPlugin}
          isInstalled={isInstalled(selectedPlugin.id)}
          onClose={() => setSelectedPlugin(null)}
          onInstall={() => handleInstall(selectedPlugin)}
        />
      )}
    </div>
  );
}
