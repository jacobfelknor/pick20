import { useState, useEffect } from "react";
import api, { API_ENDPOINTS } from "../api";
import { useForm } from "@mantine/form";
import {
    TextInput,
    PasswordInput,
    Button,
    Container,
    Paper,
    Title,
    Stack,
    Center,
    Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";


function Profile() {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const form = useForm({
        initialValues: {
            username: "",
            email: "",
            first_name: "",
            last_name: "",
            old_password: "", // Added this
            password: "",
            confirmPassword: "",
        },
        validate: {
            username: (value) =>
                /^[a-z0-9]+$/.test(value)
                    ? null
                    : "Username must be lowercase with no spaces",
            email: (value) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
            // Only validate password if the user actually typed something in it
            old_password: (value) => (isChangingPassword && !value ? "Current password is required" : null),
            password: (value) =>
                isChangingPassword && !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(value)
                    ? "Must be 8+ characters with a letter and a number"
                    : null,
            confirmPassword: (value, values) =>
                isChangingPassword && value !== values.password ? "Passwords do not match" : null,
        },
    });

    // Fetch user data on load
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Adjust this endpoint based on your backend (e.g., /api/auth/user/ or /api/profile/)
                const response = await api.get(API_ENDPOINTS.auth.user);
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
            const payload: any = isChangingPassword
                ? {
                    old_password: values.old_password,
                    password: values.password
                }
                : {
                    // intentionally omit the username field, which we don't allow changing
                    email: values.email,
                    first_name: values.first_name,
                    last_name: values.last_name
                };

            await api.patch(API_ENDPOINTS.auth.user, payload);

            notifications.show({
                title: 'Success!',
                message: isChangingPassword ? "Password updated." : "Profile updated.",
                color: 'green',
            });

            // Reset view and clear passwords
            setIsChangingPassword(false);
            form.setValues({ ...form.values, old_password: "", password: "", confirmPassword: "" });
        } catch (error: any) {
            form.setErrors(error.response?.data || { message: "Update failed" });
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <Center style={{ height: '100vh' }}><Loader size="xl" /></Center>;

    return (
        <Container size={460} my={40}>
            <Title order={2} ta="center">
                {isChangingPassword ? "Change Password" : "Profile Settings"}
            </Title>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack>
                        {!isChangingPassword ? (
                            // --- PROFILE VIEW ---
                            <>
                                <TextInput label="Username" disabled {...form.getInputProps("username")} />
                                <TextInput label="Email" required {...form.getInputProps("email")} />
                                <TextInput label="First Name" {...form.getInputProps("first_name")} />
                                <TextInput label="Last Name" {...form.getInputProps("last_name")} />

                                <Button
                                    variant="subtle"
                                    size="xs"
                                    color="red"
                                    onClick={() => setIsChangingPassword(true)}
                                >
                                    Change Password
                                </Button>
                            </>
                        ) : (
                            // --- PASSWORD VIEW ---
                            <>
                                <PasswordInput
                                    label="Current Password"
                                    required
                                    {...form.getInputProps("old_password")}
                                />
                                <PasswordInput
                                    label="New Password"
                                    required
                                    {...form.getInputProps("password")}
                                />
                                <PasswordInput
                                    label="Confirm New Password"
                                    required
                                    {...form.getInputProps("confirmPassword")}
                                />

                                <Button
                                    variant="subtle"
                                    size="xs"
                                    onClick={() => setIsChangingPassword(false)}
                                >
                                    Back to Profile
                                </Button>
                            </>
                        )}

                        <Button fullWidth mt="xl" type="submit" loading={loading}>
                            {isChangingPassword ? "Update Password" : "Save Changes"}
                        </Button>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
}

export default Profile;