import { Playfair_Display, Alfa_Slab_One } from "next/font/google";
import "./globals.css";

const body = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-body",
});

const display = Alfa_Slab_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata = {
  title: "Cozy Shelf",
  description: "Book recommendations for slow evenings.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}