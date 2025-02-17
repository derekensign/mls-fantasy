import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
import { useRouter } from "next/router";
import { useAuth } from "react-oidc-context";
import { updateTeamProfile } from "@/backend/API";
import useUserStore from "@/stores/useUserStore";
import Image from "next/image";

// Define types for player and team
type Player = {
  PlayerName: string;
  Goals: number;
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
  // New state for the player's name
  const [playerName, setPlayerName] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // After: defaultTeam is memoized and won't change on every render.
  const defaultTeam = useMemo(() => ({ id: "foo", name: "Default Team" }), []);

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
              body: JSON.stringify({ email: auth.user.profile.email }),
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
              // No team exists—initialize with default values so the user can complete their profile.
              setTeam(defaultTeam);
              setPlayerName("");
            }
          } else {
            const errText = await response.text();
            try {
              const errObj = JSON.parse(errText);
              if (errObj.message && errObj.message.includes("No teams found")) {
                // Instead of showing an error, let the user complete their profile by using a default team.
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
  }, [auth.isAuthenticated, auth.user?.profile.email, defaultTeam]);

  // Handler for updating Team Name, which is stored within the team object
  const handleTeamNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setTeam((prevTeam) =>
      prevTeam ? { ...prevTeam, teamName: value } : prevTeam
    );
  };

  // Handler for updating Player Name, stored in its own state
  const handlePlayerNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value);
  };

  // Handler for logo file selection
  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
      // For simplicity, we assume the file is uploaded elsewhere
      // and its URL is then set into team.teamLogo.
      // You might want to integrate an S3 upload flow here.
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
      // Prepare the payload.
      // We pull FantasyPlayerId from userDetails if it exists; otherwise, leave it undefined.
      const payload = {
        FantasyPlayerId: userDetails?.FantasyPlayerId,
        TeamName: team.teamName,
        // Pass along the optional TeamLogo if it exists (this might be a URL after image upload).
        TeamLogo: team.teamLogo,
        // We include FantasyPlayerName for the player's name.
        FantasyPlayerName: playerName,
        Email: auth.user?.profile.email,
      };
      const updatedProfile = await updateTeamProfile(payload);
      console.log("Updated profile:", updatedProfile);
      alert("Profile updated successfully!");
      // Optionally update the user store with the new profile details.
      setUserDetails({
        ...userDetails,
        FantasyPlayerId: updatedProfile.FantasyPlayerId,
        FantasyPlayerName: updatedProfile.FantasyPlayerName,
        TeamName: updatedProfile.TeamName,
        TeamLogo: updatedProfile.TeamLogo,
        Email: auth.user?.profile.email,
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      alert("There was an error updating your profile.");
    } finally {
      setSaving(false);
    }
  };

  // Redirect to login if the user is not authenticated
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
            {/* Display email address (read-only) */}
            <div className="mb-4">
              <label className="block font-semibold mb-1" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={auth.user?.profile.email || ""}
                readOnly
                className="w-full p-2 border rounded bg-gray-100"
              />
            </div>
            {/* Team Name (required) */}
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
            {/* Player Name (required) */}
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
            {/* Team Logo (optional) */}
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

      {/* Render the team roster */}
      {team && team.players && (
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
