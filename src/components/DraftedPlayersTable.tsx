import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { Player, DraftInfo } from "../types/DraftTypes";

interface DraftedPlayersTableProps {
  players: Player[];
  draftInfo: DraftInfo | null;
}

const DraftedPlayersTable: React.FC<DraftedPlayersTableProps> = ({
  players,
  draftInfo,
}) => {
  return (
    <TableContainer component={Paper} className="shadow rounded-lg my-[73px]">
      <Table className="min-w-full divide-y divide-[#B8860B]">
        <TableHead className="bg-[#B8860B] opacity-90 h-6">
          <TableRow>
            <TableCell>Pick #</TableCell>
            <TableCell>Player</TableCell>
            <TableCell>Drafted By</TableCell>
          </TableRow>
        </TableHead>
        <TableBody className="bg-[#FFFFF0] divide-y divide-[#B8860B]">
          {draftInfo?.drafted_players.map((draftedPlayer, index) => {
            const player = players.find(
              (p) => p.id === draftedPlayer.player_id
            );
            return (
              <TableRow
                key={`${draftedPlayer.player_id}-${index}`}
                className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70"
              >
                <TableCell>{index + 1}</TableCell>
                <TableCell>{player?.name || "Unknown"}</TableCell>
                <TableCell>{draftedPlayer.team_drafted_by}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DraftedPlayersTable;
