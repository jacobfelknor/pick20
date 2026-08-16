import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import {
    Title,
    Stack,
    Alert,
    Loader,
    Center,
    Grid,
    Paper,
    TextInput,
    NumberInput,
    Select,
    Button,
    Group,
    Text,
    Switch,
    SimpleGrid,
    Card,
    Badge,
    ActionIcon,
    Table,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
    IconInfoCircle,
    IconPlus,
    IconMinus,
    IconTrophy,
    IconChecks,
    IconUserCheck,
} from "@tabler/icons-react";
import api from "../api";

export default function AdminDashboard() {
    const { tournament } = useOutletContext<any>();
    const queryClient = useQueryClient();

    // Component States
    const [showEliminated, setShowEliminated] = useState(false);

    // Create Tournament form state
    const [newYear, setNewYear] = useState<number | "">(new Date().getFullYear());
    const [newStartDate, setNewStartDate] = useState("");
    const [createTournamentLoading, setCreateTournamentLoading] = useState(false);

    // Add Team form state
    const [addTeamSchool, setAddTeamSchool] = useState<string | null>(null);
    const [addTeamSchoolSecondary, setAddTeamSchoolSecondary] = useState<string | null>(null);
    const [addTeamSeed, setAddTeamSeed] = useState<number | "">(1);
    const [addTeamRegion, setAddTeamRegion] = useState<string | null>("East");
    const [addTeamLoading, setAddTeamLoading] = useState(false);

    // 1. Auth Query (Verify if Admin)
    const { data: userProfile, isLoading: isUserLoading } = useQuery({
        queryKey: ["userProfile"],
        queryFn: () => api.get("/api/auth/user/").then((res) => res.data),
    });

    // 2. Fetch Selected Tournament Detail
    const { data: tournamentDetail } = useQuery({
        queryKey: ["tournamentDetail", tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/`).then((res) => res.data),
        enabled: !!tournament,
    });

    // 3. Fetch Schools
    const { data: schools } = useQuery({
        queryKey: ["schools"],
        queryFn: () => api.get("/api/schools/").then((res) => res.data),
    });

    // 4. Fetch Teams
    const { data: teams, isLoading: isTeamsLoading } = useQuery({
        queryKey: ["teams", tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/teams/`).then((res) => res.data),
        enabled: !!tournament,
    });

    // Form selections mapped for Mantine select
    const schoolOptions = schools
        ? schools.map((s: any) => ({ value: s.id.toString(), label: s.name }))
        : [];

    const regionOptions = [
        { value: "East", label: "East" },
        { value: "West", label: "West" },
        { value: "South", label: "South" },
        { value: "Midwest", label: "Midwest" },
    ];

    // Group teams by Region
    const teamsByRegion = {
        East: [] as any[],
        West: [] as any[],
        South: [] as any[],
        Midwest: [] as any[],
    };

    if (teams) {
        teams.forEach((t: any) => {
            const region = t.region as keyof typeof teamsByRegion;
            if (teamsByRegion[region]) {
                if (showEliminated || !t.is_eliminated) {
                    teamsByRegion[region].push(t);
                }
            }
        });

        // Sort by seed inside regions
        Object.keys(teamsByRegion).forEach((reg) => {
            teamsByRegion[reg as keyof typeof teamsByRegion].sort((a, b) => a.seed - b.seed);
        });
    }

    // Find First Four Teams
    const firstFourTeams = teams
        ? teams.filter((t: any) => t.school_secondary !== null)
        : [];

    // Mutations
    const updateTeamMutation = useMutation({
        mutationFn: ({ teamId, data }: { teamId: number; data: any; silent?: boolean }) =>
            api.patch(`/api/tournament/${tournament}/teams/${teamId}/`, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["teams", tournament] });
            queryClient.invalidateQueries({ queryKey: ["tournamentDetail", tournament] });
            queryClient.invalidateQueries({ queryKey: ["tournaments"] });
            if (!variables.silent) {
                notifications.show({
                    title: "Team Updated",
                    message: "Tournament team settings saved successfully.",
                    color: "green",
                    autoClose: 1500,
                });
            }
        },
        onError: (err: any) => {
            notifications.show({
                title: "Update Failed",
                message: err.response?.data?.message || "Could not update team.",
                color: "red",
            });
        },
    });

    // Actions
    const handleUpdateWins = (team: any, change: number) => {
        const nextWins = team.wins + change;
        if (nextWins < 0 || nextWins > 6) return;
        updateTeamMutation.mutate({
            teamId: team.id,
            data: { wins: nextWins },
            silent: true,
        });
    };

    const handleToggleEliminated = (team: any) => {
        updateTeamMutation.mutate({
            teamId: team.id,
            data: { is_eliminated: !team.is_eliminated },
            silent: true,
        });
    };

    const handleResolveFirstFour = (team: any, winnerSchoolId: number) => {
        updateTeamMutation.mutate({
            teamId: team.id,
            data: {
                school: winnerSchoolId,
                school_secondary: null,
            },
        });
    };

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
            const response = await api.post("/api/tournament/", {
                year: Number(newYear),
                start_date: new Date(newStartDate).toISOString(),
            });
            notifications.show({
                title: "Success",
                message: `${response.data.year} Tournament has been created!`,
                color: "green",
            });
            queryClient.invalidateQueries({ queryKey: ["tournaments"] });
            setNewYear(new Date().getFullYear() + 1);
            setNewStartDate("");
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

    const handleAddTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addTeamSchool || !addTeamSeed || !addTeamRegion) {
            notifications.show({
                title: "Validation Error",
                message: "School, Seed, and Region are required fields.",
                color: "yellow",
            });
            return;
        }

        setAddTeamLoading(true);
        try {
            await api.post(`/api/tournament/${tournament}/teams/`, {
                school: Number(addTeamSchool),
                seed: Number(addTeamSeed),
                region: addTeamRegion,
                school_secondary: addTeamSchoolSecondary ? Number(addTeamSchoolSecondary) : null,
            });

            notifications.show({
                title: "Success",
                message: "Team added successfully to the tournament.",
                color: "green",
            });

            queryClient.invalidateQueries({ queryKey: ["teams", tournament] });
            queryClient.invalidateQueries({ queryKey: ["tournamentDetail", tournament] });

            // Reset form
            setAddTeamSchool(null);
            setAddTeamSchoolSecondary(null);
            setAddTeamSeed(1);
        } catch (err: any) {
            notifications.show({
                title: "Failed to Add Team",
                message: JSON.stringify(err.response?.data) || "Could not add team.",
                color: "red",
            });
        } finally {
            setAddTeamLoading(false);
        }
    };

    // Loading Screen
    if (isUserLoading) {
        return (
            <Center style={{ height: "100vh" }}>
                <Loader size="xl" />
            </Center>
        );
    }

    // Access control check
    const isAdmin = userProfile?.is_staff || userProfile?.is_superuser;
    if (!isAdmin) {
        return (
            <Center style={{ height: "50vh" }}>
                <Alert
                    variant="light"
                    color="red"
                    title="Access Denied"
                    icon={<IconInfoCircle />}
                    maw={500}
                >
                    You must have administrator privileges to view this page.
                </Alert>
            </Center>
        );
    }

    return (
        <Stack gap="xl">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Admin Dashboard</Title>
                    <Text size="sm" c="dimmed">
                        Configure tournaments, register teams, and update active live scores.
                    </Text>
                </div>
                {tournamentDetail && (
                    <Badge size="lg" color={tournamentDetail.concluded ? "gray" : tournamentDetail.is_locked ? "blue" : "yellow"}>
                        {tournamentDetail.concluded ? "Concluded" : tournamentDetail.is_locked ? "Locked" : "Pre-Start"}
                    </Badge>
                )}
            </Group>

            {/* SETUP PHASE SECTION */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                {/* Create Tournament */}
                <Paper withBorder p="md" radius="md" shadow="sm">
                    <Title order={3} mb="sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <IconTrophy size={20} color="orange" /> Create Tournament
                    </Title>
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
                            <Button type="submit" loading={createTournamentLoading} mt="xs">
                                Create Tournament
                            </Button>
                        </Stack>
                    </form>
                </Paper>

                {/* Add Team to Selected Tournament */}
                <Paper withBorder p="md" radius="md" shadow="sm">
                    <Title order={3} mb="sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <IconPlus size={20} color="green" /> Add Team to {tournamentDetail?.year || "Selected"} Tournament
                    </Title>
                    {!tournament ? (
                        <Alert color="blue" icon={<IconInfoCircle />}>
                            Please select a tournament from the header dropdown first.
                        </Alert>
                    ) : (
                        <form onSubmit={handleAddTeam}>
                            <Stack gap="sm">
                                <SimpleGrid cols={2}>
                                    <Select
                                        label="Primary School"
                                        placeholder="Search schools"
                                        data={schoolOptions}
                                        value={addTeamSchool}
                                        onChange={setAddTeamSchool}
                                        searchable
                                        required
                                    />
                                    <Select
                                        label="Secondary School (First Four)"
                                        placeholder="Optional"
                                        data={schoolOptions}
                                        value={addTeamSchoolSecondary}
                                        onChange={setAddTeamSchoolSecondary}
                                        searchable
                                        clearable
                                    />
                                </SimpleGrid>

                                <SimpleGrid cols={2}>
                                    <NumberInput
                                        label="Seed"
                                        min={1}
                                        max={16}
                                        value={addTeamSeed}
                                        onChange={(val) => setAddTeamSeed(val === "" ? "" : Number(val))}
                                        required
                                    />
                                    <Select
                                        label="Region"
                                        data={regionOptions}
                                        value={addTeamRegion}
                                        onChange={setAddTeamRegion}
                                        required
                                    />
                                </SimpleGrid>

                                <Button type="submit" loading={addTeamLoading} color="green" mt="xs" disabled={!tournament}>
                                    Add Team
                                </Button>
                            </Stack>
                        </form>
                    )}
                </Paper>
            </SimpleGrid>

            {/* FIRST FOUR RESOLUTION SECTION */}
            {firstFourTeams.length > 0 && (
                <Paper withBorder p="md" radius="md" shadow="sm" style={{ borderColor: "#4dabf7" }}>
                    <Title order={3} mb="md" style={{ display: "flex", alignItems: "center", gap: 8, color: "#1c7ed6" }}>
                        <IconUserCheck size={22} /> Resolve First Four Matchups
                    </Title>
                    <Text size="sm" c="dimmed" mb="md">
                        The teams below represent "First Four" play-in matchups. Select the winning school to set them as the primary school and clear the secondary school.
                    </Text>
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        {firstFourTeams.map((team: any) => (
                            <Card key={team.id} withBorder shadow="xs" p="sm" radius="md">
                                <Group justify="space-between" mb="xs">
                                    <Badge color="blue">Seed {team.seed} - {team.region}</Badge>
                                    <Text size="xs" c="dimmed">ID: {team.id}</Text>
                                </Group>
                                <Text fw={700} ta="center" mb="sm">
                                    {team.school_name} vs. {team.school_secondary_name}
                                </Text>
                                <SimpleGrid cols={2} spacing="xs">
                                    <Button
                                        size="xs"
                                        variant="light"
                                        onClick={() => handleResolveFirstFour(team, team.school)}
                                        loading={updateTeamMutation.isPending}
                                    >
                                        {team.school_name} Wins
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant="light"
                                        color="cyan"
                                        onClick={() => handleResolveFirstFour(team, team.school_secondary)}
                                        loading={updateTeamMutation.isPending}
                                    >
                                        {team.school_secondary_name} Wins
                                    </Button>
                                </SimpleGrid>
                            </Card>
                        ))}
                    </SimpleGrid>
                </Paper>
            )}

            {/* ACTIVE PHASE SCORE UPDATER */}
            <Paper withBorder p="md" radius="md" shadow="sm">
                <Group justify="space-between" mb="lg">
                    <div>
                        <Title order={3} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <IconChecks size={22} color="teal" /> Standings Updater
                        </Title>
                        <Text size="sm" c="dimmed">
                            Directly update individual team wins and elimination status. Standings automatically recalculate.
                        </Text>
                    </div>
                    <Switch
                        label="Show Eliminated Teams"
                        checked={showEliminated}
                        onChange={(e) => setShowEliminated(e.currentTarget.checked)}
                    />
                </Group>

                {!tournament ? (
                    <Alert color="blue" icon={<IconInfoCircle />}>
                        Please select a tournament from the header dropdown to view and edit team scores.
                    </Alert>
                ) : isTeamsLoading ? (
                    <Center p="xl">
                        <Loader />
                    </Center>
                ) : teams && teams.length === 0 ? (
                    <Alert color="yellow" icon={<IconInfoCircle />}>
                        No teams registered for this tournament yet. Use the "Add Team" form above to begin.
                    </Alert>
                ) : (
                    <Grid gutter="md">
                        {Object.keys(teamsByRegion).map((regionKey) => {
                            const rTeams = teamsByRegion[regionKey as keyof typeof teamsByRegion];
                            return (
                                <Grid.Col key={regionKey} span={{ base: 12, md: 6 }}>
                                    <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
                                        <Title order={4} mb="sm" ta="center" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
                                            {regionKey} Region ({rTeams.length} Alive)
                                        </Title>
                                        <Table verticalSpacing="xs" striped highlightOnHover>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    <Table.Th style={{ width: 50 }}>Seed</Table.Th>
                                                    <Table.Th>School</Table.Th>
                                                    <Table.Th style={{ width: 60, textAlign: "center" }}>Wins</Table.Th>
                                                    <Table.Th style={{ width: 150, textAlign: "right" }}>Actions</Table.Th>
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {rTeams.map((team: any) => (
                                                    <Table.Tr key={team.id} style={{ opacity: team.is_eliminated ? 0.5 : 1 }}>
                                                        <Table.Td>
                                                            <Badge variant="light" size="sm" circle color="blue">
                                                                {team.seed}
                                                            </Badge>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Text fw={500} size="sm">
                                                                {team.name_display}
                                                            </Text>
                                                            {team.is_eliminated && (
                                                                <Badge size="xs" color="red">
                                                                    Eliminated
                                                                </Badge>
                                                            )}
                                                        </Table.Td>
                                                        <Table.Td align="center">
                                                            <Text fw={700} size="sm">
                                                                {team.wins}
                                                            </Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Group gap={4} justify="flex-end" wrap="nowrap">
                                                                <ActionIcon
                                                                    size="sm"
                                                                    variant="light"
                                                                    color="blue"
                                                                    onClick={() => handleUpdateWins(team, 1)}
                                                                    disabled={team.wins >= 6 || team.is_eliminated}
                                                                >
                                                                    <IconPlus size={14} />
                                                                </ActionIcon>
                                                                <ActionIcon
                                                                    size="sm"
                                                                    variant="light"
                                                                    color="orange"
                                                                    onClick={() => handleUpdateWins(team, -1)}
                                                                    disabled={team.wins <= 0 || team.is_eliminated}
                                                                >
                                                                    <IconMinus size={14} />
                                                                </ActionIcon>
                                                                <Button
                                                                    size="xs"
                                                                    variant="light"
                                                                    color={team.is_eliminated ? "teal" : "red"}
                                                                    px={6}
                                                                    onClick={() => handleToggleEliminated(team)}
                                                                >
                                                                    {team.is_eliminated ? "Restore" : "Eliminate"}
                                                                </Button>
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    </Paper>
                                </Grid.Col>
                            );
                        })}
                    </Grid>
                )}
            </Paper>
        </Stack>
    );
}
