'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type CheckinResponse = {
  message?: string
  timestamp?: string
  error?: string
}

interface CheckinStatusProps {
  token?: string | null
  onClose: () => void
  isOpen: boolean
}

export function CheckinStatus({ token, onClose, isOpen }: CheckinStatusProps) {
  const [status, setStatus] = useState<CheckinResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!token || !isOpen) {
      return
    }

    setIsLoading(true)
    fetch(`/api/checkin?${token}`)
      .then((res) => res.json())
      .then((data: CheckinResponse) => {
        setStatus(data)
      })
      .catch((error) => {
        console.error(error)
        setStatus({ error: 'Failed to process check-in' })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [token, isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing check-in...</p>
          </div>
        ) : status?.error ? (
          <div className="text-center py-4">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <p className="font-bold">Check-in Failed</p>
              <p className="text-sm">{status.error}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
              <p className="font-bold">Success!</p>
              <p className="text-sm">{status?.message}</p>
              {status?.timestamp && (
                <p className="text-xs mt-2">
                  Time: {new Date(status.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}