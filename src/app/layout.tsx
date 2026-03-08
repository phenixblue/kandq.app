import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KANDQ – King & Queen Building Lights",
  description:
    "Track the current light colors of Atlanta's iconic King and Queen buildings. Submit photos, vote, and explore history.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#07080f] text-white">
        {children}
      </body>
    </html>
  );
}
