-- 1. Create Teams Table
CREATE TABLE public.teams (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    color text DEFAULT '#3b82f6', -- Blue default
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create Team Members Table (Junction)
CREATE TABLE public.team_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    operator_id uuid REFERENCES public.operators(id) ON DELETE CASCADE,
    role text DEFAULT 'Member', -- 'Leader', 'Member'
    joined_at timestamptz DEFAULT now(),
    UNIQUE(team_id, operator_id)
);

-- 3. Link Toolboxes to Teams
ALTER TABLE public.toolboxes 
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- 4. RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams viewable" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teams manageable" ON public.teams FOR ALL TO authenticated USING (public.has_permission('admin:users:manage') OR public.has_permission('logistics:manage'));

CREATE POLICY "Team members viewable" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team members manageable" ON public.team_members FOR ALL TO authenticated USING (public.has_permission('admin:users:manage') OR public.has_permission('logistics:manage'));

-- 5. Permissions (Optional, using existing logistics/admin mostly)
INSERT INTO public.permissions (code, description) VALUES
    ('teams:view', 'Can view teams'),
    ('teams:manage', 'Can manage teams')
ON CONFLICT (code) DO NOTHING;
