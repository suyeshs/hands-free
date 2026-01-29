# Restaurant Management System - Features & Workflows

## 📋 Complete Features List

### 1. Core POS & Order Management
- Multi-channel order processing (Dine-in, Pickup, Delivery, QR Guest Orders)
- Shopping cart with modifiers and customizations
- Combo meal configuration with multiple groups
- Table management with occupancy tracking
- Pickup order management (concurrent orders: P1, P2...)
- Payment processing (Cash, Card, UPI, Swiggy, Zomato coupons)
- Bill printing and reprinting
- Voice ordering integration
- AI assistant for order taking

### 2. Kitchen Display System (KDS)
- Station-based order routing
- Real-time order status tracking (pending, in-progress, ready, served)
- Order age tracking with visual timers
- Out-of-stock marking
- Dark theme optimized for kitchen environment
- Mobile/tablet responsive layout
- Active and historical order views

### 3. Menu Management
- Table-based menu editor with search and filtering
- Category management with icons
- Rich item attributes (dietary tags, allergens, spice level, preparation time)
- Combo/bundle meal configuration
- Image upload (Cloudflare integration)
- Today's Specials feature
- Dine-in pricing overrides
- Active/inactive item toggle
- Availability scheduling

### 4. Multi-Platform Aggregator Integration
- Swiggy order extraction and management
- Zomato order extraction and management
- Website orders dashboard
- Auto-acceptance settings
- Multi-channel order overview
- Real-time status synchronization

### 5. HR & Staff Management
- Staff profiles with role-based access (Manager, Server, Kitchen, Aggregator)
- PIN authentication
- Attendance tracking (clock in/out, break management)
- Shift management (regular, overtime, weekend, holiday)
- Leave management (requests, approvals, balance tracking)
- Roster/scheduling system
- Late arrival and overtime calculation

### 6. Inventory Management
- Complete inventory item tracking (SKU, category, units)
- Supplier management with contact details
- Stock level monitoring with low-stock alerts
- Expiry date tracking
- Stock adjustments (waste, returns, transfers)
- AI-powered bill scanning with OCR (Gemini, DeepSeek, Cloudflare AI)
- Supplier-specific OCR templates
- Delivery verification workflow
- Audit trail for all transactions

### 7. Analytics & Reporting
- Daily sales report with payment breakdown
- Hourly sales visualization
- Top-selling items analysis
- Transaction list with export (CSV, Excel)
- Cash register reconciliation
- Payout tracking and categorization
- Order analytics by channel
- Average wait times and delay tracking

### 8. Floor Plan & Table Management
- Visual floor plan editor with drag-and-drop
- Multiple sections/zones
- Table capacity configuration
- QR code generation per table
- Real-time table status visualization

### 9. QR-Based Guest Ordering
- Mobile-responsive menu for guests
- QR code scanning for tableside ordering
- Cart management for guests
- Order status tracking
- "Call Waiter" button
- Session management per table

### 10. Hardware & Device Management
- Device mode configuration (Owner, Kitchen, Server, Aggregator)
- LAN printer discovery (mDNS)
- Remote print server integration
- Multiple printer assignment to stations
- KOT printing and bill printing
- Device locking

### 11. Customer Management
- Phone-based customer identification
- Customer profiles with order history
- Bulk CSV import
- Customer notes and preferences

### 12. Real-Time Features
- WebSocket integration for live updates
- Multi-device synchronization
- Real-time order status across all screens
- Service request notifications
- Audio/visual alerts

### 13. System Administration
- Multi-tenant architecture
- Tenant activation and provisioning
- Database backup and archiving
- System diagnostics
- Migration system
- Offline-first with cloud sync

### 14. Training & Onboarding
- Training mode with guided walkthrough
- Business setup wizard
- Menu upload wizard
- Printer configuration wizard
- Phone verification
- Voice AI training

---

## 🔄 Restaurant Management Workflow Diagrams

### 1. Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     RESTAURANT MANAGEMENT SYSTEM                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   Hub    │  │   POS    │  │   KDS    │  │ Manager  │        │
│  │Dashboard │  │Dashboard │  │ Display  │  │ Dashboard│        │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘        │
│        │             │              │              │             │
│        └─────────────┴──────────────┴──────────────┘             │
│                             │                                     │
│                    ┌────────┴────────┐                           │
│                    │  CORE SERVICES  │                           │
│                    │   WebSocket     │                           │
│                    │   Order Sync    │                           │
│                    │   Menu Sync     │                           │
│                    └────────┬────────┘                           │
│                             │                                     │
│        ┌────────────────────┼────────────────────┐               │
│        │                    │                    │               │
│   ┌────▼─────┐      ┌──────▼─────┐      ┌──────▼─────┐         │
│   │  Local   │      │   Cloud    │      │  External  │         │
│   │ SQLite   │◄────►│  Backend   │◄────►│  Services  │         │
│   │   DB     │      │ (D1/API)   │      │  (Swiggy,  │         │
│   └──────────┘      └────────────┘      │   Zomato)  │         │
│                                          └────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Complete Order Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORDER LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────┘

ORDER SOURCES:
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Dine-In  │  │ Pickup   │  │  Swiggy  │  │  Zomato  │  │ Website/ │
│  (POS)   │  │  (POS)   │  │(Platform)│  │(Platform)│  │QR Orders │
└─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘
      │             │              │              │              │
      └─────────────┴──────────────┴──────────────┴──────────────┘
                                   │
                          ┌────────▼────────┐
                          │  ORDER CREATED  │
                          │   (Draft/New)   │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │  GENERATE KOT   │
                          │ (Kitchen Ticket)│
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
           ┌────────▼────────┐         ┌─────────▼────────┐
           │  ROUTE TO KDS   │         │  PRINT KOT TO    │
           │   BY STATION    │         │  STATION PRINTER │
           └────────┬────────┘         └──────────────────┘
                    │
           ┌────────▼────────┐
           │  KITCHEN STAFF  │
           │  VIEW ON KDS    │
           └────────┬────────┘
                    │
           ┌────────▼────────┐
           │  ITEM STATUS:   │
           │  Pending ───►   │
           │  In Progress ──►│
           │  Ready ───►     │
           │  Served         │
           └────────┬────────┘
                    │
           ┌────────▼────────┐
           │  ALL ITEMS      │
           │  COMPLETED      │
           └────────┬────────┘
                    │
     ┌──────────────┴──────────────┐
     │                             │
┌────▼─────┐              ┌────────▼────────┐
│ DINE-IN: │              │ DELIVERY/PICKUP:│
│ Generate │              │ Mark Ready for  │
│  Bill    │              │ Pickup/Delivery │
└────┬─────┘              └────────┬────────┘
     │                             │
┌────▼─────┐              ┌────────▼────────┐
│ Payment  │              │  Driver/Guest   │
│ Process  │              │  Collection     │
└────┬─────┘              └────────┬────────┘
     │                             │
     └──────────────┬──────────────┘
                    │
           ┌────────▼────────┐
           │ ORDER COMPLETED │
           │   & ARCHIVED    │
           └─────────────────┘
```

---

### 3. Dine-In Workflow (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DINE-IN SERVICE WORKFLOW                      │
└─────────────────────────────────────────────────────────────────┘

GUEST ARRIVAL:
┌──────────────┐
│ Guest Enters │
│  Restaurant  │
└──────┬───────┘
       │
┌──────▼───────┐
│ Host/Server  │
│ Assigns Table│
└──────┬───────┘
       │
┌──────▼───────────┐
│  Server Opens    │
│  POS Dashboard   │
│  Selects Table   │
└──────┬───────────┘
       │
┌──────▼───────────┐
│   Browse Menu    │
│   Add Items to   │
│   Cart with      │
│   Modifiers      │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Submit Order    │
│  (KOT Generated) │
└──────┬───────────┘
       │
       ├────────────────────────────┐
       │                            │
┌──────▼──────┐           ┌─────────▼────────┐
│  Order Sent │           │  KOT Printed     │
│  to Kitchen │           │  at Kitchen      │
│     KDS     │           │  Station Printer │
└──────┬──────┘           └──────────────────┘
       │
┌──────▼───────────┐
│ Kitchen Prepares │
│  Items (Status   │
│  Updates on KDS) │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Items Ready     │
│  (Server Alert)  │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Server Delivers │
│  Food to Table   │
│  (Mark Served)   │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Requests  │
│  Bill (Optional  │
│  Additional      │
│  Orders)         │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Generate Bill   │
│  Print Invoice   │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Pays      │
│  (Cash/Card/UPI) │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Close Table     │
│  Session in POS  │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Table Becomes   │
│  Available for   │
│  Next Guest      │
└──────────────────┘
```

---

### 4. Delivery/Aggregator Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              DELIVERY PLATFORM INTEGRATION WORKFLOW              │
└─────────────────────────────────────────────────────────────────┘

SWIGGY/ZOMATO PLATFORM:
┌──────────────┐
│ Customer     │
│ Places Order │
│ on Platform  │
└──────┬───────┘
       │
┌──────▼───────────┐
│  Platform Sends  │
│  Order to        │
│  Restaurant      │
└──────┬───────────┘
       │
┌──────▼───────────────┐
│ Order Auto-Extracted │
│ by Aggregator Poller │
│ Service              │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│ Order Appears in     │
│ Aggregator Dashboard │
│ (Pending Status)     │
└──────┬───────────────┘
       │
       ├──────────────────┐
       │                  │
┌──────▼──────┐    ┌──────▼──────────┐
│ AUTO-ACCEPT │    │ MANUAL ACCEPT/  │
│  (if set)   │    │ REJECT DECISION │
└──────┬──────┘    └──────┬──────────┘
       │                  │
       └─────────┬────────┘
                 │
       ┌─────────▼────────┐
       │  Order Accepted  │
       │  Status: CONFIRM │
       └─────────┬────────┘
                 │
       ┌─────────▼────────┐
       │  Auto-Send KOT   │
       │  to Kitchen KDS  │
       └─────────┬────────┘
                 │
       ┌─────────▼────────┐
       │ Kitchen Prepares │
       │ Status: PREPARING│
       └─────────┬────────┘
                 │
       ┌─────────▼────────┐
       │  Food Ready      │
       │  Status: READY   │
       │  (Platform       │
       │   Notified)      │
       └─────────┬────────┘
                 │
       ┌─────────▼────────┐
       │ Delivery Partner │
       │ Picks Up         │
       │ Status: PICKED_UP│
       └─────────┬────────┘
                 │
       ┌─────────▼────────┐
       │ Order Delivered  │
       │ to Customer      │
       │ Status: DELIVERED│
       └─────────┬────────┘
                 │
       ┌─────────▼────────┐
       │ Order Archived   │
       │ (Move to History)│
       └──────────────────┘

TIMING ALERTS:
┌─────────────────┐
│ < 10 min: ✅    │
│ 10-15 min: ⚠️   │
│ 15-20 min: 🚨   │
│ > 20 min: 💥    │
└─────────────────┘
```

---

### 5. QR Guest Ordering Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                  QR-BASED GUEST ORDERING                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ Guest Scans  │
│  QR Code at  │
│    Table     │
└──────┬───────┘
       │
┌──────▼───────────┐
│  Mobile Browser  │
│  Opens Guest     │
│  Ordering Page   │
│  (Table Session) │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Browses   │
│  Menu (Filters,  │
│  Search, Images) │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Adds      │
│  Items to Cart   │
│  (with Mods)     │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Reviews   │
│  Cart & Places   │
│  Order           │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Order Submitted │
│  to Restaurant   │
│  (Linked to      │
│   Table Session) │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  KOT Generated   │
│  & Sent to       │
│  Kitchen KDS     │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Sees      │
│  "Order          │
│  Confirmed"      │
│  Screen          │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Can Track │
│  Order Status    │
│  or Call Waiter  │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Kitchen Prepares│
│  Food (Status    │
│  Updates in      │
│  Real-Time)      │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Server Delivers │
│  Food to Table   │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Guest Requests  │
│  Bill via QR or  │
│  Calls Server    │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Payment &       │
│  Table Close     │
└──────────────────┘
```

---

### 6. Menu Management Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MENU MANAGEMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────────┘

INITIAL SETUP:
┌──────────────┐
│   Manager    │
│   Accesses   │
│ Admin Portal │
└──────┬───────┘
       │
┌──────▼───────────┐
│   Navigate to    │
│   Menu Section   │
└──────┬───────────┘
       │
       ├────────────────────────────┐
       │                            │
┌──────▼──────┐          ┌──────────▼─────────┐
│  CATEGORIES │          │   MENU ITEMS       │
└──────┬──────┘          └──────────┬─────────┘
       │                            │
┌──────▼──────────┐       ┌─────────▼──────────┐
│ Create Category │       │ Create/Edit Item:  │
│ - Name          │       │ - Name             │
│ - Icon          │       │ - Description      │
│ - Sort Order    │       │ - Price            │
└─────────────────┘       │ - Category         │
                          │ - Prep Time        │
                          │ - Dietary Tags     │
                          │ - Allergens        │
                          │ - Image Upload     │
                          │ - Variants/Mods    │
                          │ - Availability     │
                          └─────────┬──────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Save to Cloud DB  │
                          │      (D1)          │
                          └─────────┬──────────┘
                                    │
                          ┌─────────▼──────────┐
                          │ Sync to Local DB   │
                          │    (SQLite)        │
                          └─────────┬──────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Menu Available    │
                          │  on All Devices    │
                          │  (POS, KDS, QR)    │
                          └────────────────────┘

COMBO MANAGEMENT:
┌──────────────┐
│ Create Combo │
│   Item       │
└──────┬───────┘
       │
┌──────▼───────────┐
│  Define Groups   │
│  (e.g., "Main",  │
│  "Side", "Drink")│
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Add Items to    │
│  Each Group with │
│  Price Adjust.   │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Set Min/Max     │
│  Selection Rules │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Save & Sync     │
└──────────────────┘

IMAGE MANAGEMENT:
┌──────────────┐
│ Bulk Upload  │
│  Photos      │
└──────┬───────┘
       │
┌──────▼───────────┐
│  AI Matches      │
│  Photos to Menu  │
│  Items (Image    │
│  Recognition)    │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Manual Review   │
│  & Assignment    │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Images Stored   │
│  on Cloudflare   │
└──────────────────┘
```

---

### 7. Inventory & Bill Scanning Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              INVENTORY MANAGEMENT & BILL SCANNING                │
└─────────────────────────────────────────────────────────────────┘

SUPPLIER DELIVERY:
┌──────────────┐
│  Supplier    │
│  Delivers    │
│  Goods       │
└──────┬───────┘
       │
┌──────▼───────────┐
│ Staff Receives   │
│ Delivery with    │
│ Invoice/Bill     │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Open BillScan   │
│  Page in App     │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Scan Bill Using │
│  Native Camera   │
│  or Upload Image │
└──────┬───────────┘
       │
┌──────▼───────────────┐
│  AI OCR Processing:  │
│  - Gemini            │
│  - DeepSeek          │
│  - Cloudflare AI     │
│  (Supplier Template) │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Extract Data:       │
│  - Supplier          │
│  - Invoice #         │
│  - Date              │
│  - Items (Name, Qty, │
│    Unit, Price)      │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Display Extracted   │
│  Data for Manual     │
│  Review/Correction   │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Match Items to      │
│  Inventory DB or     │
│  Create New Items    │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Update Stock Levels │
│  in Inventory System │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Save Invoice Record │
│  & Audit Trail       │
└──────────────────────┘

INVENTORY ALERTS:
┌─────────────────────┐
│ Low Stock Alert     │
│ (Auto-notify when   │
│  below threshold)   │
└──────┬──────────────┘
       │
┌──────▼──────────────┐
│ Expiry Date Alert   │
│ (7-day warning)     │
└──────┬──────────────┘
       │
┌──────▼──────────────┐
│ Manager Reviews &   │
│ Creates Purchase    │
│ Order               │
└─────────────────────┘
```

---

### 8. Staff Attendance & HR Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              STAFF ATTENDANCE & HR WORKFLOW                      │
└─────────────────────────────────────────────────────────────────┘

SHIFT START:
┌──────────────┐
│  Staff       │
│  Arrives     │
└──────┬───────┘
       │
┌──────▼───────────┐
│  Open App &      │
│  Enter PIN       │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Navigate to     │
│  Attendance      │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  CLOCK IN        │
│  (Timestamp +    │
│   Location)      │
└──────┬───────────┘
       │
┌──────▼───────────────┐
│  System Calculates:  │
│  - Late Arrival?     │
│  - Shift Type        │
│    (Regular/OT/      │
│     Weekend/Holiday) │
└──────┬───────────────┘
       │
┌──────▼───────────┐
│  Staff Status:   │
│  ACTIVE ON SHIFT │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  During Shift:   │
│  Clock In/Out    │
│  for Breaks      │
│  (Meal, Rest)    │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  CLOCK OUT       │
│  at Shift End    │
└──────┬───────────┘
       │
┌──────▼───────────────┐
│  System Calculates:  │
│  - Total Hours       │
│  - Regular Hours     │
│  - Overtime Hours    │
│  - Break Duration    │
│  - Early Departure?  │
└──────┬───────────────┘
       │
┌──────▼───────────┐
│  Attendance      │
│  Record Saved    │
│  (Manager Review)│
└──────────────────┘

LEAVE MANAGEMENT:
┌──────────────┐
│  Staff       │
│  Requests    │
│  Leave       │
└──────┬───────┘
       │
┌──────▼───────────┐
│  Select:         │
│  - Leave Type    │
│  - Date Range    │
│  - Reason        │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Submit to       │
│  Manager         │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Manager Reviews │
│  & Approves/     │
│  Rejects         │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Staff Notified  │
│  Leave Balance   │
│  Updated         │
└──────────────────┘

ROSTER MANAGEMENT:
┌──────────────┐
│  Manager     │
│  Creates     │
│  Weekly      │
│  Roster      │
└──────┬───────┘
       │
┌──────▼───────────┐
│  Assign Staff    │
│  to Shifts with  │
│  Roles & Times   │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  Staff Can View  │
│  Their Schedule  │
│  in App          │
└──────┬───────────┘
       │
┌──────▼───────────┐
│  System Tracks   │
│  Actual vs       │
│  Scheduled Time  │
└──────────────────┘
```

---

### 9. Analytics & Reporting Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                  ANALYTICS & REPORTING WORKFLOW                  │
└─────────────────────────────────────────────────────────────────┘

DAILY OPERATIONS:
┌──────────────┐
│  All Day:    │
│  Orders,     │
│  Payments,   │
│  Transactions│
└──────┬───────┘
       │
┌──────▼───────────────┐
│  Real-Time Data      │
│  Collection:         │
│  - Order details     │
│  - Payment methods   │
│  - Item quantities   │
│  - Timestamps        │
│  - Order channels    │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Data Stored in:     │
│  - Local SQLite      │
│  - Cloud Backend     │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  End of Day:         │
│  Manager Opens       │
│  Daily Sales Report  │
└──────┬───────────────┘
       │
┌──────▼───────────────────┐
│  Report Displays:        │
│  ┌──────────────────┐    │
│  │ SUMMARY METRICS  │    │
│  │ - Total Sales    │    │
│  │ - Order Count    │    │
│  │ - Avg Order Val  │    │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ PAYMENT BREAKDOWN│    │
│  │ - Cash: ₹X       │    │
│  │ - Card: ₹Y       │    │
│  │ - UPI: ₹Z        │    │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ HOURLY SALES     │    │
│  │ (Bar Chart)      │    │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ TOP ITEMS        │    │
│  │ (Ranked List)    │    │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ ORDER CHANNELS   │    │
│  │ (Pie Chart)      │    │
│  └──────────────────┘    │
└──────┬───────────────────┘
       │
┌──────▼───────────────┐
│  Cash Reconciliation:│
│  - Opening Cash      │
│  - Sales Cash        │
│  - Payouts           │
│  - Expected Closing  │
│  - Actual Closing    │
│  - Variance          │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Export Options:     │
│  - CSV               │
│  - Excel             │
│  - Print PDF         │
└──────────────────────┘

INVENTORY REPORTING:
┌──────────────┐
│  Manager     │
│  Reviews     │
│  Inventory   │
└──────┬───────┘
       │
┌──────▼───────────────┐
│  Report Shows:       │
│  - Current Stock     │
│  - Low Stock Items   │
│  - Expiring Soon     │
│  - Stock Movement    │
│  - Supplier Spend    │
└──────┬───────────────┘
       │
┌──────▼───────────────┐
│  Take Actions:       │
│  - Reorder Items     │
│  - Adjust Pricing    │
│  - Contact Suppliers │
└──────────────────────┘
```

---

### 10. Multi-Device Synchronization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              REAL-TIME MULTI-DEVICE SYNC WORKFLOW                │
└─────────────────────────────────────────────────────────────────┘

DEVICES:
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  POS       │  │ Kitchen    │  │ Manager    │  │ Aggregator │
│  Tablet 1  │  │ KDS        │  │ Dashboard  │  │ Station    │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │               │
      └───────────────┴───────────────┴───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   WEBSOCKET       │
                    │   REAL-TIME       │
                    │   CONNECTION      │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   CLOUD BACKEND   │
                    │   (HandsFree API) │
                    └─────────┬─────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      │                       │                       │
┌─────▼──────┐      ┌─────────▼────────┐   ┌─────────▼─────────┐
│  ORDER     │      │  MENU SYNC       │   │  INVENTORY SYNC   │
│  EVENTS    │      │  EVENTS          │   │  EVENTS           │
└─────┬──────┘      └─────────┬────────┘   └─────────┬─────────┘
      │                       │                       │
      │ • New Order           │ • Item Added          │ • Stock Updated
      │ • Status Change       │ • Price Changed       │ • Low Stock
      │ • Item Ready          │ • Item Disabled       │ • Expiring
      │ • Order Complete      │ • Category Changed    │
      │                       │                       │
      └───────────────────────┴───────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   ALL DEVICES     │
                    │   AUTO-UPDATE     │
                    │   IN REAL-TIME    │
                    └───────────────────┘

SYNC PROCESS:
┌──────────────┐
│ Action on    │
│ Any Device   │
└──────┬───────┘
       │
┌──────▼───────────┐
│ Update Local     │
│ SQLite DB        │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Send Update to   │
│ Cloud Backend    │
│ (API Call)       │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Cloud Broadcasts │
│ via WebSocket    │
│ to All Devices   │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Other Devices    │
│ Receive Event &  │
│ Update Local DB  │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ UI Auto-Refreshes│
│ with New Data    │
└──────────────────┘

OFFLINE MODE:
┌──────────────┐
│ Connection   │
│ Lost         │
└──────┬───────┘
       │
┌──────▼───────────┐
│ Device Continues │
│ Working with     │
│ Local SQLite     │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Queue Changes    │
│ for Sync         │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Connection       │
│ Restored         │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Auto-Sync Queued │
│ Changes to Cloud │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Broadcast to     │
│ Other Devices    │
└──────────────────┘
```

---

### 11. System Setup & Provisioning Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              RESTAURANT ONBOARDING & SETUP                       │
└─────────────────────────────────────────────────────────────────┘

INITIAL SETUP:
┌──────────────┐
│ New Customer │
│ Signs Up     │
└──────┬───────┘
       │
┌──────▼───────────┐
│ Tenant Creation  │
│ in Backend       │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Phone Number     │
│ Verification     │
│ (OTP)            │
└──────┬───────────┘
       │
┌──────▼───────────────┐
│ SETUP WIZARD STARTS  │
└──────┬───────────────┘
       │
┌──────▼───────────┐
│ STEP 1:          │
│ Business Details │
│ - Name           │
│ - Address        │
│ - Contact        │
│ - Logo Upload    │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ STEP 2:          │
│ Menu Upload      │
│ - Bulk CSV       │
│ - Manual Entry   │
│ - Categories     │
│ - Items          │
│ - Pricing        │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ STEP 3:          │
│ Image Upload     │
│ - Bulk Photos    │
│ - AI Matching    │
│ - Manual Assign  │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ STEP 4:          │
│ Floor Plan       │
│ - Add Sections   │
│ - Add Tables     │
│ - Assign QR      │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ STEP 5:          │
│ Printer Setup    │
│ - Discover LAN   │
│ - Remote Server  │
│ - Test Print     │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ STEP 6:          │
│ Staff Setup      │
│ - Add Manager    │
│ - Add Servers    │
│ - Add Kitchen    │
│ - Assign PINs    │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ STEP 7:          │
│ Device Config    │
│ - Set Device Mode│
│ - Assign Stations│
│ - Lock Settings  │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ STEP 8:          │
│ Test & Validate  │
│ - Place Test Ord │
│ - Print Test KOT │
│ - Check Sync     │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ SETUP COMPLETE   │
│ System Ready for │
│ Live Operations  │
└──────────────────┘

TRAINING MODE:
┌──────────────┐
│ Enable       │
│ Training Mode│
└──────┬───────┘
       │
┌──────▼───────────┐
│ Interactive      │
│ Walkthrough:     │
│ - Create Order   │
│ - Manage Tables  │
│ - Use KDS        │
│ - Handle Payment │
│ - Run Reports    │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Staff Practices  │
│ with Sample Data │
└──────┬───────────┘
       │
┌──────▼───────────┐
│ Training Complete│
│ Clear Sample Data│
│ Go Live          │
└──────────────────┘
```

---

## 🔑 Key Integration Points

### External Services
- **HandsFree Cloud API** - Backend data sync, tenant management
- **Cloudflare Images** - Menu item photos and asset storage
- **Gemini AI** - OCR for bill scanning
- **DeepSeek AI** - Alternative OCR provider
- **Cloudflare AI** - Additional OCR processing
- **Swiggy Platform** - Order extraction API
- **Zomato Platform** - Order extraction API

### Internal Services
- **WebSocket Server** - Real-time order and status updates
- **Order Polling Service** - Background aggregator order fetching
- **Menu Sync Service** - Cloud-to-local menu synchronization
- **Print Server** - Remote printing infrastructure
- **mDNS Discovery** - Local network printer detection

### Database Architecture
```
┌──────────────┐         ┌──────────────┐
│  CLOUD (D1)  │◄───────►│LOCAL (SQLite)│
│              │  Sync   │              │
│ - Orders     │         │ - Orders     │
│ - Menu       │         │ - Menu       │
│ - Staff      │         │ - Staff      │
│ - Inventory  │         │ - Inventory  │
│ - Analytics  │         │ - Cache      │
└──────────────┘         └──────────────┘
```

---

## 📱 Supported Platforms

- **Desktop** - Tauri native app (Windows, macOS, Linux)
- **Web** - Browser-based access
- **Tablet** - iPad, Android tablets (optimized UI)
- **Mobile** - Responsive mobile web (guest ordering)

---

## 🔐 Security Features

- PIN-based staff authentication
- Role-based access control (RBAC)
- Passcode-protected critical actions (edit/delete)
- Session management
- Tenant data isolation
- Encrypted data transmission
- Audit trail logging

---

## 🎯 Target Users

1. **Restaurant Owners/Managers** - Full system access, reporting, configuration
2. **Front-of-House Staff (Servers)** - POS, table management, order taking
3. **Kitchen Staff** - KDS display, order status updates
4. **Aggregator Staff** - Delivery platform order management
5. **Guests** - QR-based ordering, minimal interface

---

