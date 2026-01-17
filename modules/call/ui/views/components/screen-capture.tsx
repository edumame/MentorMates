"use client"

import React, { useEffect, useRef } from 'react'
import { useCallStateHooks, useCall } from '@stream-io/video-react-sdk'

interface Props {
  meetingId: string
}

// Fallback hook to keep hook call order stable when the bindings don't
// expose `useScreenShareState`. Named with `use` to satisfy the hooks lint
// rule and always return a stable shape.
function useFallbackLocalParticipant() {
  return {}
}

// Client-side component: captures frames from the screen-share media stream
// and POSTs compressed JPEG frames to /api/call/vision at ~1 FPS max.
export const ScreenCapture: React.FC<Props> = ({ meetingId }) => {
  // useCallStateHooks exposes all call-state hooks; obtain local participant hook
  const call = useCall()
  const callStateHooks: any = useCallStateHooks()
  const useLocalParticipant: any = callStateHooks?.useLocalParticipant ?? useFallbackLocalParticipant
  const localParticipant: any = useLocalParticipant() || {}

  // screenStreamRef holds the resolved MediaStream for the local participant's published screen share
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Helpers to resolve MediaStream from various possible shapes
  const resolveCandidateStream = (c: any): MediaStream | null => {
    if (!c) return null
    if (c instanceof MediaStream) return c
    if (c?.stream instanceof MediaStream) return c.stream
    if (c?.mediaStream instanceof MediaStream) return c.mediaStream
    if (c?.tracks) {
      try {
        const ms = new MediaStream(c.tracks)
        return ms
      } catch {
        return null
      }
    }
    return null
  }

  const resolveScreenStreamFromParticipant = (p: any): MediaStream | null => {
    if (!p) return null
    return (
      resolveCandidateStream(p.screenShareStream) ||
      resolveCandidateStream(p.screenShare?.stream) ||
      resolveCandidateStream(p.publishedTracks?.screenShare?.stream) ||
      resolveCandidateStream(p.streams?.screenShare) ||
      null
    )
  }
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isSendingRef = useRef(false)
  const lastSentRef = useRef<number>(0)
  const lastFrameHashRef = useRef<string | null>(null)
  const backoffUntilRef = useRef<number>(0)

  // Cheap frame hash: length + first 64 chars + last 64 chars
  const quickFrameHash = (b64: string) => {
    const len = b64.length
    const first = b64.slice(0, 64)
    const last = b64.slice(-64)
    return `${len}:${first}:${last}`
  }

  useEffect(() => {
    const video = document.createElement('video')
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.style.display = 'none'
    videoRef.current = video
    document.body.appendChild(video)

    const canvas = document.createElement('canvas')
    canvasRef.current = canvas

    return () => {
      video.pause()
      video.srcObject = null
      video.remove()
      canvas.remove()
    }
  }, [])

  // Watch participant changes and attach/clear the resolved screen stream
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const stream = resolveScreenStreamFromParticipant(localParticipant)
    screenStreamRef.current = stream
    if (stream) {
      try {
        video.srcObject = stream
        const play = async () => {
          await new Promise<void>((resolve) => {
            const v = videoRef.current!
            const onLoaded = () => {
              v.removeEventListener('loadedmetadata', onLoaded)
              resolve()
            }
            v.addEventListener('loadedmetadata', onLoaded)
          })
          video.play().catch(() => {})
        }
        play()
      } catch {
        // ignore
      }
    } else {
      video.srcObject = null
      // clear stored screen stream
      screenStreamRef.current = null
    }
  }, [localParticipant])

  // Capture loop runs only when a resolved screen stream exists
  useEffect(() => {
    let stopped = false

    const tick = async () => {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      // Only run when a screen share stream is present
      if (!screenStreamRef.current) return

      // Skip if no video content
      if (!(video.videoWidth > 0 && video.videoHeight > 0)) return

      const now = Date.now()
      // Backoff window (set on 429)
      if (now < backoffUntilRef.current) return

      // enforce <= 0.2 rps (one frame per 5s)
      if (now - lastSentRef.current < 5000) return
      if (isSendingRef.current) return

      try {
        isSendingRef.current = true
        // Note: set lastSent when we actually attempt a send

        const maxW = 1024
        const scale = Math.min(1, maxW / video.videoWidth)
        const w = Math.max(1, Math.round(video.videoWidth * scale))
        const h = Math.max(1, Math.round(video.videoHeight * scale))
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0, w, h)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        // DEBUG: show what we're actually capturing
        const img = document.getElementById('screen-capture-debug') as HTMLImageElement | null
        if (img) img.src = dataUrl

        const base64 = dataUrl.split(',')[1]

        // Skip identical frames using a cheap hash
        const frameHash = quickFrameHash(base64)
        if (frameHash === lastFrameHashRef.current) return

        // attempt POST and check for 429 backoff
        lastSentRef.current = now
        lastFrameHashRef.current = frameHash

        try {
          const res = await fetch('/api/call/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingId, ts: now, imageBase64: base64 }),
          })
          if (res && res.status === 429) {
            backoffUntilRef.current = Date.now() + 15000
          }
        } catch (e) {
          // swallow network errors
        }
      } finally {
        isSendingRef.current = false
      }
    }

    const interval = setInterval(tick, 800) // check frequently, but send gated by time/backoff
    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [meetingId])

  return (
  <img
    id="screen-capture-debug"
    alt="debug"
    style={{
      position: "fixed",
      right: 12,
      bottom: 12,
      width: 260,
      border: "1px solid rgba(255,255,255,0.2)",
      zIndex: 9999,
      background: "#000",
    }}
  />
);

}

export default ScreenCapture
