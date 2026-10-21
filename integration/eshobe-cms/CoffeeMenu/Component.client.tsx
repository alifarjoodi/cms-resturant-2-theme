'use client'

import React, { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

type Drink = {
  name?: string | null
  category?: string | null
  description?: string | null
  detail?: string | null
  notes?: string | null
  price?: number | null
  intensity?: number | null
  volume?: string | null
  temperature?: string | null
  artwork?: string | null
}

type Props = {
  menuTitle?: string | null
  brandName?: string | null
  tagline?: string | null
  brandDescription?: string | null
  sloganLine1?: string | null
  sloganLine2?: string | null
  sloganLine3?: string | null
  sloganLine4?: string | null
  currencyLabel?: string | null
  drinks?: Drink[] | null
}

const defaults: Required<Drink>[] = [
  { name: 'Espresso', category: 'Espresso bar', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — a dense, syrupy shot pulled slow for a deep, roasted finish that lingers.', notes: 'Dark chocolate|Toasted hazelnut|Brown sugar', intensity: 5, volume: '30 ml', temperature: '88 °C', artwork: 'espresso' },
  { name: 'Double Espresso', category: 'Espresso bar', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — twice the coffee, twice the crema. Bold, velvety and unapologetically intense.', notes: 'Cocoa nib|Caramel|Smoked cedar', intensity: 5, volume: '60 ml', temperature: '88 °C', artwork: 'double' },
  { name: 'Americano', category: 'Long black', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — espresso lengthened with hot water, opening a clean, aromatic cup with a gentle bitterness.', notes: 'Roasted almond|Citrus peel|Black tea', intensity: 4, volume: '180 ml', temperature: '92 °C', artwork: 'americano' },
  { name: 'Cappuccino', category: 'Milk & foam', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — a bold espresso heart beneath a dome of velvety microfoam and a whisper of cocoa.', notes: 'Vanilla bean|Cocoa dust|Steamed milk', intensity: 3, volume: '160 ml', temperature: '88 °C', artwork: 'cappuccino' },
  { name: 'Latte', category: 'Milk & foam', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — silky steamed milk poured over espresso and finished with a hand-drawn heart.', notes: 'Fresh cream|Honey|Toasted grain', intensity: 2, volume: '240 ml', temperature: '85 °C', artwork: 'latte' },
  { name: 'Mocha', category: 'Sweet & dark', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — rich cocoa folded into espresso and steamed milk. Dessert, served in a cup.', notes: '70% chocolate|Molasses|Velvet cream', intensity: 3, volume: '240 ml', temperature: '85 °C', artwork: 'mocha' },
  { name: 'Macchiato', category: 'Espresso bar', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — an espresso marked with a spot of foam. Small, strong and pleasingly rounded.', notes: 'Burnt sugar|Hazelnut|Warm cream', intensity: 4, volume: '40 ml', temperature: '88 °C', artwork: 'macchiato' },
  { name: 'Flat White', category: 'Milk & foam', price: 5, description: 'A little cup of comfort,\nindulge in the deep, roasted\nflavor of our espresso.', detail: 'A little cup of comfort — a double ristretto base under a thin, glossy layer of silky microfoam.', notes: 'Toffee|Walnut|Buttered toast', intensity: 3, volume: '170 ml', temperature: '88 °C', artwork: 'flatwhite' },
]

const favoriteIcon = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
const cartIcon = 'M18 6h-2c0-2.76-2.24-5-5-5S6 3.24 6 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z'

const Cup: React.FC<{ artwork: string; hero?: boolean }> = ({ artwork, hero = false }) => {
  if (hero) return <div className="hero-cup" aria-hidden="true"><span className="hero-cup__saucer" /><span className="hero-cup__mug"><span className="hero-cup__coffee" /></span></div>
  const overlay = artwork === 'cappuccino' ? <span className="foam" /> : artwork === 'latte' ? <span className="heart" /> : artwork === 'mocha' ? <span className="swirl" /> : null
  return <div className={`cup cup--${artwork}`} aria-hidden="true"><span className="saucer" /><span className="mug"><span className="coffee">{overlay}</span></span></div>
}

const formatPrice = (drink: Drink, currency: string) => `${currency}${drink.price ?? 5}`

export const CoffeeMenuBlock: React.FC<Props> = (props) => {
  const shell = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const activeDrink = useRef<Drink | null>(null)
  const activeElement = useRef<HTMLElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const ctaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closing = useRef(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [favoriteCart, setFavoriteCart] = useState<Record<string, boolean>>({})
  const [isAdded, setIsAdded] = useState(false)
  const [status, setStatus] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [popped, setPopped] = useState<Record<string, boolean>>({})
  const popTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const drinks = (props.drinks?.length ? props.drinks : defaults).slice(0, 8).map((drink, index) => ({
    ...defaults[index],
    ...drink,
    name: drink.name || defaults[index].name,
    artwork: drink.artwork || defaults[index].artwork,
  })) as Required<Drink>[]
  const currency = props.currencyLabel || '$'
  const brand = (props.brandName || 'COFFEE SHOP').trim().split(/\s+/)

  useEffect(() => {
    try {
      setFavoriteCart(JSON.parse(localStorage.getItem('coffee-shop-actions') || '{}'))
    } catch { setFavoriteCart({}) }
    return () => {
      clearTimeout(closeTimer.current)
      clearTimeout(ctaTimer.current)
      clearTimeout(hoverTimer.current)
      Object.values(popTimers.current).forEach(clearTimeout)
    }
  }, [])

  const updateAction = (drink: Drink, action: 'favorite' | 'cart', value: boolean, announce = true) => {
    const key = `${drink.name || 'Coffee'}::${action}`
    setFavoriteCart((current) => {
      const next = { ...current, [key]: value }
      if (!value) delete next[key]
      try { localStorage.setItem('coffee-shop-actions', JSON.stringify(next)) } catch { /* storage may be disabled */ }
      return next
    })
    if (announce) setActionStatus(`${drink.name || 'Coffee'} ${value ? 'added to' : 'removed from'} your ${action === 'favorite' ? 'favourites' : 'cart'}.`)
  }

  const popAction = (drink: Drink, action: 'favorite' | 'cart') => {
    const key = `${drink.name || 'Coffee'}::${action}`
    clearTimeout(popTimers.current[key])
    setPopped((current) => ({ ...current, [key]: false }))
    requestAnimationFrame(() => setPopped((current) => ({ ...current, [key]: true })))
    popTimers.current[key] = setTimeout(() => setPopped((current) => ({ ...current, [key]: false })), 420)
  }

  const open = (drink: Drink, index: number, element: HTMLElement) => {
    if (!dialog.current || !shell.current) return
    clearTimeout(closeTimer.current)
    closing.current = false
    dialog.current.classList.remove('is-closing')
    activeDrink.current = drink
    activeElement.current = element
    clearTimeout(ctaTimer.current)
    setIsAdded(false)
    setStatus('')
    flushSync(() => setSelectedIndex(index))
    if (!dialog.current.open) dialog.current.showModal()
    const detailBody = dialog.current.querySelector('.detail__body')
    if (detailBody) detailBody.scrollTop = 0
    shell.current.classList.add('has-detail')
    closeButton.current?.focus({ preventScroll: true })
  }

  const close = () => {
    if (!dialog.current?.open || closing.current) return
    closing.current = true
    dialog.current.classList.add('is-closing')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    closeTimer.current = setTimeout(() => dialog.current?.close(), reduced ? 200 : 400)
  }

  const closeComplete = () => {
    if (dialog.current?.open) return
    clearTimeout(closeTimer.current)
    clearTimeout(ctaTimer.current)
    closing.current = false
    dialog.current?.classList.remove('is-closing')
    shell.current?.classList.remove('has-detail')
    activeDrink.current = null
    setIsAdded(false)
    activeElement.current?.focus({ preventScroll: true })
    activeElement.current = null
  }

  const addToOrder = () => {
    const drink = activeDrink.current
    if (!drink) return
    setIsAdded(true)
    setStatus(`${drink.name} added to your order.`)
    updateAction(drink, 'cart', true, false)
    popAction(drink, 'cart')
    clearTimeout(ctaTimer.current)
    ctaTimer.current = setTimeout(() => { setIsAdded(false); setStatus('') }, 2400)
  }

  const selected = drinks[selectedIndex] || drinks[0]
  const detailName = selected.name || 'Coffee'
  const notes = (selected.notes || '').split('|').map((value) => value.trim()).filter(Boolean)
  const intensity = Math.min(5, Math.max(1, Number(selected.intensity) || 3))

  return (
    <div className="coffee-menu-shell" ref={shell}>
      <main className="poster" aria-label={`${brand.join(' ')} menu and price list`}>
        <section className="menu" aria-labelledby="menu-title">
          <h1 id="menu-title">{props.menuTitle || 'MENU & PRICE LIST'}</h1>
          <div className="menu-grid">
            {drinks.map((drink, index) => {
              const name = drink.name || 'Coffee'
              const active = (action: 'favorite' | 'cart') => Boolean(favoriteCart[`${name}::${action}`])
              const cardDescription = (drink.description || defaults[index].description || '').split('\n')
              return (
                <div className="cell" key={`${name}-${index}`}>
                  <article className="item" role="button" tabIndex={0} aria-haspopup="dialog" aria-controls="item-detail"
                    aria-label={`Open details for ${name}, ${formatPrice(drink, currency)}`} data-drink-key={name}
                    onClick={(event) => open(drink, index, event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                        event.preventDefault()
                        open(drink, index, event.currentTarget)
                      }
                    }}
                    onPointerDown={(event) => { if (event.pointerType !== 'mouse') event.currentTarget.classList.add('is-pressed') }}
                    onPointerUp={(event) => {
                      if (event.pointerType === 'mouse') return
                      const card = event.currentTarget
                      card.classList.remove('is-pressed')
                      shell.current?.querySelectorAll('.item.is-hovered').forEach((node) => node.classList.remove('is-hovered'))
                      card.classList.add('is-hovered')
                      clearTimeout(hoverTimer.current)
                      hoverTimer.current = setTimeout(() => card.classList.remove('is-hovered'), 1600)
                    }}
                    onPointerCancel={(event) => event.currentTarget.classList.remove('is-pressed')}
                    onPointerLeave={(event) => event.currentTarget.classList.remove('is-pressed')}>
                    <Cup artwork={drink.artwork || 'espresso'} />
                    <h2>{name}</h2>
                    <p>{cardDescription.map((line, lineIndex) => <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}{line}</React.Fragment>)}</p>
                    <span className="price">{formatPrice(drink, currency)}</span>
                  </article>
                  <div className="item__actions">
                    <button className={`item__action item__action--fav${active('favorite') ? ' is-on' : ''}${popped[`${name}::favorite`] ? ' is-pop' : ''}`} type="button" data-action="favorite" aria-pressed={active('favorite')} aria-label={`${active('favorite') ? 'Remove' : 'Add'} ${name} ${active('favorite') ? 'from' : 'to'} favourites`} onClick={() => { updateAction(drink, 'favorite', !active('favorite')); popAction(drink, 'favorite') }} onPointerEnter={(event) => event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.add('is-hovered')} onPointerLeave={(event) => { if (!event.currentTarget.matches(':focus-visible')) event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.remove('is-hovered') }} onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.add('is-hovered') }} onBlur={(event) => { if (!event.currentTarget.matches(':hover')) event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.remove('is-hovered') }}>
                      <svg className="item__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={favoriteIcon} /></svg>
                    </button>
                    <button className={`item__action item__action--cart${active('cart') ? ' is-on' : ''}${popped[`${name}::cart`] ? ' is-pop' : ''}`} type="button" data-action="cart" aria-pressed={active('cart')} aria-label={`${active('cart') ? 'Remove' : 'Add'} ${name} ${active('cart') ? 'from' : 'to'} the cart`} onClick={() => { updateAction(drink, 'cart', !active('cart')); popAction(drink, 'cart') }} onPointerEnter={(event) => event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.add('is-hovered')} onPointerLeave={(event) => { if (!event.currentTarget.matches(':focus-visible')) event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.remove('is-hovered') }} onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.add('is-hovered') }} onBlur={(event) => { if (!event.currentTarget.matches(':hover')) event.currentTarget.closest('.cell')?.querySelector('.item')?.classList.remove('is-hovered') }}>
                      <svg className="item__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={cartIcon} /></svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        <aside className="brand" aria-label={`${brand.join(' ')} branding`}>
          <header className="brand__head">
            <p className="brand__name"><span>{brand[0] || 'COFFEE'}</span><span className="brand__name-second">{brand.slice(1).join(' ') || 'SHOP'}</span></p>
            <p className="brand__tag">{props.tagline || 'BREWED FOR THE BOLD'}</p>
          </header>
          <Cup artwork="espresso" hero />
        </aside>
        <footer className="brand__foot">
          <p className="brand__desc">{(props.brandDescription || 'A perfect cup of coffee, made\njust for you. Energize your\nmorning and fuel your day with\nour premium blends.').split('\n').map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}{line}</React.Fragment>)}</p>
          <p className="brand__slogan" aria-label={[props.sloganLine1, props.sloganLine2, props.sloganLine3, props.sloganLine4].filter(Boolean).join(' ')}>
            <span className="slogan-large">{props.sloganLine1 || 'BREWED'}</span>
            <span className="slogan-small">{props.sloganLine2 || 'FOR COMFORT,'}</span>
            <span className="slogan-large">{props.sloganLine3 || 'CRAFTED'}</span>
            <span className="slogan-small">{props.sloganLine4 || 'FOR YOU'}</span>
          </p>
        </footer>
      </main>

      <dialog className="detail" id="item-detail" aria-labelledby="detail-name" aria-describedby="detail-desc"
        ref={dialog} onClick={(event) => { if (event.target === dialog.current) close() }}
        onCancel={(event) => { event.preventDefault(); close() }} onClose={closeComplete}>
        <div className="detail__glass">
          <span className="detail__scan" aria-hidden="true" />
          <div className="detail__topbar">
            <p className="detail__brand">{brand.join(' ')} <span aria-hidden="true">·</span> Menu</p>
            <button className="detail__close" ref={closeButton} type="button" aria-label="Close item details" onClick={close}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="detail__body">
            <div className="detail__info">
              <p className="detail__kicker">About this cup</p>
              <p className="detail__desc" id="detail-desc">{selected.detail || defaults[drinks.indexOf(selected)]?.detail}</p>
              <ul className="detail__notes" aria-label={notes.length ? `Flavor notes: ${notes.join(', ')}` : 'Flavor notes'}>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
              <div className="detail__stats">
                <div className="detail__stat"><span className="detail__stat-label">Intensity</span><span className="detail__dots" aria-label={`Intensity ${intensity} out of 5`}>{Array.from({ length: 5 }, (_, index) => <span key={index} className={`dot${index < intensity ? ' is-on' : ''}`} aria-hidden="true" />)}</span></div>
                <div className="detail__stat"><span className="detail__stat-label">Volume</span><span className="detail__stat-value" data-field="volume">{selected.volume || '—'}</span></div>
                <div className="detail__stat"><span className="detail__stat-label">Served</span><span className="detail__stat-value" data-field="temp">{selected.temperature || '—'}</span></div>
              </div>
              <div className="detail__purchase">
                <p className="detail__price"><span className="detail__price-amount">{formatPrice(selected, currency)}</span><span className="detail__price-note">per cup</span></p>
                <button className={`detail__cta${isAdded ? ' is-added' : ''}`} type="button" onClick={addToOrder}><span>{isAdded ? 'Added to order' : 'Add to order'}</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              </div>
              <p className="sr-only" role="status" aria-live="polite">{status}</p>
            </div>
            <div className="detail__art">
              <span className="detail__ghost" aria-hidden="true">{String(Math.max(0, drinks.indexOf(selected)) + 1).padStart(2, '0')}</span>
              <span className="detail__glow" aria-hidden="true" />
              <div className="detail__stage" aria-hidden="true"><Cup artwork={selected.artwork || 'espresso'} /></div>
              <div className="detail__identity">
                <p className="detail__eyebrow"><span className="detail__num">N° {String(Math.max(0, drinks.indexOf(selected)) + 1).padStart(2, '0')}</span><span className="detail__cat">{selected.category || ''}</span></p>
                <h2 className="detail__name" id="detail-name">{detailName}</h2>
              </div>
            </div>
          </div>
        </div>
      </dialog>
      <p className="sr-only" id="action-status" role="status" aria-live="polite">{actionStatus}</p>
    </div>
  )
}
