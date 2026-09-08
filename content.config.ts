import { defineContentConfig, defineCollection, z } from '@nuxt/content'

/**
 * Content lives in markdown under content/ so text and images can be edited
 * without touching a component.
 *
 * The constraint that shapes this: the WebGL layer does not read data, it reads
 * laid-out DOM boxes. Every field below ends up rendered as a real element
 * wrapped in <ElementTracker> or <ThreeImage>, which is what registers it with
 * the scene. Anything that never reaches the DOM is invisible to the canvas.
 */
export default defineContentConfig({
  collections: {
    /** The home page: hero copy and the section headings around the work. */
    home: defineCollection({
      type: 'data',
      source: 'home.yml',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        hero: z.object({
          lead: z.string(),
          accent: z.string(),
          cta: z.object({ label: z.string(), to: z.string() }),
        }),
        /** The running band between the hero and the work. */
        marquee: z.array(z.string()),
        work: z.object({
          eyebrow: z.string(),
          heading: z.string(),
        }),
        /** The about section after the work; its text is about.md's. */
        about: z.object({
          eyebrow: z.string(),
        }),
        /** The footer, rendered on every page. */
        contact: z.object({
          eyebrow: z.string(),
          heading: z.string(),
          email: z.string(),
          name: z.string(),
          links: z.array(z.object({ label: z.string(), to: z.string() })),
          backToTop: z.string(),
        }),
      }),
    }),

    /**
     * One file per project. `order` drives the sequence on the home page;
     * `image` is a path under public/. `website` is the project's own site,
     * shown beside the rating; `links` are shown on the line under it (a
     * store page, a repository, a video), each with an optional icon, a
     * language flag and a place on the card; `gallery` is a set of
     * further images after the body, each a ThreeImage like the lead one, so
     * they get the same treatment. A `wide` item spans two columns;
     * `galleryColumns: 3` shows them small.
     */
    projects: defineCollection({
      type: 'page',
      source: 'projects/*.md',
      schema: z.object({
        title: z.string(),
        summary: z.string(),
        image: z.string(),
        imageAlt: z.string(),
        year: z.string(),
        role: z.string(),
        order: z.number(),
        /** Which schema.org type the project page's JSON-LD describes it as,
         * so a rated app, a game and a film each get the right rich result.
         * Defaults to a plain CreativeWork. */
        schemaType: z
          .enum([
            'SoftwareApplication',
            'VideoObject',
            'VideoGame',
            'CreativeWork',
          ])
          .optional(),
        /** The work's own date, ISO (yyyy-mm-dd), where the year is not
         * enough — a VideoObject's uploadDate, an app's datePublished. */
        date: z.string().optional(),
        /** A video's running time, ISO 8601 duration (e.g. PT2H). */
        duration: z.string().optional(),
        /** The application category / game platform, where the type wants one. */
        operatingSystem: z.string().optional(),
        /** A separate image for the home page card, for when the cover crop
         * of `image` is not the right picture (a screenshot with a side panel,
         * say). The project page always shows `image`. */
        card: z.string().optional(),
        /** Where the card's crop sits when its image is not 16:9, as CSS
         * `object-position` ('50% 50%' is the centre). */
        imagePosition: z.string().optional(),
        /** The project's own site, labelled with its host. */
        website: z.string().optional(),
        /** A link carries an optional mark: `icon` names where it goes
         * (`youtube`, `game`), `lang` the language of what is there as a BCP 47 tag
         * (`fi` draws the Finnish flag, and the anchor gets `hreflang`).
         * `card: true` shows it on the home page card too, beside "Read
         * more" — for the one link that is the work itself, a film say. */
        links: z
          .array(
            z.object({
              label: z.string(),
              to: z.string(),
              /** A shorter label for a phone, where the card's row is tight. */
              short: z.string().optional(),
              icon: z.enum(['youtube', 'game']).optional(),
              lang: z.enum(['fi']).optional(),
              card: z.boolean().optional(),
            }),
          )
          .optional(),
        /** A store rating out of five, shown on the card and beside the
         * links on the project page: the score as written and where it is
         * from — one store, or a list when the stores agree. */
        rating: z
          .object({
            value: z.string(),
            source: z.union([z.string(), z.array(z.string())]).optional(),
          })
          .optional(),
        galleryTitle: z.string().optional(),
        /** How many columns the gallery has from `md` up: 2 (the default,
         * one column on a phone) for photographs, 3 (two on a phone) for
         * stills and other things meant to be seen small. */
        galleryColumns: z.union([z.literal(2), z.literal(3)]).optional(),
        gallery: z
          .array(
            z.object({
              image: z.string(),
              imageAlt: z.string(),
              wide: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    }),

    /**
     * The about section of the home page: frontmatter for the standfirst,
     * the portrait (a path under public/), the place and the offer; markdown
     * body for the prose. The place, the availability and the offers are
     * rendered after the prose and also go into the home page's JSON-LD
     * Person and into llms.txt, so search engines and AI answer engines can
     * match the work to the area.
     */
    about: defineCollection({
      type: 'page',
      source: 'about.md',
      schema: z.object({
        standfirst: z.string(),
        image: z.string(),
        imageAlt: z.string(),
        /** The occupation, as a search engine names it. */
        jobTitle: z.string(),
        /** The degree: its name, the programme, the major and the school,
         * for the Person's credential in the structured data. On the page
         * it is a sentence of the availability paragraph. */
        education: z.object({
          degree: z.string(),
          field: z.string(),
          major: z.string().optional(),
          school: z.string(),
          schoolUrl: z.string().optional(),
          /** The year of graduation, quoted, for the credential's date. */
          year: z.string().optional(),
        }),
        /** Where I am: the Person's postal address in the structured data. */
        location: z.object({
          city: z.string(),
          region: z.string(),
          country: z.string(),
          /** ISO 3166-1 alpha-2, for `addressCountry`. */
          countryCode: z.string(),
        }),
        /** The cities the work is offered in. */
        areaServed: z.array(z.string()),
        /** One paragraph on the degree, where I work and what I take on, in
         * English and in Finnish: the Finnish one is what a Finnish search
         * finds. */
        availability: z.object({ en: z.string(), fi: z.string() }),
        /** What the structured data lists as known, beyond the marquee. */
        skills: z.array(z.string()),
        /** The list under the prose; each item is one service, a colon
         * separating a short name from the rest. */
        offersTitle: z.string(),
        offers: z.array(z.string()),
      }),
    }),
  },
})
