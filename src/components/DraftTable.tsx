// /*
//   Start of Selection
// */
// import React, { useEffect, useState, useCallback, useRef } from "react";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   Paper,
//   Button,
//   TextField,
// } from "@mui/material";
// import {
//   fetchPlayers2024,
//   fetchDraftData,
//   draftPlayer,
// } from "../../backend/API";
// import useUserStore from "@/stores/useUserStore";

// interface Player {
//   id: string;
//   name: string;
//   team: string;
//   goals_2024: number;
//   draftedBy?: string | null;
// }

// interface DraftedPlayer {
//   player_id: string;
//   team_drafted_by: string;
//   draft_time: string;
// }

// interface DraftInfo {
//   league_id: string;
//   draft_status: string;
//   draft_order: string[];
//   current_turn_team: string;
//   drafted_players: DraftedPlayer[];
// }

// interface DraftTableProps {
//   leagueId: string;
// }

// const DraftPage: React.FC<DraftTableProps> = ({ leagueId }) => {
//   const [players, setPlayers] = useState<Player[]>([]);
//   const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
//   const [timer, setTimer] = useState<number>(0);
//   const [searchTerm, setSearchTerm] = useState<string>("");
//   const [loading, setLoading] = useState<boolean>(true);

//   const { userDetails } = useUserStore();
//   const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();

//   // Create a ref to always have the latest players data.
//   const playersRef = useRef<Player[]>([]);
//   useEffect(() => {
//     playersRef.current = players;
//   }, [players]);

//   // Log the players state whenever it changes.
//   useEffect(() => {
//     const player1597 = players.find((p) => p.id === "1597");
//     console.log("player object with ID 1597: ", player1597);
//     const player1292 = players.find((p) => p.id === "1292");
//     console.log("player object with ID 1292: ", player1292);
//   }, [players]);

//   useEffect(() => {
//     const loadDraftData = async () => {
//       setLoading(true);
//       try {
//         const rawData = await fetchPlayers2024();
//         const formattedPlayers: Player[] = rawData.map((item: any) => ({
//           id: item.id.S,
//           name: item.name.S,
//           team: item.team.S,
//           goals_2024: parseInt(item.goals_2024.N, 10),
//           draftedBy: item.draftedBy?.S || null,
//         }));
//         setPlayers(formattedPlayers);

//         const draftData = await fetchDraftData(leagueId);
//         console.log("Draft Data:", draftData);
//         setDraftInfo(draftData);

//         setTimer(30);
//       } catch (error) {
//         console.error("Error loading draft data:", error);
//       } finally {
//         setLoading(false);
//       }
//     };
//     loadDraftData();
//   }, [leagueId]);

//   const handleAutoPick = useCallback(
//     async (teamToPickFor?: string) => {
//       if (!draftInfo) return;
//       const pickingTeam = teamToPickFor || draftInfo.current_turn_team;
//       if (!pickingTeam) return;

//       // Use the ref to ensure you are using the latest players state.
//       const sortedAvailable = playersRef.current
//         .filter((p) => !p.draftedBy)
//         .sort((a, b) => b.goals_2024 - a.goals_2024);

//       // Log Benteke's info via the ref.
//       console.log(
//         "benteke right before filter:",
//         playersRef.current.find((p) => p.id === "1597")
//       );
//       const nextPlayer = sortedAvailable[0];
//       console.log("next player", nextPlayer);
//       if (!nextPlayer) return;

//       try {
//         await draftPlayer(leagueId, nextPlayer.id, pickingTeam);

//         // Update local state
//         setPlayers((prevPlayers) =>
//           prevPlayers.map((p) =>
//             p.id === nextPlayer.id ? { ...p, draftedBy: pickingTeam } : p
//           )
//         );

//         // Update draftInfo
//         setDraftInfo((prevDraftInfo) => {
//           if (!prevDraftInfo) return null;
//           return {
//             ...prevDraftInfo,
//             drafted_players: [
//               ...prevDraftInfo.drafted_players,
//               {
//                 player_id: nextPlayer.id,
//                 team_drafted_by: pickingTeam,
//                 draft_time: new Date().toISOString(),
//               },
//             ],
//           };
//         });

//         // Move to the next team
//         setTimeout(() => {
//           nextTurn(pickingTeam);
//         }, 100);
//       } catch (error) {
//         console.error("Error auto-picking player:", error);
//       }
//     },
//     [draftInfo, leagueId]
//   );

//   const nextTurn = useCallback(
//     (justPickedTeam?: string): void => {
//       if (!draftInfo) return;
//       const pickingTeam = justPickedTeam || draftInfo.current_turn_team;
//       const currentIndex = draftInfo.draft_order.indexOf(pickingTeam);
//       const nextIndex = (currentIndex + 1) % draftInfo.draft_order.length;
//       const nextTeam = draftInfo.draft_order[nextIndex];

//       setDraftInfo((prev) =>
//         prev
//           ? {
//               ...prev,
//               current_turn_team: nextTeam,
//             }
//           : null
//       );
//       setTimer(30);

//       // If it's not the user's turn, auto-pick for the next team after 3s.
//       if (nextTeam !== userFantasyPlayerId) {
//         setTimeout(() => {
//           handleAutoPick(nextTeam);
//         }, 3000);
//       }
//     },
//     [draftInfo, userFantasyPlayerId, handleAutoPick]
//   );

//   useEffect(() => {
//     if (timer > 0) {
//       const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
//       return () => clearInterval(interval);
//     }
//     if (timer === 0) {
//       handleAutoPick();
//     }
//   }, [timer, draftInfo, handleAutoPick]);

//   const handleDraft = async (player: Player) => {
//     if (!draftInfo) {
//       alert("Draft info not loaded yet.");
//       return;
//     }
//     if (draftInfo.current_turn_team !== userFantasyPlayerId) {
//       alert("It's not your turn to draft.");
//       return;
//     }
//     try {
//       await draftPlayer(leagueId, player.id, draftInfo.current_turn_team);
//       console.log("player.id type:", typeof player.id, "value:", player.id);

//       setPlayers((prevPlayers) =>
//         prevPlayers.map((p) =>
//           p.id === player.id
//             ? { ...p, draftedBy: draftInfo.current_turn_team }
//             : p
//         )
//       );

//       setDraftInfo((prev) =>
//         prev
//           ? {
//               ...prev,
//               drafted_players: [
//                 ...prev.drafted_players,
//                 {
//                   player_id: player.id,
//                   team_drafted_by: draftInfo.current_turn_team,
//                   draft_time: new Date().toISOString(),
//                 },
//               ],
//             }
//           : null
//       );

//       nextTurn(draftInfo.current_turn_team);
//     } catch (error) {
//       console.error("Error drafting player:", error);
//       alert("Failed to draft the player. Please try again.");
//     }
//   };

//   const filteredPlayers = players.filter((player) =>
//     player.name.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   return (
//     <div className="flex">
//       <div className="w-2/3">
//         <TextField
//           label="Search Players"
//           variant="outlined"
//           fullWidth
//           margin="normal"
//           value={searchTerm}
//           onChange={(e) => setSearchTerm(e.target.value)}
//         />
//         <TableContainer component={Paper}>
//           <Table>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Name</TableCell>
//                 <TableCell>Team</TableCell>
//                 <TableCell>Goals (2024)</TableCell>
//                 <TableCell>Actions</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {filteredPlayers.map((player) => (
//                 <TableRow key={player.id}>
//                   <TableCell>{player.name}</TableCell>
//                   <TableCell>{player.team}</TableCell>
//                   <TableCell>{player.goals_2024}</TableCell>
//                   <TableCell>
//                     {player.draftedBy ? (
//                       <span>Drafted by {player.draftedBy}</span>
//                     ) : (
//                       <Button
//                         variant="contained"
//                         color="primary"
//                         onClick={() => handleDraft(player)}
//                         disabled={
//                           draftInfo?.current_turn_team !== userFantasyPlayerId
//                         }
//                       >
//                         Draft
//                       </Button>
//                     )}
//                   </TableCell>
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </TableContainer>
//       </div>
//       <div className="w-1/3 ml-4">
//         <TableContainer component={Paper}>
//           <Table>
//             <TableHead>
//               <TableRow>
//                 <TableCell>Pick #</TableCell>
//                 <TableCell>Player</TableCell>
//                 <TableCell>Drafted By</TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {draftInfo?.drafted_players.map((draftedPlayer, index) => {
//                 const player = players.find(
//                   (p) => p.id === draftedPlayer.player_id
//                 );
//                 return (
//                   <TableRow key={`${draftedPlayer.player_id}-${index}`}>
//                     <TableCell>{index + 1}</TableCell>
//                     <TableCell>{player?.name || "Unknown"}</TableCell>
//                     <TableCell>{draftedPlayer.team_drafted_by}</TableCell>
//                   </TableRow>
//                 );
//               })}
//             </TableBody>
//           </Table>
//         </TableContainer>
//       </div>
//     </div>
//   );
// };

// export default DraftPage;
