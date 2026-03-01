import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { sortBy } from "lodash";
import CheckOrXIcon from "../components/CheckOrXIcon";
import { useNavigate } from "react-router-dom";
import { useMantineEnv } from "@mantine/core";


export default function PicksTable({ entry }: { entry: string | undefined }) {
    const navigate = useNavigate();

    const { data: entryDetail, isLoading } = useQuery({
        queryKey: ['entryDetail', entry],
        queryFn: () => api.get(`/api/entry/${entry}/`).then(res => res.data),
        enabled: !!entry,
    });

    // const tournamentDetail = useMemo(() => entryDetail?.tournament_detail, [entryDetail]);
    // console.log(tournamentDetail);

    const entryPicks = useMemo(() => entryDetail?.picks_detail, [entryDetail])

    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'points',
        direction: 'desc',
    });

    // This recalculates automatically when 'entryPicks' or 'sortStatus' changes
    const records = useMemo(() => {
        if (!entryPicks) return [];
        const data = sortBy(entryPicks, sortStatus.columnAccessor);
        return sortStatus.direction === 'desc' ? data.reverse() : data;
    }, [entryPicks, sortStatus]);


    return (
        <DataTable
            withTableBorder
            withColumnBorders
            striped
            highlightOnHover
            textSelectionDisabled // don't trick users into thinking they can copy. The row click event fires if trying to highlight
            fetching={isLoading} // Adds a nice loading overlay
            records={records}
            columns={[
                { accessor: 'school_name', title: "School", sortable: true },
                { accessor: 'seed', sortable: true },
                { accessor: 'region', sortable: true },
                { accessor: 'wins', sortable: true },
                { accessor: 'total_points_earned', title: "Total Points Earned", sortable: true },
                { accessor: 'optimistic_potential_points_remaining', title: "Maximum Points Remaining", sortable: true },
                { accessor: 'optimistic_max_points', title: "Maximum Points", sortable: true },
                // TODO: add col for admins only that represents "payment received"
            ]}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            // Ensure the table has a height to show the "no data" icon
            minHeight={150}
        />
    );

}