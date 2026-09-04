# Editing the site

Everything visible on the site is in this folder. Change a file, save, and the
page updates — no component edits, no rebuild step in development.

## Where things live

| File            | What it controls                                                                |
| --------------- | ------------------------------------------------------------------------------- |
| `home.yml`      | The headline, the line under it, the button, the section heading above the work |
| `projects/*.md` | One file per project. Frontmatter is the card; the body is the project page     |
| `about.md`      | The about page — frontmatter for the standfirst, body for the prose             |

## Adding a project

Copy any file in `projects/` and change the frontmatter. The number prefix in
the filename (`1.aurora.md`) is only for ordering the files on disk; the `order`
field is what actually sorts them on the page. The URL comes from the filename,
so `projects/2.tidal.md` is served at `/projects/tidal`.

```yaml
---
title: Tidal
summary: One sentence, shown on the card. Aim for under 140 characters.
image: /images/work-02.png # a file in public/images
imageAlt: What the image shows, for screen readers and when it fails to load
year: '2024' # quoted, so it stays a string
role: Frontend architecture
order: 2 # lower numbers come first
---
Markdown body. This becomes the project page.
```

Every field is required except `link`. If you leave one out, the dev server
prints a validation error naming the file and the field rather than failing
silently — that is what `content.config.ts` is for.

## Adding an image

Drop the file in `public/images/` and reference it as `/images/your-file.png`.

Two things to know, because the WebGL layer renders these rather than the
browser:

- **Keep it same-origin.** Images are loaded into a WebGL texture, so a
  cross-origin URL without CORS headers fails to load and the card collapses to
  nothing. Files in `public/` are always fine.
- **Landscape, and reasonably large.** The layout gives them a wide box, and the
  shader crops in slightly. Around 1600×1000 is a good target.

## Why the images look odd in the page source

Each one renders as a real `<img>` at `opacity: 0`, and a mesh is pinned to its
box. That is deliberate: the DOM stays the source of truth for layout,
accessibility and search, and the canvas reads its geometry from it. With
JavaScript or WebGL unavailable, the page is still a working portfolio.

The current text and images are **sample content**. Replace them.
