import { ThemeIcon } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";

export default function CheckOrXIcon({ value }: { value: boolean }) {
    return (
        <ThemeIcon
            color={value ? 'green' : 'red'}
            variant="light"
            radius="xl"
            size="md"
        >
            {value ? <IconCheck size={18} /> : <IconX size={18} />}
        </ThemeIcon>
    );
}