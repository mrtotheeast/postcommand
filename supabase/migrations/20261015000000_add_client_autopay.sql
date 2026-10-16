-- Migration: add_client_autopay
-- Created:   2026-10-15
-- Purpose:   Direct debiting of clients (ACH + card) on a recurring cycle via
--            Stripe Connect. Each security company connects its own Stripe
--            account; client payment methods are saved on that account and
--            open invoices are charged automatically on the client's schedule.
--
-- SECURITY: raw card / routing / account numbers are NEVER stored here. They
-- are entered into Stripe's Payment Element (iframe) and tokenized by Stripe.
-- We store only Stripe IDs plus display info (brand, last4, bank name).
--
-- All writes go through edge functions (stripe-connect, client-billing,
-- process-autopay, stripe-webhook) using the service role. RLS below only
-- grants SELECT, so the browser can never tamper with Stripe IDs, schedules,
-- or payment status directly.
--
-- DO NOT run this file directly — apply via Supabase dashboard SQL editor or CLI:
--   supabase db push

-- ── 1. company_payment_account ──────────────────────────────────────────────
-- One connected Stripe account per company.

CREATE TABLE company_payment_account (
  company_id           uuid        PRIMARY KEY REFERENCES company(id) ON DELETE CASCADE,
  stripe_account_id    text        NOT NULL UNIQUE,
  charges_enabled      boolean     NOT NULL DEFAULT false,
  payouts_enabled      boolean     NOT NULL DEFAULT false,
  details_submitted    boolean     NOT NULL DEFAULT false,
  -- Optional surcharge on CREDIT cards only (never debit/prepaid/ACH). 0–3%.
  card_surcharge_pct   numeric(4,2) NOT NULL DEFAULT 0 CHECK (card_surcharge_pct >= 0 AND card_surcharge_pct <= 3),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── 2. client_billing ───────────────────────────────────────────────────────
-- Saved payment method + autopay schedule per client.
--
-- frequency:
--   daily          every day
--   weekly         every 7 days from start_date
--   biweekly       every 14 days from start_date
--   days_of_month  on each day listed in days_of_month (e.g. {1}, {1,15}, {5,20});
--                  days past the end of a short month clamp to the last day.

CREATE TABLE client_billing (
  client_id                 uuid        PRIMARY KEY REFERENCES client(id) ON DELETE CASCADE,
  company_id                uuid        NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  stripe_customer_id        text,
  stripe_payment_method_id  text,
  pm_type                   text        CHECK (pm_type IN ('card','us_bank_account')),
  pm_brand                  text,       -- 'visa' / bank name
  pm_last4                  text,
  pm_funding                text,       -- card only: credit | debit | prepaid
  pm_status                 text        CHECK (pm_status IN ('active','pending_verification','failed')),
  pending_setup_intent_id   text,       -- ACH awaiting micro-deposit verification
  autopay_enabled           boolean     NOT NULL DEFAULT false,
  frequency                 text        CHECK (frequency IN ('daily','weekly','biweekly','days_of_month')),
  start_date                date,
  days_of_month             int[]       CHECK (days_of_month IS NULL OR days_of_month <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]),
  next_charge_date          date,
  last_charged_at           timestamptz,
  authorized_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  authorized_at             timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_billing_company_id_idx ON client_billing (company_id);
CREATE INDEX client_billing_due_idx ON client_billing (next_charge_date) WHERE autopay_enabled;

-- ── 3. client_payment ───────────────────────────────────────────────────────
-- One row per charge attempt (autopay or "charge now").

CREATE TABLE client_payment (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid        NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  client_id                 uuid        NOT NULL REFERENCES client(id)  ON DELETE CASCADE,
  invoice_ids               uuid[]      NOT NULL DEFAULT '{}',
  amount_cents              integer     NOT NULL CHECK (amount_cents > 0),
  surcharge_cents           integer     NOT NULL DEFAULT 0,
  pm_type                   text,
  stripe_payment_intent_id  text        UNIQUE,
  status                    text        NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','succeeded','failed')),
  failure_message           text,
  trigger                   text        NOT NULL DEFAULT 'autopay' CHECK (trigger IN ('autopay','manual')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_payment_client_idx ON client_payment (client_id, created_at DESC);

-- ── 4. invoice additions ────────────────────────────────────────────────────
-- autopay_payment_id locks an invoice while a charge is in flight (ACH takes
-- ~4 business days) so it is never charged twice. Cleared on failure.

ALTER TABLE invoice ADD COLUMN IF NOT EXISTS autopay_payment_id uuid REFERENCES client_payment(id) ON DELETE SET NULL;
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- ── 5. RLS — read-only for billing roles ────────────────────────────────────

ALTER TABLE company_payment_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_billing          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payment          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing roles can read payment account"
  ON company_payment_account FOR SELECT
  USING (
    company_id = (SELECT company_id FROM user_profile WHERE id = auth.uid())
    AND (SELECT role FROM user_profile WHERE id = auth.uid()) IN ('chief', 'super_admin', 'accounting')
  );

CREATE POLICY "billing roles can read client billing"
  ON client_billing FOR SELECT
  USING (
    company_id = (SELECT company_id FROM user_profile WHERE id = auth.uid())
    AND (SELECT role FROM user_profile WHERE id = auth.uid()) IN ('chief', 'super_admin', 'accounting')
  );

CREATE POLICY "billing roles can read client payments"
  ON client_payment FOR SELECT
  USING (
    company_id = (SELECT company_id FROM user_profile WHERE id = auth.uid())
    AND (SELECT role FROM user_profile WHERE id = auth.uid()) IN ('chief', 'super_admin', 'accounting')
  );

-- No INSERT/UPDATE/DELETE policies: service role only.
