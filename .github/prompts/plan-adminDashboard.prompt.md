## Plan: Admin Dashboard for Tournament Management

An Admin Dashboard in the frontend to streamline managing the entire tournament lifecycle. This includes creating new tournaments, adding teams (including First Four matchups), and easily updating scores using simple action buttons (`+ Win`, `Eliminate`) grouped by region.

**Steps**
1. **Backend Auth Updates** — Expose `is_staff` and `is_superuser` on the `UserSerializer` so the frontend knows if the current user is an admin.
2. **Backend API Updates**
   - Update `TournamentListView` to `ListCreateAPIView` (restricted to admins for `POST` to create new tournaments).
   - Update `TournamentTeamListView` to `ListCreateAPIView` (restricted to admins for `POST` to add teams).
   - Create `TournamentTeamUpdateView` extending `generics.UpdateAPIView` restricted to admins (`PATCH /api/tournament/<id>/teams/<team_id>/`).
   - Ensure `TournamentTeamSerializer` allows updates/creation with `wins`, `is_eliminated`, `school`, and `school_secondary`.
3. **Frontend Nav Updates** — Fetch the current user profile in `AppLayout.tsx` and conditionally render an "Admin Dashboard" nav link if the user is an admin.
4. **Admin Dashboard UI - Setup Phase**
   - Add a "Create Tournament" button/modal (Year, Start Date).
   - Add a "Add Team" form for a selected tournament. The form needs fields for Region, Seed, School, and an optional Secondary School for First Four matchups.
5. **Admin Dashboard UI - Active Phase**
   - Fetch teams, filter out eliminated ones by default (with a "Show Eliminated" toggle for mistake correction), and group them by Region.
   - For each team, display: Current Wins, `+ Win`, `- Win`, and `Eliminate` action buttons.
6. **First Four Resolution** — Identify teams with a `school_secondary`. Present a "Resolve First Four" action that lets the admin pick the winning school. On selection, patch the team: setting `school` to the winner, `school_secondary` to null, and incrementing `wins`.

**Relevant files**
- `src/backend/accounts/serializers.py` — Expose admin status in `UserSerializer`.
- `src/backend/tournament/views.py` — Update list views to create views; add `TournamentTeamUpdateView`.
- `src/backend/tournament/urls.py` — Register the new view routes.
- `src/backend/tournament/serializers.py` — Validate `school` and `school_secondary` logic in `TournamentTeamSerializer`.
- `src/frontend/src/components/AppLayout.tsx` — Add user profile fetch and admin link.
- `src/frontend/src/router.tsx` — Add the new admin route (`/admin/dashboard`).
- `src/frontend/src/pages/AdminDashboard.tsx` — New file for the dashboard layout, data fetching, setup forms, grouping, and update actions.

**Verification**
1. Log in as a superuser and ensure the Admin Dashboard link appears.
2. Create a new Tournament via the dashboard.
3. Add a standard team and a First Four team (with a secondary school) to the new tournament.
4. View the active dashboard and verify eliminated teams are hidden by default, and remaining teams are grouped by region.
5. Click `+ Win` on a team and verify the wins increment and the API returns 200.
6. Click `Eliminate` and verify the team disappears from the active list.
7. Resolve a First Four team and verify the primary school is updated, secondary school is cleared, and wins increment.

**Decisions**
- Teams will be grouped by region rather than dynamically built matchups to avoid the complexity of predicting upset matchups.
- Eliminated teams are hidden by default but toggleable to allow "undo" functionality.
- Creating teams will be done one-by-one or via a bulk UI in the frontend, backed by standard REST patterns.