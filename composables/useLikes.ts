import { ref, onMounted } from 'vue'

/**
 * The site's like count and whether this browser has already given one.
 *
 * The count is fetched after mount and never during prerendering, so a
 * build cannot freeze a number into the page. Having liked is a flag in
 * `localStorage`: enough to keep the heart filled across visits, and the
 * server's rate guard stands behind it for anyone who clears it.
 *
 * The state lives at module level, so it is one count for the session: the
 * heart is mounted anew on every route change, and fetching on each mount
 * asked the server the same question on every navigation. It is only ever
 * written on the client, so sharing the module across server requests is
 * harmless — there it stays "unknown".
 */
const LIKED_KEY = 'portfolio:liked'

/** `null` until the count has arrived; the button shows nothing for it. */
const count = ref<number | null>(null)
const liked = ref(false)
const pending = ref(false)

let loading: Promise<void> | null = null

/** Reads the flag and fetches the count, once per session. */
function load() {
  if (loading) return loading
  try {
    liked.value = localStorage.getItem(LIKED_KEY) === '1'
  } catch {
    // Storage can be off (private mode, a locked-down browser): unliked
  }
  loading = $fetch<{ likes: number }>('/api/likes')
    .then(({ likes }) => {
      count.value = likes
    })
    .catch(() => {
      // The API being away is not the page's problem: the heart stays mute,
      // and the next mount may ask again
      loading = null
    })
  return loading
}

/**
 * Gives a like. The count moves at once and the server's answer replaces
 * it, or takes it back when the request fails. Returns whether a like was
 * actually given, so a press on an already-liked heart can still pop
 * without counting.
 */
async function like() {
  if (liked.value || pending.value) return false
  pending.value = true
  liked.value = true
  const before = count.value
  count.value = (before ?? 0) + 1
  try {
    const { likes } = await $fetch<{ likes: number }>('/api/likes', {
      method: 'POST',
    })
    count.value = likes
    try {
      localStorage.setItem(LIKED_KEY, '1')
    } catch {
      // Not remembered: the heart empties again on the next visit, no worse
    }
  } catch {
    liked.value = false
    count.value = before
  } finally {
    pending.value = false
  }
  return liked.value
}

/**
 * Takes this browser's like back: the mirror of `like()`. The count moves
 * at once and the server's answer replaces it, or the like is put back when
 * the request fails. Returns whether a like was actually taken back.
 */
async function unlike() {
  if (!liked.value || pending.value) return false
  pending.value = true
  liked.value = false
  const before = count.value
  count.value = Math.max(0, (before ?? 1) - 1)
  try {
    const { likes } = await $fetch<{ likes: number }>('/api/likes', {
      method: 'DELETE',
    })
    count.value = likes
    try {
      localStorage.removeItem(LIKED_KEY)
    } catch {
      // Not forgotten: the heart is full again on the next visit, no worse
    }
  } catch {
    liked.value = true
    count.value = before
  } finally {
    pending.value = false
  }
  return !liked.value
}

export function useLikes() {
  onMounted(() => {
    void load()
  })

  return { count, liked, pending, like, unlike }
}
