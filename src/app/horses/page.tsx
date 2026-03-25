import { prisma } from '@/lib/prisma';
import { getDaysSince } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HorsesPage() {
  const horses = await prisma.horse.findMany({
    orderBy: { name: 'asc' },
    include: {
      rides: { orderBy: { dateTime: 'desc' }, take: 1 },
      washes: { orderBy: { dateTime: 'desc' }, take: 1 },
    },
  });

  function getStatusStyle(horse: any, rideOverdue: boolean, washOverdue: boolean) {
    if (rideOverdue || washOverdue) {
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        gradient: 'from-red-400 to-orange-500',
        label: 'Needs Attention'
      };
    }

    switch (horse.status) {
      case 'ACTIVE':
        return {
          bg: 'bg-emerald-100',
          text: 'text-emerald-700',
          border: 'border-emerald-300',
          gradient: 'from-emerald-400 to-green-500',
          label: 'Active'
        };
      case 'IN_TRAINING':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-700',
          border: 'border-blue-300',
          gradient: 'from-blue-400 to-indigo-500',
          label: 'In Training'
        };
      case 'RESTING':
        return {
          bg: 'bg-purple-100',
          text: 'text-purple-700',
          border: 'border-purple-300',
          gradient: 'from-purple-400 to-pink-500',
          label: 'Resting'
        };
      case 'MEDICAL_HOLD':
        return {
          bg: 'bg-amber-100',
          text: 'text-amber-700',
          border: 'border-amber-300',
          gradient: 'from-amber-400 to-orange-500',
          label: 'Medical Hold'
        };
      case 'RETIRED':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          border: 'border-gray-300',
          gradient: 'from-gray-400 to-gray-500',
          label: 'Retired'
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          border: 'border-gray-300',
          gradient: 'from-gray-400 to-gray-500',
          label: horse.status?.replaceAll('_', ' ') || 'Unknown'
        };
    }
  }

  function formatDays(days: number | null) {
    if (days === null || days === undefined) return null;
    if (days === 0) return 'Today';
    return `${days}d ago`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Horses</h1>
            <p className="text-gray-600 mt-1">
              {horses.length} {horses.length === 1 ? 'horse' : 'horses'} in your care
            </p>
          </div>
          <Link
            href="/horses/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
          >
            + Add Horse
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {horses.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-16 text-center">
            <div className="text-6xl mb-4">🐴</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No horses yet</h3>
            <p className="text-gray-600 mb-6">Get started by adding your first horse</p>
            <Link
              href="/horses/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Add First Horse
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {horses.map((horse) => {
              const lastRide = horse.rides[0];
              const lastWash = horse.washes[0];

              const daysSinceRide = lastRide ? getDaysSince(lastRide.dateTime) : null;
              const daysSinceWash = lastWash ? getDaysSince(lastWash.dateTime) : null;

              const rideOverdue =
                daysSinceRide !== null && daysSinceRide > horse.rideIntervalDays;
              const washOverdue =
                daysSinceWash !== null && daysSinceWash > horse.washIntervalDays;

              const statusStyle = getStatusStyle(horse, rideOverdue, washOverdue);

              return (
                <div
                  key={horse.id}
                  className="relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`h-2 bg-gradient-to-r ${statusStyle.gradient}`} />

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="flex-1 min-w-0">
                        <Link href={`/horses/${horse.id}`} className="group">
                          <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                            {horse.name}
                          </h3>
                        </Link>
                        {horse.breed && (
                          <p className="text-sm text-gray-600 mt-1">{horse.breed}</p>
                        )}
                      </div>

                      <span
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border} whitespace-nowrap`}
                      >
                        {statusStyle.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {horse.age && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400">📅</span>
                          <span className="text-gray-600">{horse.age} years old</span>
                        </div>
                      )}
                      {horse.colorMarkings && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400">🎨</span>
                          <span className="text-gray-600 truncate">{horse.colorMarkings}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-4 space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2">
                          <span>🏇</span>
                          Last ridden:
                        </span>
                        <span className={`font-semibold ${rideOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatDays(daysSinceRide) ?? 'Never'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2">
                          <span>🧼</span>
                          Last groomed:
                        </span>
                        <span className={`font-semibold ${washOverdue ? 'text-orange-600' : 'text-gray-900'}`}>
                          {formatDays(daysSinceWash) ?? 'Never'}
                        </span>
                      </div>
                    </div>

                    {(rideOverdue || washOverdue) && (
                      <div className="mt-4 pt-4 border-t border-red-100">
                        <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
                          <span>⚠️</span>
                          <span>
                            {rideOverdue && washOverdue
                              ? 'Ride and grooming overdue'
                              : rideOverdue
                              ? 'Ride overdue'
                              : 'Grooming overdue'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <Link
                        href={`/horses/${horse.id}`}
                        className="text-sm text-blue-600 font-medium hover:text-blue-700"
                      >
                        View Details
                      </Link>

                      <Link
                        href={`/horses/${horse.id}/edit`}
                        className="text-sm text-gray-600 font-medium hover:text-gray-900"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}