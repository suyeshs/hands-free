/**
 * Menu Upload Session Component
 * Handles multi-page menu uploads with staging and review before commit
 */

import { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Check,
  X,

  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  startUploadSession,
  getUploadSession,
  getSessionPages,
  getSessionItems,
  addUploadPage,
  addStagingItems,
  updatePageStatus,
  commitUploadSession,
  cancelUploadSession,
  deleteSessionPage,
  type UploadSession,
  type UploadPage,
  type StagingItem,
} from '../../lib/database';
import { backendApi } from '../../lib/backendApi';

interface MenuUploadSessionProps {
  menuType: 'food' | 'bar';
  onComplete: () => void;
  onCancel: () => void;
}

export function MenuUploadSession({ menuType, onComplete, onCancel }: MenuUploadSessionProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<UploadSession | null>(null);
  const [pages, setPages] = useState<UploadPage[]>([]);
  const [items, setItems] = useState<StagingItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Initialize session
  useEffect(() => {
    initSession();
  }, [menuType]);

  const initSession = async () => {
    try {
      const id = await startUploadSession(menuType);
      setSessionId(id);
      loadSession(id);
    } catch (error) {
      console.error('[MenuUploadSession] Failed to start session:', error);
      alert('Failed to start upload session');
    }
  };

  const loadSession = async (id: string) => {
    try {
      const sess = await getUploadSession(id);
      const pgs = await getSessionPages(id);
      const itms = await getSessionItems(id);

      setSession(sess);
      setPages(pgs);
      setItems(itms);
    } catch (error) {
      console.error('[MenuUploadSession] Failed to load session:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!sessionId) return;

    setUploading(true);
    try {
      const pageNumber = pages.length + 1;
      const pageId = await addUploadPage(sessionId, pageNumber, file.name);

      // Upload to R2 and parse with AI
      const tenantId = 'airarang-8131'; // TODO: Get from auth store
      const uploadResult = await backendApi.uploadToR2Only(tenantId, file, () => {});

      await updatePageStatus(pageId, 'uploading');

      const parseResult = await backendApi.parseFromR2(
        tenantId,
        uploadResult.r2Key!,
        file.name,
        file.type
      );

      // Add items to staging
      const stagingItems = parseResult.items.map((item: any) => ({
        name: item.name,
        category: item.category,
        description: item.description,
        price: item.price,
        image: item.imageUrl,
        preparationTime: parseInt(item.preparationTime) || 15,
        allergens: item.allergens || [],
        dietaryTags: item.dietaryTags || [],
      }));

      const count = await addStagingItems(sessionId, pageNumber, stagingItems);
      await updatePageStatus(pageId, 'parsed', count);

      // Reload session
      await loadSession(sessionId);
    } catch (error) {
      console.error('[MenuUploadSession] Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Delete this page? All items from this page will be removed.')) return;

    try {
      await deleteSessionPage(pageId);
      if (sessionId) await loadSession(sessionId);
    } catch (error) {
      console.error('[MenuUploadSession] Failed to delete page:', error);
      alert('Failed to delete page');
    }
  };

  const handleCommit = async () => {
    if (!sessionId) return;
    if (pages.length === 0) {
      alert('Please upload at least one page before committing');
      return;
    }

    setCommitting(true);
    try {
      await commitUploadSession(sessionId);
      alert(`Successfully uploaded ${session?.totalItems} items!`);
      onComplete();
    } catch (error) {
      console.error('[MenuUploadSession] Commit failed:', error);
      alert(`Commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this upload session? All progress will be lost.')) return;

    if (sessionId) {
      await cancelUploadSession(sessionId);
    }
    onCancel();
  };

  // Group items by category for review
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StagingItem[]>);

  if (showReview) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        {/* Review Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Review {menuType === 'food' ? 'Food' : 'Bar'} Menu</h2>
            <p className="text-muted-foreground">
              {session?.totalItems} items from {pages.length} pages
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowReview(false)}
              className="px-4 py-2 border rounded-lg hover:bg-surface-2"
            >
              <X className="w-4 h-4 mr-2 inline" />
              Back to Upload
            </button>
            <button
              onClick={handleCommit}
              disabled={committing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {committing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block" />
                  Committing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2 inline" />
                  Commit {session?.totalItems} Items
                </>
              )}
            </button>
          </div>
        </div>

        {/* Items by Category */}
        <div className="space-y-6">
          {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
            <div key={category} className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">
                {category} ({categoryItems.length} items)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded p-3 hover:bg-surface-2"
                  >
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ${item.price.toFixed(2)}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Page {item.pageNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Upload {menuType === 'food' ? 'Food' : 'Bar'} Menu
          </h2>
          <p className="text-muted-foreground">
            Upload multiple pages, then review and commit all at once
          </p>
        </div>
        <button
          onClick={handleCancel}
          className="px-4 py-2 border rounded-lg hover:bg-surface-2"
        >
          <X className="w-4 h-4 mr-2 inline" />
          Cancel
        </button>
      </div>

      {/* Session Summary */}
      {session && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-bold text-blue-600">{session.totalPages}</div>
            <div>
              <div className="font-semibold">Pages Uploaded</div>
              <div className="text-sm text-muted-foreground">
                {session.totalItems} total items
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div className="mb-6">
        <label className="block">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              uploading
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
            )}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              {uploading ? 'Uploading...' : 'Drop file or click to upload'}
            </p>
            <p className="text-sm text-muted-foreground">
              Supports Excel, PDF, or images
            </p>
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              disabled={uploading}
            />
          </div>
        </label>
      </div>

      {/* Pages List */}
      {pages.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Uploaded Pages</h3>
          <div className="space-y-2">
            {pages.map((page) => (
              <div
                key={page.id}
                className="flex items-center gap-4 p-3 border rounded-lg hover:bg-surface-2"
              >
                <FileText className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <div className="font-medium">Page {page.pageNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {page.fileName} • {page.itemCount} items
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {page.status === 'parsed' && (
                    <span className="text-green-600 text-sm">✓ Parsed</span>
                  )}
                  {page.status === 'error' && (
                    <span className="text-red-600 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Error
                    </span>
                  )}
                  <button
                    onClick={() => handleDeletePage(page.id)}
                    className="p-2 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {pages.length > 0 && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowReview(true)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Eye className="w-4 h-4 mr-2 inline" />
            Review All {session?.totalItems} Items
          </button>
        </div>
      )}
    </div>
  );
}
