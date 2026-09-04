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
        work: z.object({
          eyebrow: z.string(),
          heading: z.string(),
        }),
      }),
    }),

    /**
     * One file per project. `order` drives the sequence on the home page;
     * `image` is a path under public/.
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
        link: z.string().optional(),
      }),
    }),

    /** The about page: frontmatter for the standfirst, markdown body for prose. */
    about: defineCollection({
      type: 'page',
      source: 'about.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        standfirst: z.string(),
      }),
    }),
  },
})
