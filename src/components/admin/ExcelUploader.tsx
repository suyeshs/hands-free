import { useState, useRef, useEffect } from 'react';
import { Upload, Download, Sparkles, Cloud } from 'lucide-react';
import { Button } from '../ui/button';
import backendApi, { MenuItem } from '../../lib/backendApi';
import { MenuItemReview, ParsedMenuItem, ReviewedMenuItem } from './MenuItemReview';
import { MenuUploadProgress, UploadStage } from './MenuUploadProgress';
import { useAuthStore } from '../../stores/authStore';

type UploadMode = 'smart' | 'template' | 'r2';

interface ExcelUploaderProps {
  tenantId: string;
  onParsed: (items: MenuItem[], confidence?: number) => void;
}

export function ExcelUploader({ tenantId: propTenantId, onParsed }: ExcelUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('r2'); // Use R2 mode (works with new tenant-specific endpoint)
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [effectiveTenantId, setEffectiveTenantId] = useState<string | null>(propTenantId);
  const [detectingTenant, setDetectingTenant] = useState(false);
  const { user } = useAuthStore();

  // Progress tracking
  const [currentStage, setCurrentStage] = useState<UploadStage>('uploading');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [itemsCount, setItemsCount] = useState<number | undefined>();

  // Auto-detect tenant ID if missing
  useEffect(() => {
    const detectTenant = async () => {
      // If we already have a valid tenant ID, use it
      if (propTenantId && propTenantId !== 'demo-restaurant') {
        console.log('[ExcelUploader] Using provided tenant ID:', propTenantId);
        setEffectiveTenantId(propTenantId);
        return;
      }

      // Check if user has a tenant ID
      if (user?.tenantId) {
        console.log('[ExcelUploader] Using user tenant ID:', user.tenantId);
        setEffectiveTenantId(user.tenantId);
        return;
      }

      // Try to auto-detect from database
      console.log('[ExcelUploader] No tenant ID found, attempting auto-detection...');
      setDetectingTenant(true);
      try {
        const { autoDetectAndSetTenant } = await import('../../services/autoDetectTenant');
        const detected = await autoDetectAndSetTenant();
        if (detected) {
          console.log('[ExcelUploader] ✅ Auto-detected tenant:', detected);
          setEffectiveTenantId(detected);
        } else {
          console.error('[ExcelUploader] ❌ Could not detect tenant ID');
          setError('No tenant ID found. Please ensure you are logged in and have restaurant data.');
        }
      } catch (err) {
        console.error('[ExcelUploader] Auto-detection failed:', err);
        setError('Failed to detect tenant ID. Please try logging in again.');
      } finally {
        setDetectingTenant(false);
      }
    };

    detectTenant();
  }, [propTenantId, user]);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate tenant ID before upload
    if (!effectiveTenantId) {
      setError('No tenant ID available. Cannot upload file.');
      console.error('[ExcelUploader] Upload blocked: No tenant ID');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);
      setShowProgressModal(true);
      setCurrentStage('uploading');

      if (uploadMode === 'r2') {
        // NEW: R2-based upload with AI parsing (NO D1 save yet - save to SQLite first)
        console.log('[ExcelUploader] R2 uploading document:', file.name);
        console.log('[ExcelUploader] Using tenant ID:', effectiveTenantId);

        // Step 1: Upload to R2
        const uploadResult = await backendApi.uploadToR2Only(
          effectiveTenantId,
          file,
          (progress) => {
            setUploadProgress(progress.percentage);
          }
        );

        console.log('[ExcelUploader] R2 upload complete:', uploadResult.r2Key);

        // Step 2: Parse with AI (no D1 save)
        setUploadProgress(100);
        setCurrentStage('parsing');

        const parseResult = await backendApi.parseFromR2(
          effectiveTenantId,
          uploadResult.r2Key!,
          file.name,
          file.type
        );

        console.log('AI parsing complete:', {
          itemsParsed: parseResult.items.length,
          summary: parseResult.summary
        });

        setItemsCount(parseResult.items.length);

        // Store parsed items for review
        setParsedItems(parseResult.items);

        // Hide progress modal and show review modal
        setShowProgressModal(false);
        setShowReviewModal(true);

      } else if (uploadMode === 'smart') {
        // LEGACY: Smart upload (old method)
        console.log('[ExcelUploader] Smart uploading document:', file.name);
        const result = await backendApi.uploadSmart(effectiveTenantId, file);
        console.log('[ExcelUploader] Smart parsing complete:', {
          count: result.count,
          confidence: result.confidence
        });
        onParsed(result.items, result.confidence);

      } else {
        // LEGACY: Template-based Excel upload
        console.log('[ExcelUploader] Uploading Excel file:', file.name);
        const result = await backendApi.uploadExcel(effectiveTenantId, file);
        console.log('[ExcelUploader] Excel parsed successfully:', result);
        onParsed(result.items);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setShowProgressModal(false);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await backendApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-template-global.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download error:', err);
      setError('Failed to download template');
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleConfirmItems = async (reviewedItems: ReviewedMenuItem[]) => {
    try {
      setUploading(true);
      setError(null);
      setShowReviewModal(false);
      setShowProgressModal(true);
      setCurrentStage('saving');
      setItemsCount(reviewedItems.length);

      console.log('[ExcelUploader] Saving', reviewedItems.length, 'items to local SQLite');

      // Import database functions
      const { batchSaveMenuItems, saveMenuCategory } = await import('../../lib/database');

      // Step 1: Create categories from reviewed items
      const categoryNames = [...new Set(reviewedItems.map(item => item.category || 'Uncategorized'))];
      const categoryMap: Record<string, string> = {};

      for (const categoryName of categoryNames) {
        const categoryId = await saveMenuCategory({
          name: categoryName,
          description: `${categoryName} items`,
          sort_order: 0,
          active: true,
        });
        categoryMap[categoryName] = categoryId;
      }

      console.log('[ExcelUploader] Created/updated', categoryNames.length, 'categories');

      // Step 2: Save menu items to SQLite with ONLY core fields that exist in schema
      const itemsToSave = reviewedItems.map(item => {
        // Build dietary tags from AI metadata
        const dietaryTags: string[] = item.dietary || [];

        // Add vegetarian/vegan info if available
        if (item.type === 'veg' || item.dietary?.includes('vegetarian')) {
          if (!dietaryTags.includes('vegetarian')) dietaryTags.push('vegetarian');
        }
        if (item.dietary?.includes('vegan')) {
          if (!dietaryTags.includes('vegan')) dietaryTags.push('vegan');
        }

        return {
          name: item.name,
          description: item.description || '',
          price: item.price,
          category_id: categoryMap[item.category || 'Uncategorized'] || 'uncategorized',
          allergens: item.allergens || [],
          dietary_tags: dietaryTags,
          preparation_time: item.preparationTime || 15,
          image: item.imageUrl || undefined,
          active: item.available !== false,
        };
      });

      const savedIds = await batchSaveMenuItems(itemsToSave);
      console.log('[ExcelUploader] Saved', savedIds.length, 'items to SQLite');

      // Step 3: Trigger background sync to D1
      // Background sync is handled by Service Worker (src/services/sync/service-worker.ts)
      // The worker will sync menu items to D1 via /api/menu/:tenantId/sync endpoint
      // D1 then syncs to File Search for voice ordering (handled by Cloudflare Worker)
      console.log('[ExcelUploader] Menu saved locally. Background sync to D1 will happen automatically.');

      // Show syncing stage briefly
      setCurrentStage('syncing');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show completion stage
      setCurrentStage('complete');
      console.log('[ExcelUploader] Menu upload complete!');

      // Wait 2 seconds to show completion, then hide modal and show success message
      setTimeout(() => {
        setShowProgressModal(false);
        setShowReviewModal(false);
        setError(null);
        setSuccessMessage(`Success! ${savedIds.length} menu items saved to your menu. You can now view them in the POS.`);
      }, 2000);

    } catch (err) {
      console.error('[ExcelUploader] Save error:', err);
      setShowProgressModal(false);
      setError(err instanceof Error ? err.message : 'Failed to save items');
      setShowReviewModal(true); // Re-open modal on error
    } finally {
      setUploading(false);
    }
  };

  const handleCancelReview = () => {
    setShowReviewModal(false);
    setParsedItems([]);
  };

  const isAIPowered = uploadMode === 'r2' || uploadMode === 'smart';

  return (
    <>
      {/* Progress Modal */}
      <MenuUploadProgress
        isOpen={showProgressModal}
        currentStage={currentStage}
        uploadProgress={uploadProgress}
        itemsCount={itemsCount}
      />

      {/* Review Modal */}
      {showReviewModal && parsedItems.length > 0 && (
        <MenuItemReview
          items={parsedItems}
          onConfirm={handleConfirmItems}
          onCancel={handleCancelReview}
        />
      )}

      {/* Main Upload UI */}
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Upload Menu Document</h2>
            {isAIPowered && (
              <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                <Sparkles className="w-3 h-3" />
                AI-Powered
              </span>
            )}
            {uploadMode === 'r2' && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                <Cloud className="w-3 h-3" />
                R2 Storage
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {uploadMode === 'r2'
              ? 'Upload menu files to cloud storage with AI processing and automatic database sync. Supports large files and progress tracking.'
              : uploadMode === 'smart'
                ? 'Upload your existing menu in any format - PDF, Excel, Word, or images. Our AI will extract and structure the data automatically.'
                : 'Download the template, fill in your menu items, and upload it here.'}
          </p>
        </div>

        {/* Upload Mode Toggle */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setUploadMode('r2')}
            className={`relative p-5  border-2 transition-all duration-200 text-left ${uploadMode === 'r2'
                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-lg scale-[1.02]'
                : 'border bg-card hover:border-blue-300 hover:shadow-md'
              }`}
          >
            {uploadMode === 'r2' && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Cloud className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">R2 Upload</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Recommended - Aligns with web client. Large file support with progress tracking.</p>
            <span className="inline-block mt-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Recommended</span>
          </button>

          <button
            onClick={() => setUploadMode('smart')}
            className={`relative p-5  border-2 transition-all duration-200 text-left ${uploadMode === 'smart'
                ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg scale-[1.02]'
                : 'border bg-card hover:border-purple-300 hover:shadow-md'
              }`}
          >
            {uploadMode === 'smart' && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">Smart Upload</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Legacy mode - Any format supported with AI parsing.</p>
            <span className="inline-block mt-3 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Legacy</span>
          </button>

          <button
            onClick={() => setUploadMode('template')}
            className={`relative p-5  border-2 transition-all duration-200 text-left ${uploadMode === 'template'
                ? 'border-accent bg-gradient-to-br from-surface-1 to-surface-2 shadow-lg scale-[1.02]'
                : 'border bg-card hover:border hover:shadow-md'
              }`}
          >
            {uploadMode === 'template' && (
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-slate-500 flex items-center justify-center">
                <Download className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">Template</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Use pre-formatted Excel template for structured data entry.</p>
            <span className="inline-block mt-3 px-2 py-1 bg-surface-3 text-foreground text-xs font-medium rounded-full">Classic</span>
          </button>
        </div>

        {/* Download Template Button (only for template mode) */}
        {uploadMode === 'template' && (
          <div className="mb-8 p-6 bg-gradient-to-r from-gray-50 to-slate-50 border-2 border shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-slate-600 flex items-center justify-center flex-shrink-0">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">Excel Template</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Download our pre-formatted template with support for multi-language names, dietary restrictions, allergens, variants, and more.
                </p>
                <Button
                  onClick={handleDownloadTemplate}
                  className="bg-gradient-to-r from-gray-600 to-slate-600 hover:from-gray-700 hover:to-slate-700 text-white shadow-md"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${dragging
              ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 scale-[1.02] shadow-xl'
              : 'border hover:border-orange-400 hover:bg-surface-2 bg-card shadow-lg'
            }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center py-8">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-orange-200 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-xl font-semibold text-foreground mt-6">
                {uploadMode === 'r2' ? 'Uploading to cloud...' : 'Parsing document...'}
              </p>
              {uploadProgress > 0 && uploadMode === 'r2' && (
                <div className="w-full max-w-md mt-6">
                  <div className="flex justify-between text-sm font-medium text-foreground mb-2">
                    <span>Upload Progress</span>
                    <span className="text-orange-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-4">Please wait while we process your menu</p>
            </div>
          ) : detectingTenant ? (
            <div className="flex flex-col items-center py-8">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-xl font-semibold text-foreground mt-6">
                Detecting Restaurant...
              </p>
              <p className="text-sm text-muted-foreground mt-4">Auto-detecting tenant ID from database</p>
            </div>
          ) : !effectiveTenantId ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-foreground mb-2">
                No Restaurant Found
              </p>
              <p className="text-sm text-muted-foreground">
                Please ensure you are logged in and have restaurant data.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-orange-500" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  {isAIPowered
                    ? 'Drag & drop your menu document here'
                    : 'Drag & drop your Excel file here'}
                </h3>
                <p className="text-muted-foreground text-sm font-medium mb-6">or click below to browse</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={isAIPowered
                  ? ".pdf,.xlsx,.xls,.csv,.docx,.jpg,.jpeg,.png,.webp,.heic"
                  : ".xlsx,.xls,.csv"}
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading || detectingTenant || !effectiveTenantId}
              />
              <Button
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg px-8 py-6 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleBrowseClick}
                disabled={detectingTenant || !effectiveTenantId}
              >
                <Upload className="w-5 h-5 mr-2" />
                Browse Files
              </Button>
              <div className="mt-6 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-muted-foreground">
                  {uploadMode === 'r2'
                    ? 'Supports PDF, Excel, Word, and images (max 100MB)'
                    : isAIPowered
                      ? 'Supports PDF, Excel, Word, and images (max 10MB)'
                      : 'Supports .xlsx, .xls, and .csv files (max 10MB)'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mt-4 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-green-900 font-semibold text-lg">Upload Complete!</p>
                <p className="text-green-800 mt-1">{successMessage}</p>
                <button
                  onClick={() => {
                    setSuccessMessage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="mt-3 px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Upload Another Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-6 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-red-900 font-semibold text-lg">Upload Error</p>
                <p className="text-red-700 mt-1">{error}</p>

                <button
                  onClick={() => setError(null)}
                  className="mt-3 px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 text-lg mb-1">What happens next?</h4>
              <p className="text-sm text-blue-700">Follow these steps to complete your menu upload</p>
            </div>
          </div>
          <div className="space-y-3">
            {isAIPowered ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                  <p className="text-sm text-blue-800 leading-relaxed">AI will extract menu items from your document</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                  <p className="text-sm text-blue-800 leading-relaxed">You'll see extracted items with confidence scores</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                  <p className="text-sm text-blue-800 leading-relaxed">Review and edit any fields as needed</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                  <p className="text-sm text-blue-800 leading-relaxed">Then upload photos that will auto-match to your items</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                  <p className="text-sm text-blue-800 leading-relaxed">Your Excel file will be parsed and validated</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                  <p className="text-sm text-blue-800 leading-relaxed">You'll see a preview of all menu items</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                  <p className="text-sm text-blue-800 leading-relaxed">You can edit any details before confirming</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                  <p className="text-sm text-blue-800 leading-relaxed">Then upload photos that will auto-match to your items</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ExcelUploader;
