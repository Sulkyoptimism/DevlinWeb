// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Liam Devlin"
export const GITHUB = "tadgem"
export const SITE_DESCRIPTION = "Liam's CV & Experience"
export const MY_NAME = "Liam Devlin"

// setup in astro.config.mjs
const BASE_URL = new URL(import.meta.env.SITE)
export const SITE_URL = BASE_URL.origin
