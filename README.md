# Coffee Shop menu poster

A portrait **Menu & Price List** recreated from the reference using HTML, CSS and a small amount of vanilla JavaScript. The coffee cups—including the oversized, cropped hero cup—are drawn with CSS gradients and shapes; no image assets are required.

- `index.html` — accessible poster structure, eight drinks, brand copy, and the full-screen detail view
- `style.css` — 4:5 responsive layout, typography, coffee-cup artwork, hover states, and the full-screen reveal
- `app.js` — fills the full-screen view from the selected menu item, handles open/close, focus, and the order button

## Interactions

**Hover a menu item** to lift it off the paper: the tile warms up, a hairline of light draws across the top, the cup floats, the price becomes an ink pill, and the other drinks recede. Keyboard focus produces the same state.

**Click a menu item** and the poster dissolves into a full-screen view of that drink. The right side shows the cup artwork together with the drink's number, type and name; the left side holds its description, tasting notes, intensity, volume, serve temperature, price and the add-to-order button. On narrow screens the artwork stacks above the text. Close with the round button or `Esc`; `Tab` stays inside the view and focus returns to the menu item.

`prefers-reduced-motion` swaps the zoom-in reveal for a plain fade.

## Run

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

The poster keeps its original two-column composition at every size and scales proportionally to fit the viewport. The detail view is always full-screen; below 900px it becomes a single, scrollable column.
