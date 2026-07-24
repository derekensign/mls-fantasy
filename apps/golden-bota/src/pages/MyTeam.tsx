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
          // First get user info to find their league and team
          const userResponse = await fetch(
            "https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/get-my-team",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: auth.user!.profile.email }),
            }
          );

          if (!userResponse.ok) {
            // If user not found (new user), let them complete their profile
            if (userResponse.status === 404 || userResponse.status === 400) {
              setTeam(defaultTeam);
              setPlayerName("");
              return;
            }
            throw new Error("Failed to fetch user data");
          }

          const userData = await userResponse.json();
          if (!userData.teams || userData.teams.length === 0) {
            setTeam(defaultTeam);
            setPlayerName("");
            return;
          }

          const userTeam = userData.teams[0];
          const leagueId = userTeam.leagueId;

          // Now get the Golden Boot data which has transfer status
          const response = await fetch(
            `https://emp47nfi83.execute-api.us-east-1.amazonaws.com/prod/golden-boot-table/${leagueId}`
          );

          if (response.ok) {
            const goldenBootData = await response.json();

            // Find the current user's team in the Golden Boot data
            const currentUserTeam = goldenBootData.find(
              (team: any) =>
                team.FantasyPlayerName === userTeam.fantasyPlayerName
            );

            if (currentUserTeam) {
              // Convert Golden Boot format to MyTeam format
              const convertedTeam = {
                teamName: currentUserTeam.TeamName,
                leagueId: leagueId,
                totalGoals: currentUserTeam.TotalGoals,
                fantasyPlayerName: currentUserTeam.FantasyPlayerName,
                players: currentUserTeam.Players.map((player: any) => ({
                  PlayerName: player.name,
                  Goals: player.goals_2025,
                  TransferStatus:
                    player.transferStatus === "Original"
                      ? ""
                      : player.transferStatus,
                  JoinedDate: player.joinedDate,
                  LeftDate: player.leftDate,
                  GoalsAfterJoining: player.goals_2025, // This will be the adjusted goals from the Lambda
                })),
              };

              setTeam(convertedTeam);
              setPlayerName(currentUserTeam.FantasyPlayerName || "");
            } else {
              // Fallback to user data if not found in Golden Boot
              setTeam({
                teamName: userTeam.teamName,
                leagueId: userTeam.leagueId,
                totalGoals: userTeam.totalGoals || 0,
                players: userTeam.players || [],
              });
              setPlayerName(userTeam.fantasyPlayerName || "");
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
        FantasyPlayerId: userDetails?.fantasyPlayerId,
        TeamName: team.teamName,
        TeamLogo: team.teamLogo,
        FantasyPlayerName: playerName,
        Email: auth.user!.profile.email!,
      };
      const updatedProfile = await updateTeamProfile(payload);

      alert("Profile updated successfully!");

      // Update user details. Since the API response doesn't include FantasyPlayerName or TeamLogo,
      // we use our existing data for those fields.
      setUserDetails({
        ...userDetails,
        fantasyPlayerId: updatedProfile.FantasyPlayerId,
        fantasyPlayerName: playerName,
        teamName: updatedProfile.TeamName,
        email: auth.user!.profile.email ?? "",
        leagueId: userDetails?.leagueId ?? 0,
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
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="font-engrave text-gold text-xl">Sign in to view your squad</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="font-score py-24 text-center"
        style={{ color: "var(--bone-dim)", letterSpacing: "0.2em" }}
      >
        LOADING YOUR SQUAD…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <div className="plaque px-6 py-8 text-center">
          <p className="font-engrave text-gold text-lg">Couldn’t load your team</p>
          <p className="mt-2 text-sm" style={{ color: "var(--bone-dim)" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded px-3 py-2 bg-[var(--pitch)] border border-[var(--gold-deep)] text-[var(--bone)] placeholder:text-[var(--bone-dim)] focus:border-[var(--bota-gold)] outline-none";
  const labelClass = "eyebrow block mb-1";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="text-center">
        <p className="eyebrow" style={{ fontSize: "0.7rem" }}>Manager</p>
        <h1
          className="font-engrave text-gold mt-1"
          style={{ fontSize: "clamp(1.8rem, 5vw, 2.6rem)", fontWeight: 700 }}
        >
          My Profile
        </h1>
      </div>
      {team && (
        <div className="plaque mx-auto mt-8 max-w-2xl p-6">
          <h2 className="font-engrave text-gold text-xl mb-5">
            {team.teamName ? "Update Profile" : "Complete Your Profile"}
          </h2>
          <form onSubmit={handleSubmit}>
            {/* Email Address (read-only) */}
            <div className="mb-4">
              <label className={labelClass} htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={auth.user!.profile.email ?? ""}
                readOnly
                className={`${fieldClass} opacity-70`}
              />
            </div>
            {/* Team Name */}
            <div className="mb-4">
              <label className={labelClass} htmlFor="teamName">
                Team Name *
              </label>
              <input
                id="teamName"
                name="teamName"
                type="text"
                value={team.teamName}
                onChange={handleTeamNameChange}
                required
                className={fieldClass}
              />
            </div>
            {/* Player Name */}
            <div className="mb-4">
              <label className={labelClass} htmlFor="playerName">
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
                className={fieldClass}
              />
            </div>
            {/* Team Logo */}
            <div className="mb-5">
              <label className={labelClass} htmlFor="teamLogo">
                Team Logo (optional)
              </label>
              <input
                id="teamLogo"
                name="teamLogo"
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full text-sm text-[var(--bone-dim)] file:mr-3 file:rounded file:border-0 file:bg-[var(--gold-deep)] file:px-3 file:py-1.5 file:text-[var(--bone)]"
              />
              {team.teamLogo && (
                <Image
                  src={team.teamLogo}
                  alt="Team Logo"
                  width={200}
                  height={200}
                  className="mt-2 h-20 w-auto"
                />
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="font-score px-7 py-2.5 text-sm uppercase tracking-wider transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60"
              style={{
                color: "var(--pitch)",
                background:
                  "linear-gradient(180deg, var(--gold-bright), var(--bota-gold) 60%, var(--gold-deep))",
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {saving
                ? "Saving…"
                : team.teamName
                ? "Update Profile"
                : "Complete Profile"}
            </button>
          </form>
        </div>
      )}

      {/* Render team roster */}
      {team && team.players && (
        <div className="plaque mx-auto mt-8 max-w-3xl overflow-hidden">
          <div className="flex items-end justify-between px-5 pt-5">
            <div>
              <div className="eyebrow" style={{ fontSize: "0.6rem" }}>Squad</div>
              <h2 className="font-engrave text-gold text-2xl">{team.teamName}</h2>
            </div>
            <div className="text-right">
              <div className="engraved-gold text-4xl leading-none">
                {team.totalGoals}
              </div>
              <div className="eyebrow" style={{ fontSize: "0.55rem" }}>Total goals</div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="eyebrow"
                  style={{ fontSize: "0.58rem", color: "var(--bota-gold)" }}
                >
                  <th className="px-5 py-2 text-left font-medium">Player</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                  <th className="px-3 py-2 text-center font-medium">Since joining</th>
                  <th className="px-5 py-2 text-center font-medium">Season</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((player: Player, idx: number) => {
                  const status = player.TransferStatus;
                  const color =
                    status === "Transferred In"
                      ? "var(--xfer-in)"
                      : status === "Transferred Out"
                      ? "var(--xfer-out)"
                      : "var(--bone-dim)";
                  return (
                    <tr
                      key={idx}
                      className="border-t"
                      style={{ borderColor: "var(--pitch-line)" }}
                    >
                      <td className="px-5 py-2.5" style={{ color: "var(--bone)" }}>
                        {player.PlayerName}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className="font-score"
                          style={{
                            padding: "1px 8px",
                            borderRadius: 999,
                            border: `1px solid ${color}`,
                            color,
                            fontSize: "0.6rem",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {status || "Original"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="engraved-gold text-lg">
                          {player.GoalsAfterJoining ?? player.Goals}
                        </span>
                      </td>
                      <td
                        className="px-5 py-2.5 text-center"
                        style={{ color: "var(--bone-dim)" }}
                      >
                        {player.Goals}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!team && !loading && (
        <div className="mt-10 text-center" style={{ color: "var(--bone-dim)" }}>
          No team data available.
        </div>
      )}
    </div>
  );
}
