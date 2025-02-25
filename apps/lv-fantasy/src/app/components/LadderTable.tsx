"use client";

import React, { useEffect, useState } from "react";

const LadderTable = () => {
  const [ladderData, setLadderData] = useState([]);
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
        setLadderData(data); // Directly set the data
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
    <div
      style={{ padding: "20px", backgroundColor: "#fff", borderRadius: "8px" }}
    >
      <h2 style={{ color: "#00b140" }}>Ladder Table</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#00b140", color: "#fff" }}>
            <th style={{ padding: "10px", border: "1px solid #ccc" }}>Rank</th>
            <th style={{ padding: "10px", border: "1px solid #ccc" }}>
              Team Name
            </th>
            <th style={{ padding: "10px", border: "1px solid #ccc" }}>
              Player Name
            </th>
            <th style={{ padding: "10px", border: "1px solid #ccc" }}>
              Weekly Points
            </th>
          </tr>
        </thead>
        <tbody>
          {ladderData.map((player) => (
            <tr
              key={player.id}
              style={{ backgroundColor: "#f9f9f9", color: "#333" }}
            >
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {player.rank}
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {player.name}
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {`${player.first_name} ${player.last_name}`.trim() || "N/A"}
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {player.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LadderTable;
