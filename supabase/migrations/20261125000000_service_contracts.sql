-- Applied manually to production on 2026-11-25. Do not re-run against production.

CREATE OR REPLACE FUNCTION public.tax_rate_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.company_id, NEW.jurisdiction_code, NEW.rate_bps, NEW.effective_date) IS DISTINCT FROM (OLD.company_id, OLD.jurisdiction_code, OLD.rate_bps, OLD.effective_date) THEN
    RAISE EXCEPTION 'To change a tax rate, add a new rate with a new effective date.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.confirmed_at IS NOT NULL AND (NEW.confirmed_at, NEW.confirmed_by) IS DISTINCT FROM (OLD.confirmed_at, OLD.confirmed_by) THEN
    RAISE EXCEPTION 'A confirmed tax rate cannot be changed or un-confirmed. Add a new rate instead.';
  END IF;
  IF NEW.confirmed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.confirmed_at IS NULL) THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'A tax rate can only be confirmed by a signed-in admin.';
    END IF;
    NEW.confirmed_by := auth.uid();
    NEW.confirmed_at := now();
  END IF;
  IF NEW.confirmed_at IS NULL THEN
    NEW.confirmed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE client ADD COLUMN IF NOT EXISTS legal_name text, ADD COLUMN IF NOT EXISTS entity_type text, ADD COLUMN IF NOT EXISTS entity_jurisdiction text, ADD COLUMN IF NOT EXISTS notice_address text, ADD COLUMN IF NOT EXISTS is_tax_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE client_contact ADD COLUMN IF NOT EXISTS is_site_contact boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS is_billing_contact boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.contracts_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_contracts(p_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_profile WHERE id = auth.uid() AND company_id = p_company AND role IN ('chief', 'super_admin', 'accounting'));
$$;

CREATE OR REPLACE FUNCTION public.is_contract_admin(p_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_profile WHERE id = auth.uid() AND company_id = p_company AND role IN ('chief', 'super_admin'));
$$;

CREATE TABLE contract_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  name text NOT NULL,
  jurisdiction_code text NOT NULL CHECK (jurisdiction_code ~ '^[A-Z]{2}$'),
  service_type text NOT NULL CHECK (service_type IN ('unarmed', 'armed')),
  version integer NOT NULL CHECK (version > 0),
  body_markdown text NOT NULL,
  merge_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  fixed_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, jurisdiction_code, service_type, version),
  CHECK (NOT is_active OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX contract_template_one_active_idx ON contract_template (company_id, jurisdiction_code, service_type) WHERE is_active;

CREATE TABLE company_contract_setting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  jurisdiction_code text NOT NULL CHECK (jurisdiction_code ~ '^[A-Z]{2}$'),
  legal_name text NOT NULL,
  license_required boolean NOT NULL DEFAULT true,
  license_number text,
  license_authority text,
  license_note text,
  notice_address text,
  signer_name text,
  signer_title text,
  ops_contact_name text,
  ops_contact_email text,
  ops_contact_phone text,
  billing_contact_name text,
  billing_contact_email text,
  billing_contact_phone text,
  deposit_weeks_standard integer NOT NULL DEFAULT 2 CHECK (deposit_weeks_standard > 0),
  deposit_weeks_post_suspension integer NOT NULL DEFAULT 4 CHECK (deposit_weeks_post_suspension > 0),
  late_fee_min_cents integer NOT NULL DEFAULT 5000 CHECK (late_fee_min_cents >= 0),
  late_fee_rate_bps integer NOT NULL DEFAULT 150 CHECK (late_fee_rate_bps BETWEEN 0 AND 10000),
  late_fee_interval_days integer NOT NULL DEFAULT 30 CHECK (late_fee_interval_days > 0),
  returned_payment_fee_cents integer NOT NULL DEFAULT 3500 CHECK (returned_payment_fee_cents >= 0),
  reinstatement_fee_cents integer CHECK (reinstatement_fee_cents >= 0),
  placement_fee_cents integer CHECK (placement_fee_cents >= 0),
  early_termination_pct_bps integer NOT NULL DEFAULT 5000 CHECK (early_termination_pct_bps BETWEEN 0 AND 10000),
  holiday_multiplier numeric(4,2) NOT NULL DEFAULT 1.50 CHECK (holiday_multiplier >= 1),
  minimum_shift_hours numeric(4,2) NOT NULL DEFAULT 4 CHECK (minimum_shift_hours >= 0),
  short_notice_rate_cents integer CHECK (short_notice_rate_cents >= 0),
  crime_coverage_limit_cents bigint CHECK (crime_coverage_limit_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, jurisdiction_code)
);

CREATE TABLE tax_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  jurisdiction_code text NOT NULL CHECK (jurisdiction_code ~ '^[A-Z]{2}$'),
  rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  effective_date date NOT NULL,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, jurisdiction_code, effective_date),
  CHECK ((confirmed_at IS NULL) = (confirmed_by IS NULL))
);

CREATE TABLE client_tax_exemption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  jurisdiction_code text NOT NULL CHECK (jurisdiction_code ~ '^[A-Z]{2}$'),
  certificate_number text NOT NULL,
  expires_on date,
  certificate_storage_path text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, jurisdiction_code)
);

CREATE TABLE service_contract (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES client(id) ON DELETE RESTRICT,
  template_id uuid NOT NULL REFERENCES contract_template(id) ON DELETE RESTRICT,
  template_version integer NOT NULL,
  jurisdiction_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'active', 'suspended', 'terminated', 'expired', 'voided')),
  execution_date date,
  effective_date date,
  initial_term_months integer CHECK (initial_term_months > 0),
  term_end_date date,
  requires_guaranty boolean NOT NULL DEFAULT false,
  tax_exempt boolean NOT NULL DEFAULT false,
  short_notice_rate_cents integer CHECK (short_notice_rate_cents >= 0),
  supervisor_rate_cents integer CHECK (supervisor_rate_cents >= 0),
  filled_body_markdown text,
  calculator_snapshot jsonb,
  pdf_storage_path text,
  esign_envelope_id text,
  sent_at timestamptz,
  signed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  retention_until date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (term_end_date IS NULL OR effective_date IS NULL OR term_end_date > effective_date),
  CHECK (status = 'draft' OR (filled_body_markdown IS NOT NULL AND calculator_snapshot IS NOT NULL))
);

CREATE INDEX service_contract_company_status_idx ON service_contract (company_id, status, term_end_date);

CREATE TABLE service_contract_post (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES service_contract(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  post_name text NOT NULL,
  premises_address text,
  days_of_week smallint[] NOT NULL DEFAULT '{}' CHECK (days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  start_time time,
  end_time time,
  hours_per_week numeric(6,2) NOT NULL CHECK (hours_per_week > 0),
  hourly_rate_cents integer NOT NULL CHECK (hourly_rate_cents >= 0),
  weekly_charge_cents integer NOT NULL CHECK (weekly_charge_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_contract_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES service_contract(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created', 'sent', 'signed', 'suspended', 'reinstated', 'terminated', 'voided', 'late_fee_assessed', 'deposit_applied', 'authorization_revoked', 'chargeback_unfounded', 'deposit_not_restored', 'default_cured')),
  event_date date NOT NULL DEFAULT current_date,
  amount_cents integer,
  note text,
  related_event_id uuid REFERENCES service_contract_event(id) ON DELETE RESTRICT,
  actor_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type <> 'default_cured' OR related_event_id IS NOT NULL)
);

CREATE INDEX service_contract_event_contract_idx ON service_contract_event (contract_id, event_date);

CREATE TABLE contract_purge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  client_id uuid,
  status_at_purge text,
  retention_until date,
  within_retention boolean NOT NULL,
  purged_by uuid,
  purged_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_offboarding (
  company_id uuid PRIMARY KEY,
  offboarded_by uuid,
  offboarded_at timestamptz NOT NULL DEFAULT now(),
  retain_until date NOT NULL,
  export_completed_at timestamptz
);

CREATE OR REPLACE FUNCTION public.contract_template_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Published template versions cannot be deleted. Deactivate it instead.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'A template cannot be moved to another company.';
  END IF;
  IF OLD.published_at IS NOT NULL AND (NEW.body_markdown, NEW.merge_fields, NEW.fixed_terms, NEW.version, NEW.jurisdiction_code, NEW.service_type, NEW.published_at) IS DISTINCT FROM (OLD.body_markdown, OLD.merge_fields, OLD.fixed_terms, OLD.version, OLD.jurisdiction_code, OLD.service_type, OLD.published_at) THEN
    RAISE EXCEPTION 'Template version % is published and cannot be edited. Create a new version instead.', OLD.version;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_contract_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' AND COALESCE(current_setting('app.contract_purge', true), '') <> 'on' THEN
      RAISE EXCEPTION 'Only draft contracts can be deleted. Use the permanent delete function.';
    END IF;
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM client WHERE id = NEW.client_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Client does not belong to this company.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_template WHERE id = NEW.template_id AND company_id = NEW.company_id AND version = NEW.template_version AND jurisdiction_code = NEW.jurisdiction_code AND published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Template must be a published template of this company with a matching version and jurisdiction.';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'New contracts must start as draft.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'A contract cannot be moved to another company.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (('draft', 'sent'), ('sent', 'signed'), ('sent', 'expired'), ('sent', 'voided'), ('signed', 'active'), ('signed', 'terminated'), ('signed', 'voided'), ('active', 'suspended'), ('active', 'terminated'), ('active', 'expired'), ('suspended', 'active'), ('suspended', 'terminated')) THEN
    RAISE EXCEPTION 'A contract cannot move from % to %.', OLD.status, NEW.status;
  END IF;
  IF OLD.status <> 'draft' AND (NEW.client_id, NEW.template_id, NEW.template_version, NEW.jurisdiction_code, NEW.effective_date, NEW.initial_term_months, NEW.term_end_date, NEW.requires_guaranty, NEW.tax_exempt, NEW.short_notice_rate_cents, NEW.supervisor_rate_cents, NEW.filled_body_markdown, NEW.calculator_snapshot) IS DISTINCT FROM (OLD.client_id, OLD.template_id, OLD.template_version, OLD.jurisdiction_code, OLD.effective_date, OLD.initial_term_months, OLD.term_end_date, OLD.requires_guaranty, OLD.tax_exempt, OLD.short_notice_rate_cents, OLD.supervisor_rate_cents, OLD.filled_body_markdown, OLD.calculator_snapshot) THEN
    RAISE EXCEPTION 'This contract was sent on % and its terms are frozen.', OLD.sent_at::date;
  END IF;
  IF OLD.status = 'draft' AND NEW.status = 'sent' THEN
    NEW.sent_at := now();
  END IF;
  IF OLD.status = 'sent' AND NEW.status = 'signed' THEN
    NEW.signed_at := COALESCE(NEW.signed_at, now());
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'voided' THEN
    NEW.voided_at := COALESCE(NEW.voided_at, now());
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('terminated', 'expired', 'voided') THEN
    NEW.retention_until := ((CASE WHEN NEW.status = 'expired' THEN COALESCE(NEW.term_end_date, current_date) ELSE current_date END) + interval '7 years')::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_contract_post_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parent_status text;
  parent_company uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(current_setting('app.contract_purge', true), '') = 'on' THEN
      RETURN OLD;
    END IF;
    SELECT status INTO parent_status FROM service_contract WHERE id = OLD.contract_id;
    IF parent_status IS NOT NULL AND parent_status <> 'draft' THEN
      RAISE EXCEPTION 'Posts on a sent contract are frozen.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.contract_id IS DISTINCT FROM OLD.contract_id THEN
    RAISE EXCEPTION 'A post cannot be moved to another contract.';
  END IF;
  SELECT status, company_id INTO parent_status, parent_company FROM service_contract WHERE id = NEW.contract_id;
  IF parent_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Post company must match its contract.';
  END IF;
  IF parent_status <> 'draft' THEN
    RAISE EXCEPTION 'Posts on a sent contract are frozen.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_contract_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Contract events are a permanent audit log and cannot be edited.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM service_contract WHERE id = NEW.contract_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Event company must match its contract.';
  END IF;
  IF NEW.related_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM service_contract_event WHERE id = NEW.related_event_id AND contract_id = NEW.contract_id) THEN
    RAISE EXCEPTION 'Related event must belong to the same contract.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_contract_event_delete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('app.contract_purge', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM service_contract WHERE id = OLD.contract_id AND status <> 'draft') THEN
    RAISE EXCEPTION 'Contract events are a permanent audit log and cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_tax_exemption_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM client WHERE id = NEW.client_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Client does not belong to this company.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER contract_template_guard BEFORE UPDATE OR DELETE ON contract_template FOR EACH ROW EXECUTE FUNCTION contract_template_guard();
  CREATE TRIGGER contract_template_touch BEFORE UPDATE ON contract_template FOR EACH ROW EXECUTE FUNCTION contracts_touch_updated_at();
  CREATE TRIGGER company_contract_setting_touch BEFORE UPDATE ON company_contract_setting FOR EACH ROW EXECUTE FUNCTION contracts_touch_updated_at();
  CREATE TRIGGER tax_rate_guard BEFORE INSERT OR UPDATE ON tax_rate FOR EACH ROW EXECUTE FUNCTION tax_rate_guard();
  CREATE TRIGGER tax_rate_touch BEFORE UPDATE ON tax_rate FOR EACH ROW EXECUTE FUNCTION contracts_touch_updated_at();
  CREATE TRIGGER client_tax_exemption_guard BEFORE INSERT OR UPDATE ON client_tax_exemption FOR EACH ROW EXECUTE FUNCTION client_tax_exemption_guard();
  CREATE TRIGGER client_tax_exemption_touch BEFORE UPDATE ON client_tax_exemption FOR EACH ROW EXECUTE FUNCTION contracts_touch_updated_at();
  CREATE TRIGGER service_contract_guard BEFORE INSERT OR UPDATE OR DELETE ON service_contract FOR EACH ROW EXECUTE FUNCTION service_contract_guard();
  CREATE TRIGGER service_contract_touch BEFORE UPDATE ON service_contract FOR EACH ROW EXECUTE FUNCTION contracts_touch_updated_at();
  CREATE TRIGGER service_contract_post_guard BEFORE INSERT OR UPDATE OR DELETE ON service_contract_post FOR EACH ROW EXECUTE FUNCTION service_contract_post_guard();
  CREATE TRIGGER service_contract_post_touch BEFORE UPDATE ON service_contract_post FOR EACH ROW EXECUTE FUNCTION contracts_touch_updated_at();
  CREATE TRIGGER service_contract_event_guard BEFORE INSERT OR UPDATE ON service_contract_event FOR EACH ROW EXECUTE FUNCTION service_contract_event_guard();
  CREATE TRIGGER service_contract_event_delete_guard BEFORE DELETE ON service_contract_event FOR EACH ROW EXECUTE FUNCTION service_contract_event_delete_guard();
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_contract_template(p_template uuid) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  t contract_template%ROWTYPE;
BEGIN
  SELECT * INTO t FROM contract_template WHERE id = p_template;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found.';
  END IF;
  IF t.published_at IS NULL THEN
    RAISE EXCEPTION 'Publish the template before activating it.';
  END IF;
  UPDATE contract_template SET is_active = false WHERE company_id = t.company_id AND jurisdiction_code = t.jurisdiction_code AND service_type = t.service_type AND is_active AND id <> t.id;
  UPDATE contract_template SET is_active = true WHERE id = t.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_service_contract(p_contract uuid, p_confirm text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c service_contract%ROWTYPE;
BEGIN
  SELECT * INTO c FROM service_contract WHERE id = p_contract;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found.';
  END IF;
  IF NOT is_contract_admin(c.company_id) THEN
    RAISE EXCEPTION 'Only a chief or super admin can permanently delete a contract.';
  END IF;
  IF p_confirm IS DISTINCT FROM 'DELETE' THEN
    RAISE EXCEPTION 'Type DELETE in capital letters to confirm permanent deletion.';
  END IF;
  INSERT INTO contract_purge_log (company_id, contract_id, client_id, status_at_purge, retention_until, within_retention, purged_by)
  VALUES (c.company_id, c.id, c.client_id, c.status, c.retention_until, (c.status <> 'draft' AND (c.retention_until IS NULL OR c.retention_until > current_date)), auth.uid());
  PERFORM set_config('app.contract_purge', 'on', true);
  DELETE FROM service_contract WHERE id = p_contract;
  PERFORM set_config('app.contract_purge', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.offboard_company(p_company uuid, p_confirm text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profile up JOIN company c ON c.id = up.company_id WHERE up.id = auth.uid() AND up.role = 'super_admin' AND c.is_platform_owner) THEN
    RAISE EXCEPTION 'Only a platform super admin can offboard a tenant.';
  END IF;
  IF p_company = (SELECT company_id FROM user_profile WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'You cannot offboard your own company.';
  END IF;
  IF p_confirm IS DISTINCT FROM 'DELETE' THEN
    RAISE EXCEPTION 'Type DELETE in capital letters to confirm.';
  END IF;
  INSERT INTO company_offboarding (company_id, offboarded_by, retain_until) VALUES (p_company, auth.uid(), (current_date + interval '7 years')::date) ON CONFLICT (company_id) DO NOTHING;
  UPDATE company SET is_active = false WHERE id = p_company;
END;
$$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION purge_service_contract(uuid, text) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION offboard_company(uuid, text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION purge_service_contract(uuid, text) TO authenticated;
  GRANT EXECUTE ON FUNCTION offboard_company(uuid, text) TO authenticated;
END;
$$;

DO $$
BEGIN
  ALTER TABLE contract_template ENABLE ROW LEVEL SECURITY;
  ALTER TABLE company_contract_setting ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tax_rate ENABLE ROW LEVEL SECURITY;
  ALTER TABLE client_tax_exemption ENABLE ROW LEVEL SECURITY;
  ALTER TABLE service_contract ENABLE ROW LEVEL SECURITY;
  ALTER TABLE service_contract_post ENABLE ROW LEVEL SECURITY;
  ALTER TABLE service_contract_event ENABLE ROW LEVEL SECURITY;
  ALTER TABLE contract_purge_log ENABLE ROW LEVEL SECURITY;
  ALTER TABLE company_offboarding ENABLE ROW LEVEL SECURITY;
END;
$$;

CREATE POLICY "contract staff manage templates" ON contract_template FOR ALL USING (can_manage_contracts(company_id)) WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff manage settings" ON company_contract_setting FOR ALL USING (can_manage_contracts(company_id)) WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff read tax rates" ON tax_rate FOR SELECT USING (can_manage_contracts(company_id));

CREATE POLICY "contract staff add tax rates" ON tax_rate FOR INSERT WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff confirm tax rates" ON tax_rate FOR UPDATE USING (can_manage_contracts(company_id)) WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff delete unconfirmed tax rates" ON tax_rate FOR DELETE USING (confirmed_at IS NULL AND can_manage_contracts(company_id));

CREATE POLICY "contract staff manage exemptions" ON client_tax_exemption FOR ALL USING (can_manage_contracts(company_id)) WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff read contracts" ON service_contract FOR SELECT USING (can_manage_contracts(company_id));

CREATE POLICY "contract staff create contracts" ON service_contract FOR INSERT WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff update contracts" ON service_contract FOR UPDATE USING (can_manage_contracts(company_id)) WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff delete draft contracts" ON service_contract FOR DELETE USING (status = 'draft' AND can_manage_contracts(company_id));

CREATE POLICY "contract staff manage posts" ON service_contract_post FOR ALL USING (can_manage_contracts(company_id)) WITH CHECK (can_manage_contracts(company_id));

CREATE POLICY "contract staff read events" ON service_contract_event FOR SELECT USING (can_manage_contracts(company_id));

CREATE POLICY "contract staff log events" ON service_contract_event FOR INSERT WITH CHECK (actor_user_id = auth.uid() AND can_manage_contracts(company_id));

CREATE POLICY "contract admins read purge log" ON contract_purge_log FOR SELECT USING (is_contract_admin(company_id));

CREATE POLICY "contract admins read offboarding" ON company_offboarding FOR SELECT USING (is_contract_admin(company_id));
