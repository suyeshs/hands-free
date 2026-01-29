/**
 * Plugin Store Component
 * Browse and install plugins from the registry
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
  TrendingUp,
  Shield,
} from 'lucide-react';
import { usePluginManager } from '@/hooks/usePluginManager';
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
    searchPlugins,
    installPlugin,
    checkConflicts,
  } = usePluginManager();

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

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      plugins = plugins.filter((p) => p.category === selectedCategory);
    }

    // Apply verified filter
    if (showVerifiedOnly) {
      plugins = plugins.filter((p) => p.verified);
    }

    // Apply rating filter
    if (minRating > 0) {
      plugins = plugins.filter((p) => p.rating >= minRating);
    }

    // Sort
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
    // Check for conflicts first
    const conflicts = await checkConflicts(plugin.id);
    if (conflicts.length > 0) {
      // Show conflict dialog
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Plugin Store</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Browse and install plugins to extend your POS system
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Search
        </button>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      selectedCategory === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                    )}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1',
                        selectedCategory === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                      )}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Other Filters */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={showVerifiedOnly}
                      onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Shield className="w-4 h-4 text-blue-600" />
                    Verified Only
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Rating
                  </label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="0">Any</option>
                    <option value="3">3+ Stars</option>
                    <option value="4">4+ Stars</option>
                    <option value="4.5">4.5+ Stars</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="rating">Rating</option>
                    <option value="downloads">Downloads</option>
                    <option value="updated">Recently Updated</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Plugin Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No plugins found</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
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
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedPlugin(plugin)}
            >
              {/* Plugin Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-2xl">
                    {plugin.icon || '🔌'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      {plugin.name}
                      {plugin.verified && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                      {plugin.featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{plugin.author}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {plugin.description}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span>{plugin.rating.toFixed(1)}</span>
                  <span>({plugin.reviews_count})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  <span>{(plugin.download_count / 1000).toFixed(1)}k</span>
                </div>
                {plugin.install_count && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{plugin.install_count}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {plugin.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {plugin.tags.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                    +{plugin.tags.length - 3}
                  </span>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInstall(plugin);
                }}
                disabled={isInstalled(plugin.id) || installing === plugin.id}
                className={cn(
                  'w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                  isInstalled(plugin.id)
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-not-allowed'
                    : installing === plugin.id
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {isInstalled(plugin.id) ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Installed
                  </>
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
