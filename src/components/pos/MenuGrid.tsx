import React from "react";
import { useMenuStore } from "../../stores/menuStore";
import { useOrderStore } from "../../stores/orderStore";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { formatCurrency } from "../../lib/utils";
import { MenuItem } from "../../types";

export function MenuGrid() {
  const items = useMenuStore((state) => state.items);
  const selectedCategory = useMenuStore((state) => state.selectedCategory);
  const searchQuery = useMenuStore((state) => state.searchQuery);
  const addItem = useOrderStore((state) => state.addItem);

  // Compute filtered items from state
  const filteredItems = React.useMemo(() => {
    let filtered = items.filter((item) => item.active);

    if (selectedCategory) {
      filtered = filtered.filter(
        (item) => item.category_id === selectedCategory
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.dietary_tags?.some((tag) =>
            tag.toLowerCase().includes(query)
          )
      );
    }

    return filtered;
  }, [items, selectedCategory, searchQuery]);

  const handleItemClick = (item: MenuItem) => {
    addItem(item, 1);
  };

  if (filteredItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No menu items found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {filteredItems.map((item) => (
        <Card
          key={item.id}
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95"
          onClick={() => handleItemClick(item)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg line-clamp-2">{item.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {item.description}
            </p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-bold text-primary">
                {formatCurrency(item.price)}
              </span>
              <span className="text-xs text-muted-foreground">
                {item.preparation_time} min
              </span>
            </div>
            {item.dietary_tags && item.dietary_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.dietary_tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

