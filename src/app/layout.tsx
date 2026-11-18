import './globals.css';
import { Inter } from 'next/font/google';
import { RouteTransition } from '@/components/RouteTransition';
import { TaskReconciliationProvider } from '@/components/OptimisticTaskRow';
import { Navbar } from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Reinwell | Stable Management',
  description: 'Stable care for farm teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TaskReconciliationProvider>
          <Navbar />
          <div className="app-content"><RouteTransition>{children}</RouteTransition></div>
        </TaskReconciliationProvider>
      </body>
    </html>
  );
}
