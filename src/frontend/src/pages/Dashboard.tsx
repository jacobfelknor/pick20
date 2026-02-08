import { Title, Text, Stack, Paper } from "@mantine/core";

function Dashboard() {
    // example fetching logic
    // function fetchNotes() {
    //     setLoading(true);

    //     api.get<Note[]>("/api/notes/")
    //         .then((res) => {
    //             setNotes(res.data);
    //         })
    //         .catch((error) => {
    //             console.error("Failed to fetch notes:", error);
    //         })
    //         .finally(() => {
    //             setLoading(false);
    //         });
    // };

    return (
        <Stack>
            <Title order={2}>Overview</Title>
            <Text c="dimmed">Welcome back to your dashboard.</Text>

            <Paper withBorder p="xl" radius="md">
                <Text>Your protected data will show up here.</Text>
            </Paper>
        </Stack>
    );
}

export default Dashboard;