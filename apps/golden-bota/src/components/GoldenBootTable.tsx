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
} from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import { fetchGoldenBootTable } from "@mls-fantasy/api";
import { Player, GoldenBootTableResponse } from "@mls-fantasy/api";
import Image from "next/image";
import { useRouter } from "next/router";

interface TeamWithRank extends GoldenBootTableResponse {
  rank: number;
}

function Row({ row }: { row: TeamWithRank }) {
  const [open, setOpen] = useState(false);
  const { rank, TeamName, FantasyPlayerName, TotalGoals, Players } = row;

  return (
    <>
      <TableRow
        onClick={() => setOpen(!open)}
        className="transition duration-300 ease-in-out hover:bg-[#FFD700] hover:bg-opacity-70"
      >
        <TableCell className="w-16 !px-2">{rank}</TableCell>
        <TableCell className="!px-2 sm:px-4">{FantasyPlayerName}</TableCell>
        <TableCell className="!px-2 sm:px-4">{TeamName}</TableCell>
        <TableCell className="w-20 !px-2">{TotalGoals}</TableCell>
        <TableCell className="hidden !pl-0 sm:table-cell w-10">
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box margin={1}>
              {/* Mobile-first responsive table */}
              <Box sx={{ display: { xs: "block", md: "none" } }}>
                {/* Mobile Card Layout */}
                {Players.map((player) => (
                  <Box
                    key={player.id}
                    sx={{
                      mb: 2,
                      p: 2,
                      border: "1px solid #B8860B",
                      borderRadius: "8px",
                      backgroundColor: "#F8F6F0", // Warm cream background
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 1,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            fontWeight: "bold",
                            fontSize: "1rem",
                            color: "#2C1810", // Dark brown for good contrast
                            mb: 0.5,
                          }}
                        >
                          {player.name}
                        </Box>
                        {player.transferStatus &&
                          player.transferStatus !== "Original" && (
                            <Box
                              sx={{
                                mt: 0.5,
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "12px",
                                fontSize: "0.6rem",
                                fontWeight: "bold",
                                color: "white",
                                backgroundColor:
                                  player.transferStatus.startsWith(
                                    "Transferred In"
                                  )
                                    ? "#4CAF50" // Green
                                    : player.transferStatus.startsWith(
                                        "Transferred Out"
                                      )
                                    ? "#f44336" // Red
                                    : "#FF9800", // Orange for In/Out
                              }}
                            >
                              {player.transferStatus.startsWith(
                                "Transferred In"
                              )
                                ? "IN"
                                : player.transferStatus.startsWith(
                                    "Transferred Out"
                                  )
                                ? "OUT"
                                : "IN/OUT"}
                            </Box>
                          )}
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Box
                          sx={{
                            fontSize: "1.25rem",
                            fontWeight: "bold",
                            color: "#2C1810", // Dark brown for good contrast
                          }}
                        >
                          {player.goals_2025}
                        </Box>
                        {player.totalGoalsAllTime !== undefined &&
                          player.totalGoalsAllTime !== player.goals_2025 && (
                            <Box sx={{ fontSize: "0.75rem", color: "#666" }}>
                              (was {player.totalGoalsAllTime})
                            </Box>
                          )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Desktop Table Layout */}
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <Table size="small" aria-label="players">
                  <TableHead>
                    <TableRow>
                      <TableCell>Player Name</TableCell>
                      <TableCell>Transfer Status</TableCell>
                      <TableCell>Goals</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Players.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell component="th" scope="row">
                          {player.name}
                        </TableCell>
                        <TableCell>
                          {player.transferStatus &&
                            player.transferStatus !== "Original" && (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "12px",
                                  fontSize: "0.7rem",
                                  fontWeight: "bold",
                                  color: "white",
                                  backgroundColor:
                                    player.transferStatus.startsWith(
                                      "Transferred In"
                                    )
                                      ? "#4CAF50" // Green
                                      : player.transferStatus.startsWith(
                                          "Transferred Out"
                                        )
                                      ? "#f44336" // Red
                                      : "#FF9800", // Orange for In/Out
                                }}
                              >
                                {player.transferStatus.startsWith(
                                  "Transferred In"
                                )
                                  ? "TRANSFERRED IN"
                                  : player.transferStatus.startsWith(
                                      "Transferred Out"
                                    )
                                  ? "TRANSFERRED OUT"
                                  : "IN/OUT"}
                              </span>
                            )}
                        </TableCell>
                        <TableCell>
                          {player.goals_2025}
                          {player.totalGoalsAllTime !== undefined &&
                            player.totalGoalsAllTime !== player.goals_2025 && (
                              <span
                                style={{
                                  color: "#666",
                                  fontSize: "0.8rem",
                                  marginLeft: "4px",
                                }}
                              >
                                (was {player.totalGoalsAllTime})
                              </span>
                            )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function CollapsibleTable() {
  const [teams, setTeams] = useState<TeamWithRank[]>([]);
  const router = useRouter();
  const { leagueId } = router.query;

  useEffect(() => {
    const getTeams = async () => {
      if (!leagueId) return; // Don't fetch if leagueId isn't available yet

      const teamsData = await fetchGoldenBootTable(String(leagueId));

      // Sort teams by TotalGoals descending
      const sortedTeams = teamsData.sort((a, b) => b.TotalGoals - a.TotalGoals);

      // Assign proper ranking based on sort order
      const rankedTeams = sortedTeams.map((team, index) => ({
        ...team,
        rank: index + 1,
      }));

      setTeams(rankedTeams);
    };

    getTeams();
  }, [leagueId]); // Add leagueId to dependency array

  return (
    <div className="flex flex-col items-center p-4 bg-black rounded-lg shadow-xl">
      <Image
        src="/golden-bota-boiz.png"
        alt="Golden Cleat"
        width={300}
        height={300}
      />
      <div className="overflow-x-auto ">
        <TableContainer component={Paper} className="shadow rounded-lg">
          <Table className="min-w-full divide-y divide-[#B8860B]">
            <TableHead className="bg-[#B8860B] opacity-90">
              <TableRow>
                <TableCell className="w-16 !px-2">Rank</TableCell>
                <TableCell className="!px-2 sm:px-4">Player</TableCell>
                <TableCell className="!px-2 sm:px-4">Team</TableCell>
                <TableCell className="w-20 !px-2">Goals</TableCell>
                <TableCell className="hidden sm:table-cell w-10" />
              </TableRow>
            </TableHead>
            <TableBody className="bg-[#FFFFF0] divide-y divide-[#B8860B]">
              {teams.map((team, index) => (
                <Row key={index} row={team} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}

export default CollapsibleTable;
