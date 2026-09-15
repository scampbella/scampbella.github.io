# Instructions: Build a Browser-Based Mining Clicker Game

Build a complete, browser-based mining clicker game using HTML, CSS, and JavaScript. The game must use `localStorage` for saving progress.

## 1. Game Concept & Core Loop
The player clicks a central rock to mine Ore, sells Ore for Gold, buys upgrades, and unlocks new zones.
- **Core Loop**: Mine (Ore Per Click) -> Sell (Zone Rate) -> Upgrade Pickaxe/Miners -> Unlock Next Zone.
- **No Enemies**: This is a pure collection and optimization game.

## 2. Zones & Progression
- There are **8 Zones** in total.
- **Unlocking**: To unlock the next zone, the player must pay a specific amount of Gold AND Ore from the previous zone.
- **Miner Persistence**: Auto-Miners bought for a zone stay there permanently, generating passive income across all unlocked zones.

## 3. Mechanics
### Pickaxe (Active Mining)
- **OPC (Ore Per Click)**: 1 Ore per Click per Pickaxe Level (e.g., Level 50 = 50 OPC).
- **Max Level**: 200 per zone.
- **Upgrade Cost**: Exponential scaling. Formula: `Base_Cost * 1.25^Current_Level`.
- **Scaling**: By Zone 8, Pickaxe costs and Gold amounts should reach into the Trillions.

### Auto-Miners (Passive Mining)
- **Slots**: Each new zone grants +1 Miner Slot (Zone 1 = 1 slot, Zone 8 = 8 slots total).
- **Tiers**:
  - **Goblins**: Unlocked at Zone 2.
  - **Dwarves**: Unlocked at Zone 4.
  - **Drills**: Unlocked at Zone 6.
- **Cost**: Miners are bought with Gold. Implement **Click Parity**: The cost of a miner should scale with the Zone's Sell Rate so that it takes roughly the same amount of time (e.g., ~1 minute of clicking) to earn enough for a miner, regardless of the zone.

## 4. Economy
- **Sell Rates**: The value of Ore scales per zone.
  - Zone 1: 1 Gold per Ore
  - Zone 8: 200 Gold per Ore
  - (Scale linearly or slightly exponentially between Z1 and Z8).
- **Number Formatting**: Format all large numbers using standard suffixes: `K` (thousands), `M` (millions), `B` (billions), `T` (trillions).

## 5. UI Layout (Grid System)
The interface should be a responsive grid:
- **Top**: A bar containing a clickable list of all 8 Zones. Show a visual indicator of which zone is active and if the next zone is unlocked/locked.
- **Left Panel**: **Inventory & Selling**. Displays current Ore stock, Gold, and a "Sell" button (or auto-sell toggle) showing the current Zone Sell Rate.
- **Right Panel**: **Shop**. Displays the Pickaxe Upgrade button (with cost and current level) and the Auto-Miner purchase buttons (showing available slots and tier).
- **Center**: **The Rock**. A large, clickable geometric shape. Directly above or below it, display "Active: X Ore/Click" and "Passive: Y Ore/Minute".

## 6. Visuals & Aesthetics
- **Placeholder Graphics**: Do not use sprites or external images. Use CSS-styled geometric shapes with different colors to represent game elements.
- **The Rock**: A large, distinct polygon or circle in the center.
- **Miners**: Represented by small colored shapes in the shop/UI.
- **Theme**: Clean, readable UI with a focus on the layout and numbers.

## 7. Technical Requirements
- Use vanilla JavaScript, HTML, and CSS.
- Implement a robust `localStorage` save/load system (auto-save every 30 seconds and on page close).
- Ensure the game loop handles passive income correctly (tick-based or delta-time based).