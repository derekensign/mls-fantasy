const joinedPlayers = players2025.map((player2025) => {
  // Use player2025.id to match the corresponding 2024 record.
  const corresponding2024 = players2024[player2025.id];
  return {
    id: player2025.id,
    name: player2025.name,
    team: squadsMap[player2025.squad_id] || "Unknown",
    // If using raw DynamoDB format for Goals, this conversion is appropriate.
    goals_2024:
      corresponding2024 && corresponding2024.Goals && corresponding2024.Goals.N
        ? Number(corresponding2024.Goals.N)
        : 0,
    goals_2025: 0, // Initialize 2025 goals to 0.
  };
});
