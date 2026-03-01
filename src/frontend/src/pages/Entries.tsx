import { Title, Stack, Text } from "@mantine/core";
import { useOutletContext } from "react-router-dom";
import EntryTable from "../tables/EntryTable";
import { useQuery } from "@tanstack/react-query";
import api from "../api";

function Entries() {
    // context passed from appshell outlet
    const { tournament } = useOutletContext<any>();

    const { data: tournamentDetail, isLoading: isTournamentDetailLoading } = useQuery({
        queryKey: ['stats', tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/`).then(res => res.data),
        enabled: !!tournament,
    });

    return (
        <Stack>
            <Title order={2}>Entries for the {isTournamentDetailLoading ? '...' : tournamentDetail?.year} Tournament</Title>

            {(tournamentDetail && !tournamentDetail?.is_locked) && <Text>TOURNAMENT HASN'T STARTED! You may only see your own entries</Text>}

            <EntryTable tournament={tournament} />

        </Stack>
    );
}

export default Entries;
