from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Entry, School, Tournament, TournamentTeam
from .serializers import EntrySerializer
from .tasks import calculate_optimistic_gain, update_tournament_scores

User = get_user_model()


class TournamentTasksTests(TestCase):
    def setUp(self):
        # Create a user
        self.user = User.objects.create_user(username="testuser", password="password")

        # Create tournament
        start_date = timezone.now() + timezone.timedelta(days=1)
        self.tournament = Tournament.objects.create(
            year=start_date.year,
            start_date=start_date,
        )

        # Create schools
        self.schools = []
        for i in range(1, 25):
            school = School.objects.create(name=f"School {i}", abbrev=f"SCH{i}")
            self.schools.append(school)

        # Create tournament teams
        self.teams = []
        regions = [TournamentTeam.Region.EAST, TournamentTeam.Region.WEST]
        for idx, school in enumerate(self.schools):
            # Assign seeds and regions
            seed = (idx % 16) + 1
            region = regions[idx // 16] if idx // 16 < len(regions) else TournamentTeam.Region.EAST
            team = TournamentTeam.objects.create(
                tournament=self.tournament,
                school=school,
                seed=seed,
                region=region,
                wins=0,
                is_eliminated=False,
            )
            self.teams.append(team)

    def test_calculate_optimistic_gain_basic(self):
        # Select some teams for the pick list
        picks = self.teams[:5]  # 5 teams

        # If current round is 1 and 0 wins have occurred in the tournament
        # Each team has 0 wins.
        # They should be able to gain wins for remaining rounds.
        gain = calculate_optimistic_gain(picks, current_round=1, total_tournament_wins=0)
        self.assertGreater(gain, 0)

    def test_calculate_optimistic_gain_with_eliminated_team(self):
        picks = self.teams[:5]
        # Mark one team as eliminated
        picks[0].is_eliminated = True
        picks[0].save()

        # Gain should be calculated without the eliminated team
        gain_with_eliminated = calculate_optimistic_gain(picks, current_round=1, total_tournament_wins=0)

        active_picks = picks[1:]
        gain_without_eliminated = calculate_optimistic_gain(active_picks, current_round=1, total_tournament_wins=0)

        self.assertEqual(gain_with_eliminated, gain_without_eliminated)

    def test_update_tournament_scores_empty_picks(self):
        # Create an entry with no picks
        entry = Entry.objects.create(
            name="Empty Entry",
            user=self.user,
            tournament=self.tournament,
        )

        # Running update_tournament_scores should NOT crash on empty picks
        try:
            update_tournament_scores(self.tournament)
        except Exception as e:
            self.fail(f"update_tournament_scores raised an exception on empty picks: {e}")

        # Fetch updated entry
        entry.refresh_from_db()
        self.assertEqual(entry.score, 0)
        self.assertEqual(entry.potential_score, 0)
        self.assertEqual(entry.current_rank, 1)


class EntrySerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        start_date = timezone.now() + timezone.timedelta(days=1)
        self.tournament = Tournament.objects.create(
            year=start_date.year,
            start_date=start_date,
        )
        self.other_tournament = Tournament.objects.create(
            year=2023,
            start_date=timezone.make_aware(timezone.datetime(2023, 3, 15)),
        )

        # Create schools and teams for both tournaments
        self.school = School.objects.create(name="School A", abbrev="SCHA")
        self.team = TournamentTeam.objects.create(
            tournament=self.tournament,
            school=self.school,
            seed=1,
            region=TournamentTeam.Region.EAST,
        )
        self.other_team = TournamentTeam.objects.create(
            tournament=self.other_tournament,
            school=self.school,
            seed=1,
            region=TournamentTeam.Region.EAST,
        )

    def test_picks_limit_validation(self):
        # Create 21 teams
        teams_21 = []
        regions = [
            TournamentTeam.Region.EAST,
            TournamentTeam.Region.WEST,
            TournamentTeam.Region.SOUTH,
            TournamentTeam.Region.MIDWEST,
        ]
        for i in range(21):
            school = School.objects.create(name=f"School {i}", abbrev=f"SCH{i}")
            # Assign unique seed and region to satisfy unique_together constraint
            seed = (i % 15) + 2  # use 2 to 16 to avoid conflict with seed=1, region=EAST from setUp
            region = regions[i // 15]
            team = TournamentTeam.objects.create(
                tournament=self.tournament,
                school=school,
                seed=seed,
                region=region,
            )
            teams_21.append(team)

        # Try to validate serializer with 21 picks
        data = {
            "name": "Over Limit Entry",
            "tournament": self.tournament.id,
            "picks": [t.id for t in teams_21],
        }

        class DummyRequest:
            def __init__(self, user):
                self.user = user

        serializer = EntrySerializer(data=data, context={"request": DummyRequest(self.user)})
        self.assertFalse(serializer.is_valid())
        self.assertIn("picks", serializer.errors)

    def test_picks_tournament_validation(self):
        # Try to validate with team from other tournament
        data = {
            "name": "Invalid Tournament Pick Entry",
            "tournament": self.tournament.id,
            "picks": [self.other_team.id],
        }

        class DummyRequest:
            def __init__(self, user):
                self.user = user

        serializer = EntrySerializer(data=data, context={"request": DummyRequest(self.user)})
        self.assertFalse(serializer.is_valid())
        self.assertIn("picks", serializer.errors)


class TournamentAutomaticScoresTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        start_date = timezone.now() + timezone.timedelta(days=1)
        self.tournament = Tournament.objects.create(
            year=start_date.year,
            start_date=start_date,
        )
        self.school = School.objects.create(name="School A", abbrev="SCHA")
        # seed 15 => 4 points per win based on SEED_POINT_BANDS
        self.team = TournamentTeam.objects.create(
            tournament=self.tournament,
            school=self.school,
            seed=15,
            region=TournamentTeam.Region.EAST,
            wins=0,
            is_eliminated=False,
        )
        self.entry = Entry.objects.create(
            name="Test Entry",
            user=self.user,
            tournament=self.tournament,
        )
        self.entry.picks.add(self.team)

    def test_automatic_recalculation_on_team_save(self):
        # Update baseline
        update_tournament_scores(self.tournament)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.score, 0)
        self.assertEqual(self.entry.potential_score, 24)

        # Update team wins - triggers automatic recalculation via custom save()
        self.team.wins = 2
        self.team.save()

        self.entry.refresh_from_db()
        # 2 wins * 4 points = 8 points
        self.assertEqual(self.entry.score, 8)
        self.assertEqual(self.entry.potential_score, 24)

        # Eliminate team
        self.team.is_eliminated = True
        self.team.save()

        self.entry.refresh_from_db()
        self.assertEqual(self.entry.score, 8)
        self.assertEqual(self.entry.potential_score, 8)


class TournamentAPITests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(username="admin", password="password", is_staff=True)
        self.normal_user = User.objects.create_user(username="normal", password="password", is_staff=False)
        start_date = timezone.now() + timezone.timedelta(days=1)
        self.tournament = Tournament.objects.create(
            year=start_date.year,
            start_date=start_date,
        )
        self.school = School.objects.create(name="School A", abbrev="SCHA")
        self.school_secondary = School.objects.create(name="School B", abbrev="SCHB")
        self.team = TournamentTeam.objects.create(
            tournament=self.tournament,
            school=self.school,
            seed=1,
            region=TournamentTeam.Region.EAST,
        )

    def test_create_tournament_by_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-list")
        next_year = self.tournament.year + 1
        start_date = timezone.make_aware(timezone.datetime(next_year, 3, 15))
        data = {
            "year": next_year,
            "start_date": start_date.isoformat(),
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Tournament.objects.filter(year=next_year).count(), 1)

    def test_create_tournament_by_normal_user_denied(self):
        self.client.force_authenticate(user=self.normal_user)
        url = reverse("tournament-list")
        next_year = self.tournament.year + 1
        start_date = timezone.make_aware(timezone.datetime(next_year, 3, 15))
        data = {
            "year": next_year,
            "start_date": start_date.isoformat(),
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 403)

    def test_create_team_by_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-team-list", kwargs={"tournament_id": self.tournament.id})
        data = {
            "school": self.school_secondary.id,
            "seed": 16,
            "region": TournamentTeam.Region.WEST,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(TournamentTeam.objects.filter(tournament=self.tournament, seed=16).count(), 1)

    def test_patch_team_by_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-team-update", kwargs={"tournament_id": self.tournament.id, "pk": self.team.id})
        data = {
            "wins": 3,
            "is_eliminated": True,
        }
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, 200)
        self.team.refresh_from_db()
        self.assertEqual(self.team.wins, 3)
        self.assertTrue(self.team.is_eliminated)

    def test_create_duplicate_school_team_denied(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-team-list", kwargs={"tournament_id": self.tournament.id})
        data = {
            "school": self.school.id,  # school is already in tournament (self.team uses self.school)
            "seed": 16,
            "region": TournamentTeam.Region.EAST,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("school", response.data)

    def test_create_duplicate_seed_region_denied(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-team-list", kwargs={"tournament_id": self.tournament.id})
        data = {
            "school": self.school_secondary.id,
            "seed": 1,  # seed 1, region East is already taken by self.team
            "region": TournamentTeam.Region.EAST,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("seed", response.data)

    def test_add_denied_but_modify_allowed_when_tournament_locked(self):
        # Lock tournament
        self.tournament.start_date = timezone.now() - timezone.timedelta(days=1)
        self.tournament.save()

        self.client.force_authenticate(user=self.admin_user)
        # Try adding - should be denied
        url_add = reverse("tournament-team-list", kwargs={"tournament_id": self.tournament.id})
        data_add = {
            "school": self.school_secondary.id,
            "seed": 16,
            "region": TournamentTeam.Region.WEST,
        }
        response_add = self.client.post(url_add, data_add)
        self.assertEqual(response_add.status_code, 400)

        # Try modifying - should be allowed
        url_patch = reverse("tournament-team-update", kwargs={"tournament_id": self.tournament.id, "pk": self.team.id})
        data_patch = {"wins": 1}
        response_patch = self.client.patch(url_patch, data_patch)
        self.assertEqual(response_patch.status_code, 200)
        self.team.refresh_from_db()
        self.assertEqual(self.team.wins, 1)

        # Try removing (deleting) - should be denied under lock
        url_delete = reverse("tournament-team-update", kwargs={"tournament_id": self.tournament.id, "pk": self.team.id})
        response_delete = self.client.delete(url_delete)
        self.assertEqual(response_delete.status_code, 400)
        self.assertEqual(TournamentTeam.objects.filter(pk=self.team.id).count(), 1)

    def test_delete_team_by_admin_before_lock(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-team-update", kwargs={"tournament_id": self.tournament.id, "pk": self.team.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(TournamentTeam.objects.filter(pk=self.team.id).count(), 0)

    def test_delete_team_by_admin_after_lock_denied(self):
        # Lock tournament
        self.tournament.start_date = timezone.now() - timezone.timedelta(days=1)
        self.tournament.save()

        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-team-update", kwargs={"tournament_id": self.tournament.id, "pk": self.team.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TournamentTeam.objects.filter(pk=self.team.id).count(), 1)

    def test_modify_tournament_start_date_before_lock(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-detail", kwargs={"pk": self.tournament.id})
        new_start = self.tournament.start_date + timezone.timedelta(days=4)
        response = self.client.patch(url, {"start_date": new_start.isoformat()})
        self.assertEqual(response.status_code, 200)
        self.tournament.refresh_from_db()
        # Comparing dates, allow small parsing difference
        self.assertAlmostEqual(self.tournament.start_date, new_start, delta=timezone.timedelta(seconds=2))

    def test_create_tournament_mismatched_year_denied(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-list")
        next_year = self.tournament.year + 5
        start_date = timezone.make_aware(timezone.datetime(next_year, 3, 15))
        data = {
            "year": next_year - 1,
            "start_date": start_date.isoformat(),
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("start_date", response.data)

    def test_modify_tournament_after_lock_denied(self):
        # Lock tournament
        self.tournament.start_date = timezone.now() - timezone.timedelta(days=1)
        self.tournament.save()

        self.client.force_authenticate(user=self.admin_user)
        url = reverse("tournament-detail", kwargs={"pk": self.tournament.id})
        response = self.client.patch(url, {"year": 2026})
        self.assertEqual(response.status_code, 400)


class TournamentScoringPlaybookTests(TestCase):
    """
    An extremely thorough "Playbook" test for the scoring, ranking, and potential score logic.
    We simulate a complete tournament lifecycle for two players:
    - Alice: An entry representing a balanced, value-focused player.
    - Bob: An entry representing a high-seed, underdog-focused player.

    This test walks chronologically through 8 distinct stages (Checkpoints) of a tournament,
    verifying at each stage that:
    1. The current scores dynamically calculated match expectation based on team seed point bands.
    2. The optimistic potential score accurately reflects the greedy win allocation and global win constraints.
    3. The standings rankings match relative performance.
    4. The 'still_alive' flag correctly changes to False when a player can no longer catch up.
    5. The 'max_potential_rank' correctly reflects the best possible rank they can attain.
    """

    def setUp(self):
        # Create user accounts
        self.alice_user = User.objects.create_user(username="alice", password="password")
        self.bob_user = User.objects.create_user(username="bob", password="password")

        # Create tournament starting in the future
        start_date = timezone.now() + timezone.timedelta(days=1)
        self.tournament = Tournament.objects.create(
            year=start_date.year,
            start_date=start_date,
        )

        # Create schools to associate with teams
        self.school_1 = School.objects.create(name="School One", abbrev="SCH1")
        self.school_2 = School.objects.create(name="School Two", abbrev="SCH2")
        self.school_5 = School.objects.create(name="School Five", abbrev="SCH5")
        self.school_9 = School.objects.create(name="School Nine", abbrev="SCH9")
        self.school_13 = School.objects.create(name="School Thirteen", abbrev="SCH13")
        self.school_14 = School.objects.create(name="School Fourteen", abbrev="SCH14")

        # Create tournament teams
        # SEED_POINT_BANDS rules:
        # - Seeds 13-16: 4 points per win
        # - Seeds 9-12: 3 points per win
        # - Seeds 5-8: 2 points per win
        # - Seeds 1-4: 1 point per win

        # Team 1: Seed 1 (Region East) -> 1 point per win
        self.team_1 = TournamentTeam.objects.create(
            tournament=self.tournament, school=self.school_1, seed=1, region=TournamentTeam.Region.EAST
        )
        # Team 5: Seed 5 (Region East) -> 2 points per win
        self.team_5 = TournamentTeam.objects.create(
            tournament=self.tournament, school=self.school_5, seed=5, region=TournamentTeam.Region.EAST
        )
        # Team 9: Seed 9 (Region East) -> 3 points per win
        self.team_9 = TournamentTeam.objects.create(
            tournament=self.tournament, school=self.school_9, seed=9, region=TournamentTeam.Region.EAST
        )
        # Team 13: Seed 13 (Region East) -> 4 points per win
        self.team_13 = TournamentTeam.objects.create(
            tournament=self.tournament, school=self.school_13, seed=13, region=TournamentTeam.Region.EAST
        )
        # Team 2: Seed 2 (Region West) -> 1 point per win (unused by entries, but active in tournament)
        self.team_2 = TournamentTeam.objects.create(
            tournament=self.tournament, school=self.school_2, seed=2, region=TournamentTeam.Region.WEST
        )
        # Team 14: Seed 14 (Region West) -> 4 points per win
        self.team_14 = TournamentTeam.objects.create(
            tournament=self.tournament, school=self.school_14, seed=14, region=TournamentTeam.Region.WEST
        )

        # Create user entries (each user selects their picks)
        # Alice picks Team 1, Team 5, Team 9.
        self.alice_entry = Entry.objects.create(name="Alice Entry", user=self.alice_user, tournament=self.tournament)
        self.alice_entry.picks.add(self.team_1, self.team_5, self.team_9)

        # Bob picks Team 5, Team 13, Team 14.
        self.bob_entry = Entry.objects.create(name="Bob Entry", user=self.bob_user, tournament=self.tournament)
        self.bob_entry.picks.add(self.team_5, self.team_13, self.team_14)

    def set_total_tournament_wins(self, target_wins):
        """
        Helper method to balance the tournament total wins to an exact target.
        Since wins are aggregated across all teams, and each team can have a max of 6 wins,
        we dynamically distribute wins to dummy teams that are NOT picked by Alice or Bob.
        """
        current_wins = sum(t.wins for t in self.tournament.teams.all())
        if current_wins == target_wins:
            return

        needed = target_wins - current_wins
        if needed < 0:
            raise ValueError("Target wins is less than current wins. Test case should only advance chronologically.")

        # Get list of teams NOT picked by Alice or Bob
        picked_ids = {self.team_1.id, self.team_5.id, self.team_9.id, self.team_13.id, self.team_14.id}
        dummy_teams = list(self.tournament.teams.exclude(id__in=picked_ids))

        # Dynamically create dummy teams as needed to hold the wins without hitting the max wins validator (6)
        while len(dummy_teams) * 6 < needed:
            idx = len(dummy_teams) + 100
            school = School.objects.create(name=f"Dummy School {idx}", abbrev=f"DUM{idx}")

            # Use SOUTH and MIDWEST regions to prevent any possible seed/region collision
            seed = (len(dummy_teams) % 15) + 1
            region = TournamentTeam.Region.SOUTH if len(dummy_teams) < 15 else TournamentTeam.Region.MIDWEST

            dummy_team = TournamentTeam.objects.create(
                tournament=self.tournament,
                school=school,
                seed=seed,
                region=region,
                wins=0,
            )
            dummy_teams.append(dummy_team)

        for dummy in dummy_teams:
            if needed <= 0:
                break
            add_amount = min(needed, 6 - dummy.wins)
            if add_amount > 0:
                dummy.wins += add_amount
                dummy.save()
                needed -= add_amount

    def test_scoring_playbook_tournament_simulation(self):
        """
        Walks through the entire tournament playbook step-by-step to prove the scoring system correct.
        """
        # =====================================================================
        # CHECKPOINT 1: BEFORE ANY GAMES ARE PLAYED (Round 1, 0 global wins)
        # =====================================================================
        # At start, no teams have any wins.
        #
        # Alice picks: Team 1 (1 pt/win), Team 5 (2 pts/win), Team 9 (3 pts/win).
        # - Current Score: 0 (0 wins)
        # - Potential Gain Greedy Calculation:
        #   - Round 1 (32 wins available): Team 9, Team 5, Team 1 can all win. Gain: 1 + 2 + 3 = 6 pts.
        #   - Round 2 (16 wins available): Team 9, Team 5, Team 1 can all win. Gain: 1 + 2 + 3 = 6 pts.
        #   - Round 3 (8 wins available): Team 9, Team 5, Team 1 can all win. Gain: 1 + 2 + 3 = 6 pts.
        #   - Round 4 (4 wins available): Team 9, Team 5, Team 1 can all win. Gain: 1 + 2 + 3 = 6 pts.
        #   - Round 5 (2 wins available): Only 2 spots available!
        #     Sort remaining picks by value descending: Team 9 (3), Team 5 (2), Team 1 (1).
        #     Top 2 teams win (9 & 5). Gain: 3 + 2 = 5 pts.
        #   - Round 6 (1 win available): Only 1 spot available!
        #     Sort remaining eligible picks: Team 9 (3), Team 5 (2).
        #     Top 1 team wins (Team 9). Gain: 3 pts.
        #   - Total Potential Gain: 6 + 6 + 6 + 6 + 5 + 3 = 32 points.
        #   - Potential Score: 0 (current) + 32 = 32 points.
        #
        # Bob picks: Team 5 (2 pts/win), Team 13 (4 pts/win), Team 14 (4 pts/win).
        # - Current Score: 0 (0 wins)
        # - Potential Gain Greedy Calculation:
        #   - Round 1 (32 wins): Team 14, Team 13, Team 5 can all win. Gain: 4 + 4 + 2 = 10 pts.
        #   - Round 2 (16 wins): Team 14, Team 13, Team 5 can all win. Gain: 4 + 4 + 2 = 10 pts.
        #   - Round 3 (8 wins): Team 14, Team 13, Team 5 can all win. Gain: 4 + 4 + 2 = 10 pts.
        #   - Round 4 (4 wins): Team 14, Team 13, Team 5 can all win. Gain: 4 + 4 + 2 = 10 pts.
        #   - Round 5 (2 wins): Only 2 spots available!
        #     Sort by value descending: Team 13 (4), Team 14 (4), Team 5 (2).
        #     Top 2 win (13 & 14). Gain: 4 + 4 = 8 pts.
        #   - Round 6 (1 win): Only 1 spot available!
        #     Sort: Team 13 (4), Team 14 (4).
        #     Top 1 wins (Team 13). Gain: 4 pts.
        #   - Total Potential Gain: 10 + 10 + 10 + 10 + 8 + 4 = 52 points.
        #   - Potential Score: 0 (current) + 52 = 52 points.

        update_tournament_scores(self.tournament)
        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        # Alice baseline
        self.assertEqual(self.alice_entry.score, 0)
        self.assertEqual(self.alice_entry.potential_score, 32)
        self.assertEqual(self.alice_entry.current_rank, 1)  # tied for 1st
        self.assertEqual(self.alice_entry.max_potential_rank, 1)
        self.assertTrue(self.alice_entry.still_alive)

        # Bob baseline
        self.assertEqual(self.bob_entry.score, 0)
        self.assertEqual(self.bob_entry.potential_score, 52)
        self.assertEqual(self.bob_entry.current_rank, 1)  # tied for 1st
        self.assertEqual(self.bob_entry.max_potential_rank, 1)
        self.assertTrue(self.bob_entry.still_alive)

        # =====================================================================
        # CHECKPOINT 2: MID-ROUND 1 (10 global wins, Bob's Team 13 is eliminated)
        # =====================================================================
        # We are still in Round 1 (total_wins = 10 < 32).
        # Remaining wins in Round 1: 32 - 10 = 22.
        # Bob's team 13 is eliminated early with 0 wins.
        #
        # Trace Bob's potential score calculation:
        # - Active Picks: Team 5, Team 14.
        # - Current Score: 0
        # - Round 1 (22 wins available): Team 14 and Team 5 both win. Gain: 4 + 2 = 6 pts.
        # - Round 2 (16 wins): Both win. Gain: 6 pts.
        # - Round 3 (8 wins): Both win. Gain: 6 pts.
        # - Round 4 (4 wins): Both win. Gain: 6 pts.
        # - Round 5 (2 wins): Both win. Gain: 6 pts.
        # - Round 6 (1 win): Only 1 spot. Sort: Team 14 (4), Team 5 (2).
        #   Top team (Team 14) wins. Gain: 4 pts.
        # - Total Potential Gain: 6 + 6 + 6 + 6 + 6 + 4 = 34 points.
        # - Potential Score: 34 points.
        # Alice has no picks eliminated; her potential score remains 32.

        self.team_13.wins = 0
        self.team_13.is_eliminated = True
        self.team_13.save()  # saves and auto-recalculates standings through signal/save override

        self.set_total_tournament_wins(10)
        update_tournament_scores(self.tournament)

        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        # Alice unaffected
        self.assertEqual(self.alice_entry.score, 0)
        self.assertEqual(self.alice_entry.potential_score, 32)
        self.assertTrue(self.alice_entry.still_alive)

        # Bob drops from 52 potential score to 34 potential score
        self.assertEqual(self.bob_entry.score, 0)
        self.assertEqual(self.bob_entry.potential_score, 34)
        self.assertTrue(self.bob_entry.still_alive)

        # =====================================================================
        # CHECKPOINT 3: ROUND 2 BEGINS (32 global wins)
        # =====================================================================
        # Round 1 is fully finished (total wins = 32).
        # - Team 1 wins in Rd 1 (wins = 1, alive)
        # - Team 5 wins in Rd 1 (wins = 1, alive)
        # - Team 9 wins in Rd 1 (wins = 1, alive)
        # - Team 14 wins in Rd 1 (wins = 1, alive)
        # - Team 13 remains eliminated with 0 wins.
        # Now let's calculate:
        # - Alice picks: Team 1 (1), Team 5 (1), Team 9 (1). Current Score: 1 + 2 + 3 = 6 pts.
        # - Bob picks: Team 5 (1), Team 14 (1), Team 13 (0). Current Score: 2 + 4 + 0 = 6 pts.
        #
        # Alice's potential gain (current_round = 2, total_wins = 32):
        # - Active: Team 1 (1 win), Team 5 (1 win), Team 9 (1 win)
        # - Round 2 (16 wins): All are eligible. All win. Gain: 6 pts.
        # - Round 3 (8 wins): All win. Gain: 6 pts.
        # - Round 4 (4 wins): All win. Gain: 6 pts.
        # - Round 5 (2 wins): Sort: Team 9 (3), Team 5 (2), Team 1 (1). Top 2 win (9 & 5). Gain: 5 pts.
        # - Round 6 (1 win): Top 1 wins (Team 9). Gain: 3 pts.
        # - Total Potential Gain: 6 + 6 + 6 + 5 + 3 = 26 points.
        # - Potential Score: 6 (current) + 26 = 32 points.
        #
        # Bob's potential gain:
        # - Active: Team 5 (1 win), Team 14 (1 win)
        # - Round 2 (16 wins): Both win. Gain: 6 pts.
        # - Round 3 (8 wins): Both win. Gain: 6 pts.
        # - Round 4 (4 wins): Both win. Gain: 6 pts.
        # - Round 5 (2 wins): Both win. Gain: 6 pts.
        # - Round 6 (1 win): Sort: Team 14 (4), Team 5 (2). Top 1 wins (Team 14). Gain: 4 pts.
        # - Total Potential Gain: 6 + 6 + 6 + 6 + 4 = 28 points.
        # - Potential Score: 6 (current) + 28 = 34 points.

        # First, set wins for our active teams
        self.team_1.wins = 1
        self.team_1.save()
        self.team_5.wins = 1
        self.team_5.save()
        self.team_9.wins = 1
        self.team_9.save()
        self.team_14.wins = 1
        self.team_14.save()

        # Balance tournament wins to 32
        self.set_total_tournament_wins(32)
        update_tournament_scores(self.tournament)

        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        self.assertEqual(self.alice_entry.score, 6)
        self.assertEqual(self.alice_entry.potential_score, 32)
        self.assertEqual(self.alice_entry.current_rank, 1)  # tied
        self.assertTrue(self.alice_entry.still_alive)

        self.assertEqual(self.bob_entry.score, 6)
        self.assertEqual(self.bob_entry.potential_score, 34)
        self.assertEqual(self.bob_entry.current_rank, 1)  # tied
        self.assertTrue(self.bob_entry.still_alive)

        # =====================================================================
        # CHECKPOINT 4: MID-ROUND 2 (40 global wins)
        # =====================================================================
        # We are midway through Round 2. Total wins = 40.
        # Wins remaining in Round 2: 16 - (40 - 32) = 8.
        # - Team 1: 1 win, alive (has not played/won Round 2 yet)
        # - Team 5: 1 win, alive (has not played/won Round 2 yet)
        # - Team 9: wins = 2, alive (already won Round 2)
        # - Team 14: wins = 2, alive (already won Round 2)
        # - Team 13: 0 wins, eliminated.
        #
        # Alice's score: Team 1 (1 * 1) + Team 5 (1 * 2) + Team 9 (2 * 3) = 9 pts.
        # Bob's score: Team 5 (1 * 2) + Team 14 (2 * 4) = 10 pts.
        #
        # Alice's potential gain (current_round = 2, total_wins = 40):
        # - Active: Team 1 (1 win), Team 5 (1 win), Team 9 (2 wins)
        # - Round 2 (8 wins remaining): Eligible: Team 1 and Team 5 (both at r-1=1 win).
        #   Both are awarded a win. Gain: 1 + 2 = 3 pts.
        #   Hypothetical wins: Team 1: 2, Team 5: 2, Team 9: 2.
        # - Round 3 (8 wins): All win. Gain: 6 pts.
        # - Round 4 (4 wins): All win. Gain: 6 pts.
        # - Round 5 (2 wins): Top 2 win (9 & 5). Gain: 5 pts.
        # - Round 6 (1 win): Top 1 wins (Team 9). Gain: 3 pts.
        # - Total Potential Gain: 3 + 6 + 6 + 5 + 3 = 23 points.
        # - Potential Score: 9 (current) + 23 = 32 points.
        #
        # Bob's potential gain (current_round = 2, total_wins = 40):
        # - Active: Team 5 (1 win), Team 14 (2 wins)
        # - Round 2 (8 wins remaining): Eligible: Team 5.
        #   Awarded a win. Gain: 2 pts.
        #   Hypothetical wins: Team 5: 2, Team 14: 2.
        # - Round 3 (8 wins): Both win. Gain: 6 pts.
        # - Round 4 (4 wins): Both win. Gain: 6 pts.
        # - Round 5 (2 wins): Both win. Gain: 6 pts.
        # - Round 6 (1 win): Top 1 wins (Team 14). Gain: 4 pts.
        # - Total Potential Gain: 2 + 6 + 6 + 6 + 4 = 24 points.
        # - Potential Score: 10 (current) + 24 = 34 points.

        self.team_9.wins = 2
        self.team_9.save()
        self.team_14.wins = 2
        self.team_14.save()

        self.set_total_tournament_wins(40)
        update_tournament_scores(self.tournament)

        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        self.assertEqual(self.alice_entry.score, 9)
        self.assertEqual(self.alice_entry.potential_score, 32)
        self.assertEqual(self.alice_entry.current_rank, 2)  # Bob has 10, Alice has 9
        self.assertTrue(self.alice_entry.still_alive)

        self.assertEqual(self.bob_entry.score, 10)
        self.assertEqual(self.bob_entry.potential_score, 34)
        self.assertEqual(self.bob_entry.current_rank, 1)  # Bob leads
        self.assertTrue(self.bob_entry.still_alive)

        # =====================================================================
        # CHECKPOINT 5: ROUND 3 BEGINS (48 global wins, Team 5 is ELIMINATED)
        # =====================================================================
        # Round 2 is complete (total wins = 48).
        # - Team 5 gets eliminated in Round 2 with 1 win.
        # - Team 1 wins in Round 2 (wins = 2, alive).
        # - Team 9 stays alive with 2 wins.
        # - Team 14 stays alive with 2 wins.
        # Current scores:
        # - Alice picks: Team 1 (2), Team 5 (1, eliminated), Team 9 (2). Score: 2 + 2 + 6 = 10 pts.
        # - Bob picks: Team 5 (1, eliminated), Team 14 (2), Team 13 (0, eliminated). Score: 2 + 8 + 0 = 10 pts.
        #
        # Alice's potential gain (current_round = 3, total_wins = 48):
        # - Active: Team 1 (2 wins), Team 9 (2 wins)
        # - Round 3 (8 wins): Both win. Gain: 1 + 3 = 4 pts. Hypothetical: 3.
        # - Round 4 (4 wins): Both win. Gain: 4 pts. Hypothetical: 4.
        # - Round 5 (2 wins): Both win. Gain: 4 pts. Hypothetical: 5.
        # - Round 6 (1 win): Top 1 wins (Team 9). Gain: 3 pts. Hypothetical: Team 9: 6.
        # - Total Potential Gain: 4 + 4 + 4 + 3 = 15 points.
        # - Potential Score: 10 (current) + 15 = 25 points.
        #
        # Bob's potential gain (current_round = 3, total_wins = 48):
        # - Active: Team 14 (2 wins)
        # - Round 3 (8 wins): Team 14 wins. Gain: 4 pts. Hypothetical: 3.
        # - Round 4 (4 wins): Team 14 wins. Gain: 4 pts. Hypothetical: 4.
        # - Round 5 (2 wins): Team 14 wins. Gain: 4 pts. Hypothetical: 5.
        # - Round 6 (1 win): Team 14 wins. Gain: 4 pts. Hypothetical: 6.
        # - Total Potential Gain: 4 + 4 + 4 + 4 = 16 points.
        # - Potential Score: 10 (current) + 16 = 26 points.

        self.team_5.wins = 1
        self.team_5.is_eliminated = True
        self.team_5.save()

        self.team_1.wins = 2
        self.team_1.save()

        self.set_total_tournament_wins(48)
        update_tournament_scores(self.tournament)

        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        self.assertEqual(self.alice_entry.score, 10)
        self.assertEqual(self.alice_entry.potential_score, 25)
        self.assertEqual(self.alice_entry.current_rank, 1)  # tied
        self.assertTrue(self.alice_entry.still_alive)

        self.assertEqual(self.bob_entry.score, 10)
        self.assertEqual(self.bob_entry.potential_score, 26)
        self.assertEqual(self.bob_entry.current_rank, 1)  # tied
        self.assertTrue(self.bob_entry.still_alive)

        # =====================================================================
        # CHECKPOINT 6: MID-ROUND 3 (52 global wins)
        # =====================================================================
        # Midway through Round 3. Total wins = 52.
        # Wins remaining in Round 3: 8 - (52 - 48) = 4.
        # - Team 1: 2 wins, alive (has not won/played Rd 3 game yet)
        # - Team 9: 3 wins, alive (won Rd 3 game)
        # - Team 14: 3 wins, alive (won Rd 3 game)
        # Current scores:
        # - Alice: Team 1 (2 * 1) + Team 5 (1 * 2) + Team 9 (3 * 3) = 13 pts.
        # - Bob: Team 5 (1 * 2) + Team 14 (3 * 4) = 14 pts.
        #
        # Alice's potential gain (current_round = 3, total_wins = 52):
        # - Active: Team 1 (2 wins), Team 9 (3 wins)
        # - Round 3 (4 wins remaining): Eligible: Team 1.
        #   Awarded win. Gain: 1 pt.
        #   Hypothetical wins: Team 1: 3, Team 9: 3.
        # - Round 4 (4 wins): Both win. Gain: 4 pts.
        # - Round 5 (2 wins): Both win. Gain: 4 pts.
        # - Round 6 (1 win): Top 1 wins (Team 9). Gain: 3 pts.
        # - Total Potential Gain: 1 + 4 + 4 + 3 = 12 points.
        # - Potential Score: 13 (current) + 12 = 25 points.
        #
        # Bob's potential gain (current_round = 3, total_wins = 52):
        # - Active: Team 14 (3 wins)
        # - Round 3 (4 wins remaining): Eligible: none (Team 14 has 3 wins). Gain: 0.
        # - Round 4 (4 wins): Team 14 wins. Gain: 4 pts.
        # - Round 5 (2 wins): Team 14 wins. Gain: 4 pts.
        # - Round 6 (1 win): Team 14 wins. Gain: 4 pts.
        # - Total Potential Gain: 0 + 4 + 4 + 4 = 12 points.
        # - Potential Score: 14 (current) + 12 = 26 points.

        self.team_9.wins = 3
        self.team_9.save()
        self.team_14.wins = 3
        self.team_14.save()

        self.set_total_tournament_wins(52)
        update_tournament_scores(self.tournament)

        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        self.assertEqual(self.alice_entry.score, 13)
        self.assertEqual(self.alice_entry.potential_score, 25)
        self.assertEqual(self.alice_entry.current_rank, 2)  # Alice is behind
        self.assertTrue(self.alice_entry.still_alive)

        self.assertEqual(self.bob_entry.score, 14)
        self.assertEqual(self.bob_entry.potential_score, 26)
        self.assertEqual(self.bob_entry.current_rank, 1)  # Bob leads
        self.assertTrue(self.bob_entry.still_alive)

        # =====================================================================
        # CHECKPOINT 7: ROUND 4 BEGINS (56 global wins, Team 9 is ELIMINATED)
        # =====================================================================
        # Round 3 is complete. Total wins = 56.
        # - Team 9 gets ELIMINATED in Round 3 with 3 wins.
        # - Team 1 wins in Round 3 (wins = 3, alive).
        # - Team 14 stays alive with 3 wins.
        # Current scores:
        # - Alice picks: Team 1 (3), Team 5 (1, eliminated), Team 9 (3, eliminated). Score: 3 + 2 + 9 = 14 pts.
        # - Bob picks: Team 5 (1, eliminated), Team 14 (3), Team 13 (0, eliminated). Score: 2 + 12 + 0 = 14 pts.
        #
        # Alice's potential gain (current_round = 4, total_wins = 56):
        # - Active: Team 1 (3 wins)
        # - Round 4 (4 wins): Team 1 wins. Gain: 1 pt. Hypothetical: 4.
        # - Round 5 (2 wins): Team 1 wins. Gain: 1 pt. Hypothetical: 5.
        # - Round 6 (1 win): Team 1 wins. Gain: 1 pt. Hypothetical: 6.
        # - Total Potential Gain: 1 + 1 + 1 = 3 points.
        # - Potential Score: 14 (current) + 3 = 17 points.
        #
        # Bob's potential gain (current_round = 4, total_wins = 56):
        # - Active: Team 14 (3 wins)
        # - Round 4 (4 wins): Team 14 wins. Gain: 4 pts. Hypothetical: 4.
        # - Round 5 (2 wins): Team 14 wins. Gain: 4 pts. Hypothetical: 5.
        # - Round 6 (1 win): Team 14 wins. Gain: 4 pts. Hypothetical: 6.
        # - Total Potential Gain: 4 + 4 + 4 = 12 points.
        # - Potential Score: 14 (current) + 12 = 26 points.

        self.team_9.wins = 3
        self.team_9.is_eliminated = True
        self.team_9.save()

        self.team_1.wins = 3
        self.team_1.save()

        self.set_total_tournament_wins(56)
        update_tournament_scores(self.tournament)

        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        self.assertEqual(self.alice_entry.score, 14)
        self.assertEqual(self.alice_entry.potential_score, 17)
        self.assertEqual(self.alice_entry.current_rank, 1)  # tied
        self.assertTrue(self.alice_entry.still_alive)

        self.assertEqual(self.bob_entry.score, 14)
        self.assertEqual(self.bob_entry.potential_score, 26)
        self.assertEqual(self.bob_entry.current_rank, 1)  # tied
        self.assertTrue(self.bob_entry.still_alive)

        # =====================================================================
        # CHECKPOINT 8: ROUND 5 BEGINS (60 global wins, Team 1 is ELIMINATED)
        # =====================================================================
        # Round 4 is complete. Total wins = 60.
        # - Team 1 is ELIMINATED in Round 4 with 3 wins.
        # - Team 14 wins in Round 4 (wins = 4, alive).
        # Current scores:
        # - Alice picks: Team 1 (3, eliminated), Team 5 (1, eliminated), Team 9 (3, eliminated). Score: 3 + 2 + 9 = 14 pts.
        # - Bob picks: Team 5 (1, eliminated), Team 14 (4), Team 13 (0, eliminated). Score: 2 + 16 + 0 = 18 pts.
        #
        # Alice's potential gain (current_round = 5, total_wins = 60):
        # - No active picks left. Potential score = 14.
        #
        # Bob's potential gain (current_round = 5, total_wins = 60):
        # - Active: Team 14 (4 wins)
        # - Round 5 (2 wins): Team 14 wins. Gain: 4 pts. Hypothetical: 5.
        # - Round 6 (1 win): Team 14 wins. Gain: 4 pts. Hypothetical: 6.
        # - Total Potential Gain: 4 + 4 = 8 points.
        # - Potential Score: 18 (current) + 8 = 26 points.
        #
        # Critical Standing Outcomes:
        # - Bob leads Alice 18 to 14.
        # - Alice's potential score (14) is strictly less than Bob's current score (18).
        # - This means Alice is mathematically eliminated! She can no longer catch Bob.
        # - Expected Alice.still_alive: False
        # - Alice's max potential rank is 2 (since Bob already has 18, and Alice can never exceed 14).

        self.team_1.wins = 3
        self.team_1.is_eliminated = True
        self.team_1.save()

        self.team_14.wins = 4
        self.team_14.save()

        self.set_total_tournament_wins(60)
        update_tournament_scores(self.tournament)

        self.alice_entry.refresh_from_db()
        self.bob_entry.refresh_from_db()

        # Alice is mathematically eliminated!
        self.assertEqual(self.alice_entry.score, 14)
        self.assertEqual(self.alice_entry.potential_score, 14)
        self.assertEqual(self.alice_entry.current_rank, 2)
        self.assertEqual(self.alice_entry.max_potential_rank, 2)  # Cannot get higher than rank 2
        self.assertFalse(self.alice_entry.still_alive)  # Still Alive is FALSE!

        # Bob is leading and still alive
        self.assertEqual(self.bob_entry.score, 18)
        self.assertEqual(self.bob_entry.potential_score, 26)
        self.assertEqual(self.bob_entry.current_rank, 1)
        self.assertEqual(self.bob_entry.max_potential_rank, 1)
        self.assertTrue(self.bob_entry.still_alive)


class TournamentScoringLimitsTests(TestCase):
    """
    Validates extreme mathematical boundaries and exact maximums/minimums of the greedy
    potential scoring system for standard 20-pick entries.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="limit_user", password="password")
        start_date = timezone.now() + timezone.timedelta(days=1)
        self.tournament = Tournament.objects.create(
            year=start_date.year,
            start_date=start_date,
        )

    def test_absolute_maximum_potential_score_is_200(self):
        """
        Proof of the absolute maximum possible potential score in a 20-team pick setup.
        To hit the absolute max:
        - 16 picks must be from the highest point-band (Seeds 13-16, 4 points/win).
        - 4 picks must be from the next highest point-band (Seeds 9-12, 3 points/win).

        Using greedy win allocation:
        - Round 1: All 20 win -> (16 * 4) + (4 * 3) = 76 points
        - Round 2: 16 win (all 4-point teams) -> (16 * 4) = 64 points
        - Round 3: 8 win (all 4-point teams) -> (8 * 4) = 32 points
        - Round 4: 4 win (all 4-point teams) -> (4 * 4) = 16 points
        - Round 5: 2 win (all 4-point teams) -> (2 * 4) = 8 points
        - Round 6: 1 wins (all 4-point teams) -> (1 * 4) = 4 points
        Total = 76 + 64 + 32 + 16 + 8 + 4 = 200 points.
        """
        # Create 16 teams with seeds 13-16
        # To avoid violating unique constraints, distribute seeds/regions properly
        teams_high_value = []
        regions = [
            TournamentTeam.Region.EAST,
            TournamentTeam.Region.WEST,
            TournamentTeam.Region.SOUTH,
            TournamentTeam.Region.MIDWEST,
        ]

        # Create 16 teams with seeds 13-16 across 4 regions (16 unique combinations)
        idx = 1
        for seed in range(13, 17):
            for region in regions:
                school = School.objects.create(name=f"School MaxHigh {idx}", abbrev=f"H{idx}")
                team = TournamentTeam.objects.create(
                    tournament=self.tournament,
                    school=school,
                    seed=seed,
                    region=region,
                )
                teams_high_value.append(team)
                idx += 1

        # Create 4 teams with seed 9 (value = 3 points per win)
        teams_mid_value = []
        for r_idx, region in enumerate(regions):
            school = School.objects.create(name=f"School MaxMid {r_idx}", abbrev=f"M{r_idx}")
            team = TournamentTeam.objects.create(
                tournament=self.tournament,
                school=school,
                seed=9,
                region=region,
            )
            teams_mid_value.append(team)

        # Create entry with exactly 20 picks (16 high-value + 4 mid-value)
        entry = Entry.objects.create(
            name="Max Potential Entry",
            user=self.user,
            tournament=self.tournament,
        )
        entry.picks.add(*(teams_high_value + teams_mid_value))

        # Recalculate scores and verify potential score is exactly 200
        update_tournament_scores(self.tournament)
        entry.refresh_from_db()

        self.assertEqual(entry.score, 0)
        self.assertEqual(entry.potential_score, 200)

    def test_absolute_minimum_potential_score_is_47_for_16_picks(self):
        """
        Proof of the absolute minimum possible potential score for a valid 16-team pick setup
        where no teams are eliminated.
        To hit the absolute min for 16 picks:
        - All 16 picks must be from the lowest point-band (Seeds 1-4, 1 point/win).

        Using greedy win allocation:
        - Round 1: All 16 win -> (16 * 1) = 16 points
        - Round 2: All 16 win -> (16 * 1) = 16 points
        - Round 3: 8 win -> (8 * 1) = 8 points
        - Round 4: 4 win -> (4 * 1) = 4 points
        - Round 5: 2 win -> (2 * 1) = 2 points
        - Round 6: 1 wins -> (1 * 1) = 1 point
        Total = 16 + 16 + 8 + 4 + 2 + 1 = 47 points.
        """
        teams_low_value = []
        regions = [
            TournamentTeam.Region.EAST,
            TournamentTeam.Region.WEST,
            TournamentTeam.Region.SOUTH,
            TournamentTeam.Region.MIDWEST,
        ]

        # Create 16 unique low value combinations (seeds 1-4, across 4 regions)
        idx = 1
        for seed in range(1, 5):
            for region in regions:
                school = School.objects.create(name=f"School MinLow {idx}", abbrev=f"L{idx}")
                team = TournamentTeam.objects.create(
                    tournament=self.tournament,
                    school=school,
                    seed=seed,
                    region=region,
                )
                teams_low_value.append(team)
                idx += 1

        # Create entry with exactly 16 picks of value 1
        entry = Entry.objects.create(
            name="Min Potential Entry 16 Picks",
            user=self.user,
            tournament=self.tournament,
        )
        entry.picks.add(*teams_low_value)

        # Recalculate and assert
        update_tournament_scores(self.tournament)
        entry.refresh_from_db()

        self.assertEqual(entry.score, 0)
        self.assertEqual(entry.potential_score, 47)

    def test_absolute_minimum_potential_score_is_70_for_20_picks(self):
        """
        Proof of the absolute minimum possible potential score for a valid 20-team pick setup.
        Since there are only 16 unique spots in the lowest point-band (seeds 1-4 across 4 regions),
        a full 20-team entry is forced to select at least 4 teams from the next point-band (seeds 5-8, 2 points/win).

        Using greedy win allocation:
        - Round 1: All 20 win -> (16 * 1) + (4 * 2) = 24 points
        - Round 2 (16 wins): Prioritizes 4 teams of value 2 + 12 teams of value 1 -> (4 * 2) + (12 * 1) = 20 points
        - Round 3 (8 wins): Prioritizes 4 teams of value 2 + 4 teams of value 1 -> (4 * 2) + (4 * 1) = 12 points
        - Round 4 (4 wins): Prioritizes 4 teams of value 2 -> (4 * 2) = 8 points
        - Round 5 (2 wins): Prioritizes 2 teams of value 2 -> (2 * 2) = 4 points
        - Round 6 (1 win): Prioritizes 1 team of value 2 -> (1 * 2) = 2 points
        Total = 24 + 20 + 12 + 8 + 4 + 2 = 70 points.
        """
        # 16 teams with seeds 1-4
        teams_16 = []
        regions = [
            TournamentTeam.Region.EAST,
            TournamentTeam.Region.WEST,
            TournamentTeam.Region.SOUTH,
            TournamentTeam.Region.MIDWEST,
        ]

        idx = 1
        for seed in range(1, 5):
            for region in regions:
                school = School.objects.create(name=f"School MinLow20 {idx}", abbrev=f"L20_{idx}")
                team = TournamentTeam.objects.create(
                    tournament=self.tournament,
                    school=school,
                    seed=seed,
                    region=region,
                )
                teams_16.append(team)
                idx += 1

        # 4 teams with seed 5 (value = 2 points per win)
        teams_4 = []
        for r_idx, region in enumerate(regions):
            school = School.objects.create(name=f"School MinLow20_5 {r_idx}", abbrev=f"L20_5_{r_idx}")
            team = TournamentTeam.objects.create(
                tournament=self.tournament,
                school=school,
                seed=5,
                region=region,
            )
            teams_4.append(team)

        # Create entry with exactly 20 picks
        entry = Entry.objects.create(
            name="Min Potential Entry 20 Picks",
            user=self.user,
            tournament=self.tournament,
        )
        entry.picks.add(*(teams_16 + teams_4))

        # Recalculate and assert
        update_tournament_scores(self.tournament)
        entry.refresh_from_db()

        self.assertEqual(entry.score, 0)
        self.assertEqual(entry.potential_score, 70)
