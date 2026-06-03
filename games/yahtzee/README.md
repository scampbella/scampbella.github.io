# Yahtzee

BBG-ruleset with solo and 1v1 versus Keiri bot.

```
node build.mjs   # compile src/*.ts → game.js
```

`game.js` is committed — no build step needed on deploy.

## Verify before pushing

- [ ] `node build.mjs` — no errors
- [ ] Solo: roll, lock, score, game-over works
- [ ] "Challenge Keiri" → bot turn plays, mode toggles back
- [ ] `game.js` is committed
