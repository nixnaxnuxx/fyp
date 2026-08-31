FYP Supervision Portal v6 - Meeting Notes & Follow-up Tasks

NEW
- Admin can open any booked supervision slot and record:
  * meeting summary
  * supervisor comments/feedback
  * key decisions/agreed changes
  * progress/concerns
  * focus for the next meeting
- Admin can add follow-up tasks/actions for the next meeting with details and due dates.
- Follow-up actions appear on the student's dashboard and Meetings page until marked done.
- Admin can mark follow-up actions done or reopen them.
- Meeting records and follow-up actions are included in the student's exported FYP Supervision Record.

SETUP
1. In Supabase SQL Editor, run supabase_meeting_records_migration.sql once.
2. In GitHub, replace index.html, styles.css and app.js with the v6 files.
3. KEEP your existing configured config.js. Do not overwrite it with the placeholder config.js in this package.
4. Commit to main, wait for GitHub Pages deployment, then Ctrl+F5 the portal.

No existing student/task/submission data is deleted by this migration.
