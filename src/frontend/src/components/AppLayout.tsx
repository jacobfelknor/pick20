import { AppShell, Burger, Group, NavLink, Title, Button, Text, NativeSelect } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

export function AppLayout() {
  const [burgerOpened, { toggle: burgerToggle, close: burgerClose }] = useDisclosure();
  const [tournament, setTournament] = useState("");
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
            onChange={(event) => setTournament(event.currentTarget.value)}
            data={['2026 Tournament', '2025 Tournament']}
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
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}