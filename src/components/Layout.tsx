import React, { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { useAuth } from "react-oidc-context";

type LayoutProps = {
  children: ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const auth = useAuth();

  return (
    <>
      <Navbar auth={auth} />
      <main className="bg-black">{children}</main>
    </>
  );
};

export default Layout;
