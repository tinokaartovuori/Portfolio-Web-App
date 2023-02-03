# Portfolio Web App - Tino Kaartovuori

> This project is in "Work in Progess" state

Link for the site will be provided when the project is ready to share

Welcome to my personal portfolio project!

This project is built using the following technologies:

- Nuxt.js 3: A framework for creating server-rendered Vue.js applications
- TypeScript: A typed superset of JavaScript that adds optional static typing to the language
- TailwindCSS: A utility-first CSS framework
- Three.js: A JavaScript library for creating 3D animations and visualizations

## Commands

- `npm run build`: Builds the project for production
- `npm run dev`: Runs the project in development mode with hot-reloading enabled
- `npm run generate`: Generates a static version of the site for deployment
- `npm run preview`: Runs the project in development mode and opens it in a browser
- `npm run postinstall`: Runs automatically after installation to prepare the project for development
- `npm run format`: Runs Prettier and formats all project files to correct style

## Usage

To run this project locally, clone the repository and install the dependencies by running:
`npm install`

Then you can use the commands listed above to run the project in development mode or build it for production.

## Progress so far

<details>
  <summary>26.1.2023</summary>
  </br>

![](https://github.com/tinokaartovuori/my-portfolio/blob/main/documentation/progress/gifs/2023-01-26-portfolio-ui.gif)

Added some nice sticky UI elements. Three.js scene will be added as background later and on top of that there will be scrollable HTML content. The scroll will be synced between the Three.js scene and HTML content and it will make a very cool effect.

Z-layer: `Sticky UI Elements` <- ( `HTML Content` <- `Three.js Scene` ) < These will have synced scroll behaivour

</details>

<details>
  <summary>1.2.2023</summary>
  </br>

![](https://github.com/tinokaartovuori/my-portfolio/blob/main/documentation/progress/gifs/2023-02-01-portfolio-ui.gif)

- [x] Implemented dark and light mode (`TailwindCSS` and `@nuxtjs/color-mode`)
- [x] Added test canvas
- [x] Used `smooth-scrollbar` and `gsap ticker` to make custom scrolling behaviour
- [x] fix: Reimplemented animated texts with gsap

</details>

<details>
  <summary>1.2.2023</summary>
  </br>

![](https://github.com/tinokaartovuori/my-portfolio/blob/main/documentation/progress/gifs/2023-02-04-portfolio-ui.gif)

- [x] Replaced the previous canvas with Three.js version and made a prototype rounded rectangle in the scene that moves with the scroll
- [x] Made a fun custom scrollbar track
- [x] More responsive design
- [x] fix: Reimplemented toggle switch with gsap

</details>

## Other

### License

This project is licensed under the MIT license. Please see the LICENSE file for more information.

### Author

This project was created by Tino Kaartovuori

Enjoy!
