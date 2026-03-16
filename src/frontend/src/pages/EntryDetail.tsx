import { Badge, Button, Card, Divider, Grid, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowLeft, IconCalculator, IconChartBar, IconCircleCheck, IconCircleX, IconEdit, IconTournament, IconTrash, IconTrophy, IconUser } from "@tabler/icons-react";
import { useParams, useNavigate } from "react-router-dom";
import PicksTable from "../tables/PicksTable";
import api from "../api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EntryFormModal } from "../forms/EntryFormModal";
import { useDisclosure } from "@mantine/hooks";
import { modals } from '@mantine/modals';
import { notifications } from "@mantine/notifications";


const EntryDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [entryCreateOpened, { open: openEntryCreateModal, close: closeEntryCreateModal }] = useDisclosure(false);
    const queryClient = useQueryClient();

    // TOOO: based on which tournament this entry belongs to, set the tournament dropdown in navbar?
    //       additionally, should the url to include the tournament id?

    const { data: entryDetail, isLoading } = useQuery({
        queryKey: ['entryDetail', id],
        queryFn: () => api.get(`/api/entries/${id}/`).then(res => res.data),
        enabled: !!id,
    });

    const { data: tournamentDetail, isLoading: isTournamentDetailLoading } = useQuery({
        queryKey: ['tournamentDetail', entryDetail?.tournament],
        queryFn: () => api.get(`/api/tournament/${entryDetail?.tournament}/`).then(res => res.data),
        enabled: !!entryDetail?.tournament,
    });
    isTournamentDetailLoading; // trick linter for now. I want to remember this is available

    const closeEntryCreateModalAndReload = () => {
        closeEntryCreateModal();
        // query from PicksTable
        queryClient.invalidateQueries({ queryKey: ['entryDetail', id] });
    }

    const handleDelete = () =>
        modals.openConfirmModal({
            title: 'Delete Entry',
            centered: true,
            children: (
                <Text size="sm">
                    Are you sure you want to delete your entry? This action cannot be undone.
                </Text>
            ),
            labels: { confirm: 'Delete', cancel: 'No, keep it' },
            confirmProps: { color: 'red' },
            closeOnConfirm: false,
            onConfirm: () => {
                // Your API logic here
                api.delete(`/api/entries/${entryDetail?.id}/`).then(() => {
                    modals.closeAll();
                    navigate("/entries");
                    notifications.show({
                        title: 'Deleted!',
                        message: 'Entry successfully deleted.',
                        color: 'red',
                    });
                }).catch(() => {
                    notifications.show({
                        title: 'Error!',
                        message: 'Something went wrong. Please try again.',
                        color: 'red',
                    });
                });
            },
        });

    return (
        <div style={{ padding: '20px' }}>
            {/* 1. The Back Button */}
            <Button
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => navigate("/entries")}
                variant="filled"
            >
                Back to {tournamentDetail?.is_locked ? 'Standings' : 'Entries'}
            </Button>
            <br />
            <br />

            {/* 2. Content */}
            {(entryDetail && !isLoading) && <Card withBorder shadow="sm" radius="md" padding="xl" mb="xl">
                <Stack gap="md">
                    {/* Header Section */}
                    <Group justify="space-between" align="flex-start">
                        <div>
                            <Group gap="xs" mb={4}>
                                <IconTrophy size={20} color="var(--mantine-color-blue-filled)" />
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                                    {entryDetail?.tournament_detail.year} Tournament Entry
                                </Text>
                            </Group>
                            <Title order={2}>{entryDetail.name}</Title>
                            <Group gap="xs" mt={4}>
                                <IconUser size={14} />
                                <Text size="sm" c="dimmed">Created by {entryDetail.user_detail.full_name}</Text>
                            </Group>
                        </div>

                        <Badge
                            size="lg"
                            variant="light"
                            color={entryDetail.still_alive ? "green" : "red"}
                            leftSection={entryDetail.still_alive ? <IconCircleCheck size={14} /> : <IconCircleX size={14} />}
                        >
                            {entryDetail.still_alive ? "In the Running" : "Mathematically Eliminated"}
                        </Badge>
                    </Group>

                    <Divider />

                    {/* Stats Grid */}
                    <Grid>
                        <Grid.Col span={{ base: 12, sm: 2.4 }}>
                            <Group align="center" wrap="nowrap">
                                <ThemeIcon variant="light" size="xl" radius="md" color="orange">
                                    <IconTournament size={24} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Teams Remaining</Text>
                                    <Text size="xl" fw={700}>{entryDetail.teams_remaining}</Text>
                                </div>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 2.4 }}>
                            <Group align="center">
                                <ThemeIcon variant="light" size="xl" radius="md" color="blue">
                                    <IconChartBar size={24} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Current Score</Text>
                                    <Text size="xl" fw={700}>{entryDetail.score} pts</Text>
                                </div>
                            </Group>
                        </Grid.Col>

                        <Grid.Col span={{ base: 12, sm: 2.4 }}>
                            <Group align="center">
                                <ThemeIcon variant="light" size="xl" radius="md" color="teal">
                                    <IconCalculator size={24} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Max Potential Score</Text>
                                    <Text size="xl" fw={700}>{entryDetail.potential_score} pts</Text>
                                </div>
                            </Group>
                        </Grid.Col>

                        <Grid.Col span={{ base: 12, sm: 2.4 }}>
                            <Group align="center">
                                <ThemeIcon variant="light" size="xl" radius="md" color="blue">
                                    <IconTrophy size={24} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Current Rank</Text>
                                    <Text size="xl" fw={700}>#{entryDetail.current_rank}</Text>
                                </div>
                            </Group>
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 2.4 }}>
                            <Group align="center">
                                <ThemeIcon variant="light" size="xl" radius="md" color="teal">
                                    <IconTrophy size={24} />
                                </ThemeIcon>
                                <div>
                                    <Text size="xs" c="dimmed" fw={700} tt="uppercase">Max Potential Rank</Text>
                                    <Text size="xl" fw={700}>#{entryDetail.max_potential_rank}</Text>
                                </div>
                            </Group>
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Card>}

            <Group justify="space-between" align="center">
                <Title order={3}>Picks</Title>

                {/* Wrap buttons in a nested Group to keep them together on the right */}
                {(tournamentDetail && !tournamentDetail?.is_locked) && (
                    <Group gap="xs">
                        <Button
                            variant="subtle"
                            color="red"
                            leftSection={<IconTrash size={18} />}
                            onClick={handleDelete}
                        >
                            Delete
                        </Button>

                        <Button
                            leftSection={<IconEdit size={18} />}
                            onClick={openEntryCreateModal}
                        >
                            Update
                        </Button>
                    </Group>
                )}
            </Group>
            <br />

            <PicksTable entryDetail={entryDetail} />

            <EntryFormModal
                opened={entryCreateOpened}
                onClose={closeEntryCreateModalAndReload}
                tournamentId={entryDetail?.tournament}
                entry={entryDetail}
            />
        </div>
    );
};

export default EntryDetail;