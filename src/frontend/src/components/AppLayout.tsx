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
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={burgerOpened} onClick={burgerToggle} hiddenFrom="sm" size="sm" />
            <Image
              src="/favicon.png" // Replace with your actual image path or URL
              alt="Pick20 Logo"
              h={30}         // Adjust height to match your title size
              w="auto"
            />
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
          label="Entries"
          active={location.pathname === '/entries' || location.pathname.includes("/entry")}
          onClick={() => handleNavigate('/entries')}
        />
        <NavLink
          label="Schools"
          active={location.pathname === '/schools'}
          onClick={() => handleNavigate('/schools')}
        />
        <NavLink
          label="Profile"
          active={location.pathname === '/profile'}
          onClick={() => handleNavigate('/profile')}
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