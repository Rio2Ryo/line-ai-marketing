-- schema-v18: RBAC (Role-Based Access Control)
-- Add role column to users table
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';

-- Note: Default 'admin' because all existing users are admins.
-- New users created via LINE Login will get 'operator' by default (set in auth callback).
-- Available roles: 'admin', 'operator', 'viewer'
