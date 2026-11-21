import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Three.js System Pipeline | Next.js + Rapier',
  description: 'System-level, code-first animation pipelines with Three.js, Rapier and Next.js',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
