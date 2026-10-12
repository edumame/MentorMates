import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MentorMates',
    short_name: 'MentorMates',
    description: 'MentorMates is the all in one platform for your next hackathon, design day, or innovation event.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#FFFFFF',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/favicon.ico',
        sizes: '256x256',
        type: 'image/png',
      },
    ],
  }
}