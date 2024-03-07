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
import { Team } from "../types/goldenBootTypes";
import Image from "next/image";

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
        className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70 "
      >
        <TableCell>{rank}</TableCell>
        <TableCell>{TeamName}</TableCell>
        <TableCell>{FantasyPlayerName}</TableCell>
        <TableCell>{TotalGoals}</TableCell>
        <TableCell className="hidden sm:table-cell">
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70">
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
    <div className="flex flex-col items-center p-4 bg-black rounded-lg shadow-xl">
      <Image
        src="/golden-bota-boiz.png"
        alt="Golden Cleat"
        width={300}
        height={300}
      />
      <div className="overflow-x-auto">
        <TableContainer component={Paper} className="shadow rounded-lg">
          <Table className="min-w-full divide-y divide-[#B8860B]">
            <TableHead className="bg-[#B8860B] opacity-90">
              <TableRow>
                <TableCell>Ranking</TableCell>
                <TableCell>Fantasy Player Name</TableCell>
                <TableCell>Team Name</TableCell>
                <TableCell>Total Goals</TableCell>
                <TableCell className="hidden sm:table-cell" />
              </TableRow>
            </TableHead>
            <TableBody className="bg-[#FFFFF0] divide-y divide-[#B8860B]">
              {teams &&
                teams.map((team, index) => <Row key={index} row={team} />)}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}

export default CollapsibleTable;

// Light Gold: #FDD017 - A bright and vibrant shade of gold that mimics the look of polished gold.
// Pale Gold: #FDF5E6 - A soft, creamy gold that works well for backgrounds and subtle gold accents.
// Metallic Gold: #D4AF37 - This shade closely resembles the color of gold metal, providing a classic and elegant look.
// Rose Gold: #B76E79 - A pinkish gold that adds a unique, modern twist to the traditional gold color.
// Antique Gold: #DAA520 - A darker gold with a hint of bronze, giving it an aged and sophisticated appearance.
// Golden Yellow: #FFDF00 - A vivid, sunny gold that brings brightness and energy to designs.
// Rich Gold: #FFD700 - A true gold color that is both luxurious and attention-grabbing.
// Deep Gold: #B8860B - A
