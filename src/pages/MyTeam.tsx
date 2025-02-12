import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/router";
import { useAuth } from "react-oidc-context";

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
  teamLogo?: string; // URL to team logo image
  teamDescription?: string;
  teamColor?: string;
};

export default function MyTeam() {
  const auth = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState<Team | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Fetch the team data inside MyTeam once the user is authenticated
  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.profile.email) {
      const fetchTeamData = async () => {
        setLoading(true);
        try {
          const response = await fetch(
            "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/get-my-team",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: auth.user.profile.email }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            // Assume data.teams is an array; for update we use the first team.
            setTeam(data.teams[0]);
          } else {
            const errText = await response.text();
            setError(`Failed to fetch team data: ${errText}`);
          }
        } catch (err: any) {
          console.error("Error fetching team data:", err);
          setError("Error fetching team data.");
        } finally {
          setLoading(false);
        }
      };
      fetchTeamData();
    }
  }, [auth.isAuthenticated, auth.user?.profile.email]);

  // Handler to update form input values
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setTeam((prevTeam) =>
      prevTeam ? { ...prevTeam, [name]: value } : prevTeam
    );
  };

  // Handler for logo file selection
  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  // Simulated submit function (typically you would call an API here)
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      // If a logo file is selected, upload it (for example to S3) and update team.teamLogo
      // Example:
      // if (logoFile) {
      //   const logoUrl = await uploadLogo(logoFile);
      //   setTeam((prevTeam) => prevTeam && { ...prevTeam, teamLogo: logoUrl });
      // }
      console.log("Updated team info:", team);
      alert("Team updated!");
    } catch (error) {
      console.error("Error updating team:", error);
      alert("There was an error updating your team.");
    } finally {
      setSaving(false);
    }
  };

  // Redirect to login if not authenticated
  if (!auth.isAuthenticated) {
    return (
      <div className="text-center mt-8">
        <h1>You must log in to view your team.</h1>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center mt-8">Loading team data...</div>;
  }

  if (error) {
    return <div className="text-center mt-8 text-red-600">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">My Team</h1>

      {/* Update form for the primary team */}
      {team && (
        <div className="max-w-3xl mx-auto bg-[#F0E68C] p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-semibold mb-4">Update Team Details</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="teamName">
                Team Name
              </label>
              <input
                id="teamName"
                name="teamName"
                type="text"
                value={team.teamName}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label
                className="block font-semibold mb-1"
                htmlFor="teamDescription"
              >
                Team Description
              </label>
              <textarea
                id="teamDescription"
                name="teamDescription"
                value={team.teamDescription || ""}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="teamColor">
                Team Color
              </label>
              <input
                id="teamColor"
                name="teamColor"
                type="color"
                value={team.teamColor || "#B8860B"}
                onChange={handleInputChange}
                className="w-16 h-10 p-1 border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="teamLogo">
                Team Logo
              </label>
              <input
                id="teamLogo"
                name="teamLogo"
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full"
              />
              {team.teamLogo && (
                <img
                  src={team.teamLogo}
                  alt="Team Logo"
                  className="mt-2 h-20"
                />
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
            >
              {saving ? "Saving..." : "Update Team"}
            </button>
          </form>
        </div>
      )}

      {/* Render the team roster */}
      {team && (
        <div className="max-w-3xl mx-auto bg-[#B8860B] text-black rounded-lg p-4 mb-4 shadow-md">
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
      )}

      {!team && !loading && (
        <div className="text-center mt-8">No team data available.</div>
      )}
    </div>
  );
}
