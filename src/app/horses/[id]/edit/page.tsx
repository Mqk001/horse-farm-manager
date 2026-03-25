'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', emoji: '✅' },
  { value: 'IN_TRAINING', label: 'In Training', emoji: '🎓' },
  { value: 'RESTING', label: 'Resting', emoji: '😴' },
  { value: 'MEDICAL_HOLD', label: 'Medical Hold', emoji: '🏥' },
  { value: 'RETIRED', label: 'Retired', emoji: '🌅' },
];

export default function EditHorsePage() {
  const router = useRouter();
  const params = useParams();
  const horseId = params.id as string;
  
  const [horse, setHorse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (!horseId) return;

    fetch(`/api/horses/${horseId}`)
      .then(res => res.json())
      .then(data => {
        setHorse(data);
        setFetchLoading(false);
      })
      .catch(() => {
        setError('Failed to load horse');
        setFetchLoading(false);
      });
  }, [horseId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      breed: formData.get('breed') as string || undefined,
      age: formData.get('age') ? Number(formData.get('age')) : undefined,
      colorMarkings: formData.get('colorMarkings') as string || undefined,
      notes: formData.get('notes') as string || undefined,
      rideIntervalDays: Number(formData.get('rideIntervalDays')),
      washIntervalDays: Number(formData.get('washIntervalDays')),
      status: formData.get('status') as string,
    };

    try {
      const response = await fetch(`/api/horses/${horseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.push(`/horses/${horseId}`);
      } else {
        setError('Failed to update horse. Please try again.');
      }
    } catch {
      setError('Connection error. Please check your internet.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600">Loading horse details...</p>
        </div>
      </div>
    );
  }

  if (!horse) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-4">🐴</p>
          <p className="text-red-600 font-semibold">Horse not found</p>
          <Link href="/horses" className="text-blue-600 hover:text-blue-700 text-sm mt-4 inline-block">
            ← Back to Horses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/horses/${horseId}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to {horse.name}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Edit Horse</h1>
          <p className="text-gray-600 mt-2">Update {horse.name}'s information</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="p-8">
            {/* Basic Information Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Basic Information
              </h2>
              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    defaultValue={horse.name}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Breed */}
                  <div>
                    <label htmlFor="breed" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Breed
                    </label>
                    <input
                      id="breed"
                      name="breed"
                      type="text"
                      defaultValue={horse.breed || ''}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* Age */}
                  <div>
                    <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Age (years)
                    </label>
                    <input
                      id="age"
                      name="age"
                      type="number"
                      min="0"
                      max="50"
                      defaultValue={horse.age || ''}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Color & Markings */}
                <div>
                  <label htmlFor="colorMarkings" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Color & Markings
                  </label>
                  <input
                    id="colorMarkings"
                    name="colorMarkings"
                    type="text"
                    defaultValue={horse.colorMarkings || ''}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Status */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={horse.status}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.emoji} {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Care Schedule Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Care Schedule
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Ride Interval */}
                <div>
                  <label htmlFor="rideIntervalDays" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ride Interval (days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="rideIntervalDays"
                    name="rideIntervalDays"
                    type="number"
                    required
                    defaultValue={horse.rideIntervalDays}
                    min="1"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">How often should this horse be ridden?</p>
                </div>

                {/* Groom Interval */}
                <div>
                  <label htmlFor="washIntervalDays" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Grooming Interval (days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="washIntervalDays"
                    name="washIntervalDays"
                    type="number"
                    required
                    defaultValue={horse.washIntervalDays}
                    min="1"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">How often should this horse be groomed?</p>
                </div>
              </div>
            </div>

            {/* Additional Notes Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Additional Notes
              </h2>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  defaultValue={horse.notes || ''}
                  placeholder="Any special care instructions, temperament notes, or other details..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <span className="text-red-500 text-xl">⚠️</span>
                <p className="text-sm text-red-700 flex-1">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
              <Link
                href={`/horses/${horseId}`}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 focus:ring-4 focus:ring-gray-200 transition-all text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}