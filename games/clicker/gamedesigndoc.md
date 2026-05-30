# Mining Clicker Game Design Document

## 1. Core Gameplay Loop
The player progresses through **8 distinct zones**, focusing on breaking rocks, collecting resources, and upgrading their equipment.

1.  **Mine:** Click the **Mother Lode** (Central Rock) to deal damage.
2.  **Break:** When the rock's **HP hits 0**, it shatters and drops **Ore** (Roll: min–max).
3.  **Inventory:** Ore is added to the inventory.
4.  **Sell:** Sell ore for **Gold**.
5.  **Upgrade:** Spend Gold and Ore to improve tools.
    *   **Pickaxe:** Increases damage.
    *   **Auto-Miners:** Add passive income.
6.  **Repeat:** Continue mining until zone completion criteria are met.

## 2. Zone Progression
*   **Total Zones:** 8.
*   **Unlock Cost:** To enter a new zone, the player must pay a specific amount of **Gold** + **Ore from the Previous Zone**.
*   **Miner Reset (The "Left Behind" Mechanic):** When a player unlocks a new zone, all Auto-Miners (Goblins, Dwarves, Drills) are left behind in the previous zone (but still operate). The player starts the new zone with only their Pickaxe.
*   **Pickaxe Cap:** Each zone has a limit on Pickaxe levels by design (cost includes ores from next area).

## 3. Mining Mechanics
*   **The Mother Lode:** A single central rock with a fixed **HP** value.
*   **Damage:** Determined by the player's **Pickaxe Level**.
*   **Loot Table:** Upon breaking the rock, the player receives a random amount of Ore (Range: min–max).
*   **Ore Usage:** Ore serves as both a currency (sold for Gold) and a crafting material (required for upgrades).

## 4. Upgrades

### Pickaxes
*   **Function:** Increases damage dealt to the Mother Lode.
*   **Cost:** Requires **Gold** + **Current Zone Ore**.
*   **Visuals:** The pickaxe icon matches the color of the current zone's ore.

### Auto-Miners
*   **Function:** Generate Ore passively.
*   **Visuals:** Miners are depicted working on separate, smaller piles of rocks in the background. They do not attack the Mother Lode.
*   **Tiers:**
    *   **Goblins:** Unlocked in **Zone 2**.
    *   **Dwarves:** Unlocked in **Zone 4**.
    *   **Drills:** Unlocked in **Zone 6**.

## 5. Power-Up System
Floating items spawn randomly every **3–5 minutes**. Clicking them applies a temporary buff.

| Power-Up Name | Effect | Duration |
| :--- | :--- | :--- |
| **Sharp Pick** | **5x Click Damage** | 30 Seconds |
| **Merchant's Favor** | **2x Sell Value** | 10 Seconds |
| **Overdrive** | **2x Auto-Miner Speed** | 5 Minutes |

## 6. Technical & Visual Notes
*   **Platform:** Browser-based static site.
*   **Visual Style:** Pixel art.
*   **Persistence:** Game state (Gold, Inventory, Levels) should be saved to `localStorage`.
*   **Sprite Logic:**
    *   **Player:** Focuses on the center rock (Mother Lode).
    *   **Miners:** Focus on background piles to avoid collision/clutter issues with the main rock.