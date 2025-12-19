import { Search, Wifi, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";

interface TopBarProps {
  onSelectTable?: () => void;
  selectedTable?: number | null;
}

export function TopBar({ onSelectTable, selectedTable }: TopBarProps) {
  return (
    <div className="bg-white border-b border-border px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        {/* Left: Title and Search */}
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-2xl font-bold">Restro POS</h1>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <Wifi className="w-5 h-5 text-gray-600" />
          </button>
          <Button
            onClick={onSelectTable}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6"
          >
            {selectedTable ? `Table ${selectedTable}` : "Select Table"}
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2">
        {["Starters", "Breakfast", "Lunch", "Supper", "Deserts", "Beverages"].map((category, index) => (
          <button
            key={category}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              index === 2
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
