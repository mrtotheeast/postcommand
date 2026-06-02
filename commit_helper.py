#!/usr/bin/env python3
import subprocess, sys, os

os.chdir('/Users/justinashe/Downloads/postcommand')

msg = """CCW: verified reciprocity data from handgunlaw.us April 2026

- ccwData.js: complete rewrite with handgunlaw.us PDF data (Apr 18 2026)
- All 50 states + DC with accurate honoredBy and honors arrays
- MD: 27 states honor MD permit, honors=0 (accurate per source)
- Permitless carry states verified per handgunlaw.us March 20 2026
- Notes: CO FL ME MI NH ND PA SC only honor RESIDENT permits
- CCWMap.jsx: migrated to CCW_DATA keyed object structure
- getMapColor(): green=carry allowed, red=not honored, gold=home state
- State list shows Carry Allowed / Mutual / Not Honored labels per state
- Updated disclaimer citing handgunlaw.us as authoritative source
- ccw-monitor edge function: monthly HTTP check on PDF last-modified
  flags changes for Super Admin review before any data update
- SuperAdmin CCW Monitor panel: status, amber warning, approval flow
- SQL: CREATE TABLE ccw_monitor_log + platform_notification

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"""

result = subprocess.run(
    ['git', 'commit', '-F', '-'],
    input=msg, capture_output=True, text=True
)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("Return code:", result.returncode)
