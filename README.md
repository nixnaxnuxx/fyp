# FYP Supervision Portal

Static GitHub Pages frontend + Supabase backend for supervising FYP students across academic years.

## Included in this first version

- Supervisor and student authentication
- Academic-year/cohort management
- Add students and their FYP project titles
- Assign tasks to one or multiple students
- Task open date, deadline, semester and research stage
- Required-evidence instructions
- Student task submission with research reflection fields
- Multiple evidence file uploads to private Supabase Storage
- External evidence links (GitHub/Drive/etc.)
- Submission timestamps and overdue status
- Supervisor review: Approve / Revision Required / Incomplete
- Revision deadline and feedback history
- Student/supervisor progress views
- Export supervision record using browser Print -> Save as PDF
- Export task/submission history to CSV
- Reusable cohort model for future academic years

## 1. Create your Supabase project

Create a Supabase project, then open SQL Editor and run `supabase_schema.sql`.

The script creates the database tables, RLS policies, user-linking trigger and private `fyp-evidence` Storage bucket.

## 2. Configure the website

Copy:

`config.example.js` -> `config.js`

Edit `config.js`:

```js
window.FYP_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_OR_PUBLISHABLE_KEY",
  evidenceBucket: "fyp-evidence"
};
```

Only use the public anon/publishable key in the browser. Never put a Supabase service-role key in this repository.

## 3. Create your supervisor account

Open the site and choose Create account using your own email.

Then run this once in Supabase SQL Editor, replacing the email:

```sql
update public.profiles
set role='supervisor'
where id=(select id from auth.users where email='YOUR_EMAIL');
```

Sign out and sign in again.

## 4. Set Auth URLs

In Supabase Authentication -> URL Configuration:

- Site URL: your GitHub Pages URL
- Add the same GitHub Pages URL under Redirect URLs

For local testing you may also add `http://localhost:8000`.

## 5. Run locally

From this folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## 6. Publish to GitHub Pages

Create a GitHub repository and upload these files to the repository root:

- index.html
- styles.css
- app.js
- config.js

You may also keep README.md and supabase_schema.sql in the repository.

In GitHub: Settings -> Pages -> Deploy from a branch -> main -> /(root).

## Recommended first setup

1. Create cohort `2026/2027`.
2. Add the 3 current FYP students with the exact email each will use to register.
3. Add their project titles.
4. Create the first tasks: project understanding, literature search, literature matrix, research gap, methodology plan.
5. Ask each student to create their portal account using the same email you entered.
6. Their account will automatically link to their student record.

## Evidence and audit behaviour

The database preserves assigned deadlines and submission timestamps. A revision updates the student's working submission record while feedback entries remain as review history. For a stricter immutable archive in a later version, add a separate `submission_revisions` table so every revision body is snapshotted permanently rather than only the supervisor feedback trail.

## Current scope / next useful upgrades

This is a functional MVP. Recommended next additions:

- reusable task-template library
- recurring weekly log task generation
- literature review matrix module
- methodology/experiment approval forms
- report chapter tracker
- full submission-revision snapshots
- email reminders
- richer PDF/Word export
- Gantt planned-vs-actual view
- publication-readiness tracker

## Meeting booking upgrade

The portal now includes a **Meetings** section dedicated to FYP supervision. It does not use Google Calendar.

Supervisor workflow:
1. Open **Meetings**.
2. Click **+ Add Availability** and enter the supervision slots you are free.
3. The page lists every current student together with the FYP project assigned to them.
4. Click **Email All Students** to open one pre-filled email addressed using BCC to the current cohort. The email lists each student's assigned FYP project, your available slots, and the portal booking link.
5. Students log in and book one open slot. A booked slot is removed from the available list for the other students.
6. Meeting bookings are included in the exported FYP Supervision Record.

If you installed an earlier version of the portal, run `supabase_meetings_migration.sql` once in the Supabase SQL Editor before deploying this update.
\n\n## v3 Admin / Student access\n\n- New public accounts are always created as `student`.\n- The administrator account must be promoted once in Supabase using `supabase_admin_migration.sql`.\n- The browser app displays the administrator role as **Admin**.\n- For email-confirmation deployments, set Supabase Authentication > URL Configuration > Site URL to your exact GitHub Pages portal URL, including the repository path, e.g. `https://USERNAME.github.io/REPOSITORY/`.\n- Add the same URL under Redirect URLs. The app also explicitly passes the current portal page as the email confirmation redirect.\n