import React from "react";
import { useRouter } from "next/router";

// Define types for team and player
type Player = {
  PlayerName: string;
  Goals: number;
};

type Team = {
  teamName: string;
  leagueId: string;
  totalGoals: number;
  players: Player[];
};

export default function MyTeam() {
  const router = useRouter();
  const { teamData } = router.query;

  const parsedTeamData = teamData ? JSON.parse(teamData as string) : null;

  if (!parsedTeamData) {
    return <div className="text-center mt-8">No team data available.</div>;
  }

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">My Team</h1>
      {parsedTeamData.teams.map((team: Team, index: number) => (
        <div
          key={index}
          className="bg-[#B8860B] text-black rounded-lg p-4 mb-4 shadow-md"
        >
          <h2 className="text-2xl font-semibold">{team.teamName}</h2>
          <p className="text-lg">Total Goals: {team.totalGoals}</p>
          <h3 className="text-xl mt-4 mb-2">Players</h3>
          <ul className="list-disc list-inside">
            {team.players.map((player: Player, idx: number) => (
              <li key={idx} className="text-lg">
                {player.PlayerName} - {player.Goals} Goals
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
