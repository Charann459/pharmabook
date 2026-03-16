import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PharmaBook Web",
  description: "Web frontend for PharmaBook",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
