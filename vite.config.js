// Vite reads this file when you run `npm run dev`, `npm run build` or `npm run deploy`.
//
// base: './' makes every path in the built site RELATIVE (./assets/x.js) instead of
// absolute (/assets/x.js). GitHub Pages serves your site from a subfolder
// (yourname.github.io/orb-seeker/), so absolute paths would look for /assets/...
// at the domain root and 404. This one line is what makes Pages work.
export default {
  base: './',
};
