import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { API_ENDPOINTS } from "../api";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { useMemo, useState } from "react";
import { sortBy } from "lodash";
import CheckOrXIcon from "../components/CheckOrXIcon";
import { useNavigate } from "react-router-dom";
import { MultiSelect, Checkbox, Select, Loader } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { ROUTES } from "../routes";


export default function EntryTable({ tournament, tournamentDetail, onlyMyEntries }: { tournament: string, tournamentDetail: any, onlyMyEntries: boolean }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: entries, isLoading } = useQuery({
        queryKey: ['entries', tournament, onlyMyEntries],
        queryFn: () => api.get(API_ENDPOINTS.tournaments.entries(tournament), { params: { onlyMyEntries: onlyMyEntries } }).then(res => res.data),
        enabled: !!tournament,
    });

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => api.get(API_ENDPOINTS.auth.user).then(res => res.data),
    });

    const isAdmin = currentUser?.is_staff || currentUser?.is_superuser;

    const togglePaidMutation = useMutation({
        mutationFn: ({ id, paid }: { id: number, paid: boolean }) =>
            api.patch(API_ENDPOINTS.entries.detail(id), { paid: !paid }),
        onSuccess: (res, variables) => {

            // instead of invalidating the entire table's query, update 
            // this rows data in place. That way, the table itself doesn't
            // reload and "flash" on 
            queryClient.setQueryData(['entries', tournament, onlyMyEntries], (oldEntries: any) => {
                if (!oldEntries) return oldEntries;
                return oldEntries.map((entry: any) => {
                    if (entry.id === variables.id) {
                        return { ...entry, paid: res.data.paid };
                    }
                    return entry;
                });
            });
            // Not sure that this one is required? When I visit this entries after updating
            // in the table, it re-fetches anyway
            // queryClient.setQueryData(['entryDetail', variables.id.toString()], (oldDetail: any) => {
            //     if (!oldDetail) return oldDetail;
            //     return { ...oldDetail, paid: res.data.paid };
            // });
        },
        onError: () => {
            notifications.show({
                title: 'Error',
                message: 'Failed to update payment status.',
                color: 'red',
            });
        }
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
    const [paidFilter, setPaidFilter] = useState<string>('all');
    const usersWithEntries = useMemo(() => {
        const users = new Set(allRecords.map((e: any) => e.user_detail.full_name));
        return sortBy([...users]);
    }, [allRecords]);

    const filteredRecords = useMemo(() => {
        let data = allRecords;
        if (selectedUsers.length > 0) {
            data = data.filter(({ user_detail }) =>
                selectedUsers.includes(user_detail.full_name)
            );
        }
        if (paidFilter !== 'all') {
            const isPaid = paidFilter === 'paid';
            data = data.filter(({ paid }) => paid === isPaid);
        }
        return data;
    }, [allRecords, selectedUsers, paidFilter]);

    // Then, slice that filtered data for pagination
    const records = useMemo(() => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        return filteredRecords.slice(from, to);
    }, [page, pageSize, filteredRecords]);

    const [prevOnlyMyEntries, setPrevOnlyMyEntries] = useState(onlyMyEntries);
    const [prevSelectedUsers, setPrevSelectedUsers] = useState(selectedUsers);
    const [prevPaidFilter, setPrevPaidFilter] = useState(paidFilter);
    const [prevPageSize, setPrevPageSize] = useState(pageSize);

    if (onlyMyEntries !== prevOnlyMyEntries) {
        setPrevOnlyMyEntries(onlyMyEntries);
        setSelectedUsers([]);
        setPaidFilter('all');
        setPage(1);
    } else if (selectedUsers !== prevSelectedUsers || paidFilter !== prevPaidFilter || pageSize !== prevPageSize) {
        setPrevSelectedUsers(selectedUsers);
        setPrevPaidFilter(paidFilter);
        setPrevPageSize(pageSize);
        setPage(1);
    }

    const columns = useMemo(() => {
        const cols: any[] = [
            { accessor: 'current_rank', title: "#", sortable: true },
            { accessor: 'name', title: "Name", sortable: true },
            { accessor: 'score', sortable: true },
            { accessor: 'potential_score', title: "Max Score", sortable: true },
            { accessor: 'still_alive', title: "Alive", sortable: true, render: ({ still_alive }: any) => <CheckOrXIcon value={still_alive} /> },
            { accessor: 'teams_remaining', title: "Teams Left", sortable: true },
            { accessor: 'complete', title: "Complete", sortable: true, hidden: tournamentDetail?.is_locked, render: ({ complete }: any) => <CheckOrXIcon value={complete} /> },
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
        ];

        if (isAdmin) {
            cols.push({
                accessor: 'paid',
                title: "Paid",
                sortable: true,
                render: ({ id, paid }: any) => {
                    const isMutating = togglePaidMutation.isPending && togglePaidMutation.variables?.id === id;
                    return (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20px' }}>
                            {isMutating ? (
                                <Loader size="xs" />
                            ) : (
                                <Checkbox
                                    checked={paid}
                                    onChange={() => togglePaidMutation.mutate({ id, paid })}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                        </div>
                    );
                },
                filter: (
                    <Select
                        label="Payment Status"
                        description="Filter by payment status"
                        data={[
                            { value: 'all', label: 'All' },
                            { value: 'paid', label: 'Paid' },
                            { value: 'unpaid', label: 'Unpaid' },
                        ]}
                        value={paidFilter}
                        onChange={(val) => setPaidFilter(val || 'all')}
                        comboboxProps={{ withinPortal: false }}
                    />
                ),
                filtering: paidFilter !== 'all',
            });
        }

        return cols;
    }, [isAdmin, tournamentDetail, usersWithEntries, selectedUsers, paidFilter, setPaidFilter, togglePaidMutation]);

    return (
        <DataTable
            withTableBorder
            withColumnBorders
            striped
            highlightOnHover
            textSelectionDisabled // don't trick users into thinking they can copy. The row click event fires if trying to highlight
            fetching={isLoading} // Adds a nice loading overlay
            records={records}
            columns={columns}
            onRowClick={({ record, index, event }) => {
                // trick linter that these are used, for now. I'd rather see they're available
                index;
                event;
                navigate(ROUTES.entryDetail(record.id));
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