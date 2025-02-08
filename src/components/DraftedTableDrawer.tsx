import React from "react";
import { Drawer } from "@mui/material";
import DraftedPlayersTable from "./DraftedPlayersTable";
import { Player, DraftInfo } from "../types/DraftTypes";

interface DraftedTableDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  players: Player[];
  draftInfo: DraftInfo | null;
}

const DraftedTableDrawer: React.FC<DraftedTableDrawerProps> = ({
  drawerOpen,
  setDrawerOpen,
  players,
  draftInfo,
}) => {
  return (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      PaperProps={{
        sx: {
          backgroundColor: "#FFFFF0 !important", // Matching the TableBody background in DraftedPlayersTable.tsx
          boxShadow: 24,
          height: "100%", // Adjust as necessary for your layout
        },
      }}
    >
      <DraftedPlayersTable players={players} draftInfo={draftInfo} />
    </Drawer>
  );
};

export default DraftedTableDrawer;
