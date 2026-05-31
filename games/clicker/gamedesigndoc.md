# Mining Clicker Game Design Document

## 1. Core Gameplay Loop
The player progresses through **8 distinct zones**, focusing on collecting resources, upgrading their equipment, and managing economy.

1.  **Mine:** Click the **Mother Lode** (Central Rock) to instantly gain Ore.
    *   **Yield:** Ore gained equals your current **Pickaxe Level** (e.g., Level 1 = 1 Ore/Click, Level 200 = 200 Ore/Click).
2.  **Inventory:** Ore is added to the inventory immediately.
3.  **Sell:** Sell ore for **Gold**.
    *   **Sell Rate:** Fixed per zone (e.g., Zone 1 = 1g, Zone 8 = 200g).
4.  **Upgrade:** Spend Gold to improve tools.
    *   **Pickaxe:** Increases Ore Per Click (OPC).
    *   **Auto-Miners:** Hire miners for passive income.
5.  **Repeat:** Continue mining until zone completion criteria are met.

## 2. Zone Progression
*   **Total Zones:** 8.
*   **Unlock Cost:** To enter a new zone, the player must pay a specific amount of **Gold** + **Ore from the Previous Zone**.
*   **Miner Reset (The "Left Behind" Mechanic):** When a player unlocks a new zone, all Auto-Miners are left behind in the previous zone (but still operate). The player starts the new zone with only their Pickaxe.
*   **Pickaxe Cap:** Each zone has a maximum Pickaxe Level of **200**.
*   **Number Formatting:** Large numbers are abbreviated using **K** (Thousands), **M** (Millions), **B** (Billions), and **T** (Trillions).

## 3. Mining Mechanics
*   **The Mother Lode:** A single central rock is what players click and mine.
*   **Instant Yield:** There is no Rock HP. Every click yields resources instantly based on Pickaxe Level.
*   **Ore Usage:** Ore serves as both a currency (sold for Gold) and a progression gate (required for zone unlocks).

## 4. Upgrades

### Pickaxes
*   **Function:** Increases Ore Per Click (OPC).
*   **Max Level:** 200 per Zone.
*   **Cost Scaling:** Exponential.
    *   **Formula:** `Cost = Base_Cost × (1.25 ^ Current_Level)`
    *   **Result:** Costs start small but reach **Trillions** by Level 200 in the final zones.
*   **Visuals:** The pickaxe icon matches the color of the current zone's ore.

### Auto-Miners
*   **Function:** Generate Ore passively.
*   **Hiring:** Miners are **bought** with Gold, not free rewards.
    *   **First Miner Cost:** Roughly 1 minute of active clicking at Level 1.
    *   **Scaling:** Each subsequent miner costs **1.5x** the previous one.
*   **Slots:** You gain **+1 Miner Slot** per zone (starting Zone 2).
*   **Tiers:**
    *   **Goblins:** Unlocked in **Zone 2** (Low cost, low yield).
    *   **Dwarves:** Unlocked in **Zone 4** (Medium cost, medium yield).
    *   **Drills:** Unlocked in **Zone 6** (High cost, high yield).
*   **Visuals:** Miners are depicted working on separate, smaller piles of rocks in the background. They do not attack the Mother Lode.

## 5. Economy
*   **Sell Rate Scaling:** The value of Ore increases per zone to match the escalating costs.
    *   *Example:* Zone 1 sells for 1g, Zone 8 sells for 200g.
*   **Click Parity:** Upgrade and Miner costs scale with the Sell Rate. This ensures that the *time* to buy an upgrade remains roughly consistent across zones, even as the *numbers* get massive.

## 6. Power-Up System
Floating items spawn randomly every **3–5 minutes**. Clicking them applies a temporary buff.

| Power-Up Name | Effect | Duration |
| :--- | :--- | :--- |
| **Sharp Pick** | **5x Ore Per Click** | 30 Seconds |
| **Merchant's Favor** | **2x Sell Value** | 10 Seconds |
| **Overdrive** | **2x Auto-Miner Speed** | 5 Minutes |

## 7. Technical & Visual Notes
*   **Platform:** Browser-based static site.
*   **Visual Style:** Pixel art.
*   **Persistence:** Game state (Gold, Inventory, Levels, Miners) should be saved to `localStorage`.
*   **Sprite Logic:**
    *   **Player:** Focuses on the center rock (Mother Lode).
    *   **Miners:** Focus on background piles to avoid collision/clutter issues with the main rock.