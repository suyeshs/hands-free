/**
 * FloorPlanCard Component
 * REQUIRED: Setup tables and sections for dine-in service
 */

import { useNavigate } from 'react-router-dom';
import { LayoutGrid, ArrowRight, Plus } from 'lucide-react';
import { SetupCardBase } from '../SetupCardBase';
import { useFloorPlanStore } from '../../../stores/floorPlanStore';
import { cn } from '../../../lib/utils';

export function FloorPlanCard() {
  const navigate = useNavigate();
  const { sections, tables } = useFloorPlanStore();

  // Require at least 1 section and 2 tables
  const completed = sections.length >= 1 && tables.length >= 2;

  const sectionCount = sections.length;
  const tableCount = tables.length;
  const tablesNeeded = Math.max(0, 2 - tableCount);

  return (
    <SetupCardBase
      id="floor-plan"
      title="Setup Tables & Floor Plan"
      description="Create sections and tables for dine-in service"
      icon={LayoutGrid}
      completed={completed}
      required={true}
      completionMessage={`${sectionCount} section${sectionCount !== 1 ? 's' : ''}, ${tableCount} table${tableCount !== 1 ? 's' : ''} configured ✓`}
    >
      <div className="space-y-6">
        {/* Help Text */}
        <p className="text-sm text-gray-400">
          💡 Set up your restaurant floor plan with sections and tables. Each table gets a unique QR code for customer ordering!
        </p>

        {/* Current Status */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-surface-2 to-surface border border-border">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className={cn(
                "text-4xl font-bold mb-1",
                sectionCount >= 1 ? "text-green-400" : "text-amber-400"
              )}>
                {sectionCount}
              </div>
              <div className="text-sm text-gray-400">Sections</div>
              {sectionCount === 0 && (
                <div className="text-xs text-amber-500 mt-1">
                  At least 1 needed
                </div>
              )}
            </div>
            <div>
              <div className={cn(
                "text-4xl font-bold mb-1",
                tableCount >= 2 ? "text-green-400" : "text-amber-400"
              )}>
                {tableCount}
              </div>
              <div className="text-sm text-gray-400">Tables</div>
              {tableCount < 2 && (
                <div className="text-xs text-amber-500 mt-1">
                  {tablesNeeded} more needed
                </div>
              )}
            </div>
          </div>

          {!completed && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                <p className="text-sm text-center text-amber-400 font-semibold">
                  {sectionCount === 0
                    ? "Create your first section and add tables"
                    : `Add ${tablesNeeded} more table${tablesNeeded !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        {!completed && sectionCount > 0 && (
          <div>
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>Tables Progress</span>
              <span>{Math.round((tableCount / 2) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                style={{ width: `${Math.min((tableCount / 2) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => navigate('/settings', {
            state: { openCategory: 'operations', openSetting: 'floor-plan' }
          })}
          className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Setup Floor Plan</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Benefits Section */}
        <div className="space-y-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="font-bold text-sm text-purple-300 mb-2">Why setup floor plan?</div>

          <div className="flex items-start gap-3">
            <div className="text-xl">📱</div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-purple-200 mb-1">QR Code Ordering</div>
              <div className="text-xs text-gray-400">
                Each table gets a unique QR code. Customers scan to see the menu and place orders directly!
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-xl">👥</div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-purple-200 mb-1">Staff Management</div>
              <div className="text-xs text-gray-400">
                Assign specific tables or sections to staff members for better service coordination.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-xl">📊</div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-purple-200 mb-1">Table Status Tracking</div>
              <div className="text-xs text-gray-400">
                See which tables are occupied, available, or need attention at a glance.
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="text-xs text-gray-500 space-y-2">
          <div className="font-semibold text-gray-400">Quick Start:</div>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Create a section (e.g., "Main Hall", "Outdoor")</li>
            <li>Add tables to the section with table numbers</li>
            <li>QR codes are automatically generated for each table</li>
          </ol>
        </div>
      </div>
    </SetupCardBase>
  );
}
