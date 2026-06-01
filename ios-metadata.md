# PostCommand — App Store Listing

## App Name
PostCommand — Security Workforce

## Subtitle
Guard Management & Compliance

## Bundle ID
com.nationwidepolice.postcommand

## Category
Business

## Age Rating
4+ (no objectionable content)

## Description

PostCommand is the complete workforce management platform for licensed security companies. Built for security professionals by security professionals.

**FEATURES FOR OFFICERS:**
• GPS-verified clock in/out at your assigned sites
• Submit incident reports with photos and AI-assisted writing
• View your schedule and request shift swaps
• Complete training courses and earn certificates
• Request PTO and view approval status
• Receive real-time push notifications for schedule changes
• SOS emergency alert with instant supervisor notification

**FEATURES FOR SUPERVISORS & ADMINISTRATORS:**
• Real-time officer location map across all sites
• Schedule creation, management, and auto-assignment
• Timesheet review, approval, and payroll export (ADP/Paychex)
• Incident report workflow and approval pipeline
• Training assignment and completion tracking with certificates
• HR document management and e-signatures
• Client portal for site-specific updates
• Geofence violation monitoring and alerts

**COMPLIANCE TOOLS:**
• MPCTC-aligned training tracking (Maryland)
• Multi-state licensing management (MD, DC, VA, PA)
• CCW reciprocity reference map (all 50 states)
• Credential expiration monitoring and automated reminders
• Full audit log for all system activity
• GPS patrol checkpoint verification

PostCommand is used exclusively by authorized security company employees. Account creation requires employer invitation — there is no public sign-up.

## Keywords
security guard, workforce management, guard management, security company, patrol, incident report, timesheets, scheduling, compliance, MPCTC, geofence, clock in

## Support URL
https://nationwidepolice.com/support

## Marketing URL
https://postcommand.app

## Privacy Policy URL
https://nationwidepolice.com/privacy

---

## Review Notes (for Apple Reviewer)

PostCommand is a private enterprise workforce management tool for licensed security companies. Please note:

1. **Login required** — All users must be invited by their employer. There is no public sign-up. To test, use the demo credentials provided in the reviewer notes field in App Store Connect.

2. **Location permission** — The app requests "When In Use" location access to verify employees are physically present at their assigned work sites when clocking in or out. This is a core compliance feature for security guard companies. Location is only captured during clock-in/out events — not tracked continuously.

3. **Camera permission** — Used for clock-in photo verification (confirming officer identity) and documenting incidents at work sites. This is a standard security industry compliance requirement.

4. **Push notifications** — Used for schedule updates, timesheet approvals, SOS emergency alerts, and training reminders.

5. **No in-app purchases** — Subscriptions are managed exclusively at postcommand.app. This complies with Apple's guidelines for B2B enterprise apps.

6. **Face ID** — Optional biometric login for faster authentication.

7. **Content** — All content is employer-controlled and monitored for compliance. The app contains no user-generated public content — all data is private to the employing security company.

---

## Screenshots Needed (per device)
- iPhone 6.9" (iPhone 16 Pro Max)
- iPhone 6.5" (iPhone 14 Plus / 15 Plus)
- iPad 13" Pro (if submitting universal)

### Screenshot order:
1. Dashboard — officer view with tiles
2. Clock In — GPS geofence verification screen
3. Scheduling — weekly schedule view
4. Live Map — officers on duty across sites
5. Incident Report — AI-assisted writing
6. SOS Alert — emergency screen
7. Training — course with quiz
8. CCW Map — reciprocity reference (web view)

---

## App Store Connect Notes

**Demo account for reviewer:**
- URL: https://postcommand.app
- Email: reviewer@postcommand.app (set up in App Store Connect reviewer notes)
- Password: (set in App Store Connect reviewer notes)
- Role: Officer (limited view demonstrating core features)

**What the reviewer will see:**
- Login screen (white, clean)
- Privacy consent banner on first launch
- Dashboard with feature tiles
- Clock In flow (GPS + camera — will work on device, not simulator)
- Scheduling view
- Training courses

**Known simulator limitations:**
- GPS geofencing will not work in Xcode Simulator — use a physical device
- Camera requires a physical device
- Push notifications require a physical device and APNs configuration

---

## Version Notes (1.0.0)

Initial App Store release of PostCommand for iOS. This is the native wrapper of the PostCommand web application, providing native camera, location, and push notification capabilities optimized for iOS security professionals.
