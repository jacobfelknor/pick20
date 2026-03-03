import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { useForm } from "@mantine/form"; // Added this
import {
    TextInput,
    PasswordInput,
    Button,
    Container,
    Paper,
    Title,
    Text,
    Anchor,
    Stack,
    Center,
    Box,
    Progress
} from "@mantine/core";
import { IconAt, IconCheck, IconX } from "@tabler/icons-react";

function PasswordRequirement({ meets, label }: { meets: boolean; label: string }) {
    return (
        <Text component="div" color={meets ? 'teal' : 'red'} mt={5} size="sm">
            <Center inline>
                {meets ? <IconCheck size="14" stroke={1.5} /> : <IconX size="14" stroke={1.5} />}
                <Box ml={7}>{label}</Box>
            </Center>
        </Text>
    );
}

const requirements = [
    { re: /.{8,}/, label: 'Has at least 8 characters' },
    { re: /[0-9]/, label: 'Includes number' },
    { re: /[A-Za-z]/, label: 'Includes letter' },
];

function getStrength(password: string) {
    let multiplier = password.length > 0 ? 1 : 0;
    requirements.forEach((requirement) => {
        if (!requirement.re.test(password)) {
            multiplier = 0;
        }
    });
    return multiplier * 100;
}

function Register() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const form = useForm({
        initialValues: {
            username: "",
            email: "",
            first_name: "",
            last_name: "",
            password: "",
            confirmPassword: "",
        },
        // This automatically trims the names before the handleSubmit receives them
        transformValues: (values) => ({
            ...values,
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            // username: values.username.trim().toLowerCase(),
        }),
        validate: {
            username: (value) =>
                /^[a-z0-9]+$/.test(value)
                    ? null
                    : "Username must be lowercase with no spaces or special characters",
            email: (value) =>
                /^\S+@\S+$/.test(value) ? null : "Invalid email",
            password: (value) =>
                /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(value)
                    ? null
                    : "Must be 8+ characters with a letter and a number",
            confirmPassword: (value, values) =>
                value !== values.password ? "Passwords do not match" : null,
        },
    });

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);

        try {
            // We destructure confirmPassword out so we don't send it to the API
            const { confirmPassword, ...registerData } = values;
            await api.post("/api/auth/register/", registerData);
            alert("Registration successful! Please login.");
            navigate("/login");
        } catch (error: any) {
            const responseData = error.response?.data;
            form.setErrors(responseData);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size={420} my={40}>
            <Title>Create an Account</Title>
            <Text color="dimmed" size="sm" mt={5}>
                Already have an account?{' '}
                <Anchor size="sm" component="button" onClick={() => navigate("/login")}>
                    Login
                </Anchor>
            </Text>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack>
                        <TextInput
                            label="Username"
                            placeholder="Choose a username"
                            required
                            {...form.getInputProps("username")}
                        />
                        <TextInput
                            leftSectionPointerEvents="none"
                            leftSection={<IconAt size={16} />}
                            required
                            label="Your email"
                            placeholder="hello@example.com"
                            {...form.getInputProps("email")}
                        />
                        <TextInput
                            label="First Name"
                            placeholder="Enter your first name"
                            required
                            {...form.getInputProps("first_name")}
                        />
                        <TextInput
                            label="Last Name"
                            placeholder="Enter your last name"
                            required
                            {...form.getInputProps("last_name")}
                        />
                        <div>
                            <PasswordInput
                                label="Password"
                                placeholder="Your password (spaces allowed)"
                                required
                                {...form.getInputProps("password")}
                            />

                            {/* Strength Meter Visuals */}
                            <Progress
                                color={form.values.password.length > 0 ? (getStrength(form.values.password) === 100 ? 'teal' : 'yellow') : 'gray'}
                                value={form.values.password.length > 0 ? (getStrength(form.values.password) === 100 ? 100 : 40) : 0}
                                size={5}
                                mt="xs"
                            />

                            {requirements.map((requirement, index) => (
                                <PasswordRequirement
                                    key={index}
                                    label={requirement.label}
                                    meets={requirement.re.test(form.values.password)}
                                />
                            ))}
                        </div>
                        <PasswordInput
                            label="Confirm Password"
                            placeholder="Re-enter password"
                            required
                            {...form.getInputProps("confirmPassword")}
                        />
                        <Button fullWidth mt="xl" type="submit" loading={loading}>
                            Register
                        </Button>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
}

export default Register;