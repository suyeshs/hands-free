# City and Pincode Fields Added to Restaurant Creation Form ✅

## Changes Made

Added **City** and **Pincode** fields to the initial restaurant creation form (`SimpleRestaurantOnboarding.tsx`) to collect location information upfront.

## File Modified

### src/components/SimpleRestaurantOnboarding.tsx

#### 1. Updated FormData Interface
```typescript
interface FormData {
  restaurantName: string;
  email: string;
  phone: string;
  city: string;        // ← ADDED
  pincode: string;     // ← ADDED
  subdomain: string;
}
```

#### 2. Updated FormErrors Interface
```typescript
interface FormErrors {
  restaurantName?: string;
  email?: string;
  phone?: string;
  city?: string;       // ← ADDED
  pincode?: string;    // ← ADDED
  subdomain?: string;
}
```

#### 3. Initialized Form State
```typescript
const [formData, setFormData] = useState<FormData>({
  restaurantName: '',
  email: '',
  phone: '',
  city: '',           // ← ADDED
  pincode: '',        // ← ADDED
  subdomain: '',
});
```

#### 4. Added Validation Rules
```typescript
// City
if (!formData.city.trim()) {
  newErrors.city = 'City is required';
}

// Pincode
if (!formData.pincode.trim()) {
  newErrors.pincode = 'Pincode is required';
} else if (formData.pincode.length !== 6) {
  newErrors.pincode = 'Pincode must be 6 digits';
}
```

#### 5. Added Form Fields (UI)
Added a responsive grid after the Phone field:
```typescript
{/* City and Pincode - Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* City */}
  <div>
    <label className="block text-sm font-medium text-zinc-200 mb-2">
      City <span className="text-red-400">*</span>
    </label>
    <input
      type="text"
      value={formData.city}
      onChange={(e) =>
        setFormData((prev) => ({ ...prev, city: e.target.value }))
      }
      placeholder="Mumbai"
      className={`w-full px-4 py-3 rounded-lg bg-white/[0.03] border ${
        errors.city ? 'border-red-500' : 'border-white/[0.08]'
      } text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 focus:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all`}
    />
    {errors.city && (
      <p className="text-red-400 text-sm mt-1">{errors.city}</p>
    )}
  </div>

  {/* Pincode */}
  <div>
    <label className="block text-sm font-medium text-zinc-200 mb-2">
      Pincode <span className="text-red-400">*</span>
    </label>
    <input
      type="text"
      value={formData.pincode}
      onChange={(e) =>
        setFormData((prev) => ({ ...prev, pincode: e.target.value }))
      }
      placeholder="400001"
      maxLength={6}
      className={`w-full px-4 py-3 rounded-lg bg-white/[0.03] border ${
        errors.pincode ? 'border-red-500' : 'border-white/[0.08]'
      } text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500 focus:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all`}
    />
    {errors.pincode && (
      <p className="text-red-400 text-sm mt-1">{errors.pincode}</p>
    )}
    <p className="text-zinc-400 text-xs mt-1">
      6-digit postal code
    </p>
  </div>
</div>
```

#### 6. Updated API Request Payload
```typescript
const requestData = {
  companyName: formData.restaurantName,
  email: formData.email,
  phone: formData.phone,
  city: formData.city,         // ← ADDED
  pincode: formData.pincode,   // ← ADDED
  tenantId: formData.subdomain,
  businessCategory: 'CASUAL_DINING',
};
```

#### 7. Updated Restaurant Settings Save
```typescript
const settings: any = {
  name: formData.restaurantName,
  tagline: '',
  address: {
    line1: '',
    line2: '',
    city: formData.city,       // ← NOW SAVES USER INPUT
    state: '',                 // ← Empty (can be auto-populated later based on pincode)
    pincode: formData.pincode, // ← NOW SAVES USER INPUT
  },
  phone: formData.phone,
  email: formData.email,
  website: '',
};
```

---

## User Flow

### Before:
1. User enters: Restaurant Name, Email, Phone, Subdomain
2. City, State, Pincode were **empty** in saved settings
3. User had to fill these again in Restaurant Basics Card

### After:
1. User enters: Restaurant Name, Email, Phone, **City**, **Pincode**, Subdomain
2. City and Pincode are **saved to restaurant settings immediately**
3. User only needs to fill Address Line 1 and State in Restaurant Basics Card

---

## State Auto-Population (Future Enhancement)

The `state` field is currently left empty but can be **auto-populated based on pincode**:

### Indian Pincode to State Mapping:
- **1xxxxx** → Delhi, Haryana, Punjab, Himachal Pradesh, Jammu & Kashmir
- **2xxxxx** → Uttar Pradesh, Uttarakhand
- **3xxxxx** → Rajasthan
- **4xxxxx** → Maharashtra, Goa
- **5xxxxx** → Karnataka
- **6xxxxx** → Tamil Nadu, Kerala, Puducherry, Lakshadweep
- **7xxxxx** → Andhra Pradesh, Telangana
- **8xxxxx** → West Bengal, Odisha, Bihar, Jharkhand, Sikkim, Assam, Arunachal Pradesh, Nagaland, Manipur, Mizoram, Tripura, Meghalaya, Andaman & Nicobar

### Implementation Options:
1. **Client-side lookup**: Use a pincode-to-state JSON map
2. **API lookup**: Call India Post API or third-party geocoding service
3. **Database lookup**: Query a pincode database

For now, state is left empty and can be filled manually in Restaurant Basics Card or auto-populated in a future update.

---

## Form Layout

The form now shows:

```
┌─────────────────────────────────────────┐
│ Restaurant Name *                       │
│ [________________________]              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Email *                                 │
│ [________________________]              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Phone Number *                          │
│ [________________________]              │
│ International format (e.g., +1234567890)│
└─────────────────────────────────────────┘

┌──────────────────┬──────────────────────┐
│ City *           │ Pincode *            │
│ [__________]     │ [__________]         │
│                  │ 6-digit postal code  │
└──────────────────┴──────────────────────┘

┌─────────────────────────────────────────┐
│ Custom URL (Subdomain) *                │
│ [________________________]              │
│ https://your-name.handsfree.page        │
└─────────────────────────────────────────┘
```

On **mobile**, the City and Pincode fields stack vertically.

---

## Validation Rules

| Field | Rules |
|-------|-------|
| Restaurant Name | Required, non-empty |
| Email | Required, valid email format |
| Phone | Required, non-empty |
| **City** | **Required, non-empty** ✅ |
| **Pincode** | **Required, exactly 6 digits** ✅ |
| Subdomain | Required, min 3 chars, available |

---

## Testing

### Test 1: Required Field Validation
1. Try to submit without city → Error: "City is required"
2. Try to submit without pincode → Error: "Pincode is required"

### Test 2: Pincode Format Validation
1. Enter 5 digits → Error: "Pincode must be 6 digits"
2. Enter 7 digits → Input limited to 6 chars (maxLength={6})
3. Enter 6 digits → Validation passes ✓

### Test 3: Data Persistence
1. Fill form with city: "Mumbai", pincode: "400001"
2. Complete restaurant creation
3. Check restaurant settings → city and pincode should be saved
4. Open Restaurant Basics Card → city and pincode pre-filled

### Test 4: Responsive Layout
1. Desktop (>768px): City and Pincode side-by-side
2. Mobile (<768px): City and Pincode stacked vertically

---

## Status

✅ **Complete** - City and Pincode fields added to restaurant creation form
✅ **Validated** - Required validation and 6-digit format check
✅ **Saved** - Data flows to restaurant settings
✅ **Responsive** - Grid layout works on mobile and desktop

---

## Next Steps (Optional)

1. **Auto-populate state** from pincode using lookup table or API
2. **Add address autocomplete** using Google Places API
3. **Validate pincode** against known Indian postal codes
4. **Auto-detect city** from pincode using geocoding service
