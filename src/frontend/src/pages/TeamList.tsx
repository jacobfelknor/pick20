import { Title, Stack, Alert } from "@mantine/core";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import dayjs from 'dayjs';
import { IconInfoCircle } from "@tabler/icons-react";
import { useMemo } from "react";
import TeamsTable from "../tables/TeamsTable";

function TeamList() {
    // context passed from appshell outlet
    const { tournament } = useOutletContext<any>();

    const { data: tournamentDetail, isLoading: isTournamentDetailLoading } = useQuery({
        queryKey: ['tournamentDetail', tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/`).then(res => res.data),
        enabled: !!tournament,
    });

    const startDateStr = useMemo(() => `${dayjs(tournamentDetail?.start_date).format("h:mm A")} on ${dayjs(tournamentDetail?.start_date).format("MMMM D, YYYY")}`, [tournamentDetail])

    return (
        <Stack>
            <Title order={2}>{isTournamentDetailLoading ? '...' : tournamentDetail?.year} Tournament</Title>

            {(tournamentDetail && !tournamentDetail?.is_locked) &&
                <Alert variant="light" color="yellow" title="Tournament Hasn't Started!" icon={<IconInfoCircle />}>
                    This tournament doesn't start until <b>{startDateStr}</b>!
                </Alert>
            }

            <Title order={3}>Tournament Teams</Title>

            <TeamsTable tournament={tournament} />

        </Stack>
    );
}

export default TeamList;
