# Coffee Shop menu poster

A portrait **Menu & Price List** recreated from the reference using HTML, CSS and a small amount of vanilla JavaScript. The coffee cups—including the oversized, cropped hero cup—are drawn with CSS gradients and shapes; no image assets are required.

- `index.html` — accessible poster structure, eight drinks, brand copy, and the full-screen detail view
- `style.css` — 4:5 responsive layout, typography, coffee-cup artwork, hover states, and the full-screen reveal
- `app.js` — fills the full-screen view from the selected menu item, handles open/close, focus, and the order button

## Interactions

**Hover a menu item** to lift it off the paper: the tile warms up, the cup settles deeper into the card on a soft shadow, the price becomes an ink pill, and the other drinks recede. Keyboard focus produces the same state. No rule or line is drawn along the top of the tile, and the cup never crosses its edge.

**Click a menu item** and the poster dissolves into a full-screen view of that drink. The right side shows the cup artwork together with the drink's number, type and name; the left side holds its description, tasting notes, intensity, volume, serve temperature, price and the add-to-order button. On narrow screens the artwork stacks above the text. Close with the round button or `Esc`; `Tab` stays inside the view and focus returns to the menu item.

`prefers-reduced-motion` swaps the zoom-in reveal for a plain fade.

## Run

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Above 900px wide (and 800px tall) the poster keeps its original two-column composition and scales proportionally to fit the viewport. Below those sizes it unfolds into a normal scrollable page: the brand panel becomes a header (logo, tagline and the oversized cup) and a footer (description and slogan) around the menu, the menu turns into readable cards — a single column on phones and two on tablets — and every size is fluid with `clamp()` instead of container-relative units. The detail view is always full-screen; below 900px it becomes a single, scrollable column.
