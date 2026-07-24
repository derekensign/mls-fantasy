import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { fetchGoldenBootTable } from "@mls-fantasy/api";
import {
  Player as BasePlayer,
  GoldenBootTableResponse,
} from "@mls-fantasy/api";
import FiligreeDivider from "./FiligreeDivider";

// Extended Player interface to ensure all properties are available
interface Player extends BasePlayer {
  transferStatus?:
    | "Transferred In"
    | "Transferred Out"
    | "Transferred In/Out"
    | "Original";
  totalGoalsAllTime?: number;
}

interface TeamWithRank extends GoldenBootTableResponse {
  rank: number;
}

// ---- Small presentational helpers ------------------------------------------

/** Compact transfer badge. Returns null for original (undisturbed) players. */
function TransferBadge({ status }: { status?: Player["transferStatus"] }) {
  if (!status || status === "Original") return null;

  const isIn = status.startsWith("Transferred In") && status !== "Transferred In/Out";
  const isOut = status === "Transferred Out";
  const label = isIn ? "IN" : isOut ? "OUT" : "IN / OUT";
  const color = isIn
    ? "var(--xfer-in)"
    : isOut
    ? "var(--xfer-out)"
    : "var(--bota-gold)";

  return (
    <span
      className="font-score"
      style={{
        marginLeft: 8,
        padding: "1px 7px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        color,
        fontSize: "0.62rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      {label}
    </span>
  );
}

/** The engraved roster that unfolds beneath a team row. */
function RosterPanel({ players }: { players: Player[] }) {
  const sorted = [...players].sort(
    (a, b) => (b.goals_2026 ?? 0) - (a.goals_2026 ?? 0)
  );
  return (
    <div className="px-4 pb-4 pt-1 sm:px-6">
      <div className="eyebrow mb-2" style={{ fontSize: "0.6rem" }}>
        Squad · goals scored
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--pitch-line)" }}>
        {sorted.map((player) => (
          <li
            key={player.id}
            className="flex items-center justify-between py-2"
          >
            <span className="flex items-center" style={{ color: "var(--bone)" }}>
              <span className="text-sm sm:text-base">{player.name}</span>
              <TransferBadge status={player.transferStatus} />
            </span>
            <span
              className="engraved-gold text-lg sm:text-xl"
              style={{ minWidth: 32, textAlign: "right" }}
            >
              {player.goals_2026 ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Leaderboard row --------------------------------------------------------

// Medal accents for the podium ranks; everyone else gets a quiet plain number.
const RANK_ACCENT: Record<number, string> = {
  1: "var(--bota-gold)",
  2: "var(--silver)",
  3: "var(--bronze)",
};

/** Rank marker — a filled medal disc for the top 3, a plain numeral otherwise. */
function RankMarker({ rank }: { rank: number }) {
  const accent = RANK_ACCENT[rank];

  if (!accent) {
    return (
      <span
        className="font-score tabular-nums text-center"
        style={{ width: 34, color: "var(--bone-dim)", fontSize: "1.05rem" }}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className="font-score inline-flex items-center justify-center"
      aria-label={`Rank ${rank}`}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        color: "var(--pitch)",
        fontSize: "0.95rem",
        fontWeight: 700,
        background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${accent} 92%, white), ${accent})`,
        boxShadow: `0 0 14px color-mix(in srgb, ${accent} 45%, transparent)`,
      }}
    >
      {rank}
    </span>
  );
}

/**
 * A single leaderboard entry. Every team — leader through last — shares this
 * full-width row so the column never breaks; the top three are distinguished
 * by their medal marker and the leader by a slightly larger, gold-tinted plate.
 * The roster expands inline via an animated grid-rows collapse so nothing snaps.
 */
function LeaderRow({
  team,
  expanded,
  onToggle,
  index,
}: {
  team: TeamWithRank;
  expanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const isLeader = team.rank === 1;
  const accent = RANK_ACCENT[team.rank];

  return (
    <div
      className="rise-in border-b"
      style={{
        borderColor: "var(--pitch-line)",
        animationDelay: `${Math.min(index * 45, 500)}ms`,
        background: isLeader
          ? "linear-gradient(90deg, rgba(212,175,55,0.10), transparent 60%)"
          : undefined,
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        data-testid="standing-entry"
        className="w-full text-left flex items-center gap-4 px-4 py-3 sm:px-6 transition-colors duration-200 hover:bg-[rgba(212,175,55,0.06)]"
        style={
          // Medal rows get an inset accent bar drawn as a shadow, so every row
          // keeps identical padding and the rank/name/goal columns line up.
          accent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined
        }
      >
        <RankMarker rank={team.rank} />

        <span className="min-w-0 flex-1">
          <span
            className="block truncate font-engrave leading-tight"
            style={{
              color: isLeader ? "var(--bota-gold)" : "var(--bone)",
              fontSize: isLeader ? "1.12rem" : "0.98rem",
            }}
          >
            {team.FantasyPlayerName}
          </span>
          <span
            className="block truncate text-xs leading-tight"
            style={{ color: "var(--bone-dim)" }}
          >
            {team.TeamName}
          </span>
        </span>

        <span
          className="engraved-gold shrink-0 text-right tabular-nums"
          style={{
            minWidth: 52,
            fontSize: isLeader ? "2.4rem" : "2rem",
            lineHeight: 1,
          }}
        >
          {team.TotalGoals}
        </span>

        <span
          aria-hidden
          className="shrink-0 transition-transform duration-300"
          style={{
            width: 16,
            textAlign: "center",
            color: "var(--gold-deep)",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </span>
      </button>

      {/* Animated collapse: grid-rows 0fr→1fr expands smoothly without snapping. */}
      <div
        className="expand-shell"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div style={{ overflow: "hidden" }}>
          <RosterPanel players={team.Players as Player[]} />
        </div>
      </div>
    </div>
  );
}

// ---- Main -------------------------------------------------------------------

function GoldenBootTable() {
  const [teams, setTeams] = useState<TeamWithRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const router = useRouter();
  const { leagueId } = router.query;

  useEffect(() => {
    const getTeams = async () => {
      if (!leagueId) return;
      setLoading(true);
      try {
        const teamsData = await fetchGoldenBootTable(String(leagueId));
        const rankedTeams = [...teamsData]
          .sort((a, b) => b.TotalGoals - a.TotalGoals)
          .map((team, index) => ({ ...team, rank: index + 1 }));
        setTeams(rankedTeams);
      } finally {
        setLoading(false);
      }
    };
    getTeams();
  }, [leagueId]);

  const toggle = (rank: number) =>
    setExpandedRank((current) => (current === rank ? null : rank));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      {/* Crest + wordmark */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/golden-bota-boiz.png"
          alt="Golden Bota Boiz crest"
          width={168}
          height={168}
          priority
          className="drop-shadow-[0_8px_30px_rgba(212,175,55,0.25)]"
        />
        <p className="eyebrow mt-4" style={{ fontSize: "0.7rem" }}>
          The race for the boot
        </p>
        <h1
          className="font-engrave text-gold mt-1"
          style={{ fontSize: "clamp(1.8rem, 5vw, 2.9rem)", fontWeight: 700 }}
        >
          Golden Boot Standings
        </h1>
      </div>

      <FiligreeDivider className="my-8" />

      {loading ? (
        <div
          className="text-center font-score py-16"
          style={{ color: "var(--bone-dim)", letterSpacing: "0.2em" }}
        >
          POLISHING THE TROPHY…
        </div>
      ) : teams.length === 0 ? (
        <div className="plaque text-center px-6 py-12">
          <p className="font-engrave text-gold text-xl">No goals on the board yet</p>
          <p className="mt-2 text-sm" style={{ color: "var(--bone-dim)" }}>
            Once the season kicks off, every goal your squad scores climbs the
            plate. Draft your strikers and watch the tally rise.
          </p>
        </div>
      ) : (
        <div className="plaque overflow-hidden">
          {teams.map((team, i) => (
            <LeaderRow
              key={team.rank}
              team={team}
              index={i}
              expanded={expandedRank === team.rank}
              onToggle={() => toggle(team.rank)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default GoldenBootTable;
