import { useRouter } from "next/router";
import GoldenBootTable from "../../../components/GoldenBootTable";

const LeagueTablePage: React.FC = () => {
  const { leagueId } = useRouter().query;

  if (!leagueId) {
    return (
      <div
        className="font-score py-24 text-center"
        style={{ color: "var(--bone-dim)", letterSpacing: "0.2em" }}
      >
        LOADING LEAGUE…
      </div>
    );
  }

  // GoldenBootTable renders its own crest + heading from the league route.
  return <GoldenBootTable />;
};

export default LeagueTablePage;
