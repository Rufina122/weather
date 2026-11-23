// Фоновые частицы: у каждой погоды свой эффект.
const canvas = document.getElementById('fx')
const ctx = canvas.getContext('2d')
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

let W = 0
let H = 0
let mode = 'sun'
let parts = []
let raf = 0
let last = 0
let flash = 0
let nextBolt = 3
let shoot = null
let t = 0

const rnd = (a, b) => a + Math.random() * (b - a)

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2)
  W = innerWidth
  H = innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  seed()
}

function seed() {
  const area = (W * H) / 1e5
  parts = []
  const n = (k) => Math.max(8, Math.round(area * k))
  switch (mode) {
    case 'sun':
      for (let i = 0; i < n(3); i++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(5, 14), v: rnd(6, 18), ph: rnd(0, 6.28) })
      break
    case 'cloud':
      for (let i = 0; i < 7; i++) parts.push({ x: rnd(-200, W), y: rnd(0, H * 0.8), s: rnd(0.8, 2), v: rnd(8, 24) })
      break
    case 'rain':
      for (let i = 0; i < n(16); i++) parts.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(12, 26), v: rnd(700, 1000) })
      break
    case 'storm':
      for (let i = 0; i < n(26); i++) parts.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(16, 32), v: rnd(1100, 1500) })
      break
    case 'snow':
      for (let i = 0; i < n(14); i++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(2, 6), v: rnd(25, 70), ph: rnd(0, 6.28) })
      break
    case 'fog':
      for (let i = 0; i < 8; i++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(180, 380), v: rnd(6, 16) })
      break
    case 'night':
      for (let i = 0; i < n(9); i++) parts.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.8, 2.6), ph: rnd(0, 6.28), sp: rnd(1, 3) })
      break
  }
}

function star(x, y, r, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const rr = i % 2 === 0 ? r : r * 0.22
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function cloudBlob(x, y, s) {
  ctx.beginPath()
  ctx.arc(x, y, 40 * s, 0, 6.28)
  ctx.arc(x + 45 * s, y - 18 * s, 52 * s, 0, 6.28)
  ctx.arc(x + 100 * s, y, 42 * s, 0, 6.28)
  ctx.arc(x + 50 * s, y + 14 * s, 44 * s, 0, 6.28)
  ctx.fill()
}

function draw(dt) {
  t += dt
  ctx.clearRect(0, 0, W, H)

  if (mode === 'sun') {
    const cx = W * 0.86
    const cy = H * 0.14
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.5)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.15, 'rgba(255,240,120,0.6)')
    g.addColorStop(1, 'rgba(255,200,80,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(t * 0.05)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-40, -Math.max(W, H))
      ctx.lineTo(40, -Math.max(W, H))
      ctx.fill()
    }
    ctx.restore()
    for (const p of parts) {
      p.y -= p.v * dt
      if (p.y < -20) { p.y = H + 20; p.x = rnd(0, W) }
      star(p.x, p.y, p.r, '#ffffff', 0.5 + 0.4 * Math.sin(t * 2 + p.ph))
    }
  } else if (mode === 'cloud') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    for (const p of parts) {
      p.x += p.v * dt
      if (p.x > W + 50) { p.x = -260 * p.s; p.y = rnd(0, H * 0.8) }
      cloudBlob(p.x, p.y, p.s)
    }
  } else if (mode === 'rain' || mode === 'storm') {
    ctx.strokeStyle = mode === 'rain' ? 'rgba(160,245,255,0.75)' : 'rgba(210,190,255,0.7)'
    ctx.lineWidth = mode === 'rain' ? 1.6 : 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const p of parts) {
      p.y += p.v * dt
      p.x -= p.v * 0.18 * dt
      if (p.y > H + 30) { p.y = -30; p.x = rnd(0, W + 200) }
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + p.l * 0.18, p.y - p.l)
    }
    ctx.stroke()
    if (mode === 'storm') {
      nextBolt -= dt
      if (nextBolt <= 0) { flash = 1; nextBolt = rnd(3.5, 8) }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,252,200,${flash * 0.5})`
        ctx.fillRect(0, 0, W, H)
        flash = Math.max(0, flash - dt * 2.2)
      }
    }
  } else if (mode === 'snow') {
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(80,160,255,0.8)'
    ctx.shadowBlur = 6
    for (const p of parts) {
      p.y += p.v * dt
      p.x += Math.sin(t + p.ph) * 18 * dt
      if (p.y > H + 10) { p.y = -10; p.x = rnd(0, W) }
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, 6.28)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  } else if (mode === 'fog') {
    for (const p of parts) {
      p.x += p.v * dt
      if (p.x - p.r > W) p.x = -p.r
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
      g.addColorStop(0, 'rgba(255,255,255,0.45)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
    }
  } else if (mode === 'night') {
    for (const p of parts) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * p.sp + p.ph))
      if (p.r > 2) star(p.x, p.y, p.r * 3, '#ffe9ff', a)
      else {
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, 6.28)
        ctx.fill()
      }
    }
    if (!shoot && Math.random() < dt * 0.15) shoot = { x: rnd(W * 0.3, W), y: rnd(0, H * 0.3), life: 1 }
    if (shoot) {
      shoot.x -= 700 * dt
      shoot.y += 350 * dt
      shoot.life -= dt * 1.4
      const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x + 140, shoot.y - 70)
      g.addColorStop(0, `rgba(255,255,255,${Math.max(shoot.life, 0)})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(shoot.x, shoot.y)
      ctx.lineTo(shoot.x + 140, shoot.y - 70)
      ctx.stroke()
      if (shoot.life <= 0) shoot = null
    }
  }
}

function loop(now) {
  const dt = Math.min((now - last) / 1000 || 0.016, 0.05)
  last = now
  draw(dt)
  raf = requestAnimationFrame(loop)
}

export function setFxMode(next) {
  if (next === mode && parts.length) return
  mode = next
  shoot = null
  seed()
  if (reduce) draw(0)
}

export function startFx() {
  resize()
  addEventListener('resize', resize)
  if (reduce) {
    draw(0)
    return
  }
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf)
    if (!document.hidden) {
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }
  })
  raf = requestAnimationFrame(loop)
}
