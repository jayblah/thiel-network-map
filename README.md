# Thiel Network Map

An interactive map of the people, companies and projects connected to Peter Thiel, as described in *The Nerd Reich* by Gil Duran.

- `index.html`: the interactive page. Open it in a browser; no build or internet needed. It loads the three files below from the same folder, so keep them together.
- `data.js`: all map content (people, links, sources, Wikipedia names, summary facts). Edit content here.
- `bump-version.js`: `node bump-version.js 1.17` updates the version shown in the header and in the `?v=` cache-busting suffix on the three files above (do this on every release so browsers never mix new and cached old files).
- `app.js`: behaviour. Each kind of badge, detail block and filter chip is one entry in `FACETS`; kinds of government reach are in `GOV`.
- `styles.css`: look and feel. Light/dark colours are defined once each with `light-dark()`; category text colours are checked for WCAG 2.1 AA contrast.

**Source and caveats.** Every relationship, funding figure and characterization comes from that one book and reflects its author's account and framing, not independent verification. Labels such as "anti-democracy views" are the book's description of a person, not necessarily their own. Wikipedia links were checked to point at the right person or organization, but not every card has one.
