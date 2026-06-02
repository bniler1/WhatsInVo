import { useEffect, useRef } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

// Singleton: fetch the SVG sprite once and inject it inline so Plyr's
// <use href="#plyr-play"> fragment references resolve correctly.
// Plyr skips sprite injection for same-origin iconUrls (CORS=false),
// so we must do it ourselves.
let spriteInjected = false
let spritePromise: Promise<void> | null = null

function injectPlyrSprite(): Promise<void> {
  if (spriteInjected) return Promise.resolve()
  if (spritePromise) return spritePromise
  spritePromise = fetch('/plyr.svg')
    .then(r => r.text())
    .then(svg => {
      const div = document.createElement('div')
      div.setAttribute('hidden', '')
      div.innerHTML = svg
      document.body.insertBefore(div, document.body.firstChild)
      spriteInjected = true
    })
    .catch(() => { spriteInjected = true })
  return spritePromise
}

interface Props {
  src: string
  kind: 'video' | 'audio'
  mime?: string
  className?: string
}

export function PlyrPlayer({ src, kind, mime, className }: Props) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    let player: Plyr | null = null

    injectPlyrSprite().then(() => {
      if (cancelled || !ref.current) return
      player = new Plyr(ref.current, {
        loadSprite: false,
        iconUrl: '',
        controls: kind === 'video'
          ? ['play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen']
          : ['play', 'progress', 'current-time', 'duration', 'mute', 'volume'],
        hideControls: false,
        resetOnEnd: true,
        keyboard: { focused: true, global: false },
        storage: { enabled: false },
      })
    })

    return () => {
      cancelled = true
      player?.destroy()
    }
  }, [kind])

  const mimeType = mime || (kind === 'video' ? 'video/mp4' : 'audio/mpeg')

  const cssVars = {
    '--plyr-color-main': '#10b981',
    '--plyr-audio-controls-background': 'transparent',
    '--plyr-audio-control-color': '#9ca3af',
    '--plyr-audio-control-color-hover': '#e9edef',
    '--plyr-audio-progress-buffered-background': 'rgba(255,255,255,0.15)',
    '--plyr-range-fill-background': '#10b981',
    '--plyr-video-controls-background': 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.6))',
  } as React.CSSProperties

  if (kind === 'video') {
    return (
      <div className={className} style={cssVars}>
        <video ref={ref as React.RefObject<HTMLVideoElement>} playsInline>
          <source src={src} type={mimeType} />
        </video>
      </div>
    )
  }

  return (
    <div className={className} style={cssVars}>
      <audio ref={ref as React.RefObject<HTMLAudioElement>}>
        <source src={src} type={mimeType} />
      </audio>
    </div>
  )
}
