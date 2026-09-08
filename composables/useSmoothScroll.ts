import Lenis from 'lenis'
import { onFrame, damp } from './useFrameLoop'
import { Spring } from '~/utils/spring'
import { motion } from '~/motion.config'

/**
 * Plain, non-reactive frame state.
 *
 * The WebGL layer reads this directly instead of the Pinia store: it is
 * rewritten every frame, and pushing that through Vue's reactivity to trigger
 * mesh updates is what previously made the meshes advance only when a watcher
 * happened to fire — so the deformation froze mid-decay whenever scrolling
 * stopped, instead of relaxing back to rest.
 */
export const scrollFrame = {
  /** Smoothed document scroll offset in pixels, always within [0, max]. */
  y: 0,
  /**
   * Velocity of the content as it appears on screen, in pixels per second.
   * Includes the rubber band, so a bounce at the edge deforms the images just
   * like scrolling does.
   */
  velocity: 0,
  /** Maximum scrollable offset in pixels. */
  max: 0,
  /**
   * How far the content is displaced past an edge, in pixels. Positive when
   * pulled down past the top, negative when pulled up past the bottom, zero
   * whenever the page is inside its scroll range.
   */
  overscroll: 0,
  /** True when the visitor asked for reduced motion: no smoothing, no bounce. */
  reduced: false,
}

export interface SmoothScroll {
  lenis: Lenis
  destroy: () => void
}

let activeGlide: ((position: number) => void) | null = null

/**
 * Moves the page to `position` through the scroll spring, the way a key or
 * an anchor does — for the scroll track. A plain jump before the integrator
 * exists or under reduced motion, where the spring is bypassed.
 */
export function glideTo(position: number) {
  if (activeGlide) activeGlide(position)
  else window.scrollTo(0, Math.max(0, position))
}

const EDGE_EPSILON = 0.5

/**
 * Scroll positions the browser reports can differ from what was written by
 * sub-pixel rounding; anything further off than this came from somewhere else.
 */
const EXTERNAL_SCROLL_EPSILON = 1.5

/**
 * Rubber-band mapping: displacement grows with the pull but saturates at
 * `max`, so no amount of wheel or finger can drag the page off the screen.
 */
function rubberBand(pull: number, max: number) {
  return max * Math.tanh(pull / max)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/** Signed distance a position lies outside [0, limit]; 0 when inside. */
function excessPast(position: number, limit: number) {
  if (position < 0) return position
  if (position > limit) return position - limit
  return 0
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)
}

/**
 * Smooth scrolling on top of native scrolling, plus the rubber band at the
 * edges of the page.
 *
 * Wheel and keyboard input move a *target*; the scroll position is a spring
 * chasing it, written to the window every frame. Lenis is kept underneath for
 * what it does well — the scroll limit with its resize observers, the touch
 * gesture stream, the iOS quirks, the optional `syncTouch` mode — but its own
 * first-order smoothing is bypassed for the wheel: a lerp restarts its
 * velocity on every notch, which is the "shoved" feel this replaces.
 *
 * @param content The element that is translated for the rubber band. It has to
 * contain everything that scrolls and nothing that is fixed; the WebGL meshes
 * follow automatically because they measure the translated DOM.
 */
export function createSmoothScroll(content: HTMLElement): SmoothScroll {
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  scrollFrame.reduced = reducedMotion

  const { scroll: scrollConfig, overscroll: overscrollConfig } = motion

  /*
   * The scroll integrator. `target` is where the input wants to be; `scroll`
   * is where the page is. Critically damped so it never overshoots and scrolls
   * back, velocity-capped so a wheel spin is a glide rather than a jump. The
   * cap is in screens a second, so it is set from the window's height each
   * frame below, not here.
   */
  const scroll = new Spring(scrollConfig.spring)
  let target = 0
  /** The last position this integrator wrote, to tell its own scroll events
   * from a finger, a scrollbar drag or a scroll restoration. */
  let lastWritten = 0

  /*
   * Overscroll state. Wheel input past an edge accumulates in `wheelPull`
   * and is let go at `release`; the band spring follows it out and home.
   */
  const band = new Spring({
    stiffness: overscrollConfig.stiffness,
    damping: overscrollConfig.damping,
  })
  /** Wheel input past an edge, accumulated then released, in pixels of pull. */
  let wheelPull = 0
  /** Distance a finger has dragged past an edge, held while it is down. */
  let touchDrag = 0
  let touching = false
  /**
   * iOS may still rubber-band natively despite `overscroll-behavior: none`.
   * The scroll position then leaves [0, max]; once that has been seen the
   * native bounce is in charge and this one stands down for good.
   */
  let nativeOverscroll = false

  /*
   * Lenis registers its wheel and touch listeners with `passive: false`, so
   * that it can take a gesture over. A non-passive touch listener anywhere
   * on the path is enough to take touch scrolling off the compositor: the
   * browser has to wait for the main thread on every touchmove before it may
   * scroll, and on a phone the main thread is the one drawing the scene, so
   * the whole page stuttered with it. Where the touch is native (no
   * syncTouch) and the primary pointer is a finger, Lenis therefore listens
   * on a detached element — there is no wheel to take over there — and the
   * part of a drag past an edge is watched below, with passive listeners.
   */
  // `?sync=1` on the address bar turns Lenis' syncTouch on for a visit, so a
  // phone can be tried with JS driving the touch scroll (DOM and scene then
  // move in the same frame) without a release
  const syncTouch =
    scrollConfig.syncTouch ||
    new URLSearchParams(window.location.search).get('sync') === '1'

  const passiveTouch =
    !reducedMotion &&
    !syncTouch &&
    window.matchMedia('(pointer: coarse)').matches

  const lenis = new Lenis({
    eventsTarget: passiveTouch ? document.createElement('div') : window,
    // The frame loop drives this, so scroll, mesh transforms and the WebGL draw
    // cannot desync
    autoRaf: false,
    // Wheel smoothing is done here, not by Lenis; lerp 1 is plain native
    lerp: 1,
    smoothWheel: false,
    syncTouch: !reducedMotion && syncTouch,
    touchInertiaExponent: scrollConfig.touchInertiaExponent,
    /*
     * Every wheel and touch delta passes through here before Lenis sees it.
     * Wheel deltas are taken over entirely (return false); touch deltas are
     * only watched, for the part a finger drags past an edge.
     */
    virtualScroll: ({ deltaY, event }) => {
      if (reducedMotion) return true
      const isTouch = event.type.startsWith('touch')

      if (isTouch && !syncTouch) {
        if (nativeOverscroll) return true
        if (event.type === 'touchstart') {
          touching = true
          touchDrag = 0
        } else if (event.type === 'touchend') {
          touching = false
          touchDrag = 0
        } else if (touching) {
          // Native scrolling owns the finger inside the range; only the part of
          // the drag the page cannot absorb is ours
          const excess = excessPast(lenis.actualScroll + deltaY, lenis.limit)
          if (excess !== 0) touchDrag -= excess
          // Reversing the drag releases the band before the range takes over
          else if (touchDrag !== 0) {
            const released = touchDrag - deltaY
            touchDrag =
              Math.sign(released) === Math.sign(touchDrag) ? released : 0
          }
        }
        return true
      }

      if (isTouch) {
        // syncTouch: Lenis drives the touch scroll and clamps its target; the
        // part it clamps away is the band's
        const excess = excessPast(lenis.targetScroll + deltaY, lenis.limit)
        if (excess !== 0 && !nativeOverscroll) wheelPull -= excess
        return true
      }

      // ctrl+wheel is the browser's pinch zoom; leave it alone
      if (event.ctrlKey) return true
      if (event.cancelable) event.preventDefault()

      const wanted = target + deltaY * scrollConfig.wheelMultiplier
      const excess = excessPast(wanted, lenis.limit)
      if (excess !== 0 && !nativeOverscroll) wheelPull -= excess
      target = clamp(wanted, 0, lenis.limit)
      return false
    },
  })

  // The finger past an edge, watched without standing in the browser's way
  // (passive): the same bookkeeping as the touch branch of virtualScroll
  let lastTouchY = 0
  const onTouchStart = (event: TouchEvent) => {
    if (nativeOverscroll) return
    touching = true
    touchDrag = 0
    lastTouchY = event.touches[0]?.clientY ?? 0
  }
  const onTouchMove = (event: TouchEvent) => {
    if (nativeOverscroll || !touching) return
    const y = event.touches[0]?.clientY ?? lastTouchY
    const deltaY = lastTouchY - y
    lastTouchY = y
    const excess = excessPast(lenis.actualScroll + deltaY, lenis.limit)
    if (excess !== 0) touchDrag -= excess
    else if (touchDrag !== 0) {
      const released = touchDrag - deltaY
      touchDrag = Math.sign(released) === Math.sign(touchDrag) ? released : 0
    }
  }
  const onTouchEnd = () => {
    touching = false
    touchDrag = 0
  }
  if (passiveTouch) {
    const passive = { passive: true } as const
    window.addEventListener('touchstart', onTouchStart, passive)
    window.addEventListener('touchmove', onTouchMove, passive)
    window.addEventListener('touchend', onTouchEnd, passive)
    window.addEventListener('touchcancel', onTouchEnd, passive)
  }

  // Start wherever the page already is (a restored position, a hash)
  scroll.set(lenis.actualScroll)
  target = lenis.actualScroll
  lastWritten = lenis.actualScroll

  let previousY = scroll.value
  let previousVelocity = 0
  let previousOverscroll = 0
  let transformApplied = false

  const stopFrame = onFrame('scroll', (dt, time) => {
    lenis.raf(time * 1000)

    // Lenis learns a new document height from a ResizeObserver, a frame or
    // two after a navigation; the router has scrolled to the hash by then,
    // and clamping to the old page's limit would haul it back up. The
    // document's own number is never stale.
    const max = Math.max(
      lenis.limit,
      document.documentElement.scrollHeight - window.innerHeight,
    )
    const actual = lenis.actualScroll
    let y: number

    if (reducedMotion) {
      y = actual
    } else {
      // Something else moved the page (a finger, the scrollbar, a restored
      // position, find-in-page): take it as the new truth and stop chasing.
      // Faster than any flick it is a jump, not motion — a navigation lands
      // the new page at the old position clamped to its height on one frame
      // and at the top on the next — and nothing on screen travelled from
      // there to here, so it leaves no velocity: read as motion, a jump
      // saturated every scroll-driven effect at once and the page arrived
      // with its images bent and trailing.
      //
      // Under a finger, or with the integrator at rest, any move at all is
      // somebody else's: a slow finger scrolls the page less than the
      // epsilon a frame, and the browser's own fling ends the same way, and
      // writing the last written position back over each of those frames
      // fought the browser for the page — a slow or careful touch scroll
      // shook with every frame while a fast one, past the epsilon, was
      // adopted and smooth. The epsilon is only for the integrator's own
      // glide, where the browser reports its write rounded.
      const moved = actual - lastWritten
      const external =
        Math.abs(moved) > EXTERNAL_SCROLL_EPSILON ||
        (moved !== 0 && (touching || scroll.settled))
      if (external) {
        if (Math.abs(moved) > overscrollConfig.bounceMaxVelocity * dt) {
          previousY = actual
        }
        scroll.set(actual)
        target = actual
        lastWritten = actual
      }

      // The range can shrink under the page (content resize)
      target = clamp(target, 0, max)
      scroll.target = target
      // The cap in px follows the window: a glide is so many screens a
      // second on every display, and on a phone the address bar's coming and
      // going moves it with the viewport
      scroll.maxVelocity = scrollConfig.maxSpeed * window.innerHeight
      scroll.update(dt)
      if (scroll.settled) scroll.set(target)
      scroll.value = clamp(scroll.value, 0, max)
      y = scroll.value

      if (Math.abs(y - actual) > 0.01) {
        window.scrollTo(0, y)
        lastWritten = y
      }
    }

    const rawVelocity = dt > 0 ? (y - previousY) / dt : 0

    let overscroll = 0
    if (!reducedMotion) {
      if (
        !nativeOverscroll &&
        (actual < -EDGE_EPSILON || actual > max + EDGE_EPSILON)
      ) {
        nativeOverscroll = true
        band.set(0)
        touchDrag = 0
        wheelPull = 0
      }

      if (!nativeOverscroll) {
        if (touching && touchDrag !== 0) {
          // The finger holds the band: track it, keeping the velocity so the
          // release carries momentum into the spring
          const held = rubberBand(
            touchDrag * overscrollConfig.touchGain,
            overscrollConfig.max,
          )
          band.velocity = dt > 0 ? (held - band.value) / dt : 0
          band.value = held
          band.target = 0
        } else {
          // Wheel pull decays once the notches stop, and the band follows it
          // out and home through its spring rather than jumping either way
          wheelPull = damp(wheelPull, 0, overscrollConfig.release, dt)
          if (Math.abs(wheelPull) < 0.01) wheelPull = 0
          band.target = rubberBand(
            wheelPull * overscrollConfig.wheelGain,
            overscrollConfig.max,
          )

          // Momentum arriving at an edge carries into the band instead of
          // stopping dead. Only a real arrival counts: the integrator's own
          // approach reaches the edge at zero speed and gets nothing, and
          // anything faster than a flick is a jump (scroll restoration, a
          // hash navigation) and lands without a bounce.
          const arrivedTop = y <= EDGE_EPSILON && previousY > EDGE_EPSILON
          const arrivedBottom =
            y >= max - EDGE_EPSILON && previousY < max - EDGE_EPSILON
          const isFlick =
            Math.abs(previousVelocity) < overscrollConfig.bounceMaxVelocity
          if (
            isFlick &&
            ((arrivedTop &&
              previousVelocity < -overscrollConfig.bounceMinVelocity) ||
              (arrivedBottom &&
                previousVelocity > overscrollConfig.bounceMinVelocity))
          ) {
            band.impulse(-previousVelocity * overscrollConfig.bounceTransfer)
          }

          band.update(dt)
          band.value = clamp(
            band.value,
            -overscrollConfig.max,
            overscrollConfig.max,
          )
          if (band.settled && band.target === 0) band.set(0)
        }
      }
      overscroll = band.value
    }

    /*
     * The translation is written in the scroll stage so that the transform
     * stage, which runs next, measures DOM boxes that already include it. It
     * is removed entirely at rest: a transformed wrapper is its own compositing
     * layer, and the document does not need one for the 99% of the time it is
     * inside its range.
     */
    if (overscroll !== 0) {
      content.style.transform = `translate3d(0, ${overscroll.toFixed(2)}px, 0)`
      transformApplied = true
    } else if (transformApplied) {
      content.style.transform = ''
      transformApplied = false
    }

    // What the eye sees moving: the document scroll plus the band. Pulling
    // the content down past the top is the same motion as scrolling up.
    const overscrollVelocity =
      dt > 0 ? (overscroll - previousOverscroll) / dt : 0
    scrollFrame.velocity = rawVelocity - overscrollVelocity
    scrollFrame.y = clamp(y, 0, max)
    scrollFrame.max = max
    scrollFrame.overscroll = overscroll

    previousY = y
    previousVelocity = rawVelocity
    previousOverscroll = overscroll
  })

  /** Moves the target; the spring does the travelling. */
  const scrollTo = (position: number) => {
    target = clamp(position, 0, lenis.limit)
  }
  activeGlide = reducedMotion
    ? (position) => window.scrollTo(0, clamp(position, 0, lenis.limit))
    : scrollTo

  /*
   * Keyboard scrolling feeds the same spring, so a key press glides exactly
   * like a wheel notch instead of the browser's own shorter animation. Under
   * reduced motion the browser keeps the keys.
   */
  const onKeyDown = (event: KeyboardEvent) => {
    if (reducedMotion) return
    if (event.defaultPrevented) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (isEditable(event.target)) return

    const { keyboard } = scrollConfig
    const page = window.innerHeight * keyboard.page

    switch (event.key) {
      case 'ArrowDown':
        scrollTo(target + keyboard.line)
        break
      case 'ArrowUp':
        scrollTo(target - keyboard.line)
        break
      case 'PageDown':
        scrollTo(target + page)
        break
      case 'PageUp':
        scrollTo(target - page)
        break
      case ' ':
        scrollTo(target + (event.shiftKey ? -page : page))
        break
      case 'Home':
        if (event.shiftKey) return
        scrollTo(0)
        break
      case 'End':
        if (event.shiftKey) return
        scrollTo(lenis.limit)
        break
      default:
        return
    }
    if (event.shiftKey && event.key !== ' ') return
    event.preventDefault()
  }

  /*
   * Same-page anchors (`href="#work"`) glide to their target through the same
   * spring. The hash is still pushed so the URL and history behave as before.
   */
  const onClick = (event: MouseEvent) => {
    if (reducedMotion) return
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const anchor = (event.target as Element | null)?.closest?.('a[href]')
    if (!(anchor instanceof HTMLAnchorElement)) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin) return
    if (url.pathname !== window.location.pathname || !url.hash) return

    let element: HTMLElement | null = null
    try {
      element = document.querySelector<HTMLElement>(
        decodeURIComponent(url.hash),
      )
    } catch {
      return
    }
    if (!element) return

    event.preventDefault()
    if (url.hash !== window.location.hash) history.pushState(null, '', url.hash)
    // The rect is measured against the page as it is now, band included; the
    // band is at rest during a click, so this is the document offset.
    // scroll-margin-top is honoured as the browser's own hash scroll would:
    // the sections carry their landing offset under the fixed bars there
    const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0
    scrollTo(element.getBoundingClientRect().top + lenis.actualScroll - margin)
  }

  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('click', onClick)

  return {
    lenis,
    destroy: () => {
      activeGlide = null
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onClick)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      stopFrame()
      lenis.destroy()
      content.style.transform = ''
      scrollFrame.y = 0
      scrollFrame.velocity = 0
      scrollFrame.max = 0
      scrollFrame.overscroll = 0
    },
  }
}
