"use client";
import dynamic from "next/dynamic";

// Client-only: the wallet needs the browser, and prerendering it on the build
// server is what made the Vercel build fail.
const CowrieApp = dynamic(() => import("./CowrieApp"), { ssr: false });

export default function Page() {
  return <CowrieApp />;
}
