// Иконки погоды в стиле Y2K. Градиенты (#g-sun и др.) лежат в index.html.
const INK = '#2a0a4a'
const S = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`

const CLOUD = `<path d="M18 46a10 10 0 0 1 1-20 14 14 0 0 1 27 3 9 9 0 0 1 0 17z" fill="url(#g-cloud)" ${S}/>`

const ICONS = {
  sun: `
    <g class="wx-ray" ${S} fill="none">
      <path d="M32 5v7M32 52v7M5 32h7M52 32h7M13 13l5 5M46 46l5 5M51 13l-5 5M18 46l-5 5"/>
    </g>
    <circle cx="32" cy="32" r="15" fill="url(#g-sun)" ${S}/>
    <circle cx="27" cy="29" r="1.8" fill="${INK}"/><circle cx="37" cy="29" r="1.8" fill="${INK}"/>
    <path d="M26.5 35.5q5.5 5 11 0" fill="none" ${S}/>`,
  cloud: CLOUD,
  rain: `${CLOUD}
    <g stroke="#19b5ff" stroke-width="3.4" stroke-linecap="round">
      <path class="wx-drop" d="M24 50l-2 6"/><path class="wx-drop" d="M33 50l-2 6"/><path class="wx-drop" d="M42 50l-2 6"/>
    </g>`,
  storm: `${CLOUD}
    <path class="wx-bolt" d="M35 40l-8 11h6l-3 9 11-13h-6l4-7z" fill="url(#g-bolt)" ${S}/>`,
  snow: `${CLOUD}
    <g fill="#ffffff" ${S}>
      <circle class="wx-flake" cx="23" cy="53" r="2.6"/><circle class="wx-flake" cx="32" cy="57" r="2.6"/><circle class="wx-flake" cx="41" cy="53" r="2.6"/>
    </g>`,
  fog: `${CLOUD}
    <g ${S} fill="none"><path d="M14 52h30"/><path d="M22 58h30"/></g>`,
  night: `
    <path d="M40 8a22 22 0 1 0 17 33A18 18 0 0 1 40 8z" fill="url(#g-moon)" ${S}/>
    <g fill="#ffe86b" ${S}>
      <path d="M50 14l1.6 3.4 3.4 1.6-3.4 1.6L50 24l-1.6-3.4-3.4-1.6 3.4-1.6z" stroke-width="1.6"/>
      <path d="M14 14l1.2 2.4 2.4 1.2-2.4 1.2L14 21l-1.2-2.2-2.4-1.2 2.4-1.2z" stroke-width="1.4"/>
    </g>`,
}

export function iconSVG(kind) {
  const body = ICONS[kind] || ICONS.cloud
  return `<svg viewBox="0 0 64 64" role="img" aria-hidden="true">${body}</svg>`
}

// id состояния OpenWeather -> тип иконки / тема
export function kindFor(id, night) {
  if (id >= 200 && id < 300) return 'storm'
  if (id >= 300 && id < 600) return 'rain'
  if (id >= 600 && id < 700) return 'snow'
  if (id === 781) return 'storm'
  if (id >= 700 && id < 800) return 'fog'
  if (id === 800 || id === 801) return night ? 'night' : 'sun'
  return night ? 'night' : 'cloud'
}

export const THEMES = [
  { key: 'sun', label: 'Солнечно' },
  { key: 'cloud', label: 'Облачно' },
  { key: 'rain', label: 'Дождь' },
  { key: 'storm', label: 'Гроза' },
  { key: 'snow', label: 'Снег' },
  { key: 'fog', label: 'Туман' },
  { key: 'night', label: 'Ночь' },
]
