import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = {
  title: "Mirage",
  description: "Hosted, file-defined mock API server",
};

// Applied before first paint so there's no flash of the wrong theme. Checks the
// legacy key too, so a theme choice made before the mockservers -> Mirage rename
// (plan 25) survives past the first load.
const themeScript = `try{var t=localStorage.getItem('mirage-theme')||localStorage.getItem('mockservers-theme');if(t==='paper'){document.documentElement.dataset.theme='paper'}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
