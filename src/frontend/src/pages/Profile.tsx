import { useState, useEffect } from "react";
import api from "../api";
import { useForm } from "@mantine/form";
import {
    TextInput,
    PasswordInput,
    Button,
    Container,
    Paper,
    Title,
    Text,
    Stack,
    Center,
    Progress,
    Divider,
    Loader,
} from "@mantine/core";
import { IconAt, IconCheck, IconX, IconUser } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { PasswordRequirement, getStrength, requirements } from "./Register";


function Profile() {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const form = useForm({
        initialValues: {
            username: "",
            email: "",
            first_name: "",
            last_name: "",
            password: "", // Optional for edit
            confirmPassword: "",
        },
        validate: {
            username: (value) =>
                /^[a-z0-9]+$/.test(value)
                    ? null
                    : "Username must be lowercase with no spaces",
            email: (value) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
            // Only validate password if the user actually typed something in it
            password: (value) =>
                value && !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(value)
                    ? "Must be 8+ characters with a letter and a number"
                    : null,
            confirmPassword: (value, values) =>
                values.password && value !== values.password ? "Passwords do not match" : null,
        },
    });

    // Fetch user data on load
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Adjust this endpoint based on your backend (e.g., /api/auth/user/ or /api/profile/)
                const response = await api.get("/api/auth/user/");
                form.setValues({
                    username: response.data.username,
                    email: response.data.email,
                    first_name: response.data.first_name || "",
                    last_name: response.data.last_name || "",
                    password: "",
                    confirmPassword: "",
                });
            } catch (error) {
                console.error("Failed to fetch profile", error);
            } finally {
                setFetching(false);
            }
        };
        fetchUserData();
    }, []);

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);

        try {
            const { confirmPassword, ...updateData } = values;

            // If password is empty, don't send it to the backend
            if (!updateData.password) {
                delete updateData.password;
            }

            await api.patch("/api/auth/user/", updateData);
            // Clear password fields after success
            form.setFieldValue("password", "");
            form.setFieldValue("confirmPassword", "");
            notifications.show({
                title: 'Success!',
                message: "Profile updated successfully.",
                color: 'green',
            });
        } catch (error: any) {
            form.setErrors(error.response?.data || { message: "Update failed" });
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <Center style={{ height: '100vh' }}><Loader size="xl" /></Center>;

    return (
        <Container size={460} my={40}>
            <Title order={2} ta="center">Profile Settings</Title>
            <Text c="dimmed" size="sm" ta="center" mt={5}>
                Update your personal information
            </Text>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">

                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack>
                        <TextInput
                            label="Username"
                            disabled // Often usernames are immutable, remove 'disabled' if allowed
                            leftSection={<IconUser size={16} />}
                            {...form.getInputProps("username")}
                        />
                        <TextInput
                            label="Email"
                            required
                            leftSection={<IconAt size={16} />}
                            {...form.getInputProps("email")}
                        />
                        <TextInput
                            label="First Name"
                            {...form.getInputProps("first_name")}
                        />
                        <TextInput
                            label="Last Name"
                            {...form.getInputProps("last_name")}
                        />

                        {/* <Divider label="Security" labelPosition="center" my="lg" />

                        <div>
                            <PasswordInput
                                label="New Password"
                                placeholder="Leave blank to keep current"
                                {...form.getInputProps("password")}
                            />

                            {form.values.password && (
                                <>
                                    <Progress
                                        color={getStrength(form.values.password) === 100 ? 'teal' : 'yellow'}
                                        value={getStrength(form.values.password)}
                                        size={5}
                                        mt="xs"
                                    />
                                    {requirements.map((req, index) => (
                                        <PasswordRequirement
                                            key={index}
                                            label={req.label}
                                            meets={req.re.test(form.values.password)}
                                        />
                                    ))}
                                </>
                            )}
                        </div>

                        <PasswordInput
                            label="Confirm New Password"
                            placeholder="Confirm your new password"
                            {...form.getInputProps("confirmPassword")}
                        /> */}

                        <Button fullWidth mt="xl" type="submit" loading={loading} color="blue">
                            Save Changes
                        </Button>
                    </Stack>
                </form>

            </Paper>
        </Container>

    );
}

export default Profile;