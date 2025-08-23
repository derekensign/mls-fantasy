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
import {
  Player,
  DraftInfo,
  FantasyPlayer,
  DraftedPlayer,
  TransferAction,
} from "../types/DraftTypes";

interface DraftedTableDrawerProps {
  open: boolean;
  onClose: () => void;
  players: Player[];
  draftInfo: DraftInfo | null;
  fantasyPlayers: FantasyPlayer[];
  draftedPlayers: DraftedPlayer[];
  mode?: string;
  transferActions?: TransferAction[];
}

const DraftedTableDrawer: React.FC<DraftedTableDrawerProps> = ({
  open,
  onClose,
  players,
  draftInfo,
  fantasyPlayers,
  draftedPlayers,
  mode,
  transferActions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Determine if we're in transfer mode based on transfer actions
  const isTransferMode = transferActions && transferActions.length > 0;

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
            backgroundColor: "#FFFFF0 ",
          }}
        >
          <Typography variant="h6">
            {isTransferMode ? "Transferred Players" : "Drafted Players"}
          </Typography>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
        <div className="flex-1">
          <DraftedPlayersTable
            players={players}
            draftInfo={draftInfo}
            fantasyPlayers={fantasyPlayers}
            draftedPlayers={draftedPlayers}
            isMobile={isMobile}
            transferActions={transferActions}
          />
        </div>
      </Box>
    </Drawer>
  );
};

export default DraftedTableDrawer;
