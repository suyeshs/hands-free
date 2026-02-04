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
import { cn, formatCurrency } from '../../lib/utils';
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
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'parsing' | null>(null);
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
    setUploadStatus('uploading');

    try {
      const pageNumber = pages.length + 1;
      const pageId = await addUploadPage(sessionId, pageNumber, file.name);

      // Step 1: Upload to R2
      console.log('[MenuUploadSession] Starting R2 upload...');
      const tenantId = 'airarang-8131'; // TODO: Get from auth store
      const uploadResult = await backendApi.uploadToR2Only(tenantId, file, () => {});
      console.log('[MenuUploadSession] R2 upload complete');

      await updatePageStatus(pageId, 'uploading');

      // Step 2: Parse with AI
      console.log('[MenuUploadSession] Starting AI parsing...');
      setUploadStatus('parsing');

      const parseResult = await backendApi.parseFromR2(
        tenantId,
        uploadResult.r2Key!,
        file.name,
        file.type
      );
      console.log('[MenuUploadSession] AI parsing complete');

      // Step 3: Add items to staging
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
      setUploadStatus(null);
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
                      {formatCurrency(item.price)}
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

      {/* Parsing Status Banner */}
      {uploading && uploadStatus === 'parsing' && (
        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg animate-pulse">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-purple-700 dark:text-purple-300">
                AI Analysis in Progress
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">
                Our AI is reading your menu and extracting items. This usually takes 30-60 seconds.
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
              'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300',
              uploading
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-not-allowed'
                : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
            )}
          >
            {uploading ? (
              <>
                {uploadStatus === 'uploading' && (
                  <>
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-lg font-medium mb-2 text-blue-600">
                      Uploading to cloud...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Transferring your file securely
                    </p>
                  </>
                )}
                {uploadStatus === 'parsing' && (
                  <>
                    <div className="relative w-12 h-12 mx-auto mb-4">
                      <div className="absolute inset-0 border-4 border-purple-200 rounded-full" />
                      <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-lg font-medium mb-2 text-purple-600 animate-pulse">
                      AI is analyzing your menu...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This may take upto 3 minutes for large menus
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">
                  Drop file or click to upload
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports Excel, PDF, or images
                </p>
              </>
            )}
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
                className={cn(
                  'flex items-center gap-4 p-3 border rounded-lg transition-all duration-300',
                  page.status === 'parsed' && 'bg-green-50 dark:bg-green-900/20 border-green-200',
                  page.status === 'uploading' && 'bg-blue-50 dark:bg-blue-900/20 border-blue-200',
                  page.status === 'error' && 'bg-red-50 dark:bg-red-900/20 border-red-200',
                  !page.status && 'hover:bg-surface-2'
                )}
              >
                <FileText className={cn(
                  'w-5 h-5',
                  page.status === 'parsed' && 'text-green-500',
                  page.status === 'uploading' && 'text-blue-500 animate-pulse',
                  page.status === 'error' && 'text-red-500',
                  !page.status && 'text-blue-500'
                )} />
                <div className="flex-1">
                  <div className="font-medium">Page {page.pageNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {page.fileName} • {page.itemCount} items
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {page.status === 'uploading' && (
                    <span className="text-blue-600 text-sm flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </span>
                  )}
                  {page.status === 'parsed' && (
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Parsed
                    </span>
                  )}
                  {page.status === 'error' && (
                    <span className="text-red-600 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Error
                    </span>
                  )}
                  <button
                    onClick={() => handleDeletePage(page.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors"
                    disabled={page.status === 'uploading'}
                  >
                    <Trash2 className={cn(
                      'w-4 h-4',
                      page.status === 'uploading' ? 'text-gray-300' : 'text-red-500'
                    )} />
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
