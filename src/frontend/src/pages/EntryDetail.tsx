import { Button } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useParams, useNavigate } from "react-router-dom";

const EntryDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <div style={{ padding: '20px' }}>
            {/* 1. The Back Button */}
            <Button
                leftSection={<IconArrowLeft size={14} />}
                onClick={() => navigate("/entries")}
                variant="filled"
            >
                Back to Entries
            </Button>

            {/* 2. Content */}
            <h2>Entry Detail View</h2>
            <p>Viewing details for Entry ID: <strong>{id}</strong></p>
        </div>
    );
};

export default EntryDetail;