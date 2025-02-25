import React from "react";
import LadderTable from "./components/LadderTable";

const HomePage = () => {
  return (
    <div>
      <h1 className="hidden sm:block">Welcome to the MLS Fantasy App</h1>
      <LadderTable />
    </div>
  );
};

export default HomePage;
