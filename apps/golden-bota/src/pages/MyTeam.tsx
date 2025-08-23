import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
import { useRouter } from "next/router";
import { useAuth } from "react-oidc-context";
import { updateTeamProfile } from "@mls-fantasy/api";
import useUserStore from "../stores/useUserStore";
import Image from "next/image";

// Define types for player and team
type Player = {
  PlayerName: string;
  Goals: number;
  TransferStatus?: "Transferred In" | "Transferred Out" | "Original" | "";
  JoinedDate?: string;
  LeftDate?: string;
  GoalsAfterJoining?: number; // Goals scored only after joining this team
};

type Team = {
  teamName: string;
  leagueId: string;
  totalGoals: number;
  players: Player[];
  teamLogo?: string; // URL to team logo image (optional)
};

export default function MyTeam() {
  const auth = useAuth();
  const router = useRouter();
  const { userDetails, setUserDetails } = useUserStore();

  const [team, setTeam] = useState<Team | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Update defaultTeam to match the Team interface.
  const defaultTeam: Team = useMemo(
    () => ({
      teamName: "Default Team",
      leagueId: "",
      totalGoals: 0,
      players: [],
    }),
    []
  );

  // Fetch team data once the user is authenticated
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
              body: JSON.stringify({ email: auth.user!.profile.email }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.teams && data.teams.length > 0) {
              const fetchedTeam = data.teams[0];
              setTeam(fetchedTeam);
              // Populate playerName if available; otherwise, leave blank.
              if (fetchedTeam.fantasyPlayerName) {
                setPlayerName(fetchedTeam.fantasyPlayerName);
              } else {
                setPlayerName("");
              }
            } else {
              // No team exists — initialize with defaultTeam.
              setTeam(defaultTeam);
              setPlayerName("");
            }
          } else {
            const errText = await response.text();
            try {
              const errObj = JSON.parse(errText);
              if (errObj.message && errObj.message.includes("No teams found")) {
                // Instead of showing an error, let the user complete their profile.
                setTeam(defaultTeam);
                setPlayerName("");
              } else {
                setError(`Failed to fetch team data: ${errText}`);
              }
            } catch (parseErr) {
              setError(`Failed to fetch team data: ${errText}`);
            }
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
  }, [auth.isAuthenticated, auth.user?.profile.email, defaultTeam, auth.user]);

  // Handler for updating Team Name
  const handleTeamNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setTeam((prevTeam) =>
      prevTeam ? { ...prevTeam, teamName: value } : prevTeam
    );
  };

  // Handler for updating Player Name
  const handlePlayerNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value);
  };

  // Handler for logo file selection
  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
      // For simplicity, assume file upload is handled elsewhere.
    }
  };

  // Submit function to update (or create) the team profile
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!team?.teamName) {
      alert("Team name is required.");
      return;
    }
    if (!playerName) {
      alert("Player name is required.");
      return;
    }
    setSaving(true);
    try {
      // Prepare payload.
      const payload = {
        FantasyPlayerId: userDetails?.FantasyPlayerId,
        TeamName: team.teamName,
        TeamLogo: team.teamLogo,
        FantasyPlayerName: playerName,
        Email: auth.user!.profile.email!,
      };
      const updatedProfile = await updateTeamProfile(payload);
      console.log("Updated profile:", updatedProfile);
      alert("Profile updated successfully!");

      // Update user details. Since the API response doesn't include FantasyPlayerName or TeamLogo,
      // we use our existing data for those fields.
      setUserDetails({
        ...userDetails,
        FantasyPlayerId: updatedProfile.FantasyPlayerId,
        FantasyPlayerName: playerName,
        TeamName: updatedProfile.TeamName,
        email: auth.user!.profile.email ?? "",
        LeagueId: userDetails?.LeagueId ?? "",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      alert("There was an error updating your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="text-center">
        <h1 className="pt-4 text-white">
          You must log in to view your profile.
        </h1>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center mt-8">Loading profile data...</div>;
  }

  if (error) {
    return <div className="text-center mt-8 text-red-600">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6">My Profile</h1>
      {team && (
        <div className="max-w-3xl mx-auto bg-[#F0E68C] p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            {team.teamName ? "Update Profile" : "Complete Your Profile"}
          </h2>
          <form onSubmit={handleSubmit}>
            {/* Email Address (read-only) */}
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={auth.user!.profile.email ?? ""}
                readOnly
                className="w-full p-2 border rounded bg-gray-100"
              />
            </div>
            {/* Team Name */}
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="teamName">
                Team Name *
              </label>
              <input
                id="teamName"
                name="teamName"
                type="text"
                value={team.teamName}
                onChange={handleTeamNameChange}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            {/* Player Name */}
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="playerName">
                Player Name *
              </label>
              <input
                id="playerName"
                name="playerName"
                type="text"
                value={playerName}
                onChange={handlePlayerNameChange}
                required
                placeholder="e.g. John Doe"
                className="w-full p-2 border rounded"
              />
            </div>
            {/* Team Logo */}
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="teamLogo">
                Team Logo (optional)
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
                <Image
                  src={team.teamLogo}
                  alt="Team Logo"
                  width={200}
                  height={200}
                  className="mt-2 h-20"
                />
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
            >
              {saving
                ? "Saving..."
                : team.teamName
                ? "Update Profile"
                : "Complete Profile"}
            </button>
          </form>
        </div>
      )}

      {/* Render team roster */}
      {team && team.players && (
        <div className="max-w-5xl mx-auto bg-[#B8860B] text-black rounded-lg p-4 mb-4 shadow-md">
          <h2 className="text-2xl font-semibold">{team.teamName}</h2>
          <p className="text-lg">Total Goals: {team.totalGoals}</p>
          <h3 className="text-xl mt-4 mb-2">Players</h3>

          {/* Enhanced table with transfer status */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-400">
              <thead>
                <tr className="bg-[#8B7355]">
                  <th className="border border-gray-400 px-4 py-2 text-left">
                    Player Name
                  </th>
                  <th className="border border-gray-400 px-4 py-2 text-center">
                    Transfer Status
                  </th>
                  <th className="border border-gray-400 px-4 py-2 text-center">
                    Goals (After Joining)
                  </th>
                  <th className="border border-gray-400 px-4 py-2 text-center">
                    Total Goals (2025)
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((player: Player, idx: number) => (
                  <tr key={idx} className="hover:bg-[#A0956B]">
                    <td className="border border-gray-400 px-4 py-2 font-medium">
                      {player.PlayerName}
                    </td>
                    <td className="border border-gray-400 px-4 py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          player.TransferStatus === "Transferred In"
                            ? "bg-green-200 text-green-800"
                            : player.TransferStatus === "Transferred Out"
                            ? "bg-red-200 text-red-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {player.TransferStatus || "Original"}
                      </span>
                    </td>
                    <td className="border border-gray-400 px-4 py-2 text-center font-bold">
                      {player.GoalsAfterJoining ?? player.Goals}
                    </td>
                    <td className="border border-gray-400 px-4 py-2 text-center text-gray-600">
                      {player.Goals}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!team && !loading && (
        <div className="text-center mt-8">No team data available.</div>
      )}
    </div>
  );
}
