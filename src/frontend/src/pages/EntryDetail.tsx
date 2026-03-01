import { Button } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useParams, useNavigate } from "react-router-dom";
import PicksTable from "../tables/PicksTable";

const EntryDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // TOOO: based on which tournament this entry belongs to, set the tournament dropdown in navbar?
    //       additionally, should the url to include the tournament id?

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
            <p>Viewing details for Entry ID: <strong>{id}</strong></p>

            {/* if tournament locked */}
            <PicksTable entry={id} />
            {/* else */}
            {/* <PicksForm entry={id} /> */}
        </div>
    );
};

export default EntryDetail;