-- Remove demo users for security
-- These hardcoded credentials should not exist in production

-- Update to use staff_users table instead of non-existent users table
DELETE FROM staff_users WHERE id IN ('user-1', 'user-2', 'user-3', 'demo-user-1', 'demo-user-2');
