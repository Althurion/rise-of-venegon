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

Run `npm run build` after changing the art map. Actors without an art-map entry
retain Foundry's neutral placeholder image.
