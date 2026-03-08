import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Group, Text, Stack, TextInput } from '@mantine/core';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import api from '../api';
import { notifications } from '@mantine/notifications';
import { sortBy } from 'lodash';
import { useForm } from '@mantine/form';

interface EntryFormModalProps {
    opened: boolean;
    onClose: () => void;
    tournamentId: number;
    entry?: any; // If provided, we are in "Edit" mode
}

export function EntryFormModal({ opened, onClose, tournamentId, entry }: EntryFormModalProps) {
    const queryClient = useQueryClient();

    // 1. Initialize Mantine Form
    const form = useForm({
        initialValues: {
            name: '',
            picks: [] as any[], // This will hold the full team objects for the DataTable
        },
        validate: {
            name: (value) => (value.length < 1 ? 'Name is required' : null),
            picks: (value) => (value.length > 20 ? 'You can only select up to 20 teams' : null),
        },
    });

    const { data: teams, isLoading } = useQuery({
        queryKey: ['tournament-teams', tournamentId],
        queryFn: () => api.get(`/api/tournament/${tournamentId}/teams/`).then((res) => res.data),
        enabled: opened,
    });

    // 2. Sync entry data into form when modal opens
    useEffect(() => {
        if (opened) {
            if (entry && teams) {
                const pickIds = entry.picks.map((p: any) => typeof p === 'object' ? p.id : p);
                const preselected = teams.filter((team: any) => pickIds.includes(team.id));

                form.setValues({
                    name: entry.name,
                    picks: preselected,
                });
            } else {
                form.reset();
            }
        }
    }, [entry, opened, teams]);

    const mutation = useMutation({
        // The actual "Work" function
        mutationFn: (values: typeof form.values) => {
            // If we have an 'entry', we use PATCH (update). If not, POST (create).
            const payload = {
                name: values.name,
                // Transform objects back to IDs for the API
                picks: values.picks.map((t) => t.id),
                tournament: tournamentId
            };

            return entry
                ? api.patch(`/api/entries/${entry.id}/`, payload)
                : api.post(`/api/entries/`, payload);
        },
        // The "What happened?" logic
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
        onError: (error: any) => {
            // Dig out the error message from the Django response
            const errorData = error.response?.data;

            if (errorData) {
                // Map Django Rest Framework errors to Mantine Form fields
                form.setErrors(errorData);
            } else {
                notifications.show({
                    title: 'Submission Failed',
                    message: "Something went wrong. Please try again.",
                    color: 'red',
                    autoClose: 5000,
                });
            }
        },
    });

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
            fullScreen={window.innerWidth < 768}
        >
            {/* 4. Use form.onSubmit to handle validation and submission */}
            <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
                <Stack>
                    <TextInput
                        label="Entry Name"
                        placeholder="e.g. John Doe #2"
                        required
                        {...form.getInputProps('name')}
                    />

                    <Stack gap={'xs'}>
                        <Text size="sm" fw={500}>
                            Select 20 Teams ({form.values.picks.length}/20)
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
                                { accessor: 'seed', title: 'Seed', width: 70, sortable: true },
                                { accessor: 'region', title: 'Region', sortable: true },
                                { accessor: 'name_display', title: 'Team', sortable: true },
                                { accessor: 'points_per_win', title: 'Points per Win', sortable: true },
                                { accessor: 'optimistic_max_points', title: 'Maximum Points', sortable: true },
                            ]}
                            selectedRecords={form.values.picks}
                            onSelectedRecordsChange={(recs) => form.setFieldValue('picks', recs)}
                            sortStatus={sortStatus}
                            onSortStatusChange={setSortStatus}
                        />
                        {/* 5. Display pick-specific errors below the table */}
                        {form.errors.picks && (
                            <Text color="red">{form.errors.picks}</Text>
                        )}
                    </Stack>

                    <Group justify="flex-end" mt="md">
                        <Button variant="subtle" onClick={onClose}>Cancel</Button>
                        <Button
                            type="submit"
                            loading={mutation.isPending}
                            leftSection={entry ? <IconDeviceFloppy size={18} /> : <IconCheck size={18} />}
                        >
                            {entry ? "Save Entry" : "Create Entry"}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}