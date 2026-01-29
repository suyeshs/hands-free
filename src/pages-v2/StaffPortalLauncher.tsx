/**
 * Staff Portal Launcher
 *
 * Manager interface to launch individual staff portal windows.
 * Each staff member gets their own personalized window with:
 * - Role-specific functionality
 * - Personal salary/payroll information
 * - Time tracking
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { Users, ExternalLink, RefreshCw } from 'lucide-react';

interface StaffMember {
    id: string;
    name: string;
    role: string;
    phone?: string;
    email?: string;
    joining_date?: string;
    is_active: boolean;
}

export default function StaffPortalLauncher() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [openPortals, setOpenPortals] = useState<string[]>([]);

    useEffect(() => {
        loadStaff();
        loadOpenPortals();
    }, []);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const db = await Database.load('sqlite:pos.db');

            const result = await db.select<StaffMember[]>(`
                SELECT id, name, role, phone, email, joining_date, is_active
                FROM staff
                WHERE is_active = 1
                ORDER BY role, name
            `);

            setStaff(result);
        } catch (error) {
            console.error('[StaffPortalLauncher] Failed to load staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadOpenPortals = async () => {
        try {
            const portals = await invoke<string[]>('get_open_staff_portals');
            setOpenPortals(portals);
        } catch (error) {
            console.error('[StaffPortalLauncher] Failed to get open portals:', error);
        }
    };

    const openPortal = async (member: StaffMember) => {
        try {
            console.log('[StaffPortalLauncher] Opening portal for:', member.name);

            await invoke('open_staff_portal', {
                staffId: member.id,
                staffName: member.name,
                role: member.role,
            });

            // Refresh open portals list
            setTimeout(loadOpenPortals, 500);
        } catch (error) {
            console.error('[StaffPortalLauncher] Failed to open portal:', error);
            alert(`Failed to open portal for ${member.name}: ${error}`);
        }
    };

    const closePortal = async (staffId: string) => {
        try {
            await invoke('close_staff_portal', { staffId });
            setTimeout(loadOpenPortals, 500);
        } catch (error) {
            console.error('[StaffPortalLauncher] Failed to close portal:', error);
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role.toLowerCase()) {
            case 'server':
                return '👔';
            case 'kitchen':
                return '👨‍🍳';
            case 'manager':
                return '💼';
            case 'cleaner':
                return '🧹';
            default:
                return '👤';
        }
    };

    const getRoleColor = (role: string) => {
        switch (role.toLowerCase()) {
            case 'server':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'kitchen':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'manager':
                return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'cleaner':
                return 'bg-green-100 text-green-700 border-green-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const isPortalOpen = (staffId: string) => {
        return openPortals.some(label => label.includes(staffId));
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Loading staff...</div>
                </div>
            </div>
        );
    }

    // Group staff by role
    const staffByRole = staff.reduce((acc, member) => {
        const role = member.role || 'Other';
        if (!acc[role]) {
            acc[role] = [];
        }
        acc[role].push(member);
        return acc;
    }, {} as Record<string, StaffMember[]>);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Staff Portal Launcher</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Open personalized portals for staff members
                    </p>
                </div>
                <button
                    onClick={() => {
                        loadStaff();
                        loadOpenPortals();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-4">
                    <div className="text-sm text-muted-foreground">Total Staff</div>
                    <div className="text-2xl font-bold text-foreground">{staff.length}</div>
                </div>
                <div className="bg-card border border-border p-4">
                    <div className="text-sm text-muted-foreground">Open Portals</div>
                    <div className="text-2xl font-bold text-green-600">{openPortals.length}</div>
                </div>
                <div className="bg-card border border-border p-4">
                    <div className="text-sm text-muted-foreground">Roles</div>
                    <div className="text-2xl font-bold text-foreground">{Object.keys(staffByRole).length}</div>
                </div>
            </div>

            {/* Staff List by Role */}
            {Object.entries(staffByRole).map(([role, members]) => (
                <div key={role} className="bg-card border border-border p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">{getRoleIcon(role)}</span>
                        <h2 className="text-xl font-bold text-foreground">{role}</h2>
                        <span className="text-sm text-muted-foreground">({members.length})</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {members.map((member) => {
                            const portalOpen = isPortalOpen(member.id);

                            return (
                                <div
                                    key={member.id}
                                    className={`border-2  p-4 transition-all ${
                                        portalOpen
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-border bg-background hover:border-blue-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-foreground">{member.name}</h3>
                                            <div className={`inline-block px-2 py-1 rounded text-xs font-medium border mt-1 ${getRoleColor(member.role)}`}>
                                                {member.role}
                                            </div>
                                        </div>
                                        {portalOpen && (
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                        )}
                                    </div>

                                    {member.joining_date && (
                                        <div className="text-xs text-muted-foreground mb-3">
                                            Joined: {new Date(member.joining_date).toLocaleDateString()}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        {portalOpen ? (
                                            <button
                                                onClick={() => closePortal(member.id)}
                                                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                                            >
                                                Close Portal
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => openPortal(member)}
                                                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center justify-center gap-2"
                                            >
                                                <ExternalLink size={14} />
                                                Open Portal
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {staff.length === 0 && (
                <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Staff Members</h3>
                    <p className="text-sm text-muted-foreground">
                        Add staff members in Settings → Operations → Staff Management
                    </p>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 How it works</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Click "Open Portal" to launch a personalized window for any staff member</li>
                    <li>• Each portal shows role-specific functionality and personal salary information</li>
                    <li>• Service staff can take orders and manage tables</li>
                    <li>• Kitchen staff see the KDS (Kitchen Display System)</li>
                    <li>• All staff can view their salary, advances, and deductions</li>
                    <li>• Portals stay open independently and can be closed anytime</li>
                </ul>
            </div>
        </div>
    );
}
