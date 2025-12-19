import { Sparkles, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useAIStore } from "../../stores/aiStore";
import { useOrderStore } from "../../stores/orderStore";
import { formatCurrency } from "../../lib/utils";

export function AIAssistant() {
  const recommendations = useAIStore((state) => state.recommendations);
  const addItem = useOrderStore((state) => state.addItem);

  // Mock recommendations for demo
  const demoRecommendations = [
    {
      type: "upsell" as const,
      item: {
        id: "demo-1",
        name: "Sweet Potato Fries",
        price: 4.99,
        description: "Crispy sweet potato fries",
        category_id: "cat-appetizers",
        active: true,
        preparation_time: 12,
      },
      confidence: 0.89,
      reason: "Pairs well with burgers (85% of customers order this combo)",
    },
    {
      type: "suggestion" as const,
      item: {
        id: "demo-2",
        name: "Iced Tea",
        price: 2.99,
        description: "Freshly brewed iced tea",
        category_id: "cat-beverages",
        active: true,
        preparation_time: 2,
      },
      confidence: 0.76,
      reason: "Popular choice for lunch time orders",
    },
  ];

  const displayRecommendations = recommendations.length > 0 ? recommendations : demoRecommendations;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {displayRecommendations.map((rec, idx) => (
            <Card key={idx} className="border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold">{rec.item.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(rec.item.price)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      rec.type === "upsell"
                        ? "default"
                        : rec.type === "cross-sell"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {rec.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {rec.reason}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addItem(rec.item)}
                    className="flex-1"
                  >
                    Add to Order
                  </Button>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(rec.confidence * 100)}% match
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="pt-4 border-t space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Quick Insights
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Average prep time: 18 minutes</span>
            </div>
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs">
              💡 Lunch rush starting soon. Consider suggesting quick items.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

