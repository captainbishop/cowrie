import "./globals.css";
import Providers from "./providers";

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#171030" };

export const metadata = {
  icons: { icon: "/favicon.ico", apple: "/apple-icon.png" },
  title: "Cowrie, talk to your money",
  description: "Programmable, gasless stablecoin money on Monad.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
