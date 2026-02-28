import { Title, Text, Stack, Paper } from "@mantine/core";
import { useOutletContext } from "react-router-dom";

function Entries() {
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
            <Title order={2}>Entries for Tournament {tournament}</Title>

            <Text>Viewing data for Tournament ID: {tournament || 'None selected'}</Text>

            <Paper withBorder p="xl" radius="md">
                <Text>I need to put an entry table here.</Text>
                <Text>If the tournament is locked, or superuser, show all entries</Text>
                <Text>Otherwise, show just this user's entries</Text>
            </Paper>
        </Stack>
    );
}

export default Entries;