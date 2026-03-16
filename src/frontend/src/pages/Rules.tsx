import {
    Container,
    Title,
    Text,
    Paper,
    Stack,
    Group,
    ThemeIcon,
    List,
    Divider,
    Badge,
    Table,
    Anchor,
    Button
} from '@mantine/core';
import { IconTrophy, IconBallBasketball, IconCoin, IconAlertCircle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';



function RulesTable() {

    const elements = [
        { seeds: "1-4", points: 1 },
        { seeds: "5-8", points: 2 },
        { seeds: "9-12", points: 3 },
        { seeds: "13-16", points: 4 },
    ];
    const rows = elements.map((element) => (
        <Table.Tr key={element.seeds}>
            <Table.Td>{element.seeds}</Table.Td>
            <Table.Td>{element.points}</Table.Td>
        </Table.Tr>
    ));

    return (
        <Table>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Seed</Table.Th>
                    <Table.Th>Points / Win</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
        </Table>
    );
}
export default function Rules() {
    const navigate = useNavigate();
    return (
        <Container size="md" py="xl">
            <Paper withBorder shadow="sm" radius="md" p="xl">
                <Stack>
                    {/* Header */}
                    <Group>
                        <Group>
                            <ThemeIcon size="xl" radius="md" variant="light" color="orange">
                                <IconBallBasketball size={28} />
                            </ThemeIcon>
                            <div>
                                <Title order={2}>Tournament Rules</Title>
                                <Text color="dimmed" size="sm">Pick 20 Pool - March Madness</Text>
                            </div>
                        </Group>
                        <Badge size="lg" color="green" variant="dot">
                            Entry Fee: $5
                        </Badge>
                    </Group>

                    <Divider />

                    {/* Overview Section */}
                    <section>
                        <Group mb="sm">
                            <IconTrophy size={20} color="var(--mantine-color-blue-filled)" />
                            <Title order={4}>How to Play</Title>
                        </Group>
                        <Text size="sm" mb="md">
                            This “Pick 20” pool is a little different than a traditional bracket pool.
                            Instead of a full bracket, you simply <strong>choose 20 teams</strong> that are in the tournament.
                            Your points accumulate based on how many games your selected teams win.
                        </Text>

                        <Paper withBorder p="sm" bg="var(--mantine-color-gray-0)">
                            <Group>
                                <IconAlertCircle size={18} color="gray" /> NOTE
                                <Text size="sm">
                                    The "First Four" play-in games are <strong>not included</strong> in point totals.
                                    If you pick a play-in matchup (e.g., "NC State / Texas"), you get the winner of that game for the rest of the tourney.
                                </Text>
                            </Group>
                        </Paper>
                    </section>

                    {/* Scoring Table */}
                    <section>
                        <Title order={4} mb="sm">Scoring System</Title>
                        <Text size="sm" mb="sm">Points are awarded per win based on the team's tournament seed:</Text>
                        <RulesTable />
                    </section>

                    {/* Deadlines */}
                    <section>
                        <Title order={4} mb="sm">Deadline</Title>
                        <Text size="sm" mb="sm">Entries lock at <strong>tip-off on Thursday</strong> morning of the first round. The exact deadline will always be shown to you while you create entries.
                            You can add additional entries or modify your picks on existing entries until this time.</Text>
                    </section>

                    {/* Payment Section */}
                    <section>
                        <Group mb="sm">
                            <IconCoin size={20} color="var(--mantine-color-green-filled)" />
                            <Title order={4}>Entry Fee & Payment</Title>
                        </Group>
                        <Text size="sm" mb="md">
                            Each entry costs <strong>$5</strong>. You may submit multiple entries. Please send payments to Jim Bartuska:
                        </Text>

                        <List spacing="xs" size="sm" center>
                            <List.Item>
                                <Text>Venmo:</Text> @Jim-Bartuska (Last 4 digits: 6862)
                            </List.Item>
                            <List.Item>
                                <Text>Zelle:</Text> jkrbartuska@comcast.net
                            </List.Item>
                        </List>

                        <Text size="sm" mt="md">
                            If you are paying for multiple entries or your payment name doesn't match your entry name,
                            please <Anchor href="mailto:jkrbartuska@comcast.net">email Jim</Anchor> to confirm which entries you've paid for.
                        </Text>
                    </section>

                    {/* Payout Section */}
                    <section>
                        <Group mb="sm">
                            <IconCoin size={20} color="var(--mantine-color-blue-filled)" />
                            <Title order={4}>Winners & Payout</Title>
                        </Group>
                        <Text size="sm" mb="md">
                            The top 3 finishers will receive payouts in the following percentages of the total pot amount:
                        </Text>

                        <List spacing="xs" size="sm" type="ordered" center>
                            <List.Item>
                                50%
                            </List.Item>
                            <List.Item>
                                30%
                            </List.Item>
                            <List.Item>
                                20%
                            </List.Item>
                        </List>
                    </section>
                </Stack>

                {location.pathname.includes('/register') &&
                    <>
                        <Divider mt="md" />

                        <Stack align="center" py="lg">
                            <Group mt="md">
                                <Button
                                    variant="filled"
                                    color="blue"
                                    onClick={() => navigate('/register')}
                                >
                                    Register
                                </Button>

                                <Button
                                    onClick={() => navigate('/login')}
                                >
                                    Sign In
                                </Button>
                            </Group>
                        </Stack>
                    </>}

            </Paper>
        </Container >
    );
}