import "./globals.css";
import Providers from "./providers";

export const metadata = {
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
