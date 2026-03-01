import { Title, Stack, Alert, Badge, Card, Divider, Grid, Group, ThemeIcon, Text } from "@mantine/core";
import { useOutletContext } from "react-router-dom";
import EntryTable from "../tables/EntryTable";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import dayjs from 'dayjs';
import { IconCalculator, IconCalendar, IconChartBar, IconCircleCheck, IconCircleX, IconInfoCircle, IconTournament, IconTrophy, IconUser, IconUsers } from "@tabler/icons-react";
import { useMemo } from "react";

function EntryList() {
    // context passed from appshell outlet
    const { tournament } = useOutletContext<any>();

    const { data: tournamentDetail, isLoading: isTournamentDetailLoading } = useQuery({
        queryKey: ['stats', tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/`).then(res => res.data),
        enabled: !!tournament,
    });

    const startDateStr = useMemo(() => `${dayjs(tournamentDetail?.start_date).format("h:mm A")} on ${dayjs(tournamentDetail?.start_date).format("MMMM D, YYYY")}`, [tournamentDetail])

    return (
        <Stack>
            <Title order={2}>{isTournamentDetailLoading ? '...' : tournamentDetail?.year} Tournament</Title>

            {!isTournamentDetailLoading && (
                <Card withBorder shadow="sm" radius="md" padding="xl" mb="xl">
                    <Stack gap="md">
                        {/* Header Section */}
                        <Group justify="space-between" align="flex-start">
                            <div>
                                <Group gap="xs" mb={4}>
                                    <IconTrophy size={20} color="var(--mantine-color-blue-filled)" />
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                                        {tournamentDetail.year} Tournament Overview
                                    </Text>
                                </Group>
                                <Title order={2}>{tournamentDetail.name}</Title>
                                <Group gap="xs" mt={4}>
                                    <IconCalendar size={14} />
                                    <Text size="sm" c="dimmed">
                                        Starts: {startDateStr}
                                    </Text>
                                </Group>
                            </div>
                            {tournamentDetail.concluded ? <Badge
                                size="lg"
                                // variant="dot"
                                color={"gray"}
                            >
                                Concluded
                            </Badge> : <Badge
                                size="lg"
                                // variant="dot"
                                color={tournamentDetail.is_locked ? "blue" : "yellow"}
                            >
                                {tournamentDetail.is_locked ? "Active" : "Pending"}
                            </Badge>}
                        </Group>

                        <Divider />

                        {/* Stats Grid */}
                        <Grid>
                            <Grid.Col span={{ base: 12, sm: 3 }}>
                                <Group align="center" wrap="nowrap">
                                    <ThemeIcon variant="light" size="xl" radius="md" color="green">
                                        <IconCircleCheck size={24} />
                                    </ThemeIcon>
                                    <div>
                                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">Entries Alive</Text>
                                        <Text size="xl" fw={700}>{tournamentDetail.entries_alive}</Text>
                                    </div>
                                </Group>
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 3 }}>
                                <Group align="center" wrap="nowrap">
                                    <ThemeIcon variant="light" size="xl" radius="md" color="blue">
                                        <IconCircleCheck size={24} />
                                    </ThemeIcon>
                                    <div>
                                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Entries</Text>
                                        <Text size="xl" fw={700}>{tournamentDetail.total_entries}</Text>
                                    </div>
                                </Group>
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 3 }}>
                                <Group align="center" wrap="nowrap">
                                    <ThemeIcon variant="light" size="xl" radius="md" color="green">
                                        <IconUsers size={24} />
                                    </ThemeIcon>
                                    <div>
                                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">Participants Alive</Text>
                                        <Text size="xl" fw={700}>{tournamentDetail.participants_alive}</Text>
                                    </div>
                                </Group>
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 3 }}>
                                <Group align="center" wrap="nowrap">
                                    <ThemeIcon variant="light" size="xl" radius="md" color="blue">
                                        <IconUsers size={24} />
                                    </ThemeIcon>
                                    <div>
                                        <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Participants</Text>
                                        <Text size="xl" fw={700}>{tournamentDetail.total_participants}</Text>
                                    </div>
                                </Group>
                            </Grid.Col>
                        </Grid>
                    </Stack>
                </Card>
            )}

            {(tournamentDetail && !tournamentDetail?.is_locked) &&
                <Alert variant="light" color="yellow" title="Tournament Hasn't Started!" icon={<IconInfoCircle />}>
                    Until the tournament starts <b>at {startDateStr}</b>, you can only see your own entries.
                </Alert>
            }

            <EntryTable tournament={tournament} />

        </Stack>
    );
}

export default EntryList;
