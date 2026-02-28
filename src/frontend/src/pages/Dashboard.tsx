import { Title, Text, Stack, Paper } from "@mantine/core";
import { useOutletContext } from "react-router-dom";

function Dashboard() {
    // context passed from appshell outlet
    const { tournament } = useOutletContext<any>();

    // add fetching logic for entries
    // This view should be renamed to "entries"

    // I can use the tournament variable as a dependency for further queries!
    // const { data: stats } = useQuery({
    //     queryKey: ['stats', tournament], // The query refetches whenever 'tournament' changes
    //     queryFn: () => api.get(`/api/stats/${tournament}`).then(res => res.data),
    //     enabled: !!tournament, // Only run the query if a tournament is selected
    // });


    return (
        <Stack>
            <Title order={2}>Overview</Title>
            <Text c="dimmed">Welcome back to your dashboard.</Text>

            <Text>Viewing data for Tournament ID: {tournament || 'None selected'}</Text>

            <Paper withBorder p="xl" radius="md">
                <Text>Your protected data will show up here.</Text>
            </Paper>
        </Stack>
    );
}

export default Dashboard;