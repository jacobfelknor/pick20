import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { sortBy } from "lodash";
import CheckOrXIcon from "../components/CheckOrXIcon";
import { useNavigate } from "react-router-dom";


export default function EntryTable({ tournament }: { tournament: string }) {
    const navigate = useNavigate();

    const { data: entries, isLoading } = useQuery({
        queryKey: ['entries', tournament],
        queryFn: () => api.get(`/api/tournament/${tournament}/entries/`).then(res => res.data),
        enabled: !!tournament,
    });

    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'score',
        direction: 'desc',
    });

    // This recalculates automatically when 'entries' or 'sortStatus' changes
    const records = useMemo(() => {
        if (!entries) return [];
        const data = sortBy(entries, sortStatus.columnAccessor);
        return sortStatus.direction === 'desc' ? data.reverse() : data;
    }, [entries, sortStatus]);

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
                { accessor: 'current_rank', title: "#", sortable: true },
                { accessor: 'name', title: "Entry Name", sortable: true },
                { accessor: 'user_detail.full_name', title: "Created By", sortable: true },
                { accessor: 'score', sortable: true },
                { accessor: 'potential_score_remaining', title: "Maximum Remaining Points", sortable: true },
                { accessor: 'potential_score', title: "Maximum Potential Score", sortable: true },
                { accessor: 'teams_remaining_count', title: "Teams Remaining", sortable: true },
                { accessor: 'still_alive', title: "Still Alive", sortable: true, render: ({ still_alive }: { still_alive: boolean }) => <CheckOrXIcon value={still_alive} /> },
                // TODO: add col for admins only that represents "payment received"
            ]}
            onRowClick={({ record, index, event }) => {
                // TODO: restrict access to this navigate unless the tournament is locked or user is superuser
                // TODO: if tournament is unlocked, this should bring you to an edit field instead of a static view page
                navigate(`/entry/${record.id}`);
            }}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            // Ensure the table has a height to show the "no data" icon
            minHeight={150}
        />
    );
}