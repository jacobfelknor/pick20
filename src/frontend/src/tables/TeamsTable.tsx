import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { sortBy } from "lodash";
import CheckOrXIcon from "../components/CheckOrXIcon";


export default function TeamsTable({ tournament }: { tournament: string }) {

    const { data: teams, isLoading } = useQuery({
        queryKey: ['teams', tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/teams/`).then(res => res.data),
        enabled: !!tournament,
    });

    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'total_points_earned',
        direction: 'desc',
    });

    // This recalculates automatically when 'entries' or 'sortStatus' changes
    const records = useMemo(() => {
        if (!teams) return [];
        const data = sortBy(teams, sortStatus.columnAccessor);
        return sortStatus.direction === 'desc' ? data.reverse() : data;
    }, [teams, sortStatus]);

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
                { accessor: 'total_points_earned', title: "Points", sortable: true },
                { accessor: 'name_display', title: "Name", sortable: true },
                { accessor: "seed", title: "Seed", sortable: true },
                { accessor: "region", title: "Region", sortable: true },
                { accessor: 'wins', title: "Wins", sortable: true },
                { accessor: 'points_per_win', title: "Points/Win", sortable: true },
                // { accessor: 'optimistic_potential_points_remaining', title: "Maximum Points Remaining", sortable: true },
                { accessor: 'optimistic_max_points', title: "Max Points", sortable: true },
                { accessor: 'num_entries_picked', title: "Entries", sortable: true },
                { accessor: 'is_eliminated', title: "Alive", sortable: true, render: ({ is_eliminated }) => <CheckOrXIcon value={!is_eliminated} /> },
                // TODO: add col for admins only that represents "payment received"
            ]}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            // Ensure the table has a height to show the "no data" icon
            minHeight={150}
        />
    );
}
