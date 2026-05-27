import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ShellRouter } from "@/components/shell-router";

import "./globals.css";

export const metadata: Metadata = {
  description: "foodtruckzs marketplace and catering operations platform.",
  title: "foodtruckzs",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ShellRouter>{children}</ShellRouter>
      </body>
    </html>
  );
}
