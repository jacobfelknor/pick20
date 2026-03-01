import { Badge, Button, Card, Divider, Grid, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowLeft, IconCalculator, IconChartBar, IconCircleCheck, IconCircleX, IconTrophy, IconUser } from "@tabler/icons-react";
import { useParams, useNavigate } from "react-router-dom";
import PicksTable from "../tables/PicksTable";
import api from "../api";
import { useQuery } from "@tanstack/react-query";


const EntryDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // TOOO: based on which tournament this entry belongs to, set the tournament dropdown in navbar?
    //       additionally, should the url to include the tournament id?

    const { data: entryDetail, isLoading } = useQuery({
        queryKey: ['entryDetail', id],
        queryFn: () => api.get(`/api/entry/${id}/`).then(res => res.data),
        enabled: !!id,
    });

    return (
        <div style={{ padding: '20px' }}>
            {/* 1. The Back Button */}
            <Button
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => navigate("/entries")}
                variant="filled"
            >
                Back to Entries
            </Button>
            <br />
            <br />

            {/* 2. Content */}
            {!isLoading && <Card withBorder shadow="sm" radius="md" padding="xl" mb="xl">
                <Stack gap="md">
                    {/* Header Section */}
                    <Group justify="space-between" align="flex-start">
                        <div>
                            <Group gap="xs" mb={4}>
                                <IconTrophy size={20} color="var(--mantine-color-blue-filled)" />
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                                    {entryDetail.tournament_detail.year} Tournament Entry
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
                        <Grid.Col span={{ base: 12, sm: 3 }}>
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

                        <Grid.Col span={{ base: 12, sm: 3 }}>
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

                        <Grid.Col span={{ base: 12, sm: 3 }}>
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
                        <Grid.Col span={{ base: 12, sm: 3 }}>
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

            {/* if tournament locked */}
            <PicksTable entryDetail={entryDetail} />
            {/* else */}
            {/* <PicksForm entry={id} /> */}
        </div>
    );
};

export default EntryDetail;