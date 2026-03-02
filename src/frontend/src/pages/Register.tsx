import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import {
    TextInput,
    PasswordInput,
    Button,
    Container,
    Paper,
    Title,
    Text,
    Anchor,
    Stack
} from "@mantine/core";
import { IconAt } from "@tabler/icons-react";

function Register() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [first_name, setFirstName] = useState("");
    const [last_name, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        setLoading(true);

        try {
            await api.post("/api/auth/register/", { username, password, first_name, last_name, email });
            alert("Registration successful! Please login.");
            navigate("/login");
        } catch (error: any) {
            alert("Registration failed. Try again with a different username, or contact the Felknor's for assistance");
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
                <form onSubmit={handleSubmit}>
                    <Stack>
                        <TextInput
                            label="Username"
                            placeholder="Choose a username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <TextInput
                            leftSectionPointerEvents="none"
                            leftSection={<IconAt size={16} />}
                            required
                            value={email}
                            label="Your email"
                            placeholder="Your email"
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <TextInput
                            label="First Name"
                            placeholder="Enter your first name"
                            required
                            value={first_name}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                        <TextInput
                            label="Last Name"
                            placeholder="Enter your last name"
                            required
                            value={last_name}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                        <PasswordInput
                            label="Password"
                            placeholder="Choose a password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <PasswordInput
                            label="Confirm Password"
                            placeholder="Re-enter password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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