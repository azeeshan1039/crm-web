import type { Metadata } from "next";
import { Instrument_Sans, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { AuthGate } from "@/components/auth-gate";
import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import "./globals.css";

const ui = Instrument_Sans({ variable: "--font-ui", subsets: ["latin"] });
const letter = Source_Serif_4({ variable: "--font-letter", subsets: ["latin"], style: ["normal", "italic"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Work Pipeline",
  description: "Agency outreach CRM",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ui.variable} ${letter.variable} ${code.variable} font-sans antialiased`}>
        <Providers>
          <AuthGate>
            <div className="flex min-h-svh">
              <AppSidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <MobileNav />
                {children}
              </div>
            </div>
          </AuthGate>
        </Providers>
      </body>
    </html>
  );
}
