#!/bin/bash
git commit -m "CCW: verified reciprocity data from handgunlaw.us April 2026

- ccwData.js: complete rewrite with handgunlaw.us data (Apr 18 2026)
- All 50 states + DC with accurate honoredBy/honors arrays per source PDF
- MD: 27 states honor MD permit, 0 honored (verified accurate from PDF)
- CCWMap.jsx: migrated to CCW_DATA keyed structure with getMapColor()
- Map now shows red for not-honored states, green for carry-allowed
- Updated disclaimer citing handgunlaw.us as authoritative source
- ccw-monitor edge function: monthly HTTP HEAD check on PDF source
- SuperAdmin CCW Monitor panel: status, amber review warning, approval flow

SQL to run in Supabase dashboard:
  CREATE TABLE IF NOT EXISTS ccw_monitor_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    checked_at TIMESTAMPTZ NOT NULL,
    source_url TEXT NOT NULL,
    source_last_modified TIMESTAMPTZ,
    needs_review BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'CURRENT',
    notes TEXT, reviewed_by UUID, reviewed_at TIMESTAMPTZ, approved BOOLEAN
  );
  CREATE TABLE IF NOT EXISTS platform_notification (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
    severity TEXT DEFAULT 'info', created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT false, resolved_by UUID, resolved_at TIMESTAMPTZ
  );

Edge function deploy:
  npx supabase functions deploy ccw-monitor --project-ref xtylrvmzoxuyzcprqkql

Cron: cron-job.org 1st of month 8am UTC
  https://xtylrvmzoxuyzcprqkql.supabase.co/functions/v1/ccw-monitor

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" && git push
