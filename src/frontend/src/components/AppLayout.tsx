import { AppShell, Burger, Group, NavLink, Title, Button, Text, NativeSelect, Image } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

export function AppLayout() {
  const [burgerOpened, { toggle: burgerToggle, close: burgerClose }] = useDisclosure();
  const [tournament, setTournament] = useState(() => {
    return localStorage.getItem('selectedTournament') || "";
  });
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  // Helper to handle both closing and navigating
  const handleNavigate = (path: string) => {
    burgerClose();
    navigate(path);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments'],
    // Extract the actual data from the Axios response object
    queryFn: () => api.get("/api/tournament/").then((res) => res.data),
    // Transform the array for Mantine's requirements
    select: (items: any[]) =>
      items.map((t) => ({
        label: `${t.year} Tournament`,
        value: t.id.toString()
      }))
  });

  // Fallback: If no selection exists in local storage, select the first one from API
  useEffect(() => {
    if (!tournament && data && data.length > 0) {
      const firstId = data[0].value;
      setTournament(firstId);
      localStorage.setItem('selectedTournament', firstId);
    }
  }, [data, tournament]);


  // consider using the useLocalStorage() hook from @mantine/hooks
  // rather than useState + this handler
  const handleTournamentChange = (value: string) => {
    setTournament(value);
    localStorage.setItem('selectedTournament', value);
    navigate("/entries")
  }


  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !burgerOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Burger opened={burgerOpened} onClick={burgerToggle} hiddenFrom="sm" size="sm" />
            <Image
              src="/favicon.png" // Replace with your actual image path or URL
              alt="Pick20 Logo"
              h={30}         // Adjust height to match your title size
              w="auto"
            />
            <Title order={3} visibleFrom="xs">Felknor's Pick20</Title>
          </Group>
          <NativeSelect
            value={tournament}
            onChange={(event) => handleTournamentChange(event.currentTarget.value)}
            // Ensure data is at least an empty array. Otherwise we get an error if data isn't yet fetched
            data={data ?? []}
            disabled={isLoading}
            w={200}
          />
          {/* Logout button moved to Navbar on mobile, visible only on Desktop header */}
          <Button variant="subtle" color="red" onClick={handleLogout} visibleFrom="sm" size="sm">
            Logout
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          {/* Mobile-only title at the top of the drawer */}
          <Title order={4} hiddenFrom="sm" mb='md'>Felknor's Pick20</Title>
          <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase' }}>
            Navigation
          </Text>
          <NavLink
            label="Entries"
            active={location.pathname === '/entries' || location.pathname.includes("/entry")}
            onClick={() => handleNavigate('/entries')}
          />
          {/* TODO: add schools */}
          <NavLink
            label="Teams"
            active={location.pathname === '/teams'}
            onClick={() => handleNavigate('/teams')}
          />
          <NavLink
            label="Profile"
            active={location.pathname === '/profile'}
            onClick={() => handleNavigate('/profile')}
          />
        </AppShell.Section>

        {/* Mobile-only Logout at the bottom of the drawer */}
        <AppShell.Section hiddenFrom="sm">
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
    </AppShell>
  );
}