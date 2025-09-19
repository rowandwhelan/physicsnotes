import "./globals.css";
import "katex/dist/katex.min.css"; // KaTeX CSS (once)
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";

export const metadata = {
  title: "Physics Quick Sheet",
  description: "Smart search & copy for practical PHYS 1–2 formulas and constants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
