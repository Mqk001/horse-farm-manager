'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white flex items-center justify-center text-sm font-bold shadow-sm">
              HF
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition">
                Horse Farm Manager
              </p>
              <p className="text-xs text-gray-500">Stable dashboard</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2">

            <Link
              href="/dashboard"
              className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                isActive('/dashboard')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/horses"
              className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                isActive('/horses')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Horses
            </Link>

            <Link
              href="/care"
              className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                isActive('/care')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Care
            </Link>

            <Link
              href="/horses/new"
              className="ml-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              Add Horse
            </Link>

          </nav>
        </div>
      </div>
    </header>
  );
}
