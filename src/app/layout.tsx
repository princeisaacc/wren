import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { brand } from "@/lib/brand";
import { ToastProvider } from "@/components/toast";
import { ConnectionsProvider } from "@/components/connections-context";
import { AuthProvider } from "@/components/auth-context";
import { LoadingProvider } from "@/components/loading";
import { RouteProgress } from "@/components/route-progress";
import { ThemeProvider, themeScript } from "@/components/theme";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s | ${brand.name}` },
  description: brand.description,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1210" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <LoadingProvider>
              <AuthProvider>
                <ConnectionsProvider>{children}</ConnectionsProvider>
              </AuthProvider>
            </LoadingProvider>
          </ToastProvider>
        </ThemeProvider>
        <RouteProgress />
      </body>
    </html>
  );
}