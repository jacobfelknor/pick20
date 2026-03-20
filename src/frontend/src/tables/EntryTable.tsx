import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useEffect, useMemo, useState } from "react";
import { sortBy } from "lodash";
import CheckOrXIcon from "../components/CheckOrXIcon";
import { useNavigate } from "react-router-dom";
import { MultiSelect } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useLocalStorage } from "@mantine/hooks";


export default function EntryTable({ tournament, tournamentDetail, onlyMyEntries }: { tournament: string, tournamentDetail: any, onlyMyEntries: boolean }) {
    const navigate = useNavigate();

    const { data: entries, isLoading } = useQuery({
        queryKey: ['entries', tournament, onlyMyEntries],
        queryFn: () => api.get(`/api/tournament/${tournament}/entries/`, { params: { onlyMyEntries: onlyMyEntries } }).then(res => res.data),
        enabled: !!tournament,
    });

    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'score',
        direction: 'desc',
    });

    // This recalculates automatically when 'entries' or 'sortStatus' changes
    const allRecords = useMemo(() => {
        if (!entries) return [];
        const data = sortBy(entries, sortStatus.columnAccessor);
        return sortStatus.direction === 'desc' ? data.reverse() : data;
    }, [entries, sortStatus]);

    const PAGE_SIZES = [15, 25, 50, 100];
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useLocalStorage({ key: 'entries-page-size', defaultValue: PAGE_SIZES[0] });
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const usersWithEntries = useMemo(() => {
        const users = new Set(allRecords.map((e: any) => e.user_detail.full_name));
        return sortBy([...users]);
    }, [allRecords]);

    const filteredRecords = useMemo(() => {
        if (!selectedUsers.length) return allRecords;
        return allRecords.filter(({ user_detail }) =>
            selectedUsers.includes(user_detail.full_name)
        );
    }, [allRecords, selectedUsers]);

    // Then, slice that filtered data for pagination
    const records = useMemo(() => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        return filteredRecords.slice(from, to);
    }, [page, pageSize, filteredRecords]);

    // go back to page 1 if changing filters
    useEffect(() => {
        setPage(1);
    }, [onlyMyEntries, selectedUsers, pageSize])

    // clear filtered users when switching on/off onlyMyEntries
    useEffect(() => {
        setSelectedUsers([]);
    }, [onlyMyEntries])

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
                { accessor: 'name', title: "Name", sortable: true },
                { accessor: 'score', sortable: true },
                // { accessor: 'potential_score_remaining', title: "Maximum Remaining Points", sortable: true },
                { accessor: 'potential_score', title: "Max Score", sortable: true },
                { accessor: 'still_alive', title: "Alive", sortable: true, render: ({ still_alive }) => <CheckOrXIcon value={still_alive} /> },
                { accessor: 'teams_remaining', title: "Teams Left", sortable: true },
                { accessor: 'complete', title: "Complete", sortable: true, hidden: tournamentDetail?.is_locked, render: ({ complete }) => <CheckOrXIcon value={complete} /> },
                {
                    accessor: 'user_detail.full_name',
                    title: "Created By",
                    sortable: true,
                    filter: (
                        <MultiSelect
                            label="Users"
                            description="Show all entries for the selected user(s)"
                            data={usersWithEntries}
                            value={selectedUsers}
                            placeholder="Search users..."
                            onChange={setSelectedUsers}
                            leftSection={<IconSearch size={16} />}
                            comboboxProps={{ withinPortal: false }}
                            clearable
                            searchable
                        />
                    ),
                    filtering: selectedUsers.length > 0,
                },
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
            totalRecords={filteredRecords.length}
            recordsPerPage={pageSize}
            page={page}
            onPageChange={(p) => setPage(p)}
            recordsPerPageOptions={PAGE_SIZES}
            onRecordsPerPageChange={setPageSize}
            // Ensure the table has a height to show the "no data" icon
            minHeight={150}
        />
    );
}