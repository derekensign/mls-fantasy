import React, { useState, useEffect, useMemo } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { getLeagueSettings } from "@mls-fantasy/api";

// Sample interface for a league setting. Adjust attributes based on your data model.
export interface LeagueSetting {
  leagueId: string;
  leagueName: string;
  commissioner: string;
}

export default function SearchableLeagueList({
  onSelect,
}: {
  onSelect: (league: LeagueSetting | null) => void;
}) {
  const [leagues, setLeagues] = useState<LeagueSetting[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function fetchLeagues() {
      setLoading(true);
      try {
        // Fetch raw data from your API.
        const rawData = await getLeagueSettings();
        // Map DynamoDB items to plain objects.
        const mappedData = rawData.map((item: any) => ({
          leagueId: item.leagueId?.S || "",
          leagueName: item.leagueName?.S || "",
          commissioner: item.commissioner?.S || "",
        }));
        setLeagues(mappedData);
      } catch (error) {
        console.error("Error fetching leagues:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeagues();
  }, []);

  // Compute how many times each leagueName appears.
  const leagueNameCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    leagues.forEach((league) => {
      counts[league.leagueName] = (counts[league.leagueName] || 0) + 1;
    });
    return counts;
  }, [leagues]);

  return (
    <Autocomplete
      options={leagues}
      getOptionLabel={(option) =>
        // If duplicate names exist, append the leagueId in parentheses.
        leagueNameCounts[option.leagueName] > 1
          ? `${option.leagueName} (${option.leagueId})`
          : option.leagueName
      }
      onChange={(event, value) => onSelect(value)}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search Leagues"
          variant="outlined"
          sx={{
            mb: 2,
            backgroundColor: "#B8860B",
            borderRadius: 1,
            "& .MuiOutlinedInput-root": {
              "& fieldset": { borderColor: "#B8860B" },
              "&:hover fieldset": { borderColor: "#B8860B" },
              "&.Mui-focused fieldset": { borderColor: "#B8860B" },
            },
            "& input": { color: "black" },
            "& label": { color: "black" },
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
