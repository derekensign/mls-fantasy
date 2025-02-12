import React from "react";
import DraftSettings from "../../../components/DraftSettings";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

interface LeaguePageProps {
  leagueId: string;
}

const LeaguePage: React.FC<LeaguePageProps> = ({ leagueId }) => {
  return (
    <Container
      maxWidth="md"
      className="py-4"
      sx={{ backgroundColor: "#FFD700 !important", minHeight: "100vh" }}
    >
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        align="center"
        sx={{ color: "white !important" }}
      >
        League {leagueId} Draft Settings
      </Typography>
      <DraftSettings leagueId={leagueId} />
    </Container>
  );
};

export default LeaguePage;

// This tells Next.js which dynamic paths to pre-render. If you don't know the leagueIds ahead of time,
// you can return an empty array and use fallback: "blocking" to generate pages on-demand.
export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

// This function extracts the leagueId from the URL and passes it as a prop to the page.
export async function getStaticProps({
  params,
}: {
  params: { leagueId: string };
}) {
  return {
    props: {
      leagueId: params.leagueId,
    },
  };
}
