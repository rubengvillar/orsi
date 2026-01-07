-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ROLES & PERMISSIONS
create table roles (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  description text
);

create table permissions (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null, -- e.g., 'inventory.read', 'users.manage'
  description text
);

create table role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- INVENTORY TABLES

-- Aluminum Accessories
create table aluminum_accessories (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  description text not null,
  quantity integer default 0,
  min_stock integer default 0,
  created_at timestamptz default now()
);

-- Aluminum Profiles
create table aluminum_profiles (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  typology text, -- e.g., 'Modena', 'A30'
  color text,
  description text,
  quantity integer default 0, -- Count of bars
  length_mm integer default 6000, -- Standard length
  min_stock integer default 0,
  created_at timestamptz default now()
);

-- Glass Types (The distinct products)
create table glass_types (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  thickness_mm text not null,
  color text,
  description text,
  min_stock_sheets integer default 0,
  created_at timestamptz default now()
);

-- Glass Stock (Full Sheets)
create table glass_sheets (
  id uuid primary key default uuid_generate_v4(),
  glass_type_id uuid references glass_types(id) on delete cascade,
  quantity integer default 0,
  created_at timestamptz default now()
);

-- Glass Remnants (Rezagos)
create table glass_remnants (
  id uuid primary key default uuid_generate_v4(),
  glass_type_id uuid references glass_types(id) on delete cascade,
  width_mm integer not null,
  height_mm integer not null,
  quantity integer default 1,
  location text, -- Shelf/Rack ID
  created_at timestamptz default now()
);

-- Glass Accessories
create table glass_accessories (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  description text not null,
  quantity integer default 0,
  min_stock integer default 0,
  created_at timestamptz default now()
);

-- SEED DATA
-- Default Roles
insert into roles (name, description) values
  ('Admin', 'Full access to everything'),
  ('Developer', 'Maintenance and debugging'),
  ('Storekeeper', 'Manage stock only'),
  ('Sales', 'View stock and create orders'),
  ('Purchasing', 'View stock and alerts'),
  ('Director', 'View reports'),
  ('TableChief', 'Production management');

-- Default Permissions (Samples)
insert into permissions (code, description) values
  ('inventory.read', 'View inventory levels'),
  ('inventory.write', 'Modify inventory levels'),
  ('users.manage', 'Create and assign roles to users'),
  ('roles.manage', 'Create and modify roles');

-- Assign 'inventory.read' to everyone (Conceptually - needed logic in app or trigger) 
-- Assign all to Admin
WITH admin_role AS (SELECT id FROM roles WHERE name = 'Admin'),
     all_perms AS (SELECT id FROM permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT admin_role.id, all_perms.id FROM admin_role, all_perms;

-- RLS (Basic setup - secure by default)
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table aluminum_accessories enable row level security;
alter table aluminum_profiles enable row level security;
alter table glass_types enable row level security;
alter table glass_sheets enable row level security;
alter table glass_remnants enable row level security;
alter table glass_accessories enable row level security;

-- Public Read Policy (for simplicity in MVP, or restrict to authenticated)
create policy "Allow read access for authenticated users" on roles for select using (auth.role() = 'authenticated');
create policy "Allow read access for authenticated users" on aluminum_accessories for select using (auth.role() = 'authenticated');
-- Add similar policies for others...

