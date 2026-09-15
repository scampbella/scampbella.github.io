const ZONES = BALANCE.zones;

let state = {
    gold: 0,
    ore: [0, 0, 0, 0, 0, 0, 0, 0],
    pickaxeLevel: 1, // Single global pickaxe level
    miners: Array(8).fill(null).map(() => ({ goblin: 0, dwarf: 0, drill: 0 })),
    unlockedZones: 1,
    activeZone: 0,
    autoSell: [false, false, false, false, false, false, false, false],
    sharpPickActiveUntil: 0,
    merchantsFavorActiveUntil: 0,
    overdriveActiveUntil: 0
};

let activeMinersData = [];
let zoneLayouts = [];

function generateZoneLayouts() {
    zoneLayouts = [];
    const shapes = [
        'polygon(50% 0%, 100% 100%, 0% 100%)',
        'polygon(30% 0%, 100% 90%, 0% 100%)',
        'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
    ];
    
    for (let z = 0; z < 8; z++) {
        const nodes = [];
        
        const addNodes = (count, minW, maxW, minH, maxH) => {
            for (let i = 0; i < count; i++) {
                const theta = Math.random() * 2 * Math.PI;
                const r = 24 + Math.random() * 21; // 24% to 45% radius
                
                const x = 50 + r * Math.cos(theta);
                const y = 50 + r * Math.sin(theta);
                
                const w = Math.floor(Math.random() * (maxW - minW) + minW);
                const h = Math.floor(Math.random() * (maxH - minH) + minH);
                
                const shape = shapes[Math.floor(Math.random() * shapes.length)];
                const rotate = Math.floor(Math.random() * 360);
                
                nodes.push({ x, y, w: `${w}px`, h: `${h}px`, shape, rotate });
            }
        };
        
        // ~4 Medium nodes (3 to 5)
        const medCount = Math.floor(Math.random() * 3) + 3;
        addNodes(medCount, 35, 50, 30, 45);
        
        // ~8 Small nodes (6 to 10)
        const smCount = Math.floor(Math.random() * 5) + 6;
        addNodes(smCount, 20, 30, 18, 28);
        
        // ~15 Tiny nodes (11 to 19)
        const tinyCount = Math.floor(Math.random() * 9) + 11;
        addNodes(tinyCount, 10, 16, 8, 14);
        
        zoneLayouts.push(nodes);
    }
}
// Formatting large numbers using standard suffixes
function formatNumber(num) {
    if (num < 1000) return Math.floor(num).toString();
    const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi"];
    let i = Math.floor(Math.log10(num) / 3);
    if (i >= suffixes.length) i = suffixes.length - 1;
    let val = num / Math.pow(1000, i);
    if (val >= 999.9 && i < suffixes.length - 1) {
        val /= 1000;
        i++;
    }
    const formatted = val.toFixed(1);
    return (formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted) + suffixes[i];
}

// Save & Load
function saveGame() {
    localStorage.setItem('miningClickerSave', JSON.stringify(state));
}

function loadGame() {
    const saved = localStorage.getItem('miningClickerSave');
    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            
            // Migrate pickaxeLevels (array) or older formats to global pickaxeLevel
            if (parsed.pickaxeLevels && Array.isArray(parsed.pickaxeLevels)) {
                parsed.pickaxeLevel = Math.max(...parsed.pickaxeLevels);
                delete parsed.pickaxeLevels;
            } else if (parsed.pickaxeLevel !== undefined) {
                if (Array.isArray(parsed.pickaxeLevel)) {
                    parsed.pickaxeLevel = Math.max(...parsed.pickaxeLevel);
                }
            }
            
            // Migrate autoSell boolean to array of 8
            if (parsed.autoSell !== undefined) {
                if (typeof parsed.autoSell === 'boolean') {
                    parsed.autoSell = Array(8).fill(parsed.autoSell);
                } else if (Array.isArray(parsed.autoSell)) {
                    while (parsed.autoSell.length < 8) {
                        parsed.autoSell.push(false);
                    }
                }
            }
            
            state = { ...state, ...parsed };
        } catch (e) {
            console.error("Failed to load save", e);
        }
    }
    
    // Safety checks to ensure correct structure
    if (state.pickaxeLevel === undefined || typeof state.pickaxeLevel !== 'number') {
        state.pickaxeLevel = 1;
    }
    if (!state.miners || !Array.isArray(state.miners) || state.miners.length !== 8) {
        state.miners = Array(8).fill(null).map(() => ({ goblin: 0, dwarf: 0, drill: 0 }));
    }
    if (!state.autoSell || !Array.isArray(state.autoSell) || state.autoSell.length !== 8) {
        state.autoSell = Array(8).fill(false);
    }
}

// Calculate Costs


function getPickaxeUpgradeCost(level) {
    const reqZoneIdx = Math.min(BALANCE.zones.length - 1, Math.floor(level / BALANCE.levelsPerTier));
    const goldCost = Math.floor(BALANCE.pickaxeGoldBase * Math.pow(BALANCE.pickaxeGoldExponent, level));
    
    const tierOffset = level % BALANCE.levelsPerTier; // resets at boundary levels (25, 50, 75…)
    const oreCost = Math.floor(BALANCE.pickaxeOreBaseCost * Math.pow(BALANCE.pickaxeOreExponent, tierOffset));
    
    return {
        gold: goldCost,
        ore: oreCost,
        oreIdx: reqZoneIdx
    };
}

function getMinerCost(type, zoneIdx, count) {
    const sellRate = BALANCE.zones[zoneIdx].sellRate;
    const base = sellRate * BALANCE.minerBaseMultipliers[type];
    return Math.floor(base * Math.pow(BALANCE.minerCostExponent, count));
}

function getMinerLimit(type, zoneIdx) {
    if (type === 'goblin') return zoneIdx;
    if (type === 'dwarf') return Math.max(0, zoneIdx - 2);
    if (type === 'drill') return Math.max(0, zoneIdx - 4);
    return 0;
}

function getUnlockCost(zoneIdx) {
    return {
        gold: Math.floor(BALANCE.unlockBaseGold * Math.pow(BALANCE.unlockGoldExponent, zoneIdx)),
        ore: Math.floor(BALANCE.unlockBaseOre * Math.pow(BALANCE.unlockOreExponent, zoneIdx))
    };
}
// UI Initialization
function initUI() {
    // 1. Init Zones UI
    const container = document.getElementById('zones-container');
    container.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const div = document.createElement('div');
        div.id = `zone-indicator-${i}`;
        div.className = `zone-indicator`;
        div.onclick = () => handleZoneClick(i);
        container.appendChild(div);
    }
    
    // 2. Init Inventory UI
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    for (let i = 0; i < 8; i++) {
        const div = document.createElement('div');
        div.id = `ore-entry-${i}`;
        div.className = `ore-entry`;
        div.style.display = 'none';
        div.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; white-space: nowrap;">
                    <div class="ore-placeholder" style="background-color: ${ZONES[i].color};"></div>
                    <span style="font-weight: bold; font-size: 0.9rem;">${ZONES[i].oreName.split(' ')[0]}</span>
                </div>
                <span id="ore-count-display-${i}" style="font-weight: bold; color: var(--text-gold); font-size: 0.95rem;">0</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.75rem; color: var(--text-dim);">${ZONES[i].sellRate}g</span>
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <input type="checkbox" id="auto-sell-${i}" onclick="toggleAutoSell(${i})" style="width: 14px; height: 14px; cursor: pointer; margin: 0;" title="Auto-Sell">
                        <span style="font-size: 0.7rem; color: var(--text-dim); margin-right: 4px; user-select: none;">Auto</span>
                    </div>
                    <button class="sell-btn" onclick="sellOre(${i})" style="width: auto; padding: 3px 8px; font-size: 0.75rem;">Sell</button>
                </div>
            </div>
        `;
        invList.appendChild(div);
        document.getElementById(`auto-sell-${i}`).checked = state.autoSell[i];
    }
}
function handleZoneClick(i) {
    if (i < state.unlockedZones) {
        state.activeZone = i;
        updateStructuralUI(true);
        updateNumbersUI();
    } else if (i === state.unlockedZones) {
        // Unlock zone
        const uCost = getUnlockCost(i);
        if (state.gold >= uCost.gold && state.ore[i - 1] >= uCost.ore) {
            state.gold -= uCost.gold;
            state.ore[i - 1] -= uCost.ore;
            state.unlockedZones++;
            state.activeZone = i;
            updateStructuralUI(true);
            updateNumbersUI();
            saveGame();
        } else {
            alert("Not enough Gold or Ore to unlock this zone!");
        }
    }
}

// UI Updates
function updateStructuralUI(forceReset = false) {
    // Update Zones indicators
    for (let i = 0; i < 8; i++) {
        const div = document.getElementById(`zone-indicator-${i}`);
        let content = ZONES[i].name;
        
        if (i < state.unlockedZones) {
            div.className = `zone-indicator unlocked ${i === state.activeZone ? 'active' : ''}`;
            div.innerHTML = content;
        } else if (i === state.unlockedZones) {
            div.className = `zone-indicator locked-next`;
            const uCost = getUnlockCost(i);
            content += `<br><span style="font-size:0.75em; font-weight:normal;">Unlock: ${formatNumber(uCost.gold)}g, ${formatNumber(uCost.ore)} ${ZONES[i-1].oreName}</span>`;
            div.innerHTML = content;
        } else {
            div.className = `zone-indicator`;
            div.innerHTML = "???";
        }
    }
    
    // Update Inventory entries visibility
    for (let i = 0; i < 8; i++) {
        const entry = document.getElementById(`ore-entry-${i}`);
        if (i < state.unlockedZones) {
            entry.style.display = 'flex';
        } else {
            entry.style.display = 'none';
        }
    }

    // Update miner shop containers displays
    document.getElementById('buy-goblin-container').style.opacity = state.activeZone >= 1 ? 1 : 0.3;
    document.getElementById('buy-dwarf-container').style.display = state.activeZone >= 3 ? 'block' : 'none';
    document.getElementById('buy-drill-container').style.display = state.activeZone >= 5 ? 'block' : 'none';
    
    // Show/hide entire miners shop based on active zone being Copper Cave (Zone 2) or higher
    const minersShop = document.getElementById('miners-shop');
    if (state.activeZone >= 1) {
        minersShop.style.display = 'block';
    } else {
        minersShop.style.display = 'none';
    }
    // Set rock color
    document.documentElement.style.setProperty('--rock-color', ZONES[state.activeZone].color);
    
    // Update background miners
    updateBackgroundMiners(forceReset);
}

function updateBackgroundMiners(forceReset = false) {
    const pilesContainer = document.getElementById('miner-piles');
    
    if (forceReset) {
        pilesContainer.innerHTML = '';
        activeMinersData = [];

        const piles = zoneLayouts[state.activeZone];

        // Create the piles
        piles.forEach((pos) => {
            const pile = document.createElement('div');
            pile.className = 'bg-pile';
            pile.style.left = `${pos.x}%`;
            pile.style.top = `${pos.y}%`;
            pile.style.clipPath = pos.shape;
            pile.style.width = pos.w;
            pile.style.height = pos.h;
            pile.style.backgroundColor = ZONES[state.activeZone].color;
            pile.style.transform = `translate(-50%, -50%) rotate(${pos.rotate}deg)`;
            pilesContainer.appendChild(pile);
        });
    }

    const activeMiners = state.miners[state.activeZone];
    const piles = zoneLayouts[state.activeZone];
    
    const addMinerData = (type, shapeClass) => {
        const miner = document.createElement('div');
        miner.className = 'bg-miner';
        
        // Find claimed piles
        const claimed = activeMinersData.map(m => m.targetPileIdx);
        const freePiles = [];
        for (let idx = 0; idx < piles.length; idx++) {
            if (!claimed.includes(idx)) {
                freePiles.push(idx);
            }
        }
        
        const startPileIdx = freePiles.length > 0 
            ? freePiles[Math.floor(Math.random() * freePiles.length)]
            : Math.floor(Math.random() * piles.length);
            
        const startPile = piles[startPileIdx];
        
        const offsetAngle = Math.random() * 2 * Math.PI;
        const offsetDist = 2 + Math.random() * 3;
        const x = startPile.x + Math.cos(offsetAngle) * offsetDist;
        const y = startPile.y + Math.sin(offsetAngle) * offsetDist;
        
        miner.style.left = `${x}%`;
        miner.style.top = `${y}%`;
        
        const variety = document.createElement('div');
        variety.className = 'bg-miner-variety';
        const randomRot = Math.floor(Math.random() * 360);
        const randomScale = 0.8 + Math.random() * 0.4;
        variety.style.transform = `scale(${randomScale}) rotate(${randomRot}deg)`;
        
        const shape = document.createElement('div');
        shape.className = `${shapeClass} mining-bob`;
        
        variety.appendChild(shape);
        miner.appendChild(variety);
        pilesContainer.appendChild(miner);
        
        activeMinersData.push({
            type: type,
            element: miner,
            innerElement: shape,
            x: x,
            y: y,
            targetPileIdx: startPileIdx,
            tx: x,
            ty: y,
            state: 'mining',
            timer: 3 + Math.random() * 7, // 3 to 10 seconds random
            speed: 12 + Math.random() * 8
        });
    };

    const currentGoblins = activeMinersData.filter(m => m.type === 'goblin').length;
    const currentDwarves = activeMinersData.filter(m => m.type === 'dwarf').length;
    const currentDrills = activeMinersData.filter(m => m.type === 'drill').length;

    for (let i = currentGoblins; i < activeMiners.goblin; i++) {
        addMinerData('goblin', 'goblin-shape');
    }
    for (let i = currentDwarves; i < activeMiners.dwarf; i++) {
        addMinerData('dwarf', 'dwarf-shape');
    }
    for (let i = currentDrills; i < activeMiners.drill; i++) {
        addMinerData('drill', 'drill-shape');
    }
}

function updateNumbersUI() {
    // Gold
    const formattedGold = formatNumber(state.gold);
    document.getElementById('gold-display').innerText = formattedGold;
    // Ores
    for (let i = 0; i < state.unlockedZones; i++) {
        const countSpan = document.getElementById(`ore-count-display-${i}`);
        if (countSpan) {
            countSpan.innerText = formatNumber(state.ore[i]);
        }
    }
    
    // OPC and OPS
    const isSharpPickActive = Date.now() < state.sharpPickActiveUntil;
    const isMerchantFavorActive = Date.now() < state.merchantsFavorActiveUntil;
    const isOverdriveActive = Date.now() < state.overdriveActiveUntil;
    
    const clickMult = isSharpPickActive ? BALANCE.buffs.sharpPick.opcMultiplier : 1;
    const activeOpc = state.pickaxeLevel * clickMult;
    document.getElementById('opc-display').innerText = formatNumber(activeOpc);
    
    const speedMult = isOverdriveActive ? BALANCE.buffs.overdrive.speedMultiplier : 1;
    const m = state.miners[state.activeZone];
    const activeOps = ((m.goblin * BALANCE.minerYields.goblin) + (m.dwarf * BALANCE.minerYields.dwarf) + (m.drill * BALANCE.minerYields.drill)) * speedMult;
    // UI displays Passive: Y Ore/Minute
    const activeOpsPerMin = activeOps * 60;
    document.getElementById('ops-display').innerText = formatNumber(activeOpsPerMin);
    
    // Pickaxe Upgrade Button & Color Update
    const pickLvl = state.pickaxeLevel;
    document.getElementById('pickaxe-level-display').innerText = pickLvl;
    // Color reflects the current tier (what ore you've already spent to reach this level)
    const colorOreIdx = Math.min(BALANCE.zones.length - 1, Math.floor((pickLvl - 1) / BALANCE.levelsPerTier));
    document.documentElement.style.setProperty('--pickaxe-color', ZONES[colorOreIdx].color);

    if (pickLvl >= BALANCE.maxPickaxeLevel) {
        document.getElementById('pickaxe-cost-display').innerText = "MAX";
        document.getElementById('upgrade-pickaxe-btn').disabled = true;
        document.getElementById('upgrade-pickaxe-btn').classList.remove('can-unlock-flash');
    } else {
        const cost = getPickaxeUpgradeCost(pickLvl);
        const oreName = ZONES[cost.oreIdx].oreName;
        document.getElementById('pickaxe-cost-display').innerHTML = `Cost: ${formatNumber(cost.gold)} Gold + ${formatNumber(cost.ore)} ${oreName}`;
        
        const hasGold = state.gold >= cost.gold;
        const hasOre = state.ore[cost.oreIdx] >= cost.ore;
        const isZoneUnlocked = cost.oreIdx < state.unlockedZones;
        const canUpgrade = hasGold && hasOre && isZoneUnlocked;
        
        document.getElementById('upgrade-pickaxe-btn').disabled = !canUpgrade;
        if (canUpgrade) {
            document.getElementById('upgrade-pickaxe-btn').classList.add('can-unlock-flash');
        } else {
            document.getElementById('upgrade-pickaxe-btn').classList.remove('can-unlock-flash');
        }
    }
    
    // Goblin button
    const gobLimit = getMinerLimit('goblin', state.activeZone);
    const gobCost = getMinerCost('goblin', state.activeZone, m.goblin);
    document.getElementById('goblin-cost').innerText = formatNumber(gobCost);
    document.getElementById('goblin-limit').innerText = gobLimit;
    document.getElementById('goblin-count').innerText = m.goblin;
    const canBuyGob = state.gold >= gobCost && m.goblin < gobLimit && state.activeZone >= 1;
    document.getElementById('buy-goblin-btn').disabled = !canBuyGob;
    if (canBuyGob) {
        document.getElementById('buy-goblin-btn').classList.add('can-unlock-flash');
    } else {
        document.getElementById('buy-goblin-btn').classList.remove('can-unlock-flash');
    }
    
    // Dwarf button
    const dwarfLimit = getMinerLimit('dwarf', state.activeZone);
    const dwarfCost = getMinerCost('dwarf', state.activeZone, m.dwarf);
    document.getElementById('dwarf-cost').innerText = formatNumber(dwarfCost);
    document.getElementById('dwarf-limit').innerText = dwarfLimit;
    document.getElementById('dwarf-count').innerText = m.dwarf;
    const canBuyDwarf = state.gold >= dwarfCost && m.dwarf < dwarfLimit && state.activeZone >= 3;
    document.getElementById('buy-dwarf-btn').disabled = !canBuyDwarf;
    if (canBuyDwarf) {
        document.getElementById('buy-dwarf-btn').classList.add('can-unlock-flash');
    } else {
        document.getElementById('buy-dwarf-btn').classList.remove('can-unlock-flash');
    }
    
    // Drill button
    const drillLimit = getMinerLimit('drill', state.activeZone);
    const drillCost = getMinerCost('drill', state.activeZone, m.drill);
    document.getElementById('drill-cost').innerText = formatNumber(drillCost);
    document.getElementById('drill-limit').innerText = drillLimit;
    document.getElementById('drill-count').innerText = m.drill;
    const canBuyDrill = state.gold >= drillCost && m.drill < drillLimit && state.activeZone >= 5;
    document.getElementById('buy-drill-btn').disabled = !canBuyDrill;
    if (canBuyDrill) {
        document.getElementById('buy-drill-btn').classList.add('can-unlock-flash');
    } else {
        document.getElementById('buy-drill-btn').classList.remove('can-unlock-flash');
    }
    // Update next locked zone indicator flashing state
    const nextLockedIdx = state.unlockedZones;
    if (nextLockedIdx < 8) {
        const div = document.getElementById(`zone-indicator-${nextLockedIdx}`);
        if (div) {
            const uCost = getUnlockCost(nextLockedIdx);
            const canUnlock = state.gold >= uCost.gold && state.ore[nextLockedIdx - 1] >= uCost.ore;
            if (canUnlock) {
                div.classList.add('can-unlock-flash');
            } else {
                div.classList.remove('can-unlock-flash');
            }
        }
    }

    // Disable sell-all button if all unlocked ores counts are 0
    let totalOres = 0;
    for (let i = 0; i < state.unlockedZones; i++) {
        totalOres += state.ore[i];
    }
    document.getElementById('sell-all-btn').disabled = totalOres <= 0;

    // Update active buffs list
    updateActiveBuffsUI(isSharpPickActive, isMerchantFavorActive, isOverdriveActive);

    // Let's also check if sell-all button needs to flash or style
}

function updateActiveBuffsUI(isSharp, isFavor, isOverdrive) {
    const container = document.getElementById('active-buffs');
    container.innerHTML = '';
    const now = Date.now();
    
    if (isSharp) {
        const rem = Math.max(0, Math.ceil((state.sharpPickActiveUntil - now) / 1000));
        container.innerHTML += `<div class="buff-indicator buff-sharp-pick">Sharp Pick (5x OPC): ${rem}s</div>`;
    }
    if (isFavor) {
        const rem = Math.max(0, Math.ceil((state.merchantsFavorActiveUntil - now) / 1000));
        container.innerHTML += `<div class="buff-indicator buff-merchants-favor">Merchant's Favor (2x Sell): ${rem}s</div>`;
    }
    if (isOverdrive) {
        const rem = Math.max(0, Math.ceil((state.overdriveActiveUntil - now) / 1000));
        container.innerHTML += `<div class="buff-indicator buff-overdrive">Overdrive (2x Speed): ${rem}s</div>`;
    }
}

// Actions
document.getElementById('mother-lode-container').addEventListener('click', (e) => {
    const isSharpPickActive = Date.now() < state.sharpPickActiveUntil;
    const clickMult = isSharpPickActive ? BALANCE.buffs.sharpPick.opcMultiplier : 1;
    const opc = state.pickaxeLevel * clickMult;
    
    state.ore[state.activeZone] += opc;
    
    const floatText = document.createElement('div');
    floatText.className = 'particle';
    floatText.innerText = `+${formatNumber(opc)}`;
    floatText.style.left = `${e.pageX - 10}px`;
    floatText.style.top = `${e.pageY - 20}px`;
    document.body.appendChild(floatText);
    setTimeout(() => floatText.remove(), 1000);

    updateNumbersUI();
});

// Individual Sell function
window.sellOre = function(zoneIdx) {
    const amount = state.ore[zoneIdx];
    if (amount > 0) {
        const isMerchantFavorActive = Date.now() < state.merchantsFavorActiveUntil;
        const sellMult = isMerchantFavorActive ? BALANCE.buffs.merchantsFavor.sellMultiplier : 1;
        const value = amount * ZONES[zoneIdx].sellRate * sellMult;
        state.gold += value;
        state.ore[zoneIdx] = 0;
        updateNumbersUI();
    }
};

document.getElementById('upgrade-pickaxe-btn').addEventListener('click', () => {
    const pickLvl = state.pickaxeLevel;
    if (pickLvl >= BALANCE.maxPickaxeLevel) return;
    
    const cost = getPickaxeUpgradeCost(pickLvl);
    const hasGold = state.gold >= cost.gold;
    const hasOre = state.ore[cost.oreIdx] >= cost.ore;
    const isZoneUnlocked = cost.oreIdx < state.unlockedZones;
    
    if (hasGold && hasOre && isZoneUnlocked) {
        state.gold -= cost.gold;
        state.ore[cost.oreIdx] -= cost.ore;
        state.pickaxeLevel++;
        updateNumbersUI();
        saveGame();
    }
});
document.getElementById('buy-goblin-btn').addEventListener('click', () => buyMiner('goblin'));
document.getElementById('buy-dwarf-btn').addEventListener('click', () => buyMiner('dwarf'));
document.getElementById('buy-drill-btn').addEventListener('click', () => buyMiner('drill'));

function buyMiner(type) {
    const m = state.miners[state.activeZone];
    const limit = getMinerLimit(type, state.activeZone);
    if (m[type] >= limit) return;
    
    if (type === 'goblin' && state.activeZone < 1) return;
    if (type === 'dwarf' && state.activeZone < 3) return;
    if (type === 'drill' && state.activeZone < 5) return;
    
    const cost = getMinerCost(type, state.activeZone, m[type]);
    if (state.gold >= cost) {
        state.gold -= cost;
        m[type]++;
        updateStructuralUI();
        updateNumbersUI();
        saveGame();
    }
}

window.toggleAutoSell = function(zoneIdx) {
    state.autoSell[zoneIdx] = document.getElementById(`auto-sell-${zoneIdx}`).checked;
    saveGame();
};

window.sellAllOres = function() {
    const isMerchantFavorActive = Date.now() < state.merchantsFavorActiveUntil;
    const sellMult = isMerchantFavorActive ? BALANCE.buffs.merchantsFavor.sellMultiplier : 1;
    let soldAny = false;
    for (let i = 0; i < state.unlockedZones; i++) {
        const amount = state.ore[i];
        if (amount > 0) {
            state.gold += amount * ZONES[i].sellRate * sellMult;
            state.ore[i] = 0;
            soldAny = true;
        }
    }
    if (soldAny) {
        updateNumbersUI();
        saveGame();
    }
};

document.getElementById('sell-all-btn').addEventListener('click', () => {
    sellAllOres();
});

document.getElementById('reset-game-btn').addEventListener('click', () => {
    if(confirm("Are you sure you want to completely reset your progress?")) {
        window.removeEventListener('beforeunload', saveGame);
        localStorage.removeItem('miningClickerSave');
        location.reload();
    }
});

// Dev Tools Logic
document.getElementById('dev-tools-toggle').addEventListener('click', () => {
    const panel = document.getElementById('dev-tools-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('dev-set-gold').addEventListener('click', () => {
    const val = parseInt(document.getElementById('dev-gold').value) || 0;
    state.gold = val;
    updateNumbersUI();
});

document.getElementById('dev-set-pickaxe').addEventListener('click', () => {
    const val = parseInt(document.getElementById('dev-pickaxe').value) || 1;
    state.pickaxeLevel = Math.min(BALANCE.maxPickaxeLevel, Math.max(1, val));
    updateNumbersUI();
});
document.getElementById('dev-set-ore').addEventListener('click', () => {
    const val = parseInt(document.getElementById('dev-ore').value) || 0;
    for (let i = 0; i < state.unlockedZones; i++) {
        state.ore[i] = val;
    }
    updateNumbersUI();
});

document.getElementById('dev-unlock-all').addEventListener('click', () => {
    state.unlockedZones = 8;
    updateStructuralUI(true);
    updateNumbersUI();
});

document.getElementById('dev-spawn-powerup').addEventListener('click', () => {
    spawnPowerUp();
});

document.getElementById('dev-clear-powerups').addEventListener('click', () => {
    document.getElementById('powerup-container').innerHTML = '';
    state.sharpPickActiveUntil = 0;
    state.merchantsFavorActiveUntil = 0;
    state.overdriveActiveUntil = 0;
    updateNumbersUI();
});

// Power-Up System Spawning & Buff Logic
let nextPowerUpTime = Date.now() + getNextPowerUpDelay();

function getNextPowerUpDelay() {
    const range = BALANCE.powerUpSpawnIntervalMax - BALANCE.powerUpSpawnIntervalMin;
    return (Math.random() * range + BALANCE.powerUpSpawnIntervalMin) * 1000;
}

function checkPowerUpSpawn() {
    if (Date.now() >= nextPowerUpTime) {
        spawnPowerUp();
        nextPowerUpTime = Date.now() + getNextPowerUpDelay();
    }
}

function spawnPowerUp(forceType = null) {
    const container = document.getElementById('powerup-container');
    container.innerHTML = '';

    const types = ['sharp_pick', 'merchants_favor', 'overdrive'];
    const type = forceType || types[Math.floor(Math.random() * types.length)];
    
    const powerup = document.createElement('div');
    powerup.className = `powerup powerup-${type.replace('_', '-')}`;
    
    const x = Math.random() * 60 + 20;
    const y = Math.random() * 60 + 20;
    
    powerup.style.left = `${x}%`;
    powerup.style.top = `${y}%`;
    
    powerup.addEventListener('click', (e) => {
        e.stopPropagation();
        activateBuff(type);
        powerup.remove();
    });
    
    container.appendChild(powerup);
    
    setTimeout(() => {
        if (powerup.parentNode) {
            powerup.remove();
        }
    }, BALANCE.powerUpDespawnTime * 1000);
}

function activateBuff(type) {
    const now = Date.now();
    let msg = "";
    
    const b = BALANCE.buffs[type];
    if (!b) return;
    
    const durationMs = b.durationSec * 1000;
    
    if (type === 'sharp_pick') {
        state.sharpPickActiveUntil = Math.max(state.sharpPickActiveUntil || 0, now) + durationMs;
        msg = `${b.label}! ${b.desc}!`;
    } else if (type === 'merchants_favor') {
        state.merchantsFavorActiveUntil = Math.max(state.merchantsFavorActiveUntil || 0, now) + durationMs;
        msg = `${b.label}! ${b.desc}!`;
    } else if (type === 'overdrive') {
        state.overdriveActiveUntil = Math.max(state.overdriveActiveUntil || 0, now) + durationMs;
        msg = `${b.label}! ${b.desc}!`;
    }
    
    showFloatingNotification(msg);
    updateNumbersUI();
}

function showFloatingNotification(msg) {
    const floatText = document.createElement('div');
    floatText.className = 'particle';
    floatText.style.fontSize = '1.2rem';
    floatText.style.color = '#ffd700';
    floatText.innerText = msg;
    floatText.style.left = '50%';
    floatText.style.top = '40%';
    floatText.style.transform = 'translate(-50%, -50%)';
    floatText.style.animation = 'floatUp 1.5s ease-out forwards';
    document.getElementById('center-panel').appendChild(floatText);
    setTimeout(() => floatText.remove(), 1500);
}

// Game Loop
let lastTime = Date.now();
function gameLoop() {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    // 1. Check powerup spawn timer
    checkPowerUpSpawn();

    // 2. Generate passive ores
    const isOverdriveActive = Date.now() < state.overdriveActiveUntil;
    const speedMult = isOverdriveActive ? BALANCE.buffs.overdrive.speedMultiplier : 1;
    
    for (let i = 0; i < state.unlockedZones; i++) {
        const m = state.miners[i];
        const zoneOps = (m.goblin * BALANCE.minerYields.goblin) + (m.dwarf * BALANCE.minerYields.dwarf) + (m.drill * BALANCE.minerYields.drill);
        state.ore[i] += zoneOps * dt * speedMult;
    }

    // 3. Handle auto-sell if enabled per-ore
    const isMerchantFavorActive = Date.now() < state.merchantsFavorActiveUntil;
    const sellMult = isMerchantFavorActive ? BALANCE.buffs.merchantsFavor.sellMultiplier : 1;
    for (let i = 0; i < state.unlockedZones; i++) {
        if (state.autoSell[i] && state.ore[i] > 0) {
            state.gold += state.ore[i] * ZONES[i].sellRate * sellMult;
            state.ore[i] = 0;
        }
    }

    // 4. Update wandering miners positions
    activeMinersData.forEach(miner => {
        const piles = zoneLayouts[state.activeZone];
        if (miner.state === 'mining') {
            miner.timer -= dt;
            if (miner.timer <= 0) {
                const claimed = activeMinersData
                    .filter(m => m !== miner)
                    .map(m => m.targetPileIdx);
                    
                const freePiles = [];
                for (let idx = 0; idx < piles.length; idx++) {
                    if (!claimed.includes(idx)) {
                        freePiles.push(idx);
                    }
                }
                
                let nextPile = freePiles.length > 0
                    ? freePiles[Math.floor(Math.random() * freePiles.length)]
                    : Math.floor(Math.random() * piles.length);
                    
                const offsetAngle = Math.random() * 2 * Math.PI;
                const offsetDist = 2 + Math.random() * 3;
                miner.targetPileIdx = nextPile;
                miner.tx = piles[nextPile].x + Math.cos(offsetAngle) * offsetDist;
                miner.ty = piles[nextPile].y + Math.sin(offsetAngle) * offsetDist;
                
                miner.state = 'walking';
                miner.innerElement.classList.remove('mining-bob');
            }
        } else if (miner.state === 'walking') {
            const dx = miner.tx - miner.x;
            const dy = miner.ty - miner.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist < 1) {
                miner.x = miner.tx;
                miner.y = miner.ty;
                miner.state = 'mining';
                miner.timer = 3 + Math.random() * 7; // 3 to 10 seconds random
                miner.innerElement.classList.add('mining-bob');
            } else {
                const step = miner.speed * dt;
                miner.x += (dx / dist) * Math.min(step, dist);
                miner.y += (dy / dist) * Math.min(step, dist);
            }
        }
        
        miner.element.style.left = `${miner.x}%`;
        miner.element.style.top = `${miner.y}%`;
    });

    // 5. Update Numbers UI
    updateNumbersUI();
    
    requestAnimationFrame(gameLoop);
}

// Auto Save (every 30 seconds)
setInterval(saveGame, 30000);
window.addEventListener('beforeunload', saveGame);

// Bootstrap
loadGame();
generateZoneLayouts();
initUI();
updateStructuralUI(true);
updateNumbersUI();
requestAnimationFrame(gameLoop);

