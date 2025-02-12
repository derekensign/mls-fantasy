// import React, { useEffect, useState, useCallback, useRef } from "react";
// import { Paper, Button, TextField } from "@mui/material";
// import {
//   fetchPlayers2024,
//   fetchDraftData,
//   draftPlayer,
// } from "../../backend/API";
// import useUserStore from "@/stores/useUserStore";
// import { Player, DraftInfo } from "../types/DraftTypes";
// import PlayersTable from "./PlayersTable";
// import DraftedPlayersTable from "./DraftedPlayersTable";

// interface DraftTableProps {
//   leagueId: string;
// }

// const DraftPage: React.FC<DraftTableProps> = ({ leagueId }) => {
//   const [players, setPlayers] = useState<Player[]>([]);
//   const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
//   const [timer, setTimer] = useState<number>(0);
//   const [loading, setLoading] = useState<boolean>(true);

//   const { userDetails } = useUserStore();
//   const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();

//   // Create a ref to always have the latest players data.
//   const playersRef = useRef<Player[]>([]);
//   useEffect(() => {
//     playersRef.current = players;
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

//   // ... (auto-pick, nextTurn, and other effect logic remain unchanged) ...

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

//       // Move to the next team
//       // (nextTurn and timer logic unchanged)
//       // ...
//     } catch (error) {
//       console.error("Error drafting player:", error);
//       alert("Failed to draft the player. Please try again.");
//     }
//   };

//   return (
//     <div className="flex">
//       <div className="w-2/3">
//         <PlayersTable
//           players={players}
//           handleDraft={handleDraft}
//           draftInfo={draftInfo}
//           userFantasyPlayerId={userFantasyPlayerId}
//         />
//       </div>
//       <div className="w-1/3 ml-4">
//         <DraftedPlayersTable players={players} draftInfo={draftInfo} />
//       </div>
//     </div>
//   );
// };

// export default DraftPage;
