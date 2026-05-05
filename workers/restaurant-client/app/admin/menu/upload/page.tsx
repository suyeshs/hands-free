'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import R2Uploader, { UploadProgress } from '../../../../r2Uploader';
import { API_URL } from '../../../config/api';

type UploadMethod = 'smart' | 'template' | 'photos';
type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface UploadResult {
  totalItems?: number;
  newItems?: number;
  updatedItems?: number;
  photosMatched?: number;
  errors?: string[];
}

export default function MenuUploadPage() {
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('smart');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const getTenantId = () => {
    if (typeof window === 'undefined') return 'demo';
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    return subdomain !== 'localhost' && subdomain !== 'stonepot-restaurant-client'
      ? subdomain
      : 'demo';
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMessage('');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');
    setResult(null);
    setUploadProgress(null);

    try {
      const tenantId = getTenantId();

      // NEW: R2 Direct Upload for "smart" method (large file support)
      if (uploadMethod === 'smart') {
        // Step 1: Upload to R2 with progress tracking
        const uploader = new R2Uploader('', (progress) => {
          setUploadProgress(progress);
        });

        const uploadResult = await uploader.uploadFile(selectedFile, tenantId);

        if (!uploadResult.success || !uploadResult.r2Key) {
          throw new Error(uploadResult.error || 'R2 upload failed');
        }

        // Step 2: Process from R2 → File Search
        setStatus('processing');
        setUploadProgress(null);

        const processResponse = await fetch(
          `${API_URL}/api/admin/menu/process-from-r2`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId,
              r2Key: uploadResult.r2Key,
              bucketName: (uploadResult as any).bucketName,
              isShared: (uploadResult as any).isShared,
              filename: selectedFile.name,
              mimeType: selectedFile.type,
            }),
          }
        );

        if (!processResponse.ok) {
          const errorData = await processResponse.json() as { error?: string };
          throw new Error(errorData.error || 'File processing failed');
        }

        const data = await processResponse.json() as any;

        setResult({
          totalItems: 1,
          newItems: 0,
          updatedItems: 0,
          photosMatched: 0,
          errors: [],
        });

        setStatus('success');
        setSelectedFile(null);
      } else {
        // Legacy upload for template/photos (< 32MB)
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('tenantId', tenantId);

        let endpoint = '';
        if (uploadMethod === 'template') {
          endpoint = `${API_URL}/api/admin/menu/upload-excel`;
        } else if (uploadMethod === 'photos') {
          endpoint = `${API_URL}/api/admin/menu/upload-photos`;
        }

        setStatus('processing');

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json() as { error?: string, message?: string };
          throw new Error(errorData.error || errorData.message || 'Upload failed');
        }

        const data = await response.json() as any;

        setResult({
          totalItems: data.totalItems || data.itemsProcessed || data.count || 0,
          newItems: data.newItems || 0,
          updatedItems: data.updatedItems || 0,
          photosMatched: data.photosMatched || data.matched || 0,
          errors: data.errors || [],
        });

        setStatus('success');
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      setStatus('error');
      setUploadProgress(null);
    }
  };

  const downloadTemplate = () => {
    window.open(`${API_URL}/api/admin/menu/template`, '_blank');
  };

  const resetUpload = () => {
    setStatus('idle');
    setResult(null);
    setSelectedFile(null);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/admin" className="mr-4 text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Upload Menu</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Smart AI upload, template-based Excel, or photo matching
                </p>
              </div>
            </div>
            <Link
              href="/admin/menu"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              View All Items
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Select Upload Method</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setUploadMethod('smart')}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${uploadMethod === 'smart'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h3 className="font-medium text-gray-900">File Search Upload</h3>
              </div>
              <p className="text-sm text-gray-500">
                Upload menu to Google File Search - supports large files (173+ items)
              </p>
            </button>

            <button
              onClick={() => setUploadMethod('template')}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${uploadMethod === 'template'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="font-medium text-gray-900">Template Upload</h3>
              </div>
              <p className="text-sm text-gray-500">
                Use our Excel template for precise control over all menu fields (27 columns)
              </p>
            </button>

            <button
              onClick={() => setUploadMethod('photos')}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${uploadMethod === 'photos'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="font-medium text-gray-900">Photo Upload</h3>
              </div>
              <p className="text-sm text-gray-500">
                Batch upload photos and match to menu items using fuzzy logic (70% threshold)
              </p>
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              {uploadMethod === 'smart' && (
                <>
                  <p className="font-medium mb-1">File Search Upload Instructions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Supports PDF, Word (.docx), Excel (.xlsx), and images (PNG, JPG, WEBP)</li>
                    <li>AI extracts menu items from images, PDFs, and documents automatically</li>
                    <li>Upload directly to Google File Search for RAG-powered menu retrieval</li>
                    <li>Handles large files - tested with 173+ menu items without errors</li>
                    <li>Menu will be parsed with AI and saved to database for admin display</li>
                  </ul>
                </>
              )}
              {uploadMethod === 'template' && (
                <>
                  <p className="font-medium mb-1">Template Upload Instructions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Download the Excel template below and fill in your menu details</li>
                    <li>27 columns available including name, price, description, allergens, etc.</li>
                    <li>Support for multi-language (English, Hindi, Tamil, etc.)</li>
                    <li>Upload the completed template to import all items at once</li>
                  </ul>
                  <button
                    onClick={downloadTemplate}
                    className="mt-3 inline-flex items-center px-3 py-1.5 border border-blue-300 rounded text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Template
                  </button>
                </>
              )}
              {uploadMethod === 'photos' && (
                <>
                  <p className="font-medium mb-1">Photo Upload Instructions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Upload a ZIP file containing multiple food photos</li>
                    <li>Name files similar to menu item names (e.g., "biryani.jpg")</li>
                    <li>Fuzzy matching will find items with 70%+ name similarity</li>
                    <li>Supports exact match, substring match, and character overlap matching</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>

        {status === 'idle' || status === 'error' ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="mt-4">
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="mt-2 text-sm text-red-600 hover:text-red-700"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500">
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          onChange={handleFileChange}
                          accept={
                            uploadMethod === 'smart'
                              ? '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp'
                              : uploadMethod === 'template'
                                ? '.xlsx'
                                : '.zip'
                          }
                        />
                      </label>
                      {' '}or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {uploadMethod === 'smart' && 'PDF, Word, Excel, PNG, JPG, WEBP up to 100MB'}
                      {uploadMethod === 'template' && 'Excel (.xlsx) up to 32MB'}
                      {uploadMethod === 'photos' && 'ZIP file up to 32MB'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Link
                href="/admin/menu"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                onClick={handleUpload}
                disabled={!selectedFile}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Upload and Process
              </button>
            </div>
          </div>
        ) : status === 'uploading' || status === 'processing' ? (
          <div className="bg-white shadow rounded-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {status === 'uploading' ? 'Uploading...' : 'Processing with AI...'}
              </h3>
              <p className="text-sm text-gray-500">
                {status === 'uploading'
                  ? uploadProgress
                    ? `Uploading chunk ${uploadProgress.uploadedChunks}/${uploadProgress.totalChunks} (${uploadProgress.percentage}%)`
                    : 'Uploading your file to R2 storage'
                  : uploadMethod === 'smart'
                    ? 'Processing menu for Google File Search'
                    : uploadMethod === 'template'
                      ? 'Importing menu items from template'
                      : 'Matching photos to menu items with fuzzy logic'}
              </p>
              {status === 'uploading' && uploadProgress && (
                <div className="mt-4 w-full max-w-md mx-auto">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : status === 'success' ? (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Successful!</h3>
              <p className="text-sm text-gray-500">Your menu has been processed and updated</p>
            </div>

            {result && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {result.totalItems !== undefined && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{result.totalItems}</p>
                    <p className="text-xs text-gray-500 mt-1">Total Items</p>
                  </div>
                )}
                {result.newItems !== undefined && (
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{result.newItems}</p>
                    <p className="text-xs text-gray-500 mt-1">New Items</p>
                  </div>
                )}
                {result.updatedItems !== undefined && (
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{result.updatedItems}</p>
                    <p className="text-xs text-gray-500 mt-1">Updated Items</p>
                  </div>
                )}
                {result.photosMatched !== undefined && (
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{result.photosMatched}</p>
                    <p className="text-xs text-gray-500 mt-1">Photos Matched</p>
                  </div>
                )}
              </div>
            )}

            {result?.errors && result.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-yellow-800 mb-2">Some items had warnings:</p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button
                onClick={resetUpload}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Upload More
              </button>
              <Link
                href="/admin/menu"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                View Menu Items
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Need Help?</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">Documentation</p>
                <p>See the complete menu upload workflow guide for detailed instructions</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">Common Issues</p>
                <p>If upload fails, check file format, size limits, and ensure proper Excel structure</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
