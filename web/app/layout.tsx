import "./globals.css";
import Providers from "./providers";
import { ThemeProvider } from "./ThemeProvider";

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#171030" };

export const metadata = {
  icons: { icon: "/favicon.ico", apple: "/apple-icon.png" },
  title: "Cowrie, talk to your money",
  description: "Programmable, gasless stablecoin money on Monad.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var theme="system";try{theme=localStorage.getItem("cowrie.theme")}catch(e){}document.documentElement.dataset.theme=theme==="light"||theme==="dark"?theme:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")})()` }} />
      </head>
      <body>
        <ThemeProvider><Providers>{children}</Providers></ThemeProvider>
      </body>
    </html>
  );
}
