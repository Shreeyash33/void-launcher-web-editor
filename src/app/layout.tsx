import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Void Launcher Web Editor",
  description: "Edit Void Launcher maps, grids, and custom widgets in the browser.",
  authors: [{ name: "Ark" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
