import React, { ReactNode } from "react";
import Navbar from "./Navbar";
import { useAuth } from "react-oidc-context";

type LayoutProps = {
  children: ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const auth = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar auth={auth} />
      <main className="flex-grow">{children}</main>
    </div>
  );
};

export default Layout;
