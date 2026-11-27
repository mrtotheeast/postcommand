ALTER TABLE company_contract_setting ADD COLUMN IF NOT EXISTS overtime_multiplier numeric(4,2) NOT NULL DEFAULT 1.50 CHECK (overtime_multiplier >= 1), ADD COLUMN IF NOT EXISTS short_notice_multiplier numeric(4,2) NOT NULL DEFAULT 1.70 CHECK (short_notice_multiplier >= 1), ADD COLUMN IF NOT EXISTS emergency_multiplier numeric(4,2) CHECK (emergency_multiplier >= 1);

ALTER TABLE service_contract ADD COLUMN IF NOT EXISTS base_rate_cents integer CHECK (base_rate_cents >= 0), ADD COLUMN IF NOT EXISTS overtime_rate_cents integer CHECK (overtime_rate_cents >= 0), ADD COLUMN IF NOT EXISTS holiday_rate_cents integer CHECK (holiday_rate_cents >= 0), ADD COLUMN IF NOT EXISTS emergency_rate_cents integer CHECK (emergency_rate_cents >= 0), ADD COLUMN IF NOT EXISTS auto_renews boolean NOT NULL DEFAULT true;

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
  IF OLD.status <> 'draft' AND (to_jsonb(NEW) - ARRAY['status', 'execution_date', 'pdf_storage_path', 'esign_envelope_id', 'sent_at', 'signed_at', 'voided_at', 'void_reason', 'retention_until', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'execution_date', 'pdf_storage_path', 'esign_envelope_id', 'sent_at', 'signed_at', 'voided_at', 'void_reason', 'retention_until', 'updated_at']) THEN
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

SELECT company_id, jurisdiction_code, short_notice_rate_cents FROM company_contract_setting WHERE short_notice_rate_cents IS NOT NULL;

ALTER TABLE company_contract_setting DROP COLUMN IF EXISTS short_notice_rate_cents;
