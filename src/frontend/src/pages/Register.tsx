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

function Register() {
    const [username, setUsername] = useState("");
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
            await api.post("/api/auth/register/", { username, password });
            alert("Registration successful! Please login.");
            navigate("/login");
        } catch (error: any) {
            alert("Registration failed. Username might already exist.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size={420} my={40}>
            <Title align="center">Create an Account</Title>
            <Text color="dimmed" size="sm" align="center" mt={5}>
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