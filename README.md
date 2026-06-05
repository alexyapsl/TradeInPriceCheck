# TradeInPriceCheck

Instant trade-in estimator for Samsung Galaxy devices (Hong Kong / Macau models).

Live demo: https://alexyapsl.github.io/TradeInPriceCheck

## Features

- Select your current device (brand → model → storage)
- Get instant trade-in value (HK/Macau models only)
- See 3 recommended upgrade options with full pricing math:
  - Original price
  - Trade-in credit deducted
  - Final "You pay after trade-in" amount
- Samsung-style UI with color chips
- Mobile responsive

## Files

- `tradein.html` — Main estimator page
- `devices.json` — Trade-in prices (HK/Macau only)

## How to Update Prices

1. Edit `devices.json`
2. Add or update entries with this format:
   ```json
   {
     "brand": "Samsung",
     "model": "Galaxy S25 Ultra",
     "storage": "256GB",
     "purchased_from": "Hong Kong/Macau",
     "trade_in_price": 680
   }
   ```
3. Commit and push — GitHub Pages will auto-update

## Recommended Products

Currently featuring:
- Galaxy S26 Ultra (512GB)
- Galaxy Z Flip7 (256GB)
- Galaxy S26 (256GB)

Update prices or links in the `recommendedProducts` array inside `tradein.html`.

## Deployment

Hosted via GitHub Pages on the `main` branch.

---

Built for quick trade-in quotes. All values in HKD.