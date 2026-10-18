import { useEffect, useRef } from 'react'

// Neural mesh background (decorative, behind content) — ported verbatim from the vanilla IIFE.
export default function MeshCanvas() {
  const ref = useRef(null)

  useEffect(() => {
    const c = ref.current
    if (!c || !c.getContext) return
    const ctx = c.getContext('2d')
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0, nodes = [], maxd = 130 * dpr, maxd2 = maxd * maxd
    let raf = 0
    let rt

    function build() {
      W = c.width = Math.floor(innerWidth * dpr)
      H = c.height = Math.floor(innerHeight * dpr)
      c.style.width = innerWidth + 'px'
      c.style.height = innerHeight + 'px'
      const count = Math.max(26, Math.min(80, Math.round(innerWidth * innerHeight / 22000)))
      nodes = []
      for (let i = 0; i < count; i++) {
        nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .14 * dpr, vy: (Math.random() - .5) * .14 * dpr })
      }
    }

    function frame() {
      const off = ((window.scrollY || 0) * dpr * .12) % H
      ctx.clearRect(0, 0, W, H)
      for (const n of nodes) {
        if (!reduce) {
          n.x += n.vx; n.y += n.vy
          if (n.x < 0) n.x += W; else if (n.x > W) n.x -= W
          if (n.y < 0) n.y += H; else if (n.y > H) n.y -= H
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i], ay = a.y - off
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], by = b.y - off
          const dx = a.x - b.x, dy = ay - by, d2 = dx * dx + dy * dy
          if (d2 < maxd2) {
            const al = (1 - d2 / maxd2) * .4
            ctx.strokeStyle = 'rgba(53,198,242,' + al.toFixed(3) + ')'
            ctx.lineWidth = .7 * dpr
            ctx.beginPath(); ctx.moveTo(a.x, ay); ctx.lineTo(b.x, by); ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = 'rgba(52,217,126,.55)'
        ctx.beginPath(); ctx.arc(n.x, n.y - off, 1.5 * dpr, 0, 6.283); ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }

    build()
    raf = requestAnimationFrame(frame)
    const onResize = () => { clearTimeout(rt); rt = setTimeout(build, 150) }
    addEventListener('resize', onResize, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(rt)
      removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas id="mesh" aria-hidden="true" ref={ref}></canvas>
}
