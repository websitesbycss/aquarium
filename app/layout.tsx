import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aquarium',
  description: 'A calm lagoon that shows the carbon cost of what you spend, and how you compare to students like you.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#3aa7f0' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
