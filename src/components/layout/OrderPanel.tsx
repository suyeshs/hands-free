import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  discount?: number;
}

const mockOrderItems: OrderItem[] = [
  { id: 1, name: "Schezwan Egg Noodles", price: 25.0, quantity: 1 },
  { id: 2, name: "Spicy Shrimp Soup", price: 40.0, quantity: 1, discount: 20 },
  { id: 3, name: "Thai Style Fried Noodles", price: 40.0, quantity: 1 },
  { id: 4, name: "Fried Basil", price: 75.0, quantity: 1 },
];

export function OrderPanel() {
  const subtotal = 200.0;
  const tax = 45.0;
  const total = 195.0;

  return (
    <div className="w-96 bg-white border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              <Plus className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mockOrderItems.map((item, index) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{index + 1}</span>
                <span className="font-medium">{item.name}</span>
                <button className="ml-auto">
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </div>
              {item.discount && (
                <span className="text-xs text-gray-500">
                  Discount {item.discount}%
                </span>
              )}
            </div>
            <span className="font-semibold">${item.price.toFixed(2)}</span>
          </div>
        ))}

        {/* Selected Item Detail */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="font-medium mb-3">Thai Style Fried Noodles</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-gray-500">Quantity</label>
              <input
                type="number"
                defaultValue={1}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Discount(%)</label>
              <input
                type="number"
                defaultValue={20}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            <button className="flex-1 py-2 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50">
              Add
            </button>
            <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              Discount
            </button>
            <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              Coupon Code
            </button>
            <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              Note
            </button>
          </div>
        </div>
      </div>

      {/* Total Section */}
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-semibold">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax</span>
          <span className="font-semibold">${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
          <span>Payable Amount</span>
          <span className="text-orange-500">${total.toFixed(2)}</span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Button
            variant="outline"
            className="border-orange-500 text-orange-500 hover:bg-orange-50"
          >
            Hold Order
          </Button>
          <Button className="bg-green-500 hover:bg-green-600 text-white">
            Proceed
          </Button>
        </div>
      </div>
    </div>
  );
}

function RefreshCw({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function LayoutGrid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}
