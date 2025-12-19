import { Users, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

interface Table {
  id: string;
  number: number;
  capacity: number;
  section: string;
  status: "available" | "occupied" | "reserved" | "cleaning";
  position_x: number;
  position_y: number;
  current_order_id?: string;
  guest_count?: number;
  server_name?: string;
  duration?: string;
}

const mockTables: Table[] = [
  { id: "table-1", number: 1, capacity: 2, section: "Main", status: "available", position_x: 50, position_y: 50 },
  { id: "table-2", number: 2, capacity: 4, section: "Main", status: "occupied", position_x: 200, position_y: 50, guest_count: 3, server_name: "John", duration: "00:45" },
  { id: "table-3", number: 3, capacity: 4, section: "Main", status: "occupied", position_x: 350, position_y: 50, guest_count: 4, server_name: "Jane", duration: "01:20" },
  { id: "table-4", number: 4, capacity: 6, section: "Main", status: "reserved", position_x: 50, position_y: 200, guest_count: 6, duration: "19:00" },
  { id: "table-5", number: 5, capacity: 2, section: "Patio", status: "available", position_x: 200, position_y: 200 },
  { id: "table-6", number: 6, capacity: 4, section: "Patio", status: "cleaning", position_x: 350, position_y: 200 },
  { id: "table-7", number: 7, capacity: 8, section: "Private", status: "reserved", position_x: 50, position_y: 350, guest_count: 8, duration: "20:00" },
  { id: "table-8", number: 8, capacity: 4, section: "Main", status: "occupied", position_x: 200, position_y: 350, guest_count: 2, server_name: "Mike", duration: "00:15" },
  { id: "table-9", number: 9, capacity: 2, section: "Main", status: "available", position_x: 350, position_y: 350 },
];

const statusColors = {
  available: "bg-green-500",
  occupied: "bg-orange-500",
  reserved: "bg-blue-500",
  cleaning: "bg-gray-400",
};

const statusLabels = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
};

interface TableGridProps {
  onTableSelect?: (table: Table) => void;
}

export function TableGrid({ onTableSelect }: TableGridProps) {
  return (
    <div className="space-y-6">
      {/* Status Legend */}
      <div className="flex gap-4">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded-full", color)} />
            <span className="text-sm text-gray-600">
              {statusLabels[status as keyof typeof statusLabels]}
            </span>
          </div>
        ))}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {["All", "Main", "Patio", "Private"].map((section) => (
          <button
            key={section}
            className={cn(
              "px-4 py-2 font-medium transition-colors",
              section === "All"
                ? "text-orange-500 border-b-2 border-orange-500"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {section}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-3 gap-4">
        {mockTables.map((table) => (
          <button
            key={table.id}
            onClick={() => onTableSelect?.(table)}
            className={cn(
              "relative p-6 rounded-xl border-2 transition-all hover:shadow-lg",
              table.status === "available" && "border-green-200 bg-green-50 hover:border-green-400",
              table.status === "occupied" && "border-orange-200 bg-orange-50 hover:border-orange-400",
              table.status === "reserved" && "border-blue-200 bg-blue-50 hover:border-blue-400",
              table.status === "cleaning" && "border-gray-200 bg-gray-50 hover:border-gray-400"
            )}
          >
            {/* Status Indicator */}
            <div className={cn("absolute top-2 right-2 w-3 h-3 rounded-full", statusColors[table.status])} />

            {/* Table Number */}
            <div className="text-2xl font-bold mb-2">Table {table.number}</div>

            {/* Capacity */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Users className="w-4 h-4" />
              <span>{table.capacity} seats</span>
            </div>

            {/* Status Details */}
            {table.status === "occupied" && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-orange-600" />
                  <span className="text-gray-700">{table.guest_count} guests</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-gray-700">{table.duration}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">Server: {table.server_name}</div>
              </div>
            )}

            {table.status === "reserved" && (
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Clock className="w-4 h-4" />
                <span>Reserved at {table.duration}</span>
              </div>
            )}

            {table.status === "cleaning" && (
              <div className="text-sm text-gray-500">Being cleaned</div>
            )}

            {table.status === "available" && (
              <div className="text-sm font-medium text-green-700">Ready to seat</div>
            )}

            {/* Section Tag */}
            <div className="absolute bottom-2 left-2 text-xs text-gray-400">{table.section}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
