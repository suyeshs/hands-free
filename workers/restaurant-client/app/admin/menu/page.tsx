'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MenuItem {
  id: string;
  name: string;
  nameHindi?: string;
  category: string;
  price: number;
  description?: string;
  photoUrl?: string;
  cloudflare_image_id?: string;
  available: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  spiceLevel?: string;
}

// Generate Cloudflare Images URL
const generateImageUrl = (cloudflareId: string, variant: string = 'public') => {
  return `https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/${cloudflareId}/${variant}`;
};

export default function MenuManagementPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [unassignedImages, setUnassignedImages] = useState<any[]>([]);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showExistingImagesGallery, setShowExistingImagesGallery] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  const getTenantId = () => {
    if (typeof window === 'undefined') return 'demo';
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    return subdomain !== 'localhost' && subdomain !== 'stonepot-restaurant-client'
      ? subdomain
      : 'demo';
  };

  // Transform Firestore response to MenuItem interface
  const transformMenuItem = (item: any): MenuItem => {
    // Extract cloudflare image ID from URL if not directly provided
    const photoUrl = item.imageUrl || item.image_url || item.photo_url || item.photoUrl;
    let cloudflareImageId = item.imageId || item.cloudflare_image_id || item.cloudflareImageId;

    // If no direct image ID but we have a Cloudflare Images URL, extract the ID
    if (!cloudflareImageId && photoUrl && photoUrl.includes('imagedelivery.net')) {
      const match = photoUrl.match(/imagedelivery\.net\/[^/]+\/([^/]+)\//);
      if (match) {
        cloudflareImageId = match[1];
      }
    }

    return {
      id: item.id,
      name: item.name,
      nameHindi: item.nameHindi || item.name_hindi,
      category: item.category,
      price: item.price,
      description: item.description,
      photoUrl,
      cloudflare_image_id: cloudflareImageId,
      available: item.available !== false,
      isVegetarian: item.isVegetarian || item.is_vegetarian,
      isVegan: item.isVegan || item.is_vegan,
      spiceLevel: item.spiceLevel || item.spice_level,
    };
  };

  useEffect(() => {
    loadMenuItems();
    loadCategories();
  }, [page]); // Reload when page changes

  const loadCategories = async () => {
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/categories/${tenantId}`);

      if (response.ok) {
        const data = await response.json() as { categories?: any[] };
        const categoryNames = (data.categories || []).map((cat: any) => cat.name);
        setCategories(categoryNames);
      } else {
        console.error('Failed to load categories:', response.status);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadMenuItems = async () => {
    setIsLoading(true);
    try {
      const tenantId = getTenantId();

      // Fetch menu via Restaurant Worker
      // Tenant ID is extracted from hostname, not URL path
      const response = await fetch(`/api/menu?limit=200`);

      if (response.ok) {
        const data = await response.json() as {
          items?: any[];
          success?: boolean;
          pagination?: {
            totalItems?: number;
            totalPages?: number;
            page?: number;
            hasNextPage?: boolean;
            hasPreviousPage?: boolean;
          };
        };

        if (data.success && data.items) {
          // Transform D1 snake_case to camelCase
          const transformedItems = data.items.map(transformMenuItem);
          setMenuItems(transformedItems);

          // Update pagination metadata from D1 response
          if (data.pagination) {
            setTotalItems(data.pagination.totalItems || transformedItems.length);
            setTotalPages(data.pagination.totalPages || 1);
            setHasNextPage(data.pagination.hasNextPage || false);
            setHasPreviousPage(data.pagination.hasPreviousPage || false);
          } else {
            setTotalItems(transformedItems.length);
            setTotalPages(1);
          }
        }
      } else {
        console.error('Failed to load menu from D1:', response.status);
      }
    } catch (error) {
      console.error('Failed to load menu items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAvailability = async (itemId: string, currentStatus: boolean) => {
    try {
      const tenantId = getTenantId();
      // Use Restaurant Worker API for availability toggle
      const response = await fetch(
        `/api/admin/menu/items/${itemId}/availability`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isAvailable: !currentStatus,
          }),
        }
      );

      if (response.ok) {
        setMenuItems(items =>
          items.map(item =>
            item.id === itemId ? { ...item, available: !currentStatus } : item
          )
        );
      }
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const loadUnassignedImages = async () => {
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/admin/menu/unassigned-images?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json() as { images?: any[] };
        setUnassignedImages(data.images || []);
      }
    } catch (err) {
      console.error('Failed to load unassigned images:', err);
    }
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem({ ...item });
    setIsAddingNew(false);
    setIsEditModalOpen(true);
    setShowImageGallery(false);
    setShowExistingImagesGallery(false);
    loadUnassignedImages(); // Load unassigned images when opening modal
    loadCategories(); // Refresh categories list
  };

  const openAddModal = () => {
    // Create a new empty item with default values
    const newItem: MenuItem = {
      id: '', // Will be generated by the server
      name: '',
      nameHindi: '',
      category: categories.length > 0 ? categories[0] : '',
      price: 0,
      description: '',
      photoUrl: '',
      cloudflare_image_id: '',
      available: true,
      isVegetarian: false,
      isVegan: false,
      spiceLevel: '',
    };
    setEditingItem(newItem);
    setIsAddingNew(true);
    setIsEditModalOpen(true);
    setShowImageGallery(false);
    setShowExistingImagesGallery(false);
    loadUnassignedImages();
    loadCategories(); // Refresh categories list
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setIsEditModalOpen(false);
    setIsAddingNew(false);
    setShowImageGallery(false);
    setShowExistingImagesGallery(false);
  };

  const selectUnassignedImage = async (imageId: string, cloudflareImageId: string) => {
      if (!editingItem) return;

      // Set the image on the editing item
      setEditingItem({
        ...editingItem,
        cloudflare_image_id: cloudflareImageId
      });

      // Remove from unassigned list
      setUnassignedImages(prev => prev.filter(img => img.id !== imageId));
      setShowImageGallery(false);
    };

  const selectExistingImage = (cloudflareImageId: string) => {
    if (!editingItem) return;

    // Set the image on the editing item
    setEditingItem({
      ...editingItem,
      cloudflare_image_id: cloudflareImageId
    });

    setShowExistingImagesGallery(false);
  };

    const handleImageUpload = async (file: File) => {
      if (!editingItem) return;

      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tenantId', getTenantId());

        const response = await fetch('/api/cfupload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json() as any;
          const imageId = data.cloudflareId || data.id || data.result?.id;
          if (data.success && imageId) {
            setEditingItem({
              ...editingItem,
              cloudflare_image_id: imageId,
            });
          } else {
            const errorMsg = data.error || 'Failed to upload image';
            alert(errorMsg);
            console.error('Upload response:', data);
          }
        } else {
          const errorText = await response.text();
          alert(`Failed to upload image: ${response.status}`);
          console.error('Upload error:', errorText);
        }
      } catch (error) {
        console.error('Failed to upload image:', error);
        alert('Error uploading image');
      } finally {
        setIsUploadingImage(false);
      }
    };

    const saveEditedItem = async () => {
      if (!editingItem) return;

      // Validate required fields
      if (!editingItem.name.trim()) {
        alert('Please enter a name for the item');
        return;
      }
      if (!editingItem.category.trim()) {
        alert('Please select or enter a category');
        return;
      }
      if (editingItem.price <= 0) {
        alert('Please enter a valid price');
        return;
      }

      setIsSaving(true);
      try {
        const tenantId = getTenantId();
        const itemData = {
          name: editingItem.name,
          nameHindi: editingItem.nameHindi,
          category: editingItem.category,
          price: editingItem.price,
          description: editingItem.description,
          available: editingItem.available,
          isVegetarian: editingItem.isVegetarian,
          isVegan: editingItem.isVegan,
          spiceLevel: editingItem.spiceLevel,
          photoUrl: editingItem.cloudflare_image_id ? generateImageUrl(editingItem.cloudflare_image_id) : editingItem.photoUrl,
        };

        let response: Response;

        if (isAddingNew) {
          // POST to create new item
          response = await fetch(
            `/api/admin/menu/items`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(itemData),
            }
          );

          if (response.ok) {
            const data = await response.json() as { item?: { id: string }; id?: string; itemId?: string };
            const newId = data.item?.id || data.id || data.itemId || `new-${Date.now()}`;
            const newItem = { ...editingItem, id: newId };
            setMenuItems(items => [newItem, ...items]);
            setTotalItems(prev => prev + 1);
            closeEditModal();
          } else {
            const errorData = await response.json().catch(() => ({})) as { error?: string };
            alert(`Failed to create item: ${errorData.error || response.statusText}`);
          }
        } else {
          // PUT to update existing item
          response = await fetch(
            `/api/admin/menu/items/${editingItem.id}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(itemData),
            }
          );

          if (response.ok) {
            setMenuItems(items =>
              items.map(item =>
                item.id === editingItem.id ? { ...editingItem } : item
              )
            );
            closeEditModal();
          } else {
            const errorData = await response.json().catch(() => ({})) as { error?: string };
            alert(`Failed to update item: ${errorData.error || response.statusText}`);
          }
        }
      } catch (error) {
        console.error('Failed to save item:', error);
        alert('Error saving item');
      } finally {
        setIsSaving(false);
      }
    };

    const deleteItem = async (itemId: string, itemName: string) => {
      if (!confirm(`Are you sure you want to delete "${itemName}"?`)) {
        return;
      }

      try {
        const tenantId = getTenantId();
        // Use Restaurant Worker API for deletes
        const response = await fetch(
          `/api/admin/menu/items/${itemId}`,
          {
            method: 'DELETE',
          }
        );

        if (response.ok) {
          setMenuItems(items => items.filter(item => item.id !== itemId));
        } else {
          const errorData = await response.json().catch(() => ({})) as { error?: string };
          alert(`Failed to delete item: ${errorData.error || response.statusText}`);
        }
      } catch (error) {
        console.error('Failed to delete item:', error);
        alert('Error deleting item');
      }
    };

    // Categories are now loaded from the categories API, not derived from menu items

    const filteredItems = menuItems.filter(item => {
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nameHindi?.includes(searchQuery) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        filterCategory === 'all' || item.category === filterCategory;

      const matchesAvailability =
        filterAvailability === 'all' ||
        (filterAvailability === 'available' && item.available) ||
        (filterAvailability === 'unavailable' && !item.available);

      return matchesSearch && matchesCategory && matchesAvailability;
    });

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
                  <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchQuery || filterCategory !== 'all' || filterAvailability !== 'all' ? (
                      `${filteredItems.length} items (filtered from ${totalItems} total)`
                    ) : (
                      <>
                        Showing {((page - 1) * 100) + 1}-{Math.min(page * 100, totalItems)} of {totalItems} items
                        {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/admin/menu/categories"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Categories
                </Link>
                <Link
                  href="/admin/menu/photos"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Photos
                </Link>
                <Link
                  href="/admin/menu/images"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  All Images
                </Link>
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
                <Link
                  href="/admin/menu/upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Bulk Upload
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, category..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  id="category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="availability" className="block text-sm font-medium text-gray-700 mb-1">
                  Availability
                </label>
                <select
                  id="availability"
                  value={filterAvailability}
                  onChange={(e) => setFilterAvailability(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Items</option>
                  <option value="available">Available Only</option>
                  <option value="unavailable">Unavailable Only</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading menu items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No menu items</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || filterCategory !== 'all' || filterAvailability !== 'all'
                  ? 'No items match your filters. Try adjusting your search.'
                  : 'Get started by uploading your menu using one of our upload methods.'}
              </p>
              {!searchQuery && filterCategory === 'all' && filterAvailability === 'all' && (
                <div className="mt-6">
                  <Link
                    href="/admin/menu/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Upload Menu
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.cloudflare_image_id ? (
                            <img
                              src={generateImageUrl(item.cloudflare_image_id)}
                              alt={item.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                            {item.nameHindi && (
                              <div className="text-sm text-gray-500">{item.nameHindi}</div>
                            )}
                            {item.description && (
                              <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{item.price}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {item.isVegetarian && (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                              Veg
                            </span>
                          )}
                          {item.isVegan && (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                              Vegan
                            </span>
                          )}
                          {item.spiceLevel && (
                            <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                              {item.spiceLevel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleAvailability(item.id, item.available)}
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.available
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                        >
                          {item.available ? 'Available' : 'Unavailable'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteItem(item.id, item.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {!isLoading && menuItems.length > 0 && totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={!hasPreviousPage}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${hasPreviousPage
                        ? 'bg-white text-gray-700 hover:bg-gray-50'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={!hasNextPage}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${hasNextPage
                        ? 'bg-white text-gray-700 hover:bg-gray-50'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{((page - 1) * 100) + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(page * 100, totalItems)}</span> of{' '}
                        <span className="font-medium">{totalItems}</span> items
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setPage(page - 1)}
                          disabled={!hasPreviousPage}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${hasPreviousPage
                            ? 'bg-white text-gray-500 hover:bg-gray-50'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>

                        {/* Page numbers */}
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 7) {
                            pageNum = i + 1;
                          } else if (page <= 4) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 3) {
                            pageNum = totalPages - 6 + i;
                          } else {
                            pageNum = page - 3 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${page === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setPage(page + 1)}
                          disabled={!hasNextPage}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${hasNextPage
                            ? 'bg-white text-gray-500 hover:bg-gray-50'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Add/Edit Modal */}
        {isEditModalOpen && editingItem && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {isAddingNew ? 'Add New Menu Item' : 'Edit Menu Item'}
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Image Upload Section */}
                <div className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dish Image</label>
                  <div className="flex items-center gap-4 mb-3">
                    {editingItem.cloudflare_image_id ? (
                      <div className="relative">
                        <img
                          src={generateImageUrl(editingItem.cloudflare_image_id)}
                          alt={editingItem.name}
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                        <button
                          onClick={() => setEditingItem({ ...editingItem, cloudflare_image_id: undefined })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          title="Remove image"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(file);
                          }
                        }}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        disabled={isUploadingImage}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {isUploadingImage ? 'Uploading...' : 'PNG, JPG, WebP or GIF (max 10MB)'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle for Unassigned Images */}
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        setShowImageGallery(!showImageGallery);
                        if (!showImageGallery) setShowExistingImagesGallery(false);
                      }}
                      disabled={unassignedImages.length === 0}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {showImageGallery ? '▼' : '▶'} Choose from Unassigned Images ({unassignedImages.length})
                    </button>
                  </div>

                  {/* Unassigned Images Gallery */}
                  {showImageGallery && unassignedImages.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-4 gap-3">
                        {unassignedImages.map((image) => (
                          <div
                            key={image.id}
                            className="relative cursor-pointer group"
                            onClick={() => selectUnassignedImage(image.id, image.cloudflare_image_id)}
                          >
                            <img
                              src={image.image_url}
                              alt={image.filename}
                              className="w-full h-20 object-cover rounded-md border-2 border-transparent group-hover:border-blue-500 transition-all"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-md flex items-center justify-center transition-all">
                              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-semibold">Select</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1 truncate" title={image.filename}>
                              {image.filename}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toggle for All Existing Images */}
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        setShowExistingImagesGallery(!showExistingImagesGallery);
                        if (!showExistingImagesGallery) setShowImageGallery(false);
                      }}
                      disabled={menuItems.filter(item => item.cloudflare_image_id).length === 0}
                      className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {showExistingImagesGallery ? '▼' : '▶'} Choose from Existing Images ({menuItems.filter(item => item.cloudflare_image_id).length})
                    </button>
                  </div>

                  {/* Existing Images Gallery */}
                  {showExistingImagesGallery && menuItems.filter(item => item.cloudflare_image_id).length > 0 && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-4 gap-3">
                        {menuItems
                          .filter(item => item.cloudflare_image_id)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="relative cursor-pointer group"
                              onClick={() => selectExistingImage(item.cloudflare_image_id!)}
                            >
                              <img
                                src={generateImageUrl(item.cloudflare_image_id!)}
                                alt={item.name}
                                className="w-full h-20 object-cover rounded-md border-2 border-transparent group-hover:border-green-500 transition-all"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-md flex items-center justify-center transition-all">
                                <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-semibold">Select</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1 truncate" title={item.name}>
                                {item.name}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editingItem.name}
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (Hindi)</label>
                    <input
                      type="text"
                      value={editingItem.nameHindi || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, nameHindi: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      {categories.length === 0 ? (
                        <option value="">No categories available</option>
                      ) : (
                        categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spice Level</label>
                  <input
                    type="text"
                    value={editingItem.spiceLevel || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, spiceLevel: e.target.value })}
                    placeholder="e.g., Mild, Medium, Spicy"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingItem.available}
                      onChange={(e) => setEditingItem({ ...editingItem, available: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Available</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingItem.isVegetarian || false}
                      onChange={(e) => setEditingItem({ ...editingItem, isVegetarian: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Vegetarian</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingItem.isVegan || false}
                      onChange={(e) => setEditingItem({ ...editingItem, isVegan: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Vegan</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={closeEditModal}
                    disabled={isSaving}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditedItem}
                    disabled={isSaving}
                    className={`px-4 py-2 text-white rounded-md disabled:opacity-50 ${
                      isAddingNew
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isSaving ? 'Saving...' : isAddingNew ? 'Add Item' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
