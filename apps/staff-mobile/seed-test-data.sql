-- Test Data Seeding Script for HandsFree Staff Mobile App
-- Creates sample staff users for testing device registration and authentication

-- Clear existing test data (optional - comment out if you want to keep existing data)
-- DELETE FROM device_registrations;
-- DELETE FROM attendance_records;
-- DELETE FROM staff_users WHERE tenant_id = 'test-tenant-001';

-- Insert test tenant (if using multi-tenant setup)
-- Note: PIN hashes below are for testing only
-- Production PINs should be hashed using the hash_staff_pin Rust command

-- Test Staff Users
-- All test PINs are "1234" (hashed using Argon2)
-- In production, use the hash_staff_pin command to generate proper hashes

INSERT OR IGNORE INTO staff_users (
  id,
  tenant_id,
  name,
  role,
  pin_hash,
  email,
  phone,
  is_active,
  permissions,
  created_at,
  last_login_at,
  created_by,
  photo_url,
  preferred_language
) VALUES
  (
    'staff-001',
    'test-tenant-001',
    'John Doe',
    'waiter',
    '$argon2id$v=19$m=19456,t=2,p=1$WwLzjJqGqnLKjJ+vRq2u6A$YourHashHere',
    'john.doe@example.com',
    '+1234567890',
    1,
    '{"can_clock_in":true,"can_view_payroll":true,"can_request_advance":true}',
    strftime('%s', 'now') * 1000,
    NULL,
    'admin',
    NULL,
    'en'
  ),
  (
    'staff-002',
    'test-tenant-001',
    'Jane Smith',
    'cashier',
    '$argon2id$v=19$m=19456,t=2,p=1$WwLzjJqGqnLKjJ+vRq2u6A$YourHashHere',
    'jane.smith@example.com',
    '+1234567891',
    1,
    '{"can_clock_in":true,"can_view_payroll":true,"can_request_advance":true}',
    strftime('%s', 'now') * 1000,
    NULL,
    'admin',
    NULL,
    'en'
  ),
  (
    'staff-003',
    'test-tenant-001',
    'Mike Johnson',
    'kitchen',
    '$argon2id$v=19$m=19456,t=2,p=1$WwLzjJqGqnLKjJ+vRq2u6A$YourHashHere',
    'mike.johnson@example.com',
    '+1234567892',
    1,
    '{"can_clock_in":true,"can_view_payroll":true}',
    strftime('%s', 'now') * 1000,
    NULL,
    'admin',
    NULL,
    'en'
  ),
  (
    'staff-004',
    'test-tenant-001',
    'Sarah Williams',
    'manager',
    '$argon2id$v=19$m=19456,t=2,p=1$WwLzjJqGqnLKjJ+vRq2u6A$YourHashHere',
    'sarah.williams@example.com',
    '+1234567893',
    1,
    '{"can_clock_in":true,"can_view_payroll":true,"can_request_advance":true,"can_manage_staff":true,"can_view_reports":true}',
    strftime('%s', 'now') * 1000,
    NULL,
    'admin',
    NULL,
    'en'
  );

-- Insert test salary records
INSERT OR IGNORE INTO staff_salary (
  id,
  staff_id,
  base_salary,
  hourly_rate,
  overtime_rate,
  salary_type,
  effective_from,
  effective_to,
  created_at,
  updated_at
) VALUES
  (
    'salary-001',
    'staff-001',
    25000,
    150,
    225,
    'monthly',
    date('now', 'start of month'),
    NULL,
    datetime('now'),
    datetime('now')
  ),
  (
    'salary-002',
    'staff-002',
    28000,
    170,
    255,
    'monthly',
    date('now', 'start of month'),
    NULL,
    datetime('now'),
    datetime('now')
  ),
  (
    'salary-003',
    'staff-003',
    22000,
    130,
    195,
    'monthly',
    date('now', 'start of month'),
    NULL,
    datetime('now'),
    datetime('now')
  ),
  (
    'salary-004',
    'staff-004',
    45000,
    270,
    405,
    'monthly',
    date('now', 'start of month'),
    NULL,
    datetime('now'),
    datetime('now')
  );

-- Insert sample attendance records for testing
INSERT OR IGNORE INTO attendance_records (
  id,
  tenant_id,
  staff_id,
  clock_in_at,
  clock_out_at,
  shift_date,
  shift_type,
  total_hours,
  regular_hours,
  overtime_hours,
  status,
  clock_in_method,
  created_at,
  updated_at
) VALUES
  -- Yesterday's completed shift
  (
    'attendance-001',
    'test-tenant-001',
    'staff-001',
    strftime('%s', 'now', '-1 day', 'start of day', '+9 hours') * 1000,
    strftime('%s', 'now', '-1 day', 'start of day', '+17 hours') * 1000,
    date('now', '-1 day'),
    'regular',
    8.0,
    8.0,
    0.0,
    'completed',
    'biometric',
    strftime('%s', 'now', '-1 day') * 1000,
    strftime('%s', 'now', '-1 day') * 1000
  );

-- Print success message
SELECT 'Test data seeded successfully!' as message;
SELECT COUNT(*) as staff_count FROM staff_users WHERE tenant_id = 'test-tenant-001';
SELECT COUNT(*) as salary_count FROM staff_salary;
SELECT COUNT(*) as attendance_count FROM attendance_records;

-- Display test users
SELECT
  id,
  name,
  role,
  email,
  is_active,
  'PIN: 1234 (for testing only)' as test_pin
FROM staff_users
WHERE tenant_id = 'test-tenant-001'
ORDER BY name;
