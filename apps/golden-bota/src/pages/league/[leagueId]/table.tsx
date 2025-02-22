import { useRouter } from "next/router";
import GoldenBootTable from "../../../components/GoldenBootTable";

const LeagueTablePage: React.FC = () => {
  const { leagueId } = useRouter().query;

  if (!leagueId) return <div>Loading league info...</div>;

  return (
    <div>
      <h1>League {leagueId} - Golden Boot Table</h1>
      <GoldenBootTable />
    </div>
  );
};

export default LeagueTablePage;
