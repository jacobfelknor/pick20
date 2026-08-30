import { useEffect, useState } from "react";
import api, { API_ENDPOINTS } from "../api";
import { useNavigate } from "react-router-dom";
import { useForm } from "@mantine/form"; // Added
import {
    TextInput,
    PasswordInput,
    Button,
    Container,
    Paper,
    Title,
    Text,
    Anchor,
    Image,
    Stack
} from "@mantine/core";

function Login() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // 1. Initialize Mantine Form
    const form = useForm({
        initialValues: {
            username: "",
            password: "",
        },
    });

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);

        try {
            const res = await api.post(API_ENDPOINTS.auth.token, values);
            localStorage.setItem("access", res.data.access);
            localStorage.setItem("refresh", res.data.refresh);
            navigate("/entries");
        } catch (error: any) {
            // 2. Map backend "Detail" or "Non-field" errors to the form
            // DRF SimpleJWT usually returns { "detail": "No active account found..." }
            const errorMessage = error.response?.data?.detail || "Invalid username or password";

            form.setErrors({
                username: " ", // Just highlight the field
                password: errorMessage + ". Please reach out to the Felknor's if you need to reset your password", // Show the actual message here
            });
        } finally {
            setLoading(false);
        }
    };

    // Redirect logic
    // Could show a "checking if you're logged in" message here too
    useEffect(() => {
        if (localStorage.getItem("access")) {
            navigate("/entries");
        }
    }, [navigate]);

    return (
        <Container size={420} my={40}>
            <Stack align="center" gap="xs" mb="lg">
                <Image src="/favicon.png" w={60} h={60} alt="Logo" />
                <Title order={2} ta="center">Login to Felknor's Pick20</Title>
                <Text color="dimmed" size="sm" ta="center">
                    Don't have an account yet?{' '}
                    <Anchor size="sm" component="button" onClick={() => navigate("/register")}>
                        Create account
                    </Anchor>
                </Text>
                <Text color="dimmed" size="sm" mt={5}>
                    <Anchor size="sm" component="button" onClick={() => navigate("/register/rules")}>
                        View Rules
                    </Anchor>
                </Text>
            </Stack>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                {/* 3. Use form.onSubmit helper */}
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <TextInput
                        label="Username"
                        placeholder="Your username"
                        required
                        {...form.getInputProps("username")}
                    />
                    <PasswordInput
                        label="Password"
                        placeholder="Your password"
                        required
                        mt="md"
                        {...form.getInputProps("password")}
                    />
                    <Button fullWidth mt="xl" type="submit" loading={loading}>
                        Sign in
                    </Button>
                </form>
            </Paper>
        </Container>
    );
}

export default Login;