// OpenWeather: текущая погода + прогноз на 5 дней (шаг 3 часа) + поиск городов.
const KEY = import.meta.env.VITE_OWM_API_KEY
const BASE = 'https://api.openweathermap.org'

export const hasKey = Boolean(KEY) && KEY !== 'your_key_here'

async function get(path, params) {
  const url = new URL(BASE + path)
  const all = { ...params, appid: KEY, units: 'metric', lang: 'ru' }
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v)
  const res = await fetch(url)
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function searchCities(q) {
  const list = await get('/geo/1.0/direct', { q, limit: 5 })
  return list.map((c) => ({
    name: c.local_names?.ru || c.name,
    country: c.country,
    state: c.state || '',
    lat: c.lat,
    lon: c.lon,
  }))
}

export async function fetchWeather({ q, lat, lon }) {
  const where = q ? { q } : { lat, lon }
  const cur = await get('/data/2.5/weather', where)
  const fc = await get('/data/2.5/forecast', { lat: cur.coord.lat, lon: cur.coord.lon })
  return normalize(cur, fc)
}

const localDate = (dt, tz) => new Date((dt + tz) * 1000)

function normalize(cur, fc) {
  const tz = cur.timezone
  const night = cur.dt < cur.sys.sunrise || cur.dt > cur.sys.sunset
  const srH = localDate(cur.sys.sunrise, tz).getUTCHours()
  const ssH = localDate(cur.sys.sunset, tz).getUTCHours()

  const hours = fc.list.slice(0, 8).map((it) => {
    const h = localDate(it.dt, tz).getUTCHours()
    return {
      label: `${String(h).padStart(2, '0')}:00`,
      temp: Math.round(it.main.temp),
      id: it.weather[0].id,
      night: h < srH || h >= ssH,
      pop: Math.round((it.pop || 0) * 100),
    }
  })

  // группируем по местным датам
  const byDay = new Map()
  for (const it of fc.list) {
    const d = localDate(it.dt, tz)
    const key = d.toISOString().slice(0, 10)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push({ it, hour: d.getUTCHours() })
  }
  const days = [...byDay.entries()].slice(0, 5).map(([key, items], i) => {
    const min = Math.min(...items.map((x) => x.it.main.temp_min))
    const max = Math.max(...items.map((x) => x.it.main.temp_max))
    const noon = items.reduce((a, b) => (Math.abs(b.hour - 13) < Math.abs(a.hour - 13) ? b : a))
    return {
      label: i === 0 ? 'Сегодня' : new Date(key + 'T12:00:00Z').toLocaleDateString('ru', { weekday: 'short', timeZone: 'UTC' }),
      min: Math.round(min),
      max: Math.round(max),
      id: noon.it.weather[0].id,
      desc: noon.it.weather[0].description,
    }
  })

  return {
    demo: false,
    city: cur.name,
    country: cur.sys.country || '',
    lat: cur.coord.lat,
    lon: cur.coord.lon,
    tz,
    dt: cur.dt,
    temp: Math.round(cur.main.temp),
    feels: Math.round(cur.main.feels_like),
    desc: cur.weather[0].description,
    id: cur.weather[0].id,
    night,
    humidity: cur.main.humidity,
    pressure: Math.round(cur.main.pressure * 0.750062), // гПа -> мм рт. ст.
    wind: Math.round(cur.wind.speed * 10) / 10,
    deg: cur.wind.deg ?? 0,
    vis: Math.round((cur.visibility ?? 10000) / 100) / 10,
    clouds: cur.clouds?.all ?? 0,
    sunrise: cur.sys.sunrise,
    sunset: cur.sys.sunset,
    hours,
    days,
  }
}

// Демо-данные: чтобы дизайн работал и без ключа
export function demoWeather() {
  const tz = 5 * 3600
  const now = Math.floor(Date.now() / 1000)
  const base = [14, 13, 11, 9, 8, 10, 13, 15]
  const ids = [800, 801, 802, 803, 500, 500, 801, 800]
  const hours = base.map((t, i) => {
    const h = (localDate(now, tz).getUTCHours() + 3 * (i + 1)) % 24
    return { label: `${String(h).padStart(2, '0')}:00`, temp: t, id: ids[i], night: h < 7 || h >= 18, pop: [0, 0, 10, 20, 60, 70, 20, 0][i] }
  })
  const days = [
    { label: 'Сегодня', min: 8, max: 15, id: 801, desc: 'малооблачно' },
    { label: 'пн', min: 7, max: 12, id: 500, desc: 'небольшой дождь' },
    { label: 'вт', min: 3, max: 8, id: 802, desc: 'облачно' },
    { label: 'ср', min: 1, max: 6, id: 600, desc: 'небольшой снег' },
    { label: 'чт', min: 2, max: 9, id: 800, desc: 'ясно' },
  ]
  return {
    demo: true,
    city: 'Демо-город',
    country: '',
    lat: 0,
    lon: 0,
    tz,
    dt: now,
    temp: 14,
    feels: 12,
    desc: 'ясно',
    id: 800,
    night: false,
    humidity: 52,
    pressure: 758,
    wind: 3.4,
    deg: 220,
    vis: 10,
    clouds: 8,
    sunrise: now - 6 * 3600,
    sunset: now + 5 * 3600,
    hours,
    days,
  }
}
