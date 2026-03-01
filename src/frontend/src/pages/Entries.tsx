import { Title, Stack, Alert } from "@mantine/core";
import { useOutletContext } from "react-router-dom";
import EntryTable from "../tables/EntryTable";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import dayjs from 'dayjs';
import { IconInfoCircle } from "@tabler/icons-react";
import { useMemo } from "react";

function Entries() {
    // context passed from appshell outlet
    const { tournament } = useOutletContext<any>();

    const { data: tournamentDetail, isLoading: isTournamentDetailLoading } = useQuery({
        queryKey: ['stats', tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/`).then(res => res.data),
        enabled: !!tournament,
    });

    const startDateStr = useMemo(() => `at ${dayjs(tournamentDetail?.start_date).format("h:mm A")} on ${dayjs(tournamentDetail?.start_date).format("MMMM D, YYYY")}`, [tournamentDetail])

    return (
        <Stack>
            <Title order={2}>Entries for the {isTournamentDetailLoading ? '...' : tournamentDetail?.year} Tournament</Title>

            {(tournamentDetail && !tournamentDetail?.is_locked) &&
                <Alert variant="light" color="yellow" title="Tournament Hasn't Started!" icon={<IconInfoCircle />}>
                    Until the tournament starts <b>{startDateStr}</b>, you can only see your own entries.
                </Alert>
            }

            <EntryTable tournament={tournament} />

        </Stack>
    );
}

export default Entries;
