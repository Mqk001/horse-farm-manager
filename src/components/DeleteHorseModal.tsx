'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteHorseModalProps {
  horseId: string;
  horseName: string;
  onClose: () => void;
}

export function DeleteHorseModal({ horseId, horseName, onClose }: DeleteHorseModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/horses/${horseId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/horses');
      } else {
        setError('Failed to delete horse. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please check your internet.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="px-6 py-5 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-900">Delete Horse</h2>
              <p className="text-sm text-red-700 mt-0.5">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete <strong className="text-gray-900">{horseName}</strong>? 
            This will permanently remove:
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
            <ul className="space-y-2 text-sm text-red-800">
              <li className="flex items-center gap-2">
                <span className="text-red-500">•</span>
                All ride logs and history
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500">•</span>
                All grooming records
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500">•</span>
                All veterinary records
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500">•</span>
                All alerts and notifications
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <p className="text-sm text-red-700 flex-1">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 focus:ring-4 focus:ring-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Deleting...
                </span>
              ) : (
                'Yes, Delete Horse'
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 focus:ring-4 focus:ring-gray-200 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
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