create table public.incident_report (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  company_id uuid not null references company(id) on delete cascade,
  site_id uuid references site(id),
  employee_id uuid references employee(id),
  shift_id uuid references shift(id),

  cad_number text unique,
  report_month text,

  incident_type text not null,
  occurred_at timestamp with time zone not null,
  location_detail text,
  subject_name text,
  subject_description text,
  narrative text not null,
  injuries boolean default false,
  injury_detail text,
  property_damage boolean default false,
  damage_detail text,
  weapons_involved boolean default false,
  weapons_detail text,
  police_notified boolean default false,
  police_report_number text,
  witnesses text,
  evidence text,

  status text not null default 'draft'
    check (status in ('draft','submitted','reviewed','approved','void')),
  submitted_at timestamp with time zone,
  submitted_by uuid references employee(id),
  reviewed_by uuid references employee(id),
  reviewed_at timestamp with time zone,
  reviewer_notes text,
  approved_by uuid references employee(id),
  approved_at timestamp with time zone,
  voided_by uuid references employee(id),
  voided_at timestamp with time zone,
  void_reason text,
  retain_until date
);

create table public.cad_sequence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company(id) on delete cascade,
  report_month text not null,
  last_number integer not null default 0,
  unique(company_id, report_month)
);

alter table incident_report enable row level security;
alter table cad_sequence enable row level security;

grant select, insert, update on incident_report to authenticated;
grant select, insert, update on cad_sequence to authenticated;

create policy "ir_read_company" on incident_report for select
using (company_id = (select company_id from user_profile where id = auth.uid()));

create policy "ir_insert_company" on incident_report for insert
with check (company_id = (select company_id from user_profile where id = auth.uid()));

create policy "ir_update_company" on incident_report for update
using (company_id = (select company_id from user_profile where id = auth.uid()));

create policy "cad_all" on cad_sequence for all
using (company_id = (select company_id from user_profile where id = auth.uid()));