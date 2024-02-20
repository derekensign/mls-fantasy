// Import the necessary React library and the PlayersList component
import React from "react";
import PlayersList from "../components/PlayerTable";

export default function Home() {
  return (
    <div>
      <h1>Welcome to Our Next.js App</h1>
      {/* Render the PlayersList component */}
      <PlayersList />
    </div>
  );
}
