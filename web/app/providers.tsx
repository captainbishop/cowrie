"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "../lib/chain";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

  // A CI build (Vercel) has no env vars unless they are set in the dashboard, and
  // Privy throws on an invalid app id, which took the whole build down. Render a
  // readable setup notice instead of crashing, and never mount Privy without an id.
  if (appId.length < 12) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: "#ecebf4", color: "#15132b" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Cowrie needs its keys</div>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6a6788" }}>
            Set NEXT_PUBLIC_PRIVY_APP_ID, the three contract addresses and the AI keys as
            environment variables, then redeploy. Locally they live in web/.env.local.
          </p>
        </div>
      </div>
    );
  }

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
