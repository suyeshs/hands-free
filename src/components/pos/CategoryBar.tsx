import { useMenuStore } from "../../stores/menuStore";
import { Button } from "../ui/button";

export function CategoryBar() {
  const categories = useMenuStore((state) => state.categories);
  const selectedCategory = useMenuStore((state) => state.selectedCategory);
  const setSelectedCategory = useMenuStore(
    (state) => state.setSelectedCategory
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <Button
        variant={selectedCategory === null ? "default" : "outline"}
        onClick={() => setSelectedCategory(null)}
        size="lg"
      >
        All Items
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selectedCategory === category.id ? "default" : "outline"}
          onClick={() => setSelectedCategory(category.id)}
          size="lg"
          className="whitespace-nowrap"
        >
          {category.icon && <span className="mr-2">{category.icon}</span>}
          {category.name}
        </Button>
      ))}
    </div>
  );
}

