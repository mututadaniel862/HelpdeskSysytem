import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HelpDesk Pro — Support Management Platform',
  description: 'AI-powered customer support helpdesk with Gmail integration and real-time ticket management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
