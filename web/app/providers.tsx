"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "../lib/chain";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        loginMethods: ["google", "email"],
        embeddedWallets: { createOnLogin: "users-without-wallets" },
        appearance: { theme: "light", accentColor: "#6c4ae6" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
