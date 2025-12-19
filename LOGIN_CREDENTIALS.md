# 🔐 Login Credentials Guide

This document provides login credentials for testing and development of the Restaurant POS AI system.

## 📋 Table of Contents
- [Backend Setup Required](#backend-setup-required)
- [Email/Password Login](#emailpassword-login)
- [PIN Login](#pin-login)
- [User Roles & Permissions](#user-roles--permissions)
- [Testing Scenarios](#testing-scenarios)

---

## ⚠️ Backend Setup Required

The Restaurant POS AI system connects to a backend API for authentication and data management.

**Backend API Endpoint**:
```
Default: http://localhost:3001/api
Configure via: VITE_BACKEND_API_URL in .env.local
```

> **Note**: You need to have the backend server running with test users created before you can log in. The credentials below assume a standard backend setup with demo users.

---

## 👤 Email/Password Login

Use these credentials for the standard login screen (Manager, Admin, POS roles).

### Manager Account
```
Email: manager@restaurant.com
Password: manager123
Role: manager
Tenant ID: tenant-001

Features:
✅ Full dashboard access
✅ Analytics & reports
✅ Settings management
✅ View all orders
✅ Aggregator management
✅ Kitchen display system
```

### Admin Account
```
Email: admin@restaurant.com
Password: admin123
Role: admin
Tenant ID: tenant-001

Features:
✅ All Manager features
✅ User management
✅ System configuration
✅ Multi-tenant access
✅ Menu management
✅ Advanced settings
```

### POS Staff Account
```
Email: cashier@restaurant.com
Password: cashier123
Role: pos
Tenant ID: tenant-001

Features:
✅ POS interface
✅ Order creation
✅ Cart management
✅ Voice ordering
✅ Basic order viewing
⛔ No analytics access
⛔ No settings access
```

### Kitchen Staff Account
```
Email: kitchen@restaurant.com
Password: kitchen123
Role: kitchen
Tenant ID: tenant-001

Features:
✅ Kitchen Display System (KDS)
✅ Order status updates
✅ Item-level controls
✅ Station filtering
✅ KOT printing
⛔ No POS access
⛔ No analytics access
```

### Aggregator Account
```
Email: aggregator@restaurant.com
Password: aggregator123
Role: aggregator
Tenant ID: tenant-001

Features:
✅ Aggregator dashboard
✅ Zomato/Swiggy orders
✅ Accept/reject orders
✅ Order status updates
⛔ No POS access
⛔ Limited analytics
```

---

## 🔢 PIN Login

Use PIN login for quick access on POS terminals (typically for cashier/kitchen staff).

### Format
```javascript
{
  tenantId: "tenant-001",
  pin: "1234",
  deviceId: "pos-terminal-01" // Optional
}
```

### Example PIN Credentials

#### Cashier Terminal
```
Tenant ID: tenant-001
PIN: 1234
Role: pos
Name: POS Cashier 1
```

#### Cashier Terminal 2
```
Tenant ID: tenant-001
PIN: 2345
Role: pos
Name: POS Cashier 2
```

#### Kitchen Terminal
```
Tenant ID: tenant-001
PIN: 3456
Role: kitchen
Name: Kitchen Staff 1
```

#### Kitchen Terminal 2
```
Tenant ID: tenant-001
PIN: 4567
Role: kitchen
Name: Kitchen Staff 2
```

#### Manager Quick Access
```
Tenant ID: tenant-001
PIN: 9999
Role: manager
Name: Manager (Quick PIN)
```

---

## 👥 User Roles & Permissions

### Admin
**Highest level access**
- User management (create, edit, delete users)
- System configuration
- Multi-tenant management
- All manager permissions

### Manager
**Restaurant management**
- Dashboard and analytics
- Order management
- Kitchen display system
- Aggregator orders
- Settings and configuration
- Reports and exports
- Menu management (future)

### POS
**Point of Sale operations**
- Create orders
- Modify cart
- Voice ordering
- View current orders
- Basic order history
- No access to analytics or settings

### Kitchen
**Kitchen operations**
- Kitchen Display System (KDS)
- Update order status
- Mark items ready
- Complete orders
- Print KOTs
- Station filtering
- No access to POS or analytics

### Aggregator
**Third-party order management**
- View incoming aggregator orders
- Accept/reject orders
- Update order status
- Manage Zomato/Swiggy orders
- Limited analytics
- No access to POS

---

## 🧪 Testing Scenarios

### Scenario 1: Manager Dashboard
```
Login: manager@restaurant.com / manager123
Navigate to: Manager Dashboard
Features to test:
- View overview stats
- Check Analytics & Reports tab
- Export data (CSV/JSON)
- Configure settings
- Toggle printer settings
```

### Scenario 2: POS Order Flow
```
Login: cashier@restaurant.com / cashier123
OR PIN: tenant-001 / 1234
Navigate to: POS
Features to test:
- Add items to cart
- Use voice ordering
- Apply modifiers
- Create order
- View order history
```

### Scenario 3: Kitchen Operations
```
Login: kitchen@restaurant.com / kitchen123
OR PIN: tenant-001 / 3456
Navigate to: Kitchen Dashboard
Features to test:
- View active orders
- Filter by station (grill, wok, fryer, etc.)
- Mark items as in-progress
- Mark items as ready
- Complete orders
- Print KOTs
```

### Scenario 4: Aggregator Management
```
Login: aggregator@restaurant.com / aggregator123
Navigate to: Aggregator Dashboard
Features to test:
- View new orders
- Accept orders
- Reject orders
- Mark preparing
- Mark ready
- WebSocket live updates
```

### Scenario 5: Multi-User Testing
```
User 1: Manager (manager@restaurant.com)
User 2: POS (PIN: 1234)
User 3: Kitchen (PIN: 3456)

Flow:
1. Manager checks dashboard stats
2. POS creates new order
3. Kitchen receives order, updates status
4. Manager views updated analytics
```

---

## 🔧 Creating Test Users

If you need to create additional test users in your backend, use this structure:

### Email/Password User
```json
{
  "email": "newuser@restaurant.com",
  "password": "password123",
  "name": "New User",
  "role": "pos",
  "tenantId": "tenant-001"
}
```

### PIN User
```json
{
  "pin": "5678",
  "name": "Terminal User",
  "role": "kitchen",
  "tenantId": "tenant-001",
  "deviceId": "kitchen-terminal-03"
}
```

---

## 🚨 Security Notes

### Development Environment
- These are **demo credentials** for testing purposes only
- **DO NOT** use these credentials in production
- Change all default passwords before deployment

### Production Environment
- Implement strong password policies
- Use secure PIN codes (6+ digits)
- Enable two-factor authentication (2FA)
- Implement session timeout
- Use HTTPS for all API calls
- Rotate credentials regularly

### Best Practices
- Each staff member should have unique credentials
- PINs should be 4-6 digits minimum
- Passwords should be 8+ characters with mixed case and numbers
- Never share credentials between users
- Log all authentication attempts
- Implement rate limiting on login attempts

---

## 🔄 Password Reset

To reset a password (backend implementation required):

```typescript
// API endpoint
POST /api/auth/reset-password

// Request body
{
  "email": "user@restaurant.com",
  "newPassword": "newpassword123"
}
```

---

## 📞 Support

If you encounter login issues:

1. **Verify backend is running**: Check `http://localhost:3001/api/health`
2. **Check credentials**: Ensure email/password or PIN is correct
3. **Verify tenant ID**: Ensure the tenant exists in the database
4. **Check browser console**: Look for authentication errors
5. **Review backend logs**: Check API server logs for errors

---

## 📝 Quick Reference Card

Print and keep this near your POS terminals:

```
┌──────────────────────────────────────────┐
│   RESTAURANT POS - QUICK LOGIN GUIDE     │
├──────────────────────────────────────────┤
│                                          │
│  MANAGER                                 │
│  Email: manager@restaurant.com           │
│  Pass: manager123                        │
│                                          │
│  CASHIER (POS)                           │
│  Tenant: tenant-001                      │
│  PIN: 1234                               │
│                                          │
│  KITCHEN                                 │
│  Tenant: tenant-001                      │
│  PIN: 3456                               │
│                                          │
│  Support: Check LOGIN_CREDENTIALS.md     │
└──────────────────────────────────────────┘
```

---

**Last Updated**: November 26, 2025
**Version**: 1.0.0
**Backend Compatibility**: v1.0+
