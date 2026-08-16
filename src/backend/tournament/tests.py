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

    def test_add_or_modify_team_when_tournament_locked_denied(self):
        # Lock tournament
        self.tournament.start_date = timezone.now() - timezone.timedelta(days=1)
        self.tournament.save()

        self.client.force_authenticate(user=self.admin_user)
        # Try adding
        url_add = reverse("tournament-team-list", kwargs={"tournament_id": self.tournament.id})
        data_add = {
            "school": self.school_secondary.id,
            "seed": 16,
            "region": TournamentTeam.Region.WEST,
        }
        response_add = self.client.post(url_add, data_add)
        self.assertEqual(response_add.status_code, 400)

        # Try modifying
        url_patch = reverse("tournament-team-update", kwargs={"tournament_id": self.tournament.id, "pk": self.team.id})
        data_patch = {"wins": 1}
        response_patch = self.client.patch(url_patch, data_patch)
        self.assertEqual(response_patch.status_code, 400)

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
