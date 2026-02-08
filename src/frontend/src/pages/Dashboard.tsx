import { Container, Title, Text, Button } from "@mantine/core";
import { useNavigate } from "react-router-dom";

function Dashboard() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        navigate("/login");
    };

    return (
        <Container mt="xl">
            <Title>Dashboard</Title>
            <Text mt="md">Hello World! You are authenticated.</Text>
            <Button color="red" mt="md" onClick={handleLogout}>
                Logout
            </Button>
        </Container>
    );
}

export default Dashboard;