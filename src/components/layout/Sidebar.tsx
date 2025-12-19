import { Home, UtensilsCrossed, Receipt, History, BarChart3, LayoutGrid, FileSpreadsheet, LogOut } from "lucide-react";
import { cn } from "../../lib/utils";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  active?: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout?: () => void;
}

export function Sidebar({ currentView, onViewChange, onLogout }: SidebarProps) {
  const navItems: NavItem[] = [
    { icon: <Home className="w-5 h-5" />, label: "Dashboard", path: "dashboard" },
    { icon: <LayoutGrid className="w-5 h-5" />, label: "Tables", path: "tables" },
    { icon: <UtensilsCrossed className="w-5 h-5" />, label: "Menu", path: "menu" },
    { icon: <FileSpreadsheet className="w-5 h-5" />, label: "Manager", path: "menu-onboarding" },
    { icon: <Receipt className="w-5 h-5" />, label: "Order", path: "orders" },
    { icon: <History className="w-5 h-5" />, label: "History", path: "history" },
    { icon: <BarChart3 className="w-5 h-5" />, label: "Report", path: "reports" },
  ];

  return (
    <aside className="w-20 bg-white border-r border-border flex flex-col items-center py-6 space-y-8">
      {/* Logo */}
      <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
        <UtensilsCrossed className="w-6 h-6 text-white" />
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col space-y-6">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => onViewChange(item.path)}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors",
              currentView === item.path
                ? "bg-orange-500 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            {item.icon}
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Logout at bottom */}
      {onLogout && (
        <button
          onClick={onLogout}
          className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600 hover:bg-red-100 transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      )}
    </aside>
  );
}
