import './globals.css';
import { Inter } from 'next/font/google';
import { Navbar } from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Reinwell | Stable Management',
  description: 'A considered home for every horse in your care.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}
