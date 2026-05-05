'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Badge } from './Badge';
import {
  Utensils,
  Mic,
  Palette,
  Settings,
  Plus,
  ExternalLink
} from 'lucide-react';

interface RestaurantInfo {
  tenantId: string;
  name: string;
  theme: string;
  menuItemsCount: number;
  isLive: boolean;
}

export function AdminDashboard() {
  const { profile: restaurantProfile } = useRestaurant();
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!restaurantProfile) {
      setIsLoading(false);
      return;
    }

    setRestaurantInfo({
      tenantId: restaurantProfile.tenantId,
      name: restaurantProfile.name,
      theme: 'coorg-food-company',
      menuItemsCount: 0,
      isLive: restaurantProfile.status === 'active',
    });
    setIsLoading(false);
  }, [restaurantProfile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2" style={{ borderColor: 'var(--admin-primary)' }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-card)' }}>
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold font-display">Restaurant Platform</h1>
            <Badge variant="secondary">Admin Dashboard</Badge>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <a
              href={`https://${restaurantInfo?.tenantId}.handsfree.tech`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn admin-btn-outline admin-btn-sm flex items-center gap-2"
            >
              <ExternalLink size={16} />
              <span>View Customer Site</span>
            </a>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-semibold tracking-tight mb-2 font-display">
            {restaurantInfo?.name}
          </h2>
          <p style={{ color: 'var(--admin-muted-fg)' }} className="text-sm">
            {restaurantInfo?.tenantId}
          </p>
        </div>

        {/* Management Sections */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurant Management</CardTitle>
            <CardDescription>
              Manage and customize your restaurant settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Menu Management */}
              <div className="flex items-start p-4 border rounded-lg" style={{ borderColor: 'var(--admin-border)' }}>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--admin-muted)' }}>
                    <Utensils className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-medium mb-1">Menu Management</h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--admin-muted-fg)' }}>
                    Manage items, categories, and pricing
                  </p>
                  <div className="space-y-2">
                    <Link href="/admin/menu" className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      View Menu
                    </Link>
                    <Link href="/admin/menu/upload" className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      Upload Menu
                    </Link>
                  </div>
                </div>
              </div>

              {/* Voice AI */}
              <div className="flex items-start p-4 border rounded-lg" style={{ borderColor: 'var(--admin-border)' }}>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--admin-muted)' }}>
                    <Mic className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-medium mb-1">Voice AI</h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--admin-muted-fg)' }}>
                    Configure voice assistant settings
                  </p>
                  <div className="space-y-2">
                    <Link href="/admin/voice" className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      Voice Settings
                    </Link>
                    <button className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      Test Voice AI
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div className="flex items-start p-4 border rounded-lg" style={{ borderColor: 'var(--admin-border)' }}>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--admin-muted)' }}>
                    <Palette className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-medium mb-1">Theme & Branding</h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--admin-muted-fg)' }}>
                    Customize colors and design
                  </p>
                  <div className="space-y-2">
                    <Link href="/admin/theme" className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      Theme Editor
                    </Link>
                    <Link href="/admin/theme" className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      Upload Logo
                    </Link>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="flex items-start p-4 border rounded-lg" style={{ borderColor: 'var(--admin-border)' }}>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--admin-muted)' }}>
                    <Settings className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="font-medium mb-1">Restaurant Settings</h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--admin-muted-fg)' }}>
                    Manage restaurant details
                  </p>
                  <div className="space-y-2">
                    <Link href="/admin/info" className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      Restaurant Info
                    </Link>
                    <Link href="/admin/info" className="admin-btn admin-btn-outline admin-btn-sm w-full">
                      Business Hours
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/admin/setup" className="admin-btn admin-btn-outline admin-btn-default flex items-center justify-center gap-2">
                <Settings size={18} />
                <span>Re-run Setup Wizard</span>
              </Link>
              <button className="admin-btn admin-btn-outline admin-btn-default flex items-center justify-center gap-2">
                <Plus size={18} />
                <span>Export Menu Data</span>
              </button>
              <button className="admin-btn admin-btn-primary admin-btn-default flex items-center justify-center gap-2">
                <Mic size={18} />
                <span>Test Voice AI</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
