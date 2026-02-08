import { useState } from "react";
import api from "../api"; // Use our custom interceptor
import { useNavigate } from "react-router-dom";
import { TextInput, PasswordInput, Button, Container, Paper, Title, Text, Anchor } from "@mantine/core";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post("/api/auth/token/", { username, password });
            localStorage.setItem("access", res.data.access);
            localStorage.setItem("refresh", res.data.refresh);
            navigate("/"); // Redirect to dashboard
        } catch (error) {
            alert("Login failed! Check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size={420} my={40}>
            <Title align="center">Welcome back!</Title>
            <Text color="dimmed" size="sm" align="center" mt={5}>
                Do not have an account yet?{' '}
                <Anchor size="sm" component="button" onClick={() => navigate("/register")}>
                    Create account
                </Anchor>
            </Text>

            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <form onSubmit={handleSubmit}>
                    <TextInput 
                        label="Username" 
                        placeholder="Your username" 
                        required 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <PasswordInput 
                        label="Password" 
                        placeholder="Your password" 
                        required 
                        mt="md" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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