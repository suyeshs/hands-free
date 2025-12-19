import { useState } from "react";
import { TableGrid } from "./TableGrid";
import { Users, Clock, DollarSign, X } from "lucide-react";
import { Button } from "../ui/button";

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

export function TableManagement() {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const handleTableSelect = (table: Table) => {
    setSelectedTable(table);
  };

  const handleCloseTable = () => {
    // Logic to close/clear table
    setSelectedTable(null);
  };

  const handleAssignTable = () => {
    // Logic to assign table to a new order
    console.log("Assigning table:", selectedTable);
  };

  return (
    <div className="flex h-full">
      {/* Table Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Table Management</h1>
          <p className="text-gray-600">Manage restaurant seating and table status</p>
        </div>
        <TableGrid onTableSelect={handleTableSelect} />
      </div>

      {/* Table Details Sidebar */}
      {selectedTable && (
        <div className="w-96 bg-white border-l border-gray-200 p-6 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Table {selectedTable.number}</h2>
            <button
              onClick={() => setSelectedTable(null)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Table Info */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Section</span>
              <span className="font-semibold">{selectedTable.section}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Capacity</span>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="font-semibold">{selectedTable.capacity} seats</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Status</span>
              <span className="font-semibold capitalize">{selectedTable.status}</span>
            </div>
          </div>

          {/* Status-specific Actions */}
          {selectedTable.status === "available" && (
            <div className="space-y-3">
              <Button onClick={handleAssignTable} className="w-full bg-orange-500 hover:bg-orange-600">
                Assign to New Order
              </Button>
              <Button variant="outline" className="w-full">
                Reserve Table
              </Button>
            </div>
          )}

          {selectedTable.status === "occupied" && (
            <div className="space-y-4 flex-1">
              {/* Current Order Details */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold mb-3">Current Order</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-orange-600" />
                    <span>{selectedTable.guest_count} guests</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span>Duration: {selectedTable.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-orange-600" />
                    <span>Bill: $125.50</span>
                  </div>
                </div>
              </div>

              {/* Server Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Server</div>
                <div className="font-semibold">{selectedTable.server_name}</div>
              </div>

              {/* Actions */}
              <div className="space-y-2 mt-auto">
                <Button className="w-full bg-blue-500 hover:bg-blue-600">
                  View Order Details
                </Button>
                <Button variant="outline" className="w-full">
                  Transfer Table
                </Button>
                <Button variant="outline" className="w-full">
                  Split Bill
                </Button>
                <Button onClick={handleCloseTable} className="w-full bg-green-500 hover:bg-green-600">
                  Close Table
                </Button>
              </div>
            </div>
          )}

          {selectedTable.status === "reserved" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold mb-2">Reservation Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time</span>
                    <span className="font-medium">{selectedTable.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Party Size</span>
                    <span className="font-medium">{selectedTable.guest_count} guests</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name</span>
                    <span className="font-medium">John Smith</span>
                  </div>
                </div>
              </div>

              <Button className="w-full bg-orange-500 hover:bg-orange-600">
                Seat Guests
              </Button>
              <Button variant="outline" className="w-full">
                Cancel Reservation
              </Button>
            </div>
          )}

          {selectedTable.status === "cleaning" && (
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-gray-600">Table is currently being cleaned</p>
              </div>
              <Button className="w-full bg-green-500 hover:bg-green-600">
                Mark as Clean
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
