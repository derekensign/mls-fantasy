// import React, { useEffect, useState } from "react";
// import { Button } from "@mui/material";
// import {
//   fetchPlayers2024,
//   getDraftSettings,
//   joinDraftSession,
//   fetchActiveParticipants,
// } from "../backend/API";
// import useUserStore from "@/stores/useUserStore";
// import { Player, DraftInfo } from "../types/DraftTypes";

// interface DraftSessionSummaryProps {
//   leagueId: string;
// }

// const DraftSessionSummary: React.FC<DraftSessionSummaryProps> = ({
//   leagueId,
// }) => {
//   const [players, setPlayers] = useState<Player[]>([]);
//   const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
//   const [timer, setTimer] = useState<number>(30);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [activeParticipants, setActiveParticipants] = useState<string[]>([]);
//   const [round, setRound] = useState<number>(1);

//   const { userDetails } = useUserStore();
//   const userFantasyPlayerId = userDetails?.FantasyPlayerId?.toString();

//   // Load players and draft info
//   useEffect(() => {
//     const loadData = async () => {
//       setLoading(true);
//       try {
//         const rawPlayers = await fetchPlayers2024();
//         const formattedPlayers: Player[] = rawPlayers.map((item: any) => ({
//           id: Number(item.id.S),
//           name: item.name.S,
//           team: item.team.S,
//           goals_2024: parseInt(item.goals_2024.N, 10),
//           draftedBy: item.draftedBy?.S || null,
//         }));
//         setPlayers(formattedPlayers);

//         const draftData = await getDraftSettings(leagueId);
//         setDraftInfo(draftData);
//         setTimer(30);
//       } catch (error) {
//         console.error("Error loading draft session data:", error);
//       } finally {
//         setLoading(false);
//       }
//     };
//     loadData();
//   }, [leagueId]);

//   // Poll active participants every 5 seconds
//   useEffect(() => {
//     const interval = setInterval(async () => {
//       try {
//         const active = await fetchActiveParticipants(leagueId);
//         setActiveParticipants(active);
//       } catch (error) {
//         console.error("Error fetching active participants:", error);
//       }
//     }, 5000);
//     return () => clearInterval(interval);
//   }, [leagueId]);

//   // Timer effect
//   useEffect(() => {
//     if (loading) return;
//     if (timer > 0) {
//       const interval = setInterval(() => {
//         setTimer((prev) => prev - 1);
//       }, 1000);
//       return () => clearInterval(interval);
//     }
//   }, [timer, loading]);

//   // Compute the current team name (using players data and draftInfo)
//   const currentTeamFantasy = draftInfo
//     ? players.find((p) => p.id === Number(draftInfo.current_turn_team))
//     : null;
//   const currentTeamName = currentTeamFantasy
//     ? currentTeamFantasy.team
//     : draftInfo?.current_turn_team;

//   // Overall pick number
//   const overallPickNumber = draftInfo
//     ? draftInfo.drafted_players.length + 1
//     : 1;

//   return (
//     <div className="relative flex flex-col items-center p-4 bg-black rounded-lg shadow-xl mb-6">
//       <h1 className="text-3xl font-bold text-[#B8860B] mb-4">
//         Draft Session - 2024
//       </h1>
//       {draftInfo && (
//         <div className="mb-4 text-white text-center">
//           <p>
//             <strong>Current Turn:</strong> {currentTeamName}
//           </p>
//           <p>
//             <strong>Timer:</strong> {timer} seconds
//           </p>
//           <p>
//             <strong>Round:</strong> {round}
//           </p>
//           <p>
//             <strong>Overall Pick #:</strong> {overallPickNumber}
//           </p>
//         </div>
//       )}
//       {/* Join button removed – join functionality is now handled in the league page */}
//     </div>
//   );
// };

// export default DraftSessionSummary;
