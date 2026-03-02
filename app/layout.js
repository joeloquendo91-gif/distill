import "./globals.css";

export const metadata = {
  title: "Distill — Turn any CSV into insights in seconds",
  description:
    "Upload a CSV and instantly get auto-charts, AI-written narrative, and shareable dashboards. No setup, no formulas.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
