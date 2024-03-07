import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Box,
  IconButton,
  Typography,
} from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import { fetchGoldenBootTable } from "../../backend/API";
import { Player, Team } from "../types/goldenBootTypes";

function Row({
  row: { rank, TeamName, FantasyPlayerName, TotalGoals, Players },
}: {
  row: Team;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        onClick={() => setOpen(!open)}
        className="transition duration-300 ease-in-out hover:bg-gray-100 "
      >
        <TableCell className="hidden sm:table-cell">
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{rank}</TableCell>
        <TableCell>{TeamName}</TableCell>
        <TableCell>{FantasyPlayerName}</TableCell>
        <TableCell>{TotalGoals}</TableCell>
      </TableRow>
      <TableRow className="transition duration-300 ease-in-out hover:bg-gray-100">
        <TableCell className="py-0" colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Table size="small" aria-label="players">
                <TableHead>
                  <TableRow>
                    <TableCell>Player Name</TableCell>
                    <TableCell>Goals</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Players.map((player) => (
                    <TableRow key={player.playerId}>
                      <TableCell component="th" scope="row">
                        {player.PlayerName}
                      </TableCell>
                      <TableCell>{player.Goals}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function CollapsibleTable() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    const getTeams = async () => {
      const teamsData = await fetchGoldenBootTable();
      const sortedTeams = teamsData.sort(
        (a: Team, b: Team) => b.TotalGoals - a.TotalGoals
      );

      const rankedTeams = sortedTeams.map((team: Team, index: number) => {
        const { rank, ...teamWithoutRank } = team;
        return {
          rank: index + 1,
          ...teamWithoutRank,
        };
      });

      setTeams(rankedTeams);
    };

    getTeams();
  }, []);

  return (
    <div className="overflow-x-auto">
      <TableContainer component={Paper} className="shadow rounded-lg">
        <Table className="min-w-full divide-y divide-gray-200">
          <TableHead className="bg-gray-50">
            <TableRow>
              <TableCell className="hidden sm:table-cell" />
              <TableCell>Ranking</TableCell>
              <TableCell>Fantasy Player Name</TableCell>
              <TableCell>Team Name</TableCell>
              <TableCell>Total Goals</TableCell>
            </TableRow>
          </TableHead>
          <TableBody className="bg-white divide-y divide-gray-200">
            {teams &&
              teams.map((team, index) => <Row key={index} row={team} />)}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

export default CollapsibleTable;
