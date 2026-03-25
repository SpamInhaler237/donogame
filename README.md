# Voidforge Shrine

Dark fantasy Roblox donation site for `1_xLow`.

## What changed

- Free path is now `1 click = 1 damage`
- Donation flow now pushes users to `PLS DONATE`
- The tracked game data still comes from `40 percent method`
- The site has separate game and donation tabs
- The live donor board is still powered by `/api/donations`

## Commands

```bash
npm run fetch:data
npm run start
```

## Webhook secret

Use this same secret in WispByte and Roblox:

```text
7bd4fcb64d3ce8f351b715a86629961d5f6d34052ff3f7cc5185692102fca76f
```

## WispByte

See [WISPBYTE_SETUP.md](/Users/hayden/Downloads/rpg-damage-donation-site/WISPBYTE_SETUP.md).

## Roblox hookup

- Put [DonationWebhook.server.lua](/Users/hayden/Downloads/rpg-damage-donation-site/roblox/DonationWebhook.server.lua) in `ServerScriptService`
- Put [GamepassDamageMap.lua](/Users/hayden/Downloads/rpg-damage-donation-site/roblox/GamepassDamageMap.lua) in a `ModuleScript` named `GamepassDamageMap`
- Replace the webhook URL with your public WispByte URL plus `/api/donations`

## Local test

```bash
curl -X POST http://localhost:4173/api/donations \
  -H "Content-Type: application/json" \
  -H "x-donation-secret: 7bd4fcb64d3ce8f351b715a86629961d5f6d34052ff3f7cc5185692102fca76f" \
  -d '{"userId":1,"username":"Builderman","displayName":"Builderman","amount":100,"productId":1739343098,"productName":"100","productType":"gamepass","source":"test"}'
```
