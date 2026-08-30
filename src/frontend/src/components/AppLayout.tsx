import { AppShell, Burger, Group, NavLink, Title, Button, Text, NativeSelect, Image, ActionIcon, Modal, TextInput, NumberInput, Stack } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrophy } from '@tabler/icons-react';
import api, { logOutUser, API_ENDPOINTS } from '../api';
import { ROUTES } from '../routes';
import { LOCAL_STORAGE_KEYS } from '../localStorageKeys';

export function AppLayout() {
  const [burgerOpened, { toggle: burgerToggle, close: burgerClose }] = useDisclosure();
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [tournament, setTournament] = useLocalStorage({ key: LOCAL_STORAGE_KEYS.SELECTED_TOURNAMENT, defaultValue: "" })
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [newYear, setNewYear] = useState<number | "">(new Date().getFullYear());
  const [newStartDate, setNewStartDate] = useState("");
  const [createTournamentLoading, setCreateTournamentLoading] = useState(false);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear || !newStartDate) {
      notifications.show({
        title: "Validation Error",
        message: "Please fill in all tournament fields.",
        color: "yellow",
      });
      return;
    }

    setCreateTournamentLoading(true);
    try {
      const response = await api.post(API_ENDPOINTS.tournaments.list, {
        year: Number(newYear),
        start_date: new Date(newStartDate).toISOString(),
      });
      notifications.show({
        title: "Success",
        message: `${response.data.year} Tournament has been created!`,
        color: "green",
      });
      if (response.data && response.data.id) {
        setTournament(response.data.id.toString());
      }
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setNewYear(new Date().getFullYear() + 1);
      setNewStartDate("");
      closeCreateModal();
    } catch (err: any) {
      notifications.show({
        title: "Creation Failed",
        message: JSON.stringify(err.response?.data) || "Could not create tournament.",
        color: "red",
      });
    } finally {
      setCreateTournamentLoading(false);
    }
  };

  const handleLogout = () => {
    logOutUser();
    navigate(ROUTES.login);
  };

  // Helper to handle both closing and navigating
  const handleNavigate = (path: string) => {
    burgerClose();
    navigate(path);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments'],
    // Extract the actual data from the Axios response object
    queryFn: () => api.get(API_ENDPOINTS.tournaments.list).then((res) => res.data),
    // Transform the array for Mantine's requirements
    select: (items: any[]) =>
      items.map((t) => ({
        label: `${t.year} Tournament`,
        value: t.id.toString()
      }))
  });

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => api.get(API_ENDPOINTS.auth.user).then(res => res.data),
  });

  // Fallback: If no selection exists in local storage, select the first one from API
  useEffect(() => {
    if (!tournament && data && data.length > 0) {
      const firstId = data[0].value;
      setTournament(firstId);
    }
  }, [data, tournament]);


  const { data: tournamentDetail, isLoading: isTournamentDetailLoading, isError: isTournamentDetailError } = useQuery({
    queryKey: ['tournamentDetail', tournament],
    queryFn: () => api.get(API_ENDPOINTS.tournaments.detail(tournament)).then(res => res.data),
    enabled: !!tournament,
  });
  isTournamentDetailLoading; // trick linter for now. I want to remember this is available

  // Reset to fallback if the tournament detail query above fails (e.g. bogus/invalid ID in localStorage)
  // This triggers the Fallback effect to select the first tournament from the API list
  useEffect(() => {
    if (isTournamentDetailError) {
      setTournament("");
    }
  }, [isTournamentDetailError, setTournament]);


  // consider using the useLocalStorage() hook from @mantine/hooks
  // rather than useState + this handler
  const handleTournamentChange = (value: string) => {
    setTournament(value);
    // if we're not on an teams view, switch back to the entries table.
    // it only makes sense to see the same page after switching years 
    // if the object can span tournaments - right now that is only the teams list
    if (!(location.pathname.includes(ROUTES.teams) || location.pathname.includes(ROUTES.adminDashboard))) {
      navigate(ROUTES.entries)
    }
  };


  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'md',
        collapsed: { mobile: !burgerOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Burger opened={burgerOpened} onClick={burgerToggle} hiddenFrom="md" size="sm" />
            <Image
              src="/favicon.png" // Replace with your actual image path or URL
              alt="Pick20 Logo"
              h={30}         // Adjust height to match your title size
              w="auto"
            />
            <Title order={3} visibleFrom="md">Felknor's Pick20</Title>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <NativeSelect
              value={tournament}
              onChange={(event) => handleTournamentChange(event.currentTarget.value)}
              // Ensure data is at least an empty array. Otherwise we get an error if data isn't yet fetched
              data={data ?? []}
              disabled={isLoading}
              w={200}
            />
            {userProfile && (userProfile.is_staff || userProfile.is_superuser) && (
              <ActionIcon
                variant="light"
                color="blue"
                size="lg"
                onClick={openCreateModal}
                title="Create New Tournament"
              >
                <IconPlus size={18} />
              </ActionIcon>
            )}
          </Group>
          {/* Logout button moved to Navbar on mobile, visible only on Desktop header */}
          <Button variant="subtle" color="red" onClick={handleLogout} visibleFrom="md" size="sm">
            Logout
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          {/* Mobile-only title at the top of the drawer */}
          <Title order={4} hiddenFrom="md" mb='md'>Felknor's Pick20</Title>
          <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase' }}>
            Navigation
          </Text>
          <NavLink
            label={tournamentDetail?.is_locked ? "Standings" : "Entries"}
            active={location.pathname.includes(ROUTES.entries)}
            onClick={() => handleNavigate(ROUTES.entries)}
          />
          {/* TODO: add schools */}
          <NavLink
            label="Teams"
            active={location.pathname === ROUTES.teams}
            onClick={() => handleNavigate(ROUTES.teams)}
          />
          <NavLink
            label="Rules"
            active={location.pathname === ROUTES.rules}
            onClick={() => handleNavigate(ROUTES.rules)}
          />
          <NavLink
            label="Profile"
            active={location.pathname === ROUTES.profile}
            onClick={() => handleNavigate(ROUTES.profile)}
          />
          {userProfile && (userProfile.is_staff || userProfile.is_superuser) && (
            <NavLink
              label="Admin Dashboard"
              active={location.pathname === ROUTES.adminDashboard}
              onClick={() => handleNavigate(ROUTES.adminDashboard)}
            />
          )}
        </AppShell.Section>

        {/* Mobile-only Logout at the bottom of the drawer */}
        <AppShell.Section hiddenFrom="md">
          <Button
            variant="light"
            color="red"
            fullWidth
            onClick={handleLogout}
            mt="md"
          >
            Logout
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet context={{ tournament }} />
      </AppShell.Main>

      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={
          <Group gap="xs">
            <IconTrophy size={20} color="orange" />
            <Text fw={700}>Create Tournament</Text>
          </Group>
        }
        centered
      >
        <form onSubmit={handleCreateTournament}>
          <Stack gap="sm">
            <NumberInput
              label="Tournament Year"
              placeholder={new Date().getFullYear().toString()}
              value={newYear}
              onChange={(val) => setNewYear(val === "" ? "" : Number(val))}
              required
              min={1900}
              max={2100}
            />
            <TextInput
              label="Start Date & Time (Picks Lock)"
              placeholder="Select date and time"
              type="datetime-local"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.currentTarget.value)}
              required
            />
            <Button type="submit" loading={createTournamentLoading} mt="xs" fullWidth>
              Create Tournament
            </Button>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}