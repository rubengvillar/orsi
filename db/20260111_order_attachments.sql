-- Create the storage bucket for order attachments if it doesn't exist
insert into storage.buckets (id, name, public)
values ('order_attachments', 'order_attachments', true)
on conflict (id) do nothing;

-- Create table to track attachments
create table public.order_attachments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  file_type text, -- 'image/png', 'application/pdf', etc.
  file_size integer,
  uploaded_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.order_attachments enable row level security;

-- Policies for order_attachments table
create policy "Attachments viewable by authenticated users"
  on public.order_attachments for select
  to authenticated
  using (true);

create policy "Attachments insertable by authenticated users"
  on public.order_attachments for insert
  to authenticated
  with check (true);

create policy "Attachments deletable by authenticated users"
  on public.order_attachments for delete
  to authenticated
  using (true); -- Ideally restrict to owner or admin, but for now open to authenticated

-- Storage Policies (using storage.objects)
create policy "Give users access to own folder 1oj01k_0" on storage.objects for select to authenticated using (bucket_id = 'order_attachments'); 
create policy "Give users access to own folder 1oj01k_1" on storage.objects for insert to authenticated with check (bucket_id = 'order_attachments');
create policy "Give users access to own folder 1oj01k_2" on storage.objects for update to authenticated using (bucket_id = 'order_attachments');
create policy "Give users access to own folder 1oj01k_3" on storage.objects for delete to authenticated using (bucket_id = 'order_attachments');
