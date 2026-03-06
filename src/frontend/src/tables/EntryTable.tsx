import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { sortBy } from "lodash";
import CheckOrXIcon from "../components/CheckOrXIcon";
import { useNavigate } from "react-router-dom";


export default function EntryTable({ tournamentDetail }: { tournamentDetail: any }) {
    const navigate = useNavigate();

    const { data: entries, isLoading } = useQuery({
        queryKey: ['entries', tournamentDetail?.id],
        queryFn: () => api.get(`/api/tournament/${tournamentDetail?.id}/entries/`).then(res => res.data),
        enabled: !!tournamentDetail?.id,
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
                // { accessor: 'potential_score_remaining', title: "Maximum Remaining Points", sortable: true },
                { accessor: 'potential_score', title: "Maximum Potential Score", sortable: true },
                { accessor: 'teams_remaining', title: "Teams Remaining", sortable: true },
                { accessor: 'complete', title: "Entry Complete", sortable: true, hidden: tournamentDetail?.is_locked, render: ({ complete }) => <CheckOrXIcon value={complete} /> },
                { accessor: 'still_alive', title: "Still Alive", sortable: true, render: ({ still_alive }) => <CheckOrXIcon value={still_alive} /> },
                // TODO: add col for admins only that represents "payment received"
            ]}
            onRowClick={({ record, index, event }) => {
                // trick linter that these are used, for now. I'd rather see they're available
                index;
                event;
                navigate(`/entries/${record.id}`);
            }}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            // Ensure the table has a height to show the "no data" icon
            minHeight={150}
        />
    );
}