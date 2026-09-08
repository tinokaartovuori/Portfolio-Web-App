<template>
  <!--
    Everything below is plain DOM. ElementTracker and ThreeImage register the
    elements they wrap, and the WebGL layer measures those boxes — so content
    coming from markdown still ends up with a mesh, exactly as hand-written
    markup did.
  -->
  <!--
    The hero pads itself past the fixed bars (--bar-safe, see index.css) on
    both edges, so however short or narrow the viewport its text sits between
    the name and the scroll prompt rather than under either. When it still
    cannot fit, the scroll prompt is suppressed instead (see the script).
    On a phone in portrait the text sits in the lower part of the screen,
    above the scroll prompt, and the light field has the upper part; from
    md up it is centred.
  -->
  <ElementTracker threeReference="hero" object="LightField" variant="hero">
    <section
      ref="hero"
      class="relative isolate flex min-h-[100svh] w-full items-end px-(--page-gutter) pb-[calc(var(--bar-safe-bottom)_+_3.5rem)] pt-[calc(var(--bar-safe)_+_2.5rem)] md:items-center md:pb-[calc(var(--bar-safe-bottom)_+_2rem)]"
    >
      <!--
        The plate, painted by the page from the first frame in the colour the
        light field starts from (utils/plate.ts), so the hero has its frame
        before WebGL is up; the light field then hides it and lights up.
        `isolate` keeps -z-10 inside the section, behind the text and above
        the canvas.
      -->
      <div
        data-plate
        aria-hidden="true"
        class="plate pointer-events-none absolute -z-10"
        :style="plateStyle('hero')"
      />
      <div class="w-full">
        <h1
          class="max-w-[15ch] text-3xl font-light leading-[1.08] tracking-tight text-onyx dark:text-platinum xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {{ home?.hero.lead }}
        </h1>
        <WaveText
          :text="home?.hero.accent ?? ''"
          class="mt-6 block text-lg font-light text-onyx/60 dark:text-platinum/60 sm:text-xl md:mt-8 md:text-2xl"
        />
        <Magnetic class="mt-12 md:mt-16">
          <a
            :href="home?.hero.cta.to"
            class="group inline-flex items-baseline gap-3 text-base text-onyx dark:text-platinum sm:text-lg md:text-xl"
          >
            <span class="border-b border-current/30 pb-1">{{
              home?.hero.cta.label
            }}</span>
            <BobbingArrow />
          </a>
        </Magnetic>
      </div>
    </section>
  </ElementTracker>

  <Marquee v-if="home?.marquee" :words="home.marquee" />

  <section
    id="work"
    class="w-full px-(--page-gutter) pb-24 pt-16 md:pb-32 md:pt-24"
  >
    <header ref="workHeader" class="mb-20 will-change-transform md:mb-28">
      <p
        class="mb-4 text-sm uppercase tracking-[0.18em] text-onyx/50 dark:text-platinum/50 sm:text-base"
      >
        {{ home?.work.eyebrow }}
      </p>
      <h2
        class="max-w-[18ch] text-3xl font-light leading-tight tracking-tight text-onyx dark:text-platinum sm:text-4xl md:text-[2.75rem]"
      >
        {{ home?.work.heading }}
      </h2>
    </header>

    <ol class="flex flex-col gap-32 md:gap-44">
      <li v-for="(project, index) in projects" :key="project.id">
        <ProjectIndex
          :index="index"
          :threeReference="`shape-${project.stem}`"
          :flip="index % 2 === 0"
        />

        <div
          class="flex flex-col gap-8 md:flex-row md:items-start md:gap-16"
          :class="index % 2 === 1 ? 'md:flex-row-reverse' : ''"
        >
          <!--
            Every card is 16:9 whatever the file is, so the column reads as one
            set; the mesh crops the texture to the box (cover fit) and keeps
            the side the content's `imagePosition` asks for. A project can hand
            the card its own picture (`card`) when the crop of the lead image
            is not it. The project page shows the lead image whole.
          -->
          <div class="w-full md:w-3/5">
            <NuxtLink
              :to="project.path"
              class="block"
              :aria-label="`View ${project.title}`"
            >
              <ThreeImage
                :threeReference="`project-${project.stem}`"
                :imageUrl="project.card ?? project.image"
                :alt="project.imageAlt"
                sizes="(min-width: 768px) 54vw, 100vw"
                class="aspect-video object-cover"
                :style="{ objectPosition: project.imagePosition }"
              />
            </NuxtLink>
          </div>

          <div
            :ref="(el) => trailed(el, index)"
            class="flex w-full flex-col will-change-transform md:w-2/5 md:pt-2"
          >
            <p
              class="mb-3 font-mono text-sm uppercase tracking-[0.14em] text-onyx/45 dark:text-platinum/45"
            >
              <time :datetime="project.year">{{ project.year }}</time> —
              {{ project.role }}
            </p>
            <h3
              class="text-2xl font-normal tracking-tight text-onyx dark:text-platinum sm:text-3xl md:text-4xl"
            >
              {{ project.title }}
            </h3>
            <p
              class="mt-4 max-w-[42ch] text-lg leading-relaxed text-onyx/70 dark:text-platinum/70 sm:text-xl"
            >
              {{ project.summary }}
            </p>
            <!-- A store rating, where the project has one -->
            <Rating
              v-if="project.rating"
              :value="project.rating.value"
              :source="project.rating.source"
              class="mt-5"
            />
            <!--
              The way in, and beside it any link the content marks for the
              card (`card: true`): the one that is the work itself, where
              the page is about it — the film on YouTube. The rest of the
              links stay on the project page. The row never wraps: on a
              phone the link shows its `short` label instead.
            -->
            <p
              class="mt-8 flex items-baseline gap-x-6 text-base sm:gap-x-8 sm:text-lg"
            >
              <NuxtLink
                :to="project.path"
                class="group inline-flex items-baseline gap-2 text-onyx dark:text-platinum"
              >
                <span class="border-b border-current/30 pb-1"
                  >Read more<span class="sr-only">
                    about {{ project.title }}</span
                  ></span
                >
                <BobbingArrow direction="right" />
              </NuxtLink>
              <ProjectLink
                v-for="link in project.links?.filter((l) => l.card)"
                :key="link.to"
                :to="link.to"
                :label="link.label"
                :short="link.short"
                :icon="link.icon"
                :lang="link.lang"
              />
            </p>
          </div>
        </div>
      </li>
    </ol>
  </section>

  <!--
    The about section: the site is one page, so this is where the top bar's
    "About" lands. The portrait is a wash behind the section at every size —
    a ThreeImage with the background treatment (monochrome, very faint, its
    edges dissolved, hanging back as the page scrolls), absolutely placed so
    it adds no height of its own — and the text is laid over it: the
    standfirst across the width, the prose in one column on the left. From
    md up the photograph takes the section's height on the right, hanging a
    little past the edge; below md the text has the whole width, so the
    photograph is a wide box hung past the right edge behind the standfirst
    and the first paragraph, with the face in the upper right, and the rest
    of the prose runs off it. The canvas is behind the DOM whatever the boxes
    do.

    The anchor (#about) lands the eyebrow at --bar-safe + 2rem, the hero's
    own top line: scroll-margin-top makes up the difference between that and
    the padding, so the padding is the gap to the work above and nothing else.
  -->
  <section
    v-if="about"
    id="about"
    class="relative w-full overflow-x-clip scroll-mt-[calc(var(--bar-safe)_-_2rem)] px-(--page-gutter) pb-24 pt-16 md:scroll-mt-[calc(var(--bar-safe)_-_4rem)] md:pb-32 md:pt-24"
  >
    <!--
      The wash is kept inside the section: hanging back as it does (parallax)
      a taller box rose behind the last project. The photograph covers the
      box (cover fit, cropped on the face), so the box's shape is the
      picture's: below md it keeps the file's own aspect, wide as the
      viewport and more, hung past the right edge; from md up it is the
      section's height less a margin, and the width per breakpoint decides
      how much of the face the tall crop keeps.
    -->
    <div
      class="pointer-events-none absolute bottom-[2%] right-[-34vw] aspect-[1200/1275] w-[124vw] xs:right-[-30vw] xs:w-[112vw] sm:right-[-24vw] sm:w-[88vw] md:bottom-[6%] md:right-[-12vw] md:top-[6%] md:aspect-auto md:w-[74vw] lg:right-[-8vw] lg:w-[66vw] xl:w-[60vw]"
    >
      <ThreeImage
        threeReference="portrait"
        :imageUrl="about.image"
        :alt="about.imageAlt"
        variant="background"
        sizes="(min-width: 1280px) 60vw, (min-width: 1024px) 66vw, (min-width: 768px) 74vw, 124vw"
        class="h-full object-cover object-[50%_45%]"
      />
    </div>

    <div ref="aboutText" class="relative will-change-transform">
      <p
        class="mb-6 text-sm uppercase tracking-[0.18em] text-onyx/50 dark:text-platinum/50 sm:text-base"
      >
        {{ home?.about.eyebrow }}
      </p>
      <h2
        class="max-w-[30ch] text-3xl font-light leading-snug tracking-tight text-onyx dark:text-platinum sm:text-4xl md:text-[2.75rem] lg:text-[3.5rem]"
      >
        {{ about.standfirst }}
      </h2>

      <div
        class="prose-body mt-12 max-w-[56ch] text-onyx dark:text-platinum md:mt-16 md:w-1/2"
      >
        <ContentRenderer :value="about" />
        <!--
          Where I am and what I take on, from the frontmatter; the Finnish
          version is not on the page (hidden text is what a search engine
          calls spam) but goes into the JSON-LD below and llms.txt, where a
          Finnish search finds it. Then the offer as a list, from the same
          data the structured data offers.
        -->
        <p>{{ about.availability.en }}</p>
        <h3>{{ about.offersTitle }}</h3>
        <ul>
          <li v-for="offer in about.offers" :key="offer">{{ offer }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watchEffect,
  onMounted,
  onUnmounted,
  nextTick,
} from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useElementSize, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useScrollStateStore } from '~/store/scrollState'
import { useTrail } from '~/composables/useTrail'
import { plateStyle } from '~/utils/plate'
import { motion } from '~/motion.config'

/*
 * The page trail: headings and text columns lag their scroll position
 * through the same spring as the images, so the page moves as one body. The
 * image columns are left alone — their meshes carry the trail themselves.
 */
const workHeader = ref<HTMLElement | null>(null)
const aboutText = ref<HTMLElement | null>(null)
useTrail(workHeader, motion.trail.heading)
useTrail(aboutText, motion.trail.text)

// One ref per project text column, created as the list renders
const textColumns = Array.from({ length: 8 }, () =>
  ref<HTMLElement | null>(null),
)
for (const column of textColumns) useTrail(column, motion.trail.text)
const trailed = (
  el: Element | ComponentPublicInstance | null,
  index: number,
) => {
  const column = textColumns[index]
  if (column) column.value = el instanceof HTMLElement ? el : null
}

const { scrollPromptSuppressed, heroHeight: storedHeroHeight } = storeToRefs(
  useScrollStateStore(),
)

// Declared before the first await, so it is in the store before any sibling
// mounts: the bars would otherwise show their veil over the hero for the
// first frames, until the hero's real height arrives
storedHeroHeight.value = Number.POSITIVE_INFINITY

const { data: home } = await useHomeContent()

/*
 * The hero is min-h-[100svh] with its text centred between the bar-safe
 * paddings, so it only grows past the viewport when the text cannot fit
 * (a landscape phone, a small window). The fixed scroll prompt would then
 * sit on the text, so it is switched off for as long as that is the case.
 */
const hero = ref<HTMLElement | null>(null)
// Border box: the padding is the whole point, so the content box would say
// the hero fits when its text is already under the bars
const { height: heroHeight } = useElementSize(hero, undefined, {
  box: 'border-box',
})
const { height: windowHeight } = useWindowSize()
watchEffect(() => {
  scrollPromptSuppressed.value =
    heroHeight.value > 0 && heroHeight.value > windowHeight.value + 1
  // The fixed bars fade their veil in once the hero has scrolled past them
  storedHeroHeight.value =
    heroHeight.value > 0 ? heroHeight.value : Number.POSITIVE_INFINITY
})

onUnmounted(() => {
  scrollPromptSuppressed.value = false
  storedHeroHeight.value = 0
})

/*
 * Arriving with a hash from another page (About or Contact in the top bar on
 * a project page): the router scrolls to the section as soon as the page is
 * in, but the images have no height until they load, so the section is
 * still further down than where the router put us. Once every image is in,
 * the position is corrected — a jump, which the scroll integrator adopts.
 */
const route = useRoute()
onMounted(async () => {
  if (!route.hash) return
  const pending = Array.from(document.images).filter((img) => !img.complete)
  await Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  )
  await nextTick()
  let target: Element | null = null
  try {
    target = document.querySelector(decodeURIComponent(route.hash))
  } catch {
    return
  }
  if (target) {
    // Honouring scroll-margin-top, as the router's own hash scroll did
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0
    window.scrollTo(
      0,
      target.getBoundingClientRect().top + window.scrollY - margin,
    )
  }
})

const { data: projects } = await useProjects()

// The about section: standfirst and portrait from the frontmatter, the
// prose from the body
const { data: about } = await useAboutContent()

const { absolute } = useSiteUrl()

useSeo({
  // No title: the layout's default tagline title stands for the home page
  description:
    home.value?.description ??
    'Tino Kaartovuori is an engineer in Finland who designs and builds web apps, software and hardware.',
  path: '/',
  // The first project's og crop reads better as a social card than a portrait
  image: projects.value?.[0]?.image,
  imageAlt: projects.value?.[0]?.imageAlt,
})

// The site's identity: a WebSite and a Person, the Person referenced by @id
// from every project page's JSON-LD. The Person carries the place (address,
// occupation and where it is practised), the degree and the school, the
// languages, the skills and the offer as Services with the area they are
// served in — the facts an answer engine needs to match "a developer in
// Turku" to this page.
const contact = computed(() => home.value?.contact)
const socials = computed(() =>
  (contact.value?.links ?? []).map((l) => l.to).filter(Boolean),
)
const personId = `${absolute('/')}#person`
const cities = (about.value?.areaServed ?? []).map((name) => ({
  '@type': 'City',
  name,
}))
const education = about.value?.education
const school = education
  ? {
      '@type': 'CollegeOrUniversity',
      name: education.school,
      url: education.schoolUrl,
    }
  : undefined
const offers = (about.value?.offers ?? []).map((offer) => {
  const [name = offer, ...rest] = offer.split(':')
  return {
    '@type': 'Offer',
    itemOffered: {
      '@type': 'Service',
      name: name.trim(),
      description: rest.length ? rest.join(':').trim() : undefined,
      provider: { '@id': personId },
      areaServed: cities,
    },
  }
})
useJsonLd([
  {
    '@type': 'WebSite',
    '@id': `${absolute('/')}#website`,
    url: absolute('/'),
    name: 'Tino Kaartovuori',
    inLanguage: 'en',
    publisher: { '@id': personId },
  },
  {
    '@type': 'Person',
    '@id': personId,
    name: contact.value?.name ?? 'Tino Kaartovuori',
    url: absolute('/'),
    email: contact.value?.email,
    image: absolute(about.value?.image ?? '/images/portrait.jpg'),
    jobTitle: about.value?.jobTitle ?? 'Software engineer',
    // Language-tagged: the English site description, and the Finnish
    // availability paragraph, which is on no page — this and llms.txt are
    // where a Finnish search meets it
    description: about.value
      ? [
          { '@language': 'en', '@value': home.value?.description },
          { '@language': 'fi', '@value': about.value.availability.fi },
        ]
      : home.value?.description,
    address: about.value
      ? {
          '@type': 'PostalAddress',
          addressLocality: about.value.location.city,
          addressRegion: about.value.location.region,
          addressCountry: about.value.location.countryCode,
        }
      : undefined,
    homeLocation: about.value
      ? {
          '@type': 'City',
          name: `${about.value.location.city}, ${about.value.location.country}`,
        }
      : undefined,
    workLocation: cities,
    hasOccupation: about.value
      ? {
          '@type': 'Occupation',
          name: about.value.jobTitle,
          occupationLocation: cities,
        }
      : undefined,
    alumniOf: school,
    hasCredential: education
      ? {
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: 'degree',
          educationalLevel: "Master's degree",
          name: `${education.degree} in ${education.field}`,
          about: education.major,
          recognizedBy: school,
          dateCreated: education.year,
        }
      : undefined,
    knowsLanguage: ['fi', 'en'],
    knowsAbout: [
      ...new Set([
        ...(home.value?.marquee ?? []),
        ...(about.value?.skills ?? []),
      ]),
    ],
    makesOffer: offers,
    sameAs: socials.value,
  },
])
</script>

<style scoped>
/*
 * Scoped rather than a Tailwind typography plugin: the body is a handful of
 * elements and the plugin's own colour scale would have to be overridden for
 * both themes anyway.
 */
.prose-body :deep(p),
.prose-body :deep(ul) {
  margin-bottom: 1.4em;
  font-size: 1.2rem;
  line-height: 1.65;
  color: color-mix(in srgb, currentColor 78%, transparent);
}

/* A list in the prose: a dash for a marker, hanging so lines align */
.prose-body :deep(li) {
  padding-left: 1.2em;
  text-indent: -1.2em;
}

.prose-body :deep(li)::before {
  content: '–';
  display: inline-block;
  width: 1.2em;
  text-indent: 0;
  color: color-mix(in srgb, currentColor 50%, transparent);
}

.prose-body :deep(h3) {
  margin-top: 1.6em;
  margin-bottom: 0.9em;
  font-size: 0.9375rem;
  font-weight: 400;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: color-mix(in srgb, currentColor 50%, transparent);
}

.prose-body :deep(a) {
  color: inherit;
  border-bottom: 1px solid color-mix(in srgb, currentColor 35%, transparent);
}

/* No trailing margin under the column: the offers list is its last child,
 * and the body's last paragraph keeps its gap to what follows it */
.prose-body > :last-child {
  margin-bottom: 0;
}
</style>
