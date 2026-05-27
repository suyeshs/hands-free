/**
 * Test Script: Tunnel Slug Generation
 * Tests the slug generation logic for restaurant URLs
 */

function generateRestaurantSlug(restaurantName) {
  return restaurantName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Test cases
const testCases = [
  {
    input: "Mahesh's Dhaba & Grill!",
    expected: "maheshs-dhaba-grill",
    description: "Special characters and apostrophes"
  },
  {
    input: "  Café  Délice  ",
    expected: "caf-dlice",
    description: "Accented characters and extra spaces"
  },
  {
    input: "123 Main Street Bistro",
    expected: "123-main-street-bistro",
    description: "Numbers and spaces"
  },
  {
    input: "The-Best-Restaurant",
    expected: "the-best-restaurant",
    description: "Already has hyphens"
  },
  {
    input: "Restaurant!!!",
    expected: "restaurant",
    description: "Multiple special chars at end"
  },
  {
    input: "A&B    Café",
    expected: "ab-caf",
    description: "Multiple spaces and ampersand"
  },
  {
    input: "---Test---",
    expected: "test",
    description: "Leading and trailing hyphens"
  },
  {
    input: "Coorg Food Company",
    expected: "coorg-food-company",
    description: "Simple case"
  },
  {
    input: "McDonald's",
    expected: "mcdonalds",
    description: "Possessive apostrophe"
  },
  {
    input: "Pizza Hut #42",
    expected: "pizza-hut-42",
    description: "Hash symbol and number"
  }
];

console.log("🧪 Testing Tunnel Slug Generation\n");
console.log("=".repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = generateRestaurantSlug(test.input);
  const isPass = result === test.expected;

  if (isPass) {
    passed++;
    console.log(`✅ Test ${index + 1}: PASSED`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: FAILED`);
  }

  console.log(`   Input:    "${test.input}"`);
  console.log(`   Expected: "${test.expected}"`);
  console.log(`   Got:      "${result}"`);
  console.log(`   Desc:     ${test.description}`);

  if (!isPass) {
    console.log(`   ⚠️  MISMATCH!`);
  }

  console.log("");
});

console.log("=".repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log("✅ All tests passed! Slug generation working correctly.\n");
  process.exit(0);
} else {
  console.log("❌ Some tests failed. Review the implementation.\n");
  process.exit(1);
}
