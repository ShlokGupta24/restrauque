import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Restrauque Backend API',
  description: 'AI-Native Café Intelligence Platform API',
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
