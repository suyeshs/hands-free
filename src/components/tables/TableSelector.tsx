import { useState } from "react";
import { X, Users } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface Table {
  id: string;
  number: number;
  capacity: number;
  section: string;
  status: "available" | "occupied" | "reserved" | "cleaning";
}

const availableTables: Table[] = [
  { id: "table-1", number: 1, capacity: 2, section: "Main", status: "available" },
  { id: "table-5", number: 5, capacity: 2, section: "Patio", status: "available" },
  { id: "table-9", number: 9, capacity: 2, section: "Main", status: "available" },
];

interface TableSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: (table: Table) => void;
}

export function TableSelector({ isOpen, onClose, onSelectTable }: TableSelectorProps) {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [guestCount, setGuestCount] = useState(2);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedTable) {
      onSelectTable(selectedTable);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Select Table</h2>
            <p className="text-gray-600 text-sm mt-1">Choose an available table for this order</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guest Count */}
        <div className="p-6 border-b border-gray-200">
          <label className="block text-sm font-medium mb-2">Number of Guests</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
              className="w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-100 font-semibold"
            >
              −
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
              <Users className="w-5 h-5 text-gray-600" />
              <span className="font-semibold">{guestCount}</span>
            </div>
            <button
              onClick={() => setGuestCount(guestCount + 1)}
              className="w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-100 font-semibold"
            >
              +
            </button>
          </div>
        </div>

        {/* Available Tables */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="font-semibold mb-4">Available Tables</h3>
          <div className="grid grid-cols-3 gap-4">
            {availableTables.map((table) => (
              <button
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all",
                  selectedTable?.id === table.id
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 bg-white hover:border-orange-300"
                )}
              >
                <div className="text-xl font-bold mb-2">Table {table.number}</div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{table.capacity} seats</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">{table.section}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTable}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          >
            Confirm Table {selectedTable?.number}
          </Button>
        </div>
      </div>
    </div>
  );
}
