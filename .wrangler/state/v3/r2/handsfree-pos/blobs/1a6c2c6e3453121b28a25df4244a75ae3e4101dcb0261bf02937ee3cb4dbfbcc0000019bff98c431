-- Combo Filter Keywords
-- Store customizable filter keywords for quick-add combo features
CREATE TABLE IF NOT EXISTS combo_filter_keywords (
    id TEXT PRIMARY KEY,
    filter_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    emoji TEXT,
    keywords TEXT NOT NULL, -- JSON array of keywords
    color_class TEXT, -- Tailwind color class for UI
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed default filter keywords (matching existing hard-coded values)
INSERT OR REPLACE INTO combo_filter_keywords (id, filter_key, display_name, emoji, keywords, color_class, sort_order) VALUES
    ('filter-rice', 'rice', 'Rice', '🍚', '["rice", "biryani", "pulao", "fried rice", "jeera rice", "steamed rice", "veg rice", "chicken rice", "mutton rice"]', 'amber', 1),
    ('filter-puttu-otti', 'puttu-otti', 'Puttu/Otti', '🥞', '["puttu", "otti", "appam", "idiyappam", "pathiri", "kadala", "steamed cake"]', 'purple', 2),
    ('filter-roti', 'roti', 'Roti/Naan', '🫓', '["roti", "naan", "paratha", "chapati", "kulcha", "bread", "tandoori roti", "butter naan", "garlic naan", "laccha paratha", "rumali roti"]', 'orange', 3),
    ('filter-dal', 'dal', 'Dal', '🥣', '["dal", "daal", "lentil"]', 'yellow', 4),
    ('filter-curry', 'curry', 'Curry', '🍛', '["curry", "gravy", "masala", "sabzi", "kadhi"]', 'red', 5),
    ('filter-sides', 'sides', 'Sides', '🥗', '["raita", "papad", "papadum", "papadam", "pappadam", "papputtu", "pickle", "chutney", "salad", "achar", "yogurt", "curd"]', 'green', 6);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_combo_filter_keywords_active ON combo_filter_keywords(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_combo_filter_keywords_key ON combo_filter_keywords(filter_key);
