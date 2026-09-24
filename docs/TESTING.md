# Manual test checklist

Run through this before each deploy. Use a **fresh test account** for the sign-up and tour
sections so you see what a new student sees. Tick each box as you go.

## 1. Landing & auth
- [ ] `/` shows the landing page when logged out; the headline reveals word by word.
- [ ] Scrolling "How Cram helps it stick" pins the section and steps through all 4 visuals.
- [ ] Light/dark toggle in the landing nav works.
- [ ] `/app` while logged out redirects to `/login`.
- [ ] **Sign up** with a weak password — the checklist stays incomplete and the button is disabled.
- [ ] Sign up with a strong password → "Check your inbox" → confirmation email arrives → link logs you in.
- [ ] **Log in** with a wrong password shows a friendly error.
- [ ] **Forgot password** → email arrives → link opens "Set a new password" → new password works;
      the old one doesn't. *(Open the link in the same browser.)*
- [ ] **Continue with Google / Microsoft** (once set up) creates an account with your name and photo.
- [ ] Logging in with Google using the same email as an existing email account keeps the same data.
- [ ] **Log out** from the profile menu and from Settings both return to `/login`.

## 2. First-run tour (new account)
- [ ] The tour starts on the dashboard; **Skip** closes it and it never returns on reload.
- [ ] On another new account, **Start tour** → each step opens its page (dashboard → folder →
      page → planner → Pomodoro → progress → settings) and the spotlight lands on the right element.
- [ ] Back / Next / arrow keys / Esc all work; **Take the tour** in the profile menu replays it.

## 3. Folders & notes
- [ ] Create, rename and delete a folder (sidebar `+`, then the `⋯` menu on the folder page).
- [ ] Create a page; the title and content autosave ("Saved"), and survive a reload.
- [ ] In the editor: `/` menu → headings, lists, table, **Two Columns**; drag a block beside another.
- [ ] Upload an image into a page (tests Supabase Storage).
- [ ] `⋯` next to the title: **Full width**, **Small text** (persist after reload), **Copy link**.
- [ ] Heading outline dashes appear on the right for pages with 2+ headings; hover → click jumps.
- [ ] Sidebar folder expands to show pages; `+` on hover creates a page.
- [ ] Breadcrumb hover menus list sections / folders / pages.
- [ ] **Tabs**: `+` opens a tab; Ctrl+click a sidebar link opens a background tab; close works.
- [ ] **Ctrl+K** finds pages by title and by words inside the page.

## 4. Sharing
- [ ] Share a folder with a second account as **Viewer**: they can read and quiz but not edit.
- [ ] Change them to **Editor**: they can edit pages.
- [ ] Shared folder shows the weekly leaderboard; turning off "Show me on leaderboards" hides you.

## 5. Quizzes & review
- [ ] **Quiz me** on a folder generates questions from your notes (needs `GEMINI_API_KEY`).
- [ ] Submit → results page shows score, "+XP", and "Next review in …".
- [ ] Wrong answers link back to the source page.
- [ ] After the review date, the page appears in **Due for review** on Home and the one-click
      **Review** quiz works.

## 6. Planner, to-do & roadmap
- [ ] "revise chapter 4 tomorrow" sets tomorrow's date; "stretch everyday" makes it repeat.
- [ ] Pick a subject → the task shows its subject tag and appears in that folder's **To-do**.
- [ ] Complete / edit / delete tasks.
- [ ] Folder **Roadmap**: add topics, tick them off, progress bar updates.

## 7. Pomodoro
- [ ] The page fits the window without scrolling (try a small laptop screen too).
- [ ] Start / Pause / Resume / Reset; **Space** and **R** shortcuts.
- [ ] Navigate away while running → mini timer in the top bar; countdown in the browser tab title.
- [ ] Let a short session finish (set Focus to 1 min in settings) → "+XP" toast, sessions count up.

## 8. Gamification
- [ ] Writing notes for 5+ minutes, a focus session, or a quiz marks today on the week strip.
- [ ] The goal ring fills; hitting the goal gives +20 XP once.
- [ ] Settings → **Custom** goal (e.g. 4 hours) shows as "of 4 hours" on Home.
- [ ] Achievements unlock with a confetti toast; the Progress page lists them and the heatmap fills.
- [ ] Skip a day (or wait) → a streak freeze covers it (❄ on the week strip).

## 9. General
- [ ] Every page in **light and dark** mode.
- [ ] Phone width (≈375 px): landing, login, dashboard, a page, Pomodoro.
- [ ] No red errors in the browser console on the main pages.
