'use client';

import { useState } from 'react';

interface LogRideModalProps {
  horseId: string;
  horseName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogRideModal({ horseId, horseName, onClose, onSuccess }: LogRideModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      horseId,
      dateTime: new Date(formData.get('dateTime') as string),
      riderName: formData.get('riderName') as string,
      rideType: formData.get('rideType') as string,
      durationMinutes: formData.get('durationMinutes') ? Number(formData.get('durationMinutes')) : undefined,
      notes: formData.get('notes') as string || undefined,
    };

    try {
      const response = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Call onSuccess which will reload the page
        onSuccess();
      } else {
        setError('Failed to log ride. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please check your internet.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Log Ride</h2>
              <p className="text-sm text-gray-600 mt-1">Recording ride for {horseName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="space-y-5">
            {/* Date & Time */}
            <div>
              <label htmlFor="dateTime" className="block text-sm font-medium text-gray-700 mb-1.5">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                id="dateTime"
                name="dateTime"
                type="datetime-local"
                required
                defaultValue={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Rider Name */}
            <div>
              <label htmlFor="riderName" className="block text-sm font-medium text-gray-700 mb-1.5">
                Rider Name <span className="text-red-500">*</span>
              </label>
              <input
                id="riderName"
                name="riderName"
                type="text"
                required
                placeholder="Enter rider's name"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Ride Type */}
              <div>
                <label htmlFor="rideType" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Type
                </label>
                <select
                  id="rideType"
                  name="rideType"
                  defaultValue="FLAT"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="FLAT">🏇 Flat</option>
                  <option value="TRAIL">🌲 Trail</option>
                  <option value="JUMP">🚀 Jump</option>
                  <option value="TRAINING">🎓 Training</option>
                  <option value="OTHER">📋 Other</option>
                </select>
              </div>

              {/* Duration */}
              <div>
                <label htmlFor="durationMinutes" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Duration (min)
                </label>
                <input
                  id="durationMinutes"
                  name="durationMinutes"
                  type="number"
                  min="1"
                  placeholder="e.g., 45"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Any observations or notes about the ride..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <p className="text-sm text-red-700 flex-1">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
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
                  Logging...
                </span>
              ) : (
                'Log Ride'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 focus:ring-4 focus:ring-gray-200 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}