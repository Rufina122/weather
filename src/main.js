import './style.css'
import gsap from 'gsap'
import { registerSW } from 'virtual:pwa-register'
import { fetchWeather, searchCities, demoWeather, hasKey } from './api.js'
import { iconSVG, kindFor, THEMES } from './icons.js'
import { setFxMode, startFx } from './fx.js'
import { initInstall } from './install.js'

registerSW({ immediate: true })

const $ = (id) => document.getElementById(id)
const REFRESH_MS = 60_000
const STORE = 'y2kwx:last'
const DEFAULT_QUERY = { q: 'Tashkent' }
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

let data = null
let place = null // { q } или { lat, lon }
let updatedAt = 0
let timer = 0
let preview = null // выбранная вручную тема
let currentTheme = document.body.dataset.theme
let inflight = 0

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

/* ---------- Тема ---------- */
function applyTheme(next) {
  if (next === currentTheme) return
  const wipe = $('wipe')
  currentTheme = next
  setFxMode(next)
  const meta = document.querySelector('meta[name="theme-color"]')

  if (reduce) {
    document.body.dataset.theme = next
  } else {
    wipe.dataset.theme = next
    gsap.killTweensOf(wipe)
    gsap.fromTo(
      wipe,
      { clipPath: 'circle(0% at 50% 18%)' },
      {
        clipPath: 'circle(150% at 50% 18%)',
        duration: 0.9,
        ease: 'power3.inOut',
        onComplete: () => {
          document.body.dataset.theme = next
          wipe.style.clipPath = 'circle(0% at 50% 18%)'
        },
      },
    )
  }
  requestAnimationFrame(() => {
    setTimeout(() => {
      const c = getComputedStyle(document.body).getPropertyValue('--accent').trim()
      if (meta && c) meta.setAttribute('content', c)
    }, 1000)
  })
  renderChips()
}

function themeFromData(d) {
  return kindFor(d.id, d.night)
}

/* ---------- Отрисовка ---------- */
function localNow(tz) {
  return new Date(Date.now() + tz * 1000)
}
function fmtTime(unix, tz) {
  const d = new Date((unix + tz) * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function render(d) {
  data = d
  $('city').textContent = d.city
  $('country').textContent = d.country
  $('desc').textContent = d.desc
  $('feels').textContent = `ощущается как ${d.feels}°`
  const today = d.days[0]
  $('hilo').textContent = today ? `${today.max}° / ${today.min}°` : ''

  const hero = $('hero-icon')
  hero.innerHTML = iconSVG(kindFor(d.id, d.night))
  if (!reduce) gsap.fromTo(hero, { scale: 0.6, rotate: -12 }, { scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.55)' })

  // число плавно «докручивается»
  const tempEl = $('temp')
  const from = Number.parseInt(tempEl.textContent, 10)
  if (Number.isNaN(from) || reduce) tempEl.textContent = d.temp
  else {
    const o = { v: from }
    gsap.to(o, { v: d.temp, duration: 1, ease: 'power2.out', onUpdate: () => (tempEl.textContent = Math.round(o.v)) })
  }

  // по часам
  const hours = $('hours')
  hours.replaceChildren(
    ...d.hours.map((h) => {
      const li = el('li', 'hour')
      li.insertAdjacentHTML('beforeend', iconSVG(kindFor(h.id, h.night)))
      li.append(el('span', 'hour-t', `${h.temp}°`), el('span', 'hour-time', h.label), el('span', 'hour-pop', h.pop >= 10 ? `${h.pop}%` : ''))
      return li
    }),
  )

  // по дням
  $('days').replaceChildren(
    ...d.days.map((day) => {
      const li = el('li', 'day')
      li.append(el('span', 'day-name', day.label))
      li.insertAdjacentHTML('beforeend', iconSVG(kindFor(day.id, false)))
      li.append(el('span', 'day-desc', day.desc))
      const range = el('span', 'day-range')
      range.append(el('b', null, `${day.max}°`), document.createTextNode(` / ${day.min}°`))
      li.append(range)
      return li
    }),
  )

  // детали
  const stats = [
    ['Ветер', d.wind, 'м/с', d.deg],
    ['Влажность', d.humidity, '%'],
    ['Давление', d.pressure, 'мм рт. ст.'],
    ['Видимость', d.vis, 'км'],
    ['Восход', fmtTime(d.sunrise, d.tz), ''],
    ['Закат', fmtTime(d.sunset, d.tz), ''],
  ]
  $('stats').replaceChildren(
    ...stats.map(([label, value, unit, deg]) => {
      const wrap = el('div', 'stat')
      const dd = el('dd', null, String(value))
      if (unit) dd.append(el('small', null, unit))
      if (deg != null) {
        const a = el('span', 'arrow', '↓')
        a.style.transform = `rotate(${deg}deg)`
        a.setAttribute('aria-label', `направление ${deg}°`)
        dd.append(a)
      }
      wrap.append(el('dt', null, label), dd)
      return wrap
    }),
  )

  if (!preview) applyTheme(themeFromData(d))
  tickClock()
}

function renderChips() {
  const box = $('chips')
  const active = preview || 'auto'
  const items = [{ key: 'auto', label: 'Авто' }, ...THEMES]
  box.replaceChildren(
    ...items.map((t) => {
      const b = el('button', 'chip', t.label)
      b.type = 'button'
      b.setAttribute('aria-pressed', String(active === t.key))
      b.addEventListener('click', () => {
        preview = t.key === 'auto' ? null : t.key
        applyTheme(preview || (data ? themeFromData(data) : 'sun'))
        renderChips()
      })
      return b
    }),
  )
}

/* ---------- Время и статус ---------- */
function tickClock() {
  const tz = data ? data.tz : -new Date().getTimezoneOffset() * 60
  const d = localNow(tz)
  const p = (n) => String(n).padStart(2, '0')
  $('clock').textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  $('date').textContent = d.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  if (updatedAt) {
    const s = Math.max(0, Math.round((Date.now() - updatedAt) / 1000))
    setStatus(data?.demo ? 'демо-режим' : s < 5 ? 'обновлено сейчас' : `обновлено ${s} с назад`, 'ok')
  }
}
function setStatus(text, state) {
  $('status-text').textContent = text
  $('status').dataset.state = state
}
function notice(html) {
  const n = $('notice')
  if (!html) {
    n.hidden = true
    return
  }
  n.hidden = false
  n.replaceChildren(...html)
}

/* ---------- Загрузка данных ---------- */
async function load(next) {
  if (next) place = next
  const id = ++inflight
  if (!hasKey) {
    render(demoWeather())
    updatedAt = Date.now()
    const code = el('code', null, 'VITE_OWM_API_KEY')
    const file = el('code', null, '.env')
    notice([
      document.createTextNode('Сейчас включён демо-режим. Чтобы увидеть настоящую погоду, получите ключ на openweathermap.org, впишите его в '),
      file,
      document.createTextNode(' как '),
      code,
      document.createTextNode(' и перезапустите сервер.'),
    ])
    return
  }
  try {
    const d = await fetchWeather(place)
    if (id !== inflight) return
    updatedAt = Date.now()
    localStorage.setItem(STORE, JSON.stringify(place.q ? { lat: d.lat, lon: d.lon } : place))
    place = { lat: d.lat, lon: d.lon }
    notice(null)
    render(d)
  } catch (e) {
    if (id !== inflight) return
    setStatus('нет обновления', 'error')
    if (e.status === 401) notice([document.createTextNode('OpenWeather не принял ключ. Новый ключ может заработать только через пару часов после регистрации.')])
    else if (e.status === 404) notice([document.createTextNode('Такой город не найден. Проверьте название.')])
    else if (e.status === 429) notice([document.createTextNode('Слишком много запросов к OpenWeather. Попробую снова через минуту.')])
    else notice([document.createTextNode('Нет связи с OpenWeather. Попробую снова через минуту.')])
  }
}

function schedule() {
  clearInterval(timer)
  timer = setInterval(() => {
    if (!document.hidden && place) load()
  }, REFRESH_MS)
}

/* ---------- Поиск и геолокация ---------- */
let searchTimer = 0
function hideResults() {
  $('results').hidden = true
  $('results').replaceChildren()
}
async function runSearch(q) {
  if (!q.trim()) return hideResults()
  if (!hasKey) {
    notice([document.createTextNode('Поиск городов заработает после добавления ключа OpenWeather.')])
    return
  }
  try {
    const list = await searchCities(q.trim())
    const box = $('results')
    if (!list.length) {
      box.replaceChildren(el('li', null, 'Ничего не нашлось'))
      box.firstChild.style.padding = '9px 12px'
      box.hidden = false
      return
    }
    box.replaceChildren(
      ...list.map((c) => {
        const li = el('li')
        const b = el('button', null, [c.name, c.state, c.country].filter(Boolean).join(', '))
        b.type = 'button'
        b.addEventListener('click', () => {
          hideResults()
          $('search').value = ''
          load({ lat: c.lat, lon: c.lon })
        })
        li.append(b)
        return li
      }),
    )
    box.hidden = false
  } catch {
    notice([document.createTextNode('Не удалось найти город. Проверьте связь и ключ.')])
  }
}

$('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer)
  const v = e.target.value
  if (v.trim().length < 2) return hideResults()
  searchTimer = setTimeout(() => runSearch(v), 350)
})
$('search-form').addEventListener('submit', (e) => {
  e.preventDefault()
  clearTimeout(searchTimer)
  runSearch($('search').value)
})
$('geo').addEventListener('click', () => {
  if (!navigator.geolocation) return notice([document.createTextNode('Этот браузер не умеет определять местоположение.')])
  setStatus('ищу вас…', 'ok')
  navigator.geolocation.getCurrentPosition(
    (pos) => load({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => notice([document.createTextNode('Доступ к местоположению закрыт. Разрешите его в настройках браузера или найдите город вручную.')]),
    { timeout: 10000 },
  )
})

/* ---------- Старт ---------- */
function intro() {
  if (reduce) return
  gsap.from('.win', { y: 46, opacity: 0, rotate: -1.2, duration: 0.8, stagger: 0.09, ease: 'back.out(1.5)', clearProps: 'all' })
}

startFx()
setFxMode(currentTheme)
renderChips()
initInstall()
intro()
setInterval(tickClock, 1000)
tickClock()

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null')
  place = saved && typeof saved.lat === 'number' ? saved : DEFAULT_QUERY
} catch {
  place = DEFAULT_QUERY
}
load()
schedule()
addEventListener('online', () => load())
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - updatedAt > REFRESH_MS) load()
})
