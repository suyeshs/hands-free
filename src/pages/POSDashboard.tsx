/**
 * POS Dashboard
 * Point of Sale interface for servers
 * (This will redirect to the main App component for now)
 */

import { useAuthStore } from '../stores/authStore';

export default function POSDashboard() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
            <p className="text-sm text-gray-600 mt-1">
              {user?.name} ({user?.role})
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            POS Interface
          </h2>
          <p className="text-gray-600 mb-6">
            The full POS interface will be integrated in Phase 4.
          </p>
          <p className="text-sm text-gray-500">
            For now, this is a placeholder. The complete POS system with menu,
            cart, and checkout will be available soon.
          </p>
        </div>
      </div>
    </div>
  );
}
