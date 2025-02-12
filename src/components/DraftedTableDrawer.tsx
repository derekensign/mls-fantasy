import React from "react";
import {
  Drawer,
  IconButton,
  Typography,
  Box,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DraftedPlayersTable from "./DraftedPlayersTable";
import { Player, DraftInfo } from "../types/DraftTypes";
import { FantasyPlayer } from "./DraftedPlayersTable";
interface DraftedTableDrawerProps {
  open: boolean;
  onClose: () => void;
  players: Player[];
  draftInfo: DraftInfo | null;
  fantasyPlayers: FantasyPlayer[];
}

const DraftedTableDrawer: React.FC<DraftedTableDrawerProps> = ({
  open,
  onClose,
  players,
  draftInfo,
  fantasyPlayers,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: isMobile ? "100vw" : 600,
          borderRadius: isMobile ? 0 : 2,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            borderRadius: isMobile ? 0 : "inherit",
          }}
        >
          <Typography variant="h6">Drafted Players</Typography>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
        <DraftedPlayersTable
          players={players}
          draftInfo={draftInfo}
          fantasyPlayers={fantasyPlayers}
          isMobile={isMobile}
        />
      </Box>
    </Drawer>
  );
};

export default DraftedTableDrawer;
