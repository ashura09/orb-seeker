# public/

Files here are copied to the site root as-is, with their names unchanged.
That matters for a PWA: the browser looks for these at exact paths.

From orb-seeker-site.zip, this folder needs:

    manifest.webmanifest
    sw.js
    icons/          (the whole folder, not its contents)

Do NOT put index.html here — it belongs in the project root.
