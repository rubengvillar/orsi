-- OPTIMIZATION LOGS & PDF STORAGE
-- -----------------------------------------------------------------------------

create table if not exists public.optimization_logs (
  id uuid primary key default uuid_generate_v4(),
  glass_type_id uuid references public.glass_types(id) on delete cascade,
  user_id uuid references auth.users(id),
  pdf_base64 text, -- Storing PDF as base64 for simplicity in DB
  metadata jsonb, -- { total_cuts, remnants_used, sheets_used, etc }
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.optimization_logs enable row level security;

create policy "Optimization logs viewable by authenticated" 
  on public.optimization_logs for select to authenticated using (true);

create policy "Optimization logs insertable by staff"
  on public.optimization_logs for insert to authenticated
  with check (public.has_role('Admin') or public.has_role('Storekeeper'));

-- Update existing execute_cut_confirmation if needed, or handle logs in UI
