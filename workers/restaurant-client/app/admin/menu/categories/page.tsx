'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CategoryNode {
  id: string;
  tenant_id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  display_order: number;
  icon: string | null;
  created_at: string;
  updated_at: string;
  children: CategoryNode[];
  item_count?: number;
}

export default function CategoryManagementPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryNode | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parent_id: null as string | null,
    display_order: 0,
  });

  const getTenantId = () => {
    if (typeof window === 'undefined') return 'demo';
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    return subdomain !== 'localhost' && subdomain !== 'stonepot-restaurant-client'
      ? subdomain
      : 'demo';
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const tenantId = getTenantId();
      const response = await fetch(`/api/categories/${tenantId}`);

      if (response.ok) {
        const data = await response.json() as { categories?: CategoryNode[] };
        setCategories(data.categories || []);
      } else {
        console.error('Failed to load categories:', response.status);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = (parent: CategoryNode | null = null) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      parent_id: parent?.id || null,
      display_order: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (category: CategoryNode) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      parent_id: category.parent_id,
      display_order: category.display_order,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', parent_id: null, display_order: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Category name is required');
      return;
    }

    try {
      const tenantId = getTenantId();

      if (editingCategory) {
        // Update existing category - use full category ID
        const response = await fetch(`/api/categories/${tenantId}/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json() as { error?: string };
          alert(error.error || 'Failed to update category');
          return;
        }
      } else {
        // Create new category
        const response = await fetch(`/api/categories/${tenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json() as { error?: string };
          alert(error.error || 'Failed to create category');
          return;
        }
      }

      closeModal();
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error saving category');
    }
  };

  const handleDelete = async (category: CategoryNode) => {
    const itemInfo = category.item_count ? ` (${category.item_count} items will be reassigned)` : '';
    if (!confirm(`Are you sure you want to delete "${category.name}"?${itemInfo}`)) {
      return;
    }

    try {
      const tenantId = getTenantId();
      // Use full category ID
      const response = await fetch(`/api/categories/${tenantId}/${category.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json() as { error?: string };
        alert(error.error || 'Failed to delete category');
        return;
      }

      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error deleting category');
    }
  };

  const renderCategoryTree = (nodes: CategoryNode[], depth = 0): JSX.Element[] => {
    if (!nodes || !Array.isArray(nodes)) return [];

    return nodes.flatMap((node) => {
      const indent = depth * 24;
      return [
        <div
          key={node.id}
          className="border-b border-gray-200 hover:bg-gray-50"
          style={{ paddingLeft: `${indent}px` }}
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 flex-1">
              {node.icon && <span className="text-xl">{node.icon}</span>}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{node.name}</span>
                  {node.item_count !== undefined && (
                    <span className="text-xs text-gray-500">
                      ({node.item_count} items)
                    </span>
                  )}
                  {depth > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Level {depth + 1}
                    </span>
                  )}
                </div>
                {node.parent_id && (
                  <span className="text-xs text-gray-400">
                    Child category
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => openCreateModal(node)}
                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                title="Add subcategory"
              >
                + Add Child
              </button>
              <button
                onClick={() => openEditModal(node)}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(node)}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        ...(node.children ? renderCategoryTree(node.children, depth + 1) : []),
      ];
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/admin/menu" className="mr-4 text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Category Management</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {categories.length} categories (with nested hierarchy)
                </p>
              </div>
            </div>
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No categories</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new category.</p>
            <div className="mt-6">
              <button
                onClick={() => openCreateModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {renderCategoryTree(categories)}
            </div>
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-400"
                  placeholder="e.g., Appetizers, Main Course"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Icon will be automatically assigned based on category name
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
