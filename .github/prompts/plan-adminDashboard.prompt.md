## Plan: Admin Dashboard for Tournament Wins

An Admin Dashboard in the frontend to streamline updating tournament scores. It will group active teams by region and use simple action buttons (`+ Win`, `Eliminate`) instead of manual data entry, along with a built-in workflow for resolving First Four matchups.

**Steps**
1. **Backend Auth Updates** — Expose `is_staff` and `is_superuser` on the `UserSerializer` so the frontend knows if the current user is an admin.
2. **Backend API Updates** — Create `TournamentTeamUpdateView` extending `generics.UpdateAPIView` restricted to admins. Register the route, and ensure the serializer allows updates to `wins`, `is_eliminated`, `school`, and `school_secondary`.
3. **Frontend Nav Updates** — Fetch the current user profile in `AppLayout.tsx` and conditionally render an "Admin Dashboard" nav link if the user is an admin.
4. **Admin Dashboard UI** — Create the new dashboard page. Fetch teams, filter out eliminated ones by default (with a "Show Eliminated" toggle for mistake correction), and group them by Region. For each team, display: Current Wins, `+ Win`, `- Win`, and `Eliminate` action buttons.
5. **First Four Resolution** — Identify teams with a `school_secondary`. Present a "Resolve First Four" action that lets the admin pick the winning school. On selection, patch the team: setting `school` to the winner, `school_secondary` to null, and incrementing `wins`.

**Relevant files**
- `src/backend/accounts/serializers.py` — Expose admin status in `UserSerializer`.
- `src/backend/tournament/views.py` — Add `TournamentTeamUpdateView`.
- `src/backend/tournament/urls.py` — Register the new view route.
- `src/backend/tournament/serializers.py` — Validate `school` and `school_secondary` are updateable in `TournamentTeamSerializer`.
- `src/frontend/src/components/AppLayout.tsx` — Add user profile fetch and admin link.
- `src/frontend/src/router.tsx` — Add the new admin route.
- `src/frontend/src/pages/AdminDashboard.tsx` — New file for the dashboard layout, data fetching, grouping, and update actions.

**Verification**
1. Log in as a superuser and ensure the Admin Dashboard link appears.
2. View the dashboard and verify eliminated teams are hidden by default, and remaining teams are grouped by region.
3. Click `+ Win` on a team and verify the wins increment and the API returns 200.
4. Click `Eliminate` and verify the team disappears from the active list.
5. Resolve a First Four team and verify the primary school is updated, secondary school is cleared, and wins increment.

**Decisions**
- Teams will be grouped by region rather than dynamically built matchups to avoid the complexity of predicting upset matchups.
- Eliminated teams are hidden by default but toggleable to allow "undo" functionality.