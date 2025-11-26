import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BIC Grants MCP Server',
  description: 'MCP server for querying grant transaction data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

