# Editing the site

Everything visible on the site is in this folder. Change a file, save, and the
page updates — no component edits, no rebuild step in development.

## Where things live

| File            | What it controls                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `home.yml`      | The headline, the line under it, the button, the running band of words, the section heading above the work, the about eyebrow, the footer |
| `projects/*.md` | One file per project. Frontmatter is the card; the body is the project page                                                               |
| `about.md`      | The about section — frontmatter for the standfirst and the portrait, body for the prose                                                   |

The footer (`contact` in `home.yml`) appears on every page: the heading, the
email address, the links and the "back to top" label are all there.

## Adding a project

Copy any file in `projects/` and change the frontmatter. The number prefix in
the filename (`1.aurora.md`) is only for ordering the files on disk; the `order`
field is what actually sorts them on the page. The URL comes from the filename,
so `projects/2.tidal.md` is served at `/projects/tidal`.

```yaml
---
title: A 3D-printed film camera
summary: One sentence, shown on the card. Aim for under 140 characters.
image: /images/pinhole-camera.jpg # a file in public/images
imageAlt: What the image shows, for screen readers and when it fails to load
year: '2022' # quoted, so it stays a string
role: Design, engineering and print
order: 2 # lower numbers come first
# Optional. The card on the home page is always 16:9 and crops the image to
# fit; this says which part to keep when the file is wider or taller, as CSS
# object-position. '50% 50%' (the centre) if left out.
imagePosition: 40% 50%
# Optional. A different picture for the card, when no crop of `image` is the
# right one (a screenshot with a side panel, say). Best made 16:9 already.
card: /images/colonizing-pirkanmaa-card.jpg
# Optional: how search engines and AI describe this project, in the page's
# structured data (JSON-LD). Pick the one that fits — an app on stores,
# a film on YouTube, something to play, or a plain piece of work — and it gets
# the matching rich result. Defaults to CreativeWork.
schemaType: SoftwareApplication # or VideoObject, VideoGame, CreativeWork
# Optional: a fuller date than the year (yyyy-mm-dd) — a film's upload date,
# an app's release date. And, for a film, its running time as an ISO duration.
date: 2023-05-01
duration: PT2H
# Optional: the platform, where the type wants one — "iOS, Android" for an
# app, "Web browser" for a game.
operatingSystem: iOS, Android
# Optional: the project's own site, shown beside the rating on the project
# page with its host as the label ("auroracompass.com"). Opens in a new tab.
website: https://auroracompass.com/
# Optional: links on the line under it (a store page, a repository, a video).
# They open in a new tab. A link can carry an `icon` for where it goes
# (`youtube`, or `game` for something to play), a `lang` for the language of what is there (`fi` draws
# the Finnish flag after the label), and `card: true` to show it on the home
# page card too, beside "Read more" — for the one link that is the work
# itself, a film say. A card link wants a `short` label as well: on a phone
# the card's row is too narrow for the long one beside "Read more".
links:
  - label: App Store
    to: https://apps.apple.com/app/aurora-compass/id6446504259
  - label: Watch on YouTube
    short: Watch
    to: https://youtu.be/mp-44MlWYC8
    icon: youtube
    lang: fi
    card: true
# Optional: a store rating out of five, shown on the card and beside the links
# on the project page. `value` is quoted so 4.0 stays "4.0"; `source` is one
# store, or a list when the stores agree on the score.
rating:
  value: '4.9'
  source:
    - App Store
    - Google Play
# Optional: more images after the body, in two columns from tablet width up.
# `wide: true` makes one span both columns; a landscape image usually wants it.
# `galleryColumns: 3` shows them small — three columns, two on a phone — for
# stills from a film; there `wide` spans two of the three.
galleryTitle: Shot on it
gallery:
  - image: /images/pinhole-01.jpg
    imageAlt: A pine leaning over a snowy shore at dusk
  - image: /images/pinhole-02.jpg
    imageAlt: Apartment blocks in low evening sun
    wide: true
---
Markdown body. This becomes the project page.
```

Every field is required except `schemaType`, `date`, `duration`,
`operatingSystem`, `card`, `imagePosition`, `website`, `links`, `rating`,
`galleryTitle`, `galleryColumns` and `gallery`. If you leave a required one
out, the dev server prints a validation error naming the file and the field
rather than failing silently — that is what `content.config.ts` is for.

A video does not go in `public/` — a film is far too large for that. Put it on
YouTube or Vimeo, use a still from it as the project `image`, and put the
video's address in `links`.

## Adding an image

Drop the file in `public/images/` and reference it as `/images/your-file.png`.
Nothing else: the build makes the small, fast versions (AVIF and WebP at
several widths, a social-share crop, the browser tab icons) from it on its
own, into `public/images/gen/` and `public/images/og/`, which are not checked
in. Just add the one original.

Two things to know, because the WebGL layer renders these rather than the
browser:

- **Keep it same-origin.** Images are loaded into a WebGL texture, so a
  cross-origin URL without CORS headers fails to load and the card collapses to
  nothing. Files in `public/` are always fine.
- **Landscape, and reasonably large.** The card on the home page is 16:9 and
  crops the image to fit (see `imagePosition`); the project page shows it
  whole. Around 2000×1125 is a good target for a project image. Gallery images
  keep their own shape, so a portrait photograph is fine there; around 2000 px
  on the long side.

## Why the images look odd in the page source

Each one renders as a real `<img>` (a `<picture>` with several formats and
sizes), and a mesh is pinned to its box. The photograph loads and shows like
on any page; once the WebGL layer is ready it draws the same image and the
`<img>` fades out under it, so there is no flash and nothing loads twice. That
is deliberate: the DOM stays the source of truth for layout, accessibility and
search, and the canvas reads its geometry from it. With JavaScript or WebGL
unavailable, the page is still a working portfolio with its photographs.

The copy and the images are the real ones now (since September 2026). One
thing is left: the LinkedIn address in `home.yml` is a placeholder. The film
project in `projects/3.philippines.md` has stills from the film as its
gallery, shown small; there are few photographs from the trip, and the body
says so.
