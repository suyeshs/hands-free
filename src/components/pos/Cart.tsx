import { useOrderStore } from "../../stores/orderStore";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { formatCurrency } from "../../lib/utils";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";

export function Cart() {
  const cartItems = useOrderStore((state) => state.cartItems);
  const updateQuantity = useOrderStore((state) => state.updateQuantity);
  const removeItem = useOrderStore((state) => state.removeItem);
  const clearCart = useOrderStore((state) => state.clearCart);
  const getCartTotal = useOrderStore((state) => state.getCartTotal);
  const getCartItemCount = useOrderStore((state) => state.getCartItemCount);

  const subtotal = getCartTotal();
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;
  const itemCount = getCartItemCount();

  if (cartItems.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Current Order
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
            <p>No items in cart</p>
            <p className="text-sm">Start adding items to create an order</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Current Order
          <Badge variant="secondary">{itemCount} items</Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearCart}
          className="text-destructive"
        >
          Clear All
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {cartItems.map((item) => (
            <div
              key={item.menu_item.id}
              className="flex gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">{item.menu_item.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(item.menu_item.price)}
                </p>
                {item.modifiers.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {item.modifiers.map((mod, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">
                        + {mod.name}: {mod.value}
                        {mod.price_adjustment > 0 &&
                          ` (+${formatCurrency(mod.price_adjustment)})`}
                      </p>
                    ))}
                  </div>
                )}
                {item.special_instructions && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Note: {item.special_instructions}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.menu_item.id)}
                  className="h-6 w-6"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      updateQuantity(item.menu_item.id, item.quantity - 1)
                    }
                    className="h-7 w-7"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-semibold">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      updateQuantity(item.menu_item.id, item.quantity + 1)
                    }
                    className="h-7 w-7"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax (10%)</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <Button className="w-full" size="lg">
            Complete Order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

