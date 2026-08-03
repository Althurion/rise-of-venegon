# Actor artwork

Actor artwork is intentionally separated from actor mechanics.

Add portrait and token files beneath this directory, then add an entry to
`source/art-map.json` using the actor slug:

```json
{
  "borrowed-veil-runner": {
    "img": "modules/rise-of-venegon/assets/portraits/borrowed-veil-runner.webp",
    "token": "modules/rise-of-venegon/assets/tokens/borrowed-veil-runner.webp"
  }
}
```

For an actor with a wildcard token set, keep `img` as one concrete image for
the actor sheet, set `token` to a module-relative wildcard pattern, and enable
`randomImg`:

```json
{
  "deepwatch-commoner": {
    "img": "modules/rise-of-venegon/assets/tokens/deepwatch/deepwatch-commoner/deepwatch-commoner-01.png",
    "token": "modules/rise-of-venegon/assets/tokens/deepwatch/deepwatch-commoner/*.png",
    "randomImg": true
  }
}
```

Foundry resolves the wildcard only when a new prototype token is placed. The
actor portrait must therefore never contain `*`.

Run `npm run build` after changing the art map. Actors without an art-map entry
retain Foundry's neutral placeholder image.
