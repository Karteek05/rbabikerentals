import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "RBA Bike Rentals - Rent a Bike in Bengaluru",
  description:
    "Affordable scooter rentals in Bengaluru with weekly, 15-day, and monthly GST-inclusive packages.",
  keywords: "bike rental, bengaluru, scooter, two-wheeler, rbabikerentals",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-[color:var(--color-paper)] text-[color:var(--color-ink)] antialiased">
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
