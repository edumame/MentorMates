'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(
          function() {
            // Service Worker registered successfully
          },
          function() {
            // Service Worker registration failed
          }
        );
      });
    }
  }, [])

  return null
}

