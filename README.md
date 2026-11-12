# Thiel Network Map

An interactive map of the people, companies and projects connected to Peter Thiel, as described in *The Nerd Reich* by Gil Duran.

## Using it

- Hover a card to trace its connections; click it to pin it and read the details. Clicking any badge, filter chip or government count spotlights the matching cards; click it again to clear.
- With a card pinned, **How is it connected to…** finds the chain between two cards, with or without going through Thiel.
- The address bar mirrors the view, so any view can be shared, for example `#card=Yarvin&to=Vance`, `#filter=crypto` or `#q=greenland`.
- Shortcuts: `/` search, `L` legend, `D` details panel, `?` help, `Esc` clear.

## Files

- `index.html`: the interactive page. Open it in a browser; no build or internet needed. It loads the three files below from the same folder, so keep them together.
- `data.js`: all map content (people, connections, sources, Wikipedia names, summary facts). Edit content here.
- `app.js`: behaviour. Each kind of badge, detail block and filter chip is one entry in `FACETS`; kinds of government reach are in `GOV`.
- `styles.css`: look and feel. Light/dark colours are defined once each with `light-dark()`; category text colours are checked for WCAG 2.1 AA contrast.
- `bump-version.js`: `node bump-version.js 1.17` updates the version shown in the header and in the `?v=` cache-busting suffix on the three files above (do this on every release so browsers never mix new and cached old files).
- `social.png`: the preview image shown when the site is shared.

## Checks

- `node check.js` validates `data.js` (every connection points at a real card, no duplicates, nothing orphaned, fields have the right shape).
- `tests/smoke.html` loads the real page in a frame and exercises filters, search, pinning, paths and the address bar. Open it in a browser; the title becomes PASS or FAIL.
- `node check-links.js` confirms every Wikipedia link still resolves.
- `.github/workflows/checks.yml` runs all three on GitHub (the link check weekly).

The source book is not in this repository (it is copyrighted); `.gitignore` keeps any local copy out.
