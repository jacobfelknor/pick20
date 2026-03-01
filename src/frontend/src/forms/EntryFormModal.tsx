import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Group, Text, Stack, TextInput } from '@mantine/core';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import api from '../api';
import { notifications } from '@mantine/notifications';
import { sortBy } from 'lodash';

interface EntryFormModalProps {
    opened: boolean;
    onClose: () => void;
    tournamentId: number;
    entry?: any; // If provided, we are in "Edit" mode
}

export function EntryFormModal({ opened, onClose, tournamentId, entry }: EntryFormModalProps) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [selectedTeams, setSelectedTeams] = useState<any[]>([]);

    // Fetch available teams for this tournament
    const { data: teams, isLoading } = useQuery({
        queryKey: ['tournament-teams', tournamentId],
        queryFn: () => api.get(`/api/tournament/${tournamentId}/teams/`).then((res) => res.data),
        enabled: opened,
    });

    useEffect(() => {
        if (entry && teams) {
            setName(entry.name);

            // Create an array of IDs from the entry's picks
            // Handles both objects {id: 1} or just IDs [1, 2, 3] depending on your serializer
            const pickIds = entry.picks.map((p: any) => typeof p === 'object' ? p.id : p);
            // Find the actual team objects from the source list that match those IDs
            const preselected = teams.filter((team: any) => pickIds.includes(team.id));

            setSelectedTeams(preselected);
        } else {
            setName('');
            setSelectedTeams([]);
        }
    }, [entry, opened, teams]); // Added teams as a dependency

    const mutation = useMutation({
        // 1. The actual "Work" function
        mutationFn: (data: any) => {
            // If we have an 'entry', we use PATCH (update). If not, POST (create).
            return entry
                ? api.patch(`/api/entries/${entry.id}/`, data)
                : api.post(`/api/entries/`, { ...data, tournament: tournamentId });
        },
        // 2. The "What happened?" logic
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', tournamentId] });
            notifications.show({
                title: 'Success!',
                message: `Entry ${entry ? 'updated' : 'created'} successfully.`,
                color: 'green',
            });
            // Close the modal because we are done
            onClose();
        },
        // 3. The "Error handler" logic
        onError: (error: any) => {
            // Dig out the error message from the Django response
            const serverMessage = error.response?.data?.detail ||
                error.response?.data?.non_field_errors?.[0] ||
                "Something went wrong. Please try again.";

            notifications.show({
                title: 'Submission Failed',
                message: serverMessage,
                color: 'red',
                autoClose: 5000,
            });
        },
    });


    const handleSubmit = () => {
        mutation.mutate({
            name,
            picks: selectedTeams.map((t) => t.id),
        });
    };


    // NOTE: selecting less than 20 teams is allowed, but not advised
    const isValid = name.length > 0 && selectedTeams.length <= 20;

    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'seed',
        direction: 'asc',
    });

    // This recalculates automatically when 'entryPicks' or 'sortStatus' changes
    const records = useMemo(() => {
        if (!teams) return [];
        const data = sortBy(teams, sortStatus.columnAccessor);
        return sortStatus.direction === 'desc' ? data.reverse() : data;
    }, [teams, sortStatus]);

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={entry ? "Edit Entry" : "Create New Entry"}
            size="75%"
        >
            <Stack>
                <TextInput
                    label="Entry Name"
                    placeholder="e.g. John Doe #2"
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    required
                />

                <Text size="sm" fw={500}>
                    Select 20 Teams ({selectedTeams.length}/20)
                </Text>

                <DataTable
                    withTableBorder
                    withColumnBorders
                    striped
                    highlightOnHover
                    textSelectionDisabled
                    borderRadius="sm"
                    height={400}
                    records={records || []}
                    fetching={isLoading}
                    columns={[
                        // TODO: move display logic for secondary schools to serializer/model rather than on the client
                        { accessor: 'seed', title: 'Seed', width: 70, sortable: true },
                        { accessor: 'region', title: 'Region', sortable: true },
                        { accessor: 'name_display', title: 'Team', sortable: true },
                        { accessor: 'points_per_win', title: 'Points per Win', sortable: true },
                        { accessor: 'optimistic_max_points', title: 'Maximum Points', sortable: true },

                    ]}
                    selectedRecords={selectedTeams}
                    onSelectedRecordsChange={setSelectedTeams}
                    sortStatus={sortStatus}
                    onSortStatusChange={setSortStatus}
                // logic to limit selection or show warning could go here
                />

                {selectedTeams.length !== 20 && (
                    <Text size="xs" color={isValid ? 'black' : 'red'}>
                        You can select up to 20 teams.
                    </Text>
                )}

                <Group justify="flex-end" mt="md">
                    <Button variant="subtle" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isValid}
                        loading={mutation.isPending}
                        leftSection={entry ? <IconDeviceFloppy size={18} /> : <IconCheck size={18} />}
                    >
                        {entry ? "Save Entry" : "Create Entry"}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}