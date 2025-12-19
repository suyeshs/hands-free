import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { useMenuStore } from "../../stores/menuStore";
import { debounce } from "../../lib/utils";
import { useCallback } from "react";

export function SearchBar() {
  const searchQuery = useMenuStore((state) => state.searchQuery);
  const setSearchQuery = useMenuStore((state) => state.setSearchQuery);

  const debouncedSetSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
    }, 300),
    [setSearchQuery]
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        type="text"
        placeholder="Search menu items (try: 'spicy chicken' or 'vegetarian under $15')"
        className="pl-10 h-12 text-base"
        defaultValue={searchQuery}
        onChange={(e) => debouncedSetSearch(e.target.value)}
      />
    </div>
  );
}

