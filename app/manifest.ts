import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MentorMates PWA',
    short_name: 'MentorMates',
    description: 'MentorMates is the all in one platform for your next hackathon, design day, or innovation event.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#FFFFFF',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}