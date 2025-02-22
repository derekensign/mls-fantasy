// Import useState and useEffect from React
import React, { useState, useEffect } from "react";
import { Player, ProjectedScores, Prices, SeasonStats } from "../types/types";

const PlayersList = () => {
  const [players, setPlayers] = useState<Player[]>([]); // State to hold players data
  const [error, setError] = useState(""); // State to hold any error message
  const [searchTerm, setSearchTerm] = useState(""); // State to hold the search term

  useEffect(() => {
    // Function to fetch players data
    const fetchPlayers = async () => {
      try {
        const response = await fetch("/api/players"); // Adjust the endpoint as necessary
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setPlayers(data); // Update state with fetched players
        setError(""); // Reset error message
      } catch (err) {
        console.error("Error fetching players:", err);
        setError("Error fetching players. Please try again."); // Set error message
      }
    };

    fetchPlayers(); // Call the fetch function
  }, []); // Empty dependency array means this effect runs once on component mount

  const renderProjectedScoresAndPrices = (obj: ProjectedScores | Prices) => {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  };

  return (
    <div>
      {/* Search input */}
      <input
        type="text"
        placeholder="Search players..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div>
        <h1>Players Stats</h1>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Games Played</th>
              <th>Total Points</th>
              {/* Add more headers for Stats and SeasonStats */}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>{player.known_name}</td>
                <td>{player.stats.games_played}</td>
                <td>{player.stats.total_points}</td>
                {/* Render additional stats as needed */}
                {/* Example for nested and array data */}
                <td>{player.stats.avg_points}</td>
                <td>
                  {renderProjectedScoresAndPrices(
                    player.stats.projected_scores
                  )}
                </td>
                <td>{renderProjectedScoresAndPrices(player.stats.prices)}</td>
                {/* Render SeasonStats */}
                <td>{player.season_stats.GL}</td>
                <td>{player.season_stats.ASS}</td>
                {/* Continue for other season stats */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayersList;
