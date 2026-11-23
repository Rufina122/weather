// Установка приложения (PWA) прямо со страницы.
import gsap from 'gsap'

export function initInstall() {
  const btn = document.getElementById('install')
  const note = document.getElementById('install-note')
  const steps = document.getElementById('dl-steps')
  let deferred = null

  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(ua)
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

  // подсвечиваем подсказку для вашей системы
  const os = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
  steps.querySelector(`[data-os="${os}"]`)?.classList.add('is-you')

  function installed() {
    btn.disabled = true
    btn.textContent = 'Приложение установлено'
    note.textContent = ''
  }
  if (standalone) installed()

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    note.textContent = 'Установка займёт пару секунд.'
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed()
  })

  btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      if (outcome === 'dismissed') note.textContent = 'Установку отменили. Нажмите ещё раз, когда будет удобно.'
      return
    }
    note.textContent = isIOS
      ? 'На iPhone: «Поделиться», затем «На экран Домой».'
      : 'Нажмите значок установки в адресной строке или откройте меню браузера и выберите «Установить».'
    const target = steps.querySelector('.is-you')
    if (target && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(target, { x: -8 }, { x: 0, duration: 0.8, ease: 'elastic.out(1, 0.3)' })
    }
  })
}
