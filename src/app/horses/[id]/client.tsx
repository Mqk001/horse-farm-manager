'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogRideModal } from '@/components/LogRideModal';
import { LogGroomingModal } from '@/components/LogGroomingModal';
import { DeleteHorseModal } from '@/components/DeleteHorseModal';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function HorseDetailClient({
  horse,
  daysSinceRide,
  daysSinceWash,
  rideOverdue,
  washOverdue,
  activities
}: any) {
  const [showRideModal, setShowRideModal] = useState(false);
  const [showGroomModal, setShowGroomModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSuccess = () => {
    setShowRideModal(false);
    setShowGroomModal(false);
    window.location.reload();
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{horse.name}</h1>
              <p className="text-sm text-gray-500">{horse.status.replace('_', ' ')}</p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/horses"
                className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Back
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => setShowRideModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              Log Ride
            </button>
            <button
              onClick={() => setShowGroomModal(true)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-300"
            >
              Log Grooming
            </button>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg border p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Status</h2>

            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Last ridden</span>
              <span className={rideOverdue ? 'text-red-600 font-medium' : ''}>
                {daysSinceRide !== null && daysSinceRide !== undefined
                  ? daysSinceRide === 0 ? 'Today' : `${daysSinceRide}d ago`
                  : 'Not recorded'}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Last groomed</span>
              <span className={washOverdue ? 'text-orange-600 font-medium' : ''}>
                {daysSinceWash !== null && daysSinceWash !== undefined
                  ? daysSinceWash === 0 ? 'Today' : `${daysSinceWash}d ago`
                  : 'Not recorded'}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-lg border p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Details</h2>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {horse.breed && (
                <div>
                  <p className="text-gray-500">Breed</p>
                  <p className="font-medium">{horse.breed}</p>
                </div>
              )}
              {horse.age && (
                <div>
                  <p className="text-gray-500">Age</p>
                  <p className="font-medium">{horse.age}y</p>
                </div>
              )}
              {horse.colorMarkings && (
                <div>
                  <p className="text-gray-500">Color</p>
                  <p className="font-medium">{horse.colorMarkings}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Ride Interval</p>
                <p className="font-medium">{horse.rideIntervalDays} days</p>
              </div>
              <div>
                <p className="text-gray-500">Groom Interval</p>
                <p className="font-medium">{horse.washIntervalDays} days</p>
              </div>
            </div>

            {horse.notes && (
              <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                {horse.notes}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="bg-white rounded-lg border">
            <div className="p-5 border-b">
              <h2 className="text-sm font-semibold text-gray-700">Activity</h2>
            </div>

            {activities.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No activity yet
              </div>
            ) : (
              <div className="divide-y">
                {activities.map((activity: any) => (
                  <div key={activity.id} className="p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">
                        {activity.type === 'ride' ? 'Ride' : 'Grooming'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(activity.dateTime)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {showRideModal && (
        <LogRideModal
          horseId={horse.id}
          horseName={horse.name}
          onClose={() => setShowRideModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showGroomModal && (
        <LogGroomingModal
          horseId={horse.id}
          horseName={horse.name}
          onClose={() => setShowGroomModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showDeleteModal && (
        <DeleteHorseModal
          horseId={horse.id}
          horseName={horse.name}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
} 