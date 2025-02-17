import React, { useEffect, useState } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { getLeagueSettings, updateLeagueSettings } from "../backend/API";

interface LeagueSettingsProps {
  leagueId: string;
  currentDraftStartTime?: string;
  onDraftTimeUpdated?: (newTime: string) => void;
}

interface Settings {
  leagueName: string;
  commissioner: {
    name: string;
    email: string;
  };
}

const LeagueSettings: React.FC<LeagueSettingsProps> = ({
  leagueId,
  currentDraftStartTime,
  onDraftTimeUpdated,
}) => {
  const [settings, setSettings] = useState<Settings>({
    leagueName: "",
    commissioner: { name: "", email: "" },
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [draftTimeInput, setDraftTimeInput] = useState<string>(
    currentDraftStartTime || ""
  );

  useEffect(() => {
    // Fetch league settings on mount
    const fetchSettings = async () => {
      setLoading(true);
      try {
        // GET /league/{league_id}/settings response may include DynamoDB types
        const data = await getLeagueSettings(leagueId);

        // Convert the DynamoDB attribute types to plain values.
        const leagueName = data.leagueName?.S || data.leagueName || "";
        const commissionerName =
          (data.commissioner && data.commissioner.M?.name?.S) ||
          (data.commissioner && data.commissioner.name) ||
          "";
        const commissionerEmail =
          (data.commissioner && data.commissioner.M?.email?.S) ||
          (data.commissioner && data.commissioner.email) ||
          "";

        setSettings({
          leagueName,
          commissioner: {
            name: commissionerName,
            email: commissionerEmail,
          },
        });
      } catch (err: any) {
        setError(err.message || "Error fetching league settings");
      }
      setLoading(false);
    };

    fetchSettings();
  }, [leagueId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => {
      if (name === "leagueName") {
        return { ...prev, leagueName: value };
      } else if (name === "commissionerName") {
        return { ...prev, commissioner: { ...prev.commissioner, name: value } };
      } else if (name === "commissionerEmail") {
        return {
          ...prev,
          commissioner: { ...prev.commissioner, email: value },
        };
      }
      return prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError("");
    try {
      // POST /league/{league_id}/settings endpoint
      const result = await updateLeagueSettings(leagueId, {
        leagueName: settings.leagueName,
        commissioner: settings.commissioner,
      });
      // Optionally, update the draft start time if returned from the API.
      if (onDraftTimeUpdated && result.updatedAttributes?.draftStartTime?.S) {
        onDraftTimeUpdated(result.updatedAttributes.draftStartTime.S);
      }
    } catch (err: any) {
      setError(err.message || "Error updating league settings");
    }
    setUpdating(false);
  };

  const handleSetDraftTime = async () => {
    setUpdating(true);
    setError("");
    try {
      const response = await fetch("/api/setDraftTime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          draftStartTime: draftTimeInput,
        }),
      });
      if (!response.ok) {
        setError("Failed to set draft time.");
      } else {
        onDraftTimeUpdated && onDraftTimeUpdated(draftTimeInput);
      }
    } catch (err) {
      console.error("Error setting draft time:", err);
      setError("Error setting draft time.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div>Loading league settings...</div>;

  return (
    <div className="space-y-4">
      {/* League Settings Box */}
      <Paper
        className="p-4 rounded-lg"
        elevation={3}
        sx={{ backgroundColor: "#B8860B !important" }}
      >
        <h3 className="text-xl font-bold mb-2" style={{ color: "white" }}>
          League Settings
        </h3>
        {error && <div className="text-red-500">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-2">
          <TextField
            label="League Name"
            variant="outlined"
            fullWidth
            name="leagueName"
            value={settings.leagueName}
            onChange={handleInputChange}
            InputLabelProps={{ sx: { color: "white !important" } }}
            InputProps={{ sx: { color: "white !important" } }}
          />
          <TextField
            label="Commissioner Name"
            variant="outlined"
            fullWidth
            name="commissionerName"
            value={settings.commissioner.name}
            onChange={handleInputChange}
            InputLabelProps={{ sx: { color: "white !important" } }}
            InputProps={{ sx: { color: "white !important" } }}
          />
          <TextField
            label="Commissioner Email"
            variant="outlined"
            fullWidth
            type="email"
            name="commissionerEmail"
            value={settings.commissioner.email}
            onChange={handleInputChange}
            InputLabelProps={{ sx: { color: "white !important" } }}
            InputProps={{ sx: { color: "white !important" } }}
          />
          <Button
            type="submit"
            fullWidth
            disabled={updating}
            sx={{
              backgroundColor: "black !important",
              color: "white !important",
            }}
          >
            {updating ? "Updating..." : "Update Settings"}
          </Button>
        </form>
      </Paper>
    </div>
  );
};

export default LeagueSettings;
