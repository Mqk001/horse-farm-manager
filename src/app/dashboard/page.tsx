import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getDaysSince } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const horses = await prisma.horse.findMany({
    include: {
      rides: { orderBy: { dateTime: 'desc' }, take: 1 },
      washes: { orderBy: { dateTime: 'desc' }, take: 1 },
    },
  });

  const totalHorses = horses.length;

  const overdueHorses = horses.filter((horse) => {
    const lastRide = horse.rides[0];
    const lastWash = horse.washes[0];
    const daysSinceRide = lastRide ? getDaysSince(lastRide.dateTime) : null;
    const daysSinceWash = lastWash ? getDaysSince(lastWash.dateTime) : null;
    const rideOverdue =
      daysSinceRide !== null && daysSinceRide > horse.rideIntervalDays;
    const washOverdue =
      daysSinceWash !== null && daysSinceWash > horse.washIntervalDays;
    return rideOverdue || washOverdue;
  });

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const ridesThisWeek = await prisma.rideLog.count({
    where: { dateTime: { gte: oneWeekAgo } },
  });

  const washesThisWeek = await prisma.washLog.count({
    where: { dateTime: { gte: oneWeekAgo } },
  });

  const recentRides = await prisma.rideLog.findMany({
    orderBy: { dateTime: 'desc' },
    take: 5,
    include: { horse: true },
  });

  const recentWashes = await prisma.washLog.findMany({
    orderBy: { dateTime: 'desc' },
    take: 5,
    include: { horse: true },
  });

  const activities = [
    ...recentRides.map((r) => ({
      id: r.id,
      type: 'ride' as const,
      horseName: r.horse.name,
      dateTime: r.dateTime,
      label: `Ridden by ${r.riderName}`,
    })),
    ...recentWashes.map((w) => ({
      id: w.id,
      type: 'wash' as const,
      horseName: w.horse.name,
      dateTime: w.dateTime,
      label: 'Groomed',
    })),
  ]
    .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())
    .slice(0, 6);

  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 px-6 py-8 text-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-blue-100 mb-2">
                  Stable Overview
                </p>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-sm text-blue-100 mt-2">
                  Track activity, spot overdue care, and manage your horses in one place.
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/horses"
                  className="px-4 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 transition"
                >
                  View Horses
                </Link>
                <Link
                  href="/horses/new"
                  className="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-400 transition"
                >
                  Add Horse
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-white">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-4">
              <p className="text-sm text-gray-500">Total Horses</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalHorses}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-red-50 to-white p-4">
              <p className="text-sm text-gray-500">Need Attention</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {overdueHorses.length}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50 to-white p-4">
              <p className="text-sm text-gray-500">Rides This Week</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">
                {ridesThisWeek}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-white p-4">
              <p className="text-sm text-gray-500">Grooming This Week</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {washesThisWeek}
              </p>
            </div>
          </div>
        </div>

        {overdueHorses.length > 0 && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Needs Attention</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Horses with overdue ride or grooming schedules.
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-white text-red-600 text-sm font-semibold border border-red-200">
                {overdueHorses.length} flagged
              </div>
            </div>

            <div className="space-y-3">
              {overdueHorses.map((horse) => {
                const lastRide = horse.rides[0];
                const lastWash = horse.washes[0];
                const daysSinceRide = lastRide ? getDaysSince(lastRide.dateTime) : null;
                const daysSinceWash = lastWash ? getDaysSince(lastWash.dateTime) : null;
                const rideOverdue =
                  daysSinceRide !== null && daysSinceRide > horse.rideIntervalDays;
                const washOverdue =
                  daysSinceWash !== null && daysSinceWash > horse.washIntervalDays;

                return (
                  <Link
                    key={horse.id}
                    href={`/horses/${horse.id}`}
                    className="block rounded-xl border border-red-200 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">{horse.name}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm">
                          {rideOverdue && daysSinceRide !== null && (
                            <span className="text-red-600 font-medium">
                              Ride overdue by {daysSinceRide - horse.rideIntervalDays} days
                            </span>
                          )}
                          {washOverdue && daysSinceWash !== null && (
                            <span className="text-orange-600 font-medium">
                              Grooming overdue by {daysSinceWash - horse.washIntervalDays} days
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-sm font-medium text-blue-600">Open</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Latest rides and grooming entries across the stable.
                </p>
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No activity yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activities.map((activity) => (
                  <div
                    key={`${activity.type}-${activity.id}`}
                    className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                          activity.type === 'ride'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {activity.type === 'ride' ? 'R' : 'G'}
                      </div>

                      <div>
                        <p className="font-semibold text-gray-900">{activity.horseName}</p>
                        <p className="text-sm text-gray-500">{activity.label}</p>
                      </div>
                    </div>

                    <span className="text-sm text-gray-400">
                      {getTimeAgo(activity.dateTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Quick Summary</h2>
            <p className="text-sm text-gray-500 mb-5">
              A simple snapshot of what needs attention today.
            </p>

            <div className="space-y-4">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Stable Status</p>
                <p className="mt-2 font-semibold text-gray-900">
                  {overdueHorses.length === 0
                    ? 'Everything looks on schedule'
                    : `${overdueHorses.length} horse${overdueHorses.length === 1 ? '' : 's'} need attention`}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-500">This Week</p>
                <p className="mt-2 font-semibold text-gray-900">
                  {ridesThisWeek} rides and {washesThisWeek} grooming logs recorded
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/horses"
                  className="block w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                >
                  Go to Horses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}