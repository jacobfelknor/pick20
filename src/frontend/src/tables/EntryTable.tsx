import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { sortBy } from "lodash";

export default function EntryTable({ tournament }: { tournament: string }) {
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
            fetching={isLoading} // Adds a nice loading overlay
            records={records}
            columns={[
                { accessor: 'name', sortable: true },
                { accessor: 'score', textAlign: 'right', sortable: true },
                { accessor: 'potential_score', textAlign: 'right', sortable: true },
                { accessor: 'still_alive', textAlign: 'right', sortable: true },
            ]}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            // Ensure the table has a height or it might look "wrong"
            minHeight={150}
        />
    );
}