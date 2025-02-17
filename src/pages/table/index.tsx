import React from "react";
import { Container } from "@mui/material";
import GoldenBootTable from "@/components/GoldenBootTable";

function TablePage() {
  return (
    <Container
      sx={{
        py: 4,
        backgroundColor: "#333",
        minHeight: "100vh",
        minWidth: "100vw",
      }}
    >
      <GoldenBootTable />
    </Container>
  );
}

export default TablePage;
