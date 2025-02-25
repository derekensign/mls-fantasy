"use client";

import React, { useEffect, useState } from "react";

interface Player {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  points: number;
  rank: number;
}

const LadderTable = () => {
  const [ladderData, setLadderData] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLadderData = async () => {
      try {
        const response = await fetch("/api/ladder");
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        setLadderData(data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "An unknown error occurred."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLadderData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-0 sm:p-5 bg-white sm:rounded-lg">
      <h2 className="text-green-600 p-2 sm:p-0">Ladder Table</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-green-600 text-white">
              <th className="p-2 border">Rank</th>
              <th className="p-2 border w-1/3 sm:w-auto">Team Name</th>
              <th className="p-2 border">Player Name</th>
              <th className="p-2 border">Weekly Points</th>
            </tr>
          </thead>
          <tbody>
            {ladderData.map((player) => (
              <tr key={player.id} className="bg-gray-100 text-gray-800">
                <td className="p-2 border">{player.rank}</td>
                <td className="p-2 border">{player.name}</td>
                <td className="p-2 border">
                  {`${player.first_name} ${player.last_name}`.trim() || "N/A"}
                </td>
                <td className="p-2 border">{player.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LadderTable;