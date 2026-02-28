import { AppShell, Burger, Group, NavLink, Title, Button, Text, NativeSelect } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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

  const handleTournamentChange = (value: string) => {
    setTournament(value);
    localStorage.setItem('selectedTournament', value);
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
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={burgerOpened} onClick={burgerToggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>Felknor's Pick20</Title>
          </Group>
          <NativeSelect
            value={tournament}
            onChange={(event) => handleTournamentChange(event.currentTarget.value)}
            // Ensure data is at least an empty array. Otherwise we get an error if data isn't yet fetched
            data={data ?? []}
            disabled={isLoading}
            w={200}
          />
          <Button variant="subtle" color="red" onClick={handleLogout}>
            Logout
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: 'uppercase' }}>
          Navigation
        </Text>
        <NavLink
          label="Dashboard"
          active={location.pathname === '/'}
          onClick={() => handleNavigate('/')}
        />
        <NavLink
          label="Profile"
          active={location.pathname === '/profile'}
          onClick={() => handleNavigate('/profile')}
        />
        <NavLink
          label="Settings"
          active={location.pathname === '/settings'}
          onClick={() => handleNavigate('/settings')}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        {/* This is where the specific page content (Dashboard, etc.) appears */}
        {/* Pass whatever data you want child routes to access */}
        <Outlet context={{ tournament }} />
      </AppShell.Main>
    </AppShell>
  );
}