// ============================================================
//  PyClicker: Resurrected — Mining Clicker Game Engine
// ============================================================

const SAVE_KEY = 'clicker_mining_save';
const MAX_OFFLINE_SECONDS = 172800; // 48 hours
const MIN_OFFLINE_SECONDS = 60;   // 1 minute

// ============================================================
//  DATA DEFINITIONS
// ============================================================

const AREAS = [
    { id: 'surface',     name: 'The Surface',        oreEmoji: '🟤', oreName: 'Copper Ore',  oreHp: 10,    oreSell: 5,    oreXp: 10,   levelReq: 1,   cost: 0 },
    { id: 'shallows',    name: 'The Shallows',       oreEmoji: '⛰️', oreName: 'Iron Ore',    oreHp: 200,   oreSell: 25,   oreXp: 30,   levelReq: 5,   cost: 200 },
    { id: 'deep_mines',  name: 'The Deep Mines',     oreEmoji: '🥈', oreName: 'Silver Ore',  oreHp: 750,   oreSell: 100,  oreXp: 80,   levelReq: 15,  cost: 1500 },
    { id: 'crystal',     name: 'The Crystal Caves',  oreEmoji: '🥇', oreName: 'Gold Ore',    oreHp: 3000,  oreSell: 400,  oreXp: 250,  levelReq: 30,  cost: 8000 },
    { id: 'magma',       name: 'The Magma Core',     oreEmoji: '💎', oreName: 'Diamond Ore', oreHp: 10000, oreSell: 1500, oreXp: 700,  levelReq: 50,  cost: 30000 },
    { id: 'void',        name: 'The Void',           oreEmoji: '✨', oreName: 'Mythril Ore', oreHp: 35000, oreSell: 5000, oreXp: 2000, levelReq: 75,  cost: 120000 },
    { id: 'abyss',       name: 'The Abyss',          oreEmoji: '🌑', oreName: 'Obsidian',    oreHp: 100000,oreSell: 15000,oreXp: 5000, levelReq: 100, cost: 500000 },
];

const PICKAXES = [
    { id: 'copper_pick',   name: 'Copper Pickaxe',      desc: '+3 damage',   damageBonus: 3,   cost: 30 },
    { id: 'iron_pick',     name: 'Iron Pickaxe',        desc: '+10 damage',  damageBonus: 10,  cost: 150 },
    { id: 'steel_pick',    name: 'Steel Pickaxe',       desc: '+35 damage',  damageBonus: 35,  cost: 750 },
    { id: 'gold_pick',     name: 'Gold Pickaxe',        desc: '+100 damage', damageBonus: 100, cost: 3000 },
    { id: 'diamond_pick',  name: 'Diamond Pickaxe',     desc: '+350 damage', damageBonus: 350, cost: 14000 },
    { id: 'mythril_pick',  name: 'Mythril Pickaxe',     desc: '+1200 damage',damageBonus: 1200,cost: 60000 },
    { id: 'obsidian_pick', name: 'Obsidian Pickaxe',    desc: '+4000 damage',damageBonus: 4000,cost: 250000 },
];

const AUTO_MINERS = [
    { id: 'goblin_helper',   name: 'Goblin Helper',      desc: '+2 DPS',  dps: 2,    cost: 100 },
    { id: 'dwarven_drill',   name: 'Dwarven Drill',      desc: '+8 DPS',  dps: 8,    cost: 500 },
    { id: 'steam_engine',    name: 'Steam Engine',       desc: '+30 DPS', dps: 30,   cost: 2500 },
    { id: 'magma_borer',     name: 'Magma Borer',        desc: '+120 DPS',dps: 120,  cost: 12000 },
    { id: 'arcane_excavator',name: 'Arcane Excavator',   desc: '+500 DPS',dps: 500,  cost: 50000 },
    { id: 'void_drill',      name: 'Void Drill',         desc: '+2000 DPS',dps: 2000, cost: 200000 },
];

// ============================================================
//  GAME STATE
// ============================================================

function createInitialState() {
    return {
        level: 1,
        xp: 0,
        gold: 0,
        pickaxeDamage: 1,
        autoMinerDPS: 0,
        currentArea: 'surface',
        purchasedAreas: ['surface'],
        ores: {},
        purchasedPickaxes: [],
        purchasedMiners: [],
        lastSavedTime: Date.now(),
    };
}

// ============================================================
//  UTILITY
// ============================================================

function xpForLevel(level) {
    return Math.floor(100 * Math.pow(level, 1.6));
}

function getAreaById(id) {
    return AREAS.find(a => a.id === id);
}

function getAreaIndex(id) {
    return AREAS.findIndex(a => a.id === id);
}

function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
}

// ============================================================
//  ORE CLASS
// ============================================================

class Ore {
    constructor(area) {
        this.area = area;
        this.maxHp = area.oreHp;
        this.currentHp = area.oreHp;
    }

    takeDamage(damage) {
        this.currentHp = Math.max(0, this.currentHp - damage);
    }

    get isBroken() {
        return this.currentHp <= 0;
    }

    get hpPercent() {
        return (this.currentHp / this.maxHp) * 100;
    }

    setHp(value) {
        this.currentHp = Math.max(0, Math.min(this.maxHp, value));
    }

    reset() {
        this.currentHp = this.maxHp;
    }
}

// ============================================================
//  PLAYER CLASS
// ============================================================

class Player {
    constructor(state) {
        this.state = state;
        this.onStateChange = null;
    }

    get currentAreaDef() {
        return getAreaById(this.state.currentArea);
    }

    get totalDamage() {
        return this.state.pickaxeDamage;
    }

    addXp(amount) {
        if (this.state.level >= 100) return;
        this.state.xp += amount;
        while (this.state.level < 100 && this.state.xp >= xpForLevel(this.state.level)) {
            this.state.xp -= xpForLevel(this.state.level);
            this.state.level++;
        }
        if (this.state.level >= 100) {
            this.state.xp = 0;
        }
        this.notify();
    }

    addGold(amount) {
        this.state.gold += amount;
        this.notify();
    }

    spendGold(amount) {
        if (this.state.gold < amount) return false;
        this.state.gold -= amount;
        this.notify();
        return true;
    }

    addOre(oreId, count) {
        if (!this.state.ores[oreId]) this.state.ores[oreId] = 0;
        this.state.ores[oreId] += (count || 1);
        this.notify();
    }

    sellOre(oreId) {
        if (!this.state.ores[oreId] || this.state.ores[oreId] <= 0) return 0;
        const area = getAreaById(oreId);
        if (!area) return 0;
        const count = this.state.ores[oreId];
        const totalGold = count * area.oreSell;
        this.state.gold += totalGold;
        this.state.ores[oreId] = 0;
        this.notify();
        return totalGold;
    }

    sellAllOres() {
        let totalGold = 0;
        for (const [oreId, count] of Object.entries(this.state.ores)) {
            if (count <= 0) continue;
            const area = getAreaById(oreId);
            if (!area) continue;
            totalGold += count * area.oreSell;
            this.state.ores[oreId] = 0;
        }
        if (totalGold > 0) {
            this.state.gold += totalGold;
            this.notify();
        }
        return totalGold;
    }

    canBuyPickaxe(item) {
        return !this.state.purchasedPickaxes.includes(item.id) && this.state.gold >= item.cost;
    }

    buyPickaxe(item) {
        if (!this.canBuyPickaxe(item)) return false;
        this.state.gold -= item.cost;
        this.state.purchasedPickaxes.push(item.id);
        this.state.pickaxeDamage += item.damageBonus;
        this.notify();
        return true;
    }

    canBuyMiner(item) {
        return !this.state.purchasedMiners.includes(item.id) && this.state.gold >= item.cost;
    }

    buyMiner(item) {
        if (!this.canBuyMiner(item)) return false;
        this.state.gold -= item.cost;
        this.state.purchasedMiners.push(item.id);
        this.state.autoMinerDPS += item.dps;
        this.notify();
        return true;
    }

    canBuyArea(area) {
        if (this.state.purchasedAreas.includes(area.id)) return false;
        if (this.state.level < area.levelReq) return false;
        return this.state.gold >= area.cost;
    }

    buyArea(area) {
        if (!this.canBuyArea(area)) return false;
        this.state.gold -= area.cost;
        this.state.purchasedAreas.push(area.id);
        this.state.currentArea = area.id;
        this.notify();
        return true;
    }

    switchArea(areaId) {
        if (!this.state.purchasedAreas.includes(areaId)) return false;
        this.state.currentArea = areaId;
        this.notify();
        return true;
    }

    hasOres() {
        return Object.values(this.state.ores).some(c => c > 0);
    }

    reset() {
        this.state = createInitialState();
        this.notify();
    }

    toJSON() {
        return JSON.stringify(this.state);
    }

    notify() {
        if (this.onStateChange) this.onStateChange();
    }
}

// ============================================================
//  UI RENDERER
// ============================================================

class UIRenderer {
    constructor() {
        this.cacheElements();
    }

    cacheElements() {
        this.el = {
            gold:           document.getElementById('gold-display'),
            level:          document.getElementById('level-display'),
            xpCurrent:      document.getElementById('xp-current'),
            xpNeeded:       document.getElementById('xp-needed'),
            xpBar:          document.getElementById('xp-bar-fill'),
            pickaxe:        document.getElementById('pickaxe-display'),
            autoDps:        document.getElementById('auto-dps-display'),
            areaLabel:      document.getElementById('area-label'),
            areaTabs:       document.getElementById('area-tabs'),
            oreSprite:      document.getElementById('ore-sprite'),
            hpBar:          document.getElementById('hp-bar-fill'),
            hpText:         document.getElementById('hp-text'),
            shopTabs:       document.getElementById('shop-tabs'),
            shopContent:    document.getElementById('shop-content'),
            inventory:      document.getElementById('inventory-list'),
            sellAllBtn:     document.getElementById('sell-all-btn'),
            damageFly:      document.getElementById('damage-fly'),
            lootFly:        document.getElementById('loot-fly'),
            resetBtn:       document.getElementById('reset-btn'),
        };
    }

    updatePlayer(player) {
        const s = player.state;
        this.el.gold.textContent = s.gold.toLocaleString();
        this.el.level.textContent = s.level;
        this.el.pickaxe.textContent = s.pickaxeDamage;
        this.el.autoDps.textContent = s.autoMinerDPS;

        const needed = xpForLevel(s.level);
        this.el.xpCurrent.textContent = s.xp.toLocaleString();
        this.el.xpNeeded.textContent = needed.toLocaleString();
        this.el.xpBar.style.width = s.level >= 100 ? '100%' : ((s.xp / needed) * 100) + '%';
    }

    renderAreaTabs(player) {
        this.el.areaTabs.innerHTML = AREAS.map(area => {
            const owned = player.state.purchasedAreas.includes(area.id);
            const isActive = player.state.currentArea === area.id;
            const cls = ['area-tab'];
            if (isActive) cls.push('active');
            if (!owned) cls.push('locked');

            return `
                <div class="${cls.join(' ')}" data-area-id="${area.id}" ${!owned ? 'tabindex="-1"' : ''}>
                    <span class="tab-emoji">${owned ? area.oreEmoji : '🔒'}</span>
                    ${area.name}
                </div>
            `;
        }).join('');
    }

    updateOre(ore) {
        this.el.areaLabel.textContent = ore.area.name;
        this.el.oreSprite.textContent = ore.area.oreEmoji;
        this.el.hpBar.style.width = ore.hpPercent + '%';
        this.el.hpText.textContent = `${Math.ceil(ore.currentHp).toLocaleString()} / ${ore.maxHp.toLocaleString()} HP`;

        if (ore.hpPercent < 25) {
            this.el.hpBar.style.background = 'linear-gradient(180deg, #d9534f 0%, #a0302a 100%)';
        } else if (ore.hpPercent < 60) {
            this.el.hpBar.style.background = 'linear-gradient(180deg, #f0ad4e 0%, #c07a20 100%)';
        } else {
            this.el.hpBar.style.background = 'linear-gradient(180deg, #5cb85c 0%, #3d8b3d 100%)';
        }
    }

    updateShop(player) {
        this.renderShop(player);
    }

    getActiveShopTab() {
        const active = this.el.shopTabs.querySelector('.shop-tab.active');
        return active ? active.dataset.shopTab : 'pickaxes';
    }

    renderShop(player) {
        const tab = this.getActiveShopTab();
        if (tab === 'pickaxes') {
            this.el.shopContent.innerHTML = PICKAXES.map(item => {
                const owned = player.state.purchasedPickaxes.includes(item.id);
                const canAfford = player.state.gold >= item.cost;
                const disabled = owned || !canAfford;

                let btnHtml;
                if (owned) {
                    btnHtml = '<span class="owned-tag">✓ Owned</span>';
                } else {
                    btnHtml = `<button class="buy-btn" data-shop-type="pickaxe" data-item-id="${item.id}" ${disabled ? 'disabled' : ''}>Buy</button>`;
                }

                return `
                    <div class="shop-item">
                        <div class="item-name">${item.name}</div>
                        <div class="item-desc">${item.desc}</div>
                        <div class="item-cost">🪙 ${item.cost.toLocaleString()} gold</div>
                        ${btnHtml}
                    </div>
                `;
            }).join('');
        } else if (tab === 'miners') {
            this.el.shopContent.innerHTML = AUTO_MINERS.map(item => {
                const owned = player.state.purchasedMiners.includes(item.id);
                const canAfford = player.state.gold >= item.cost;
                const disabled = owned || !canAfford;

                let btnHtml;
                if (owned) {
                    btnHtml = '<span class="owned-tag">✓ Owned</span>';
                } else {
                    btnHtml = `<button class="buy-btn" data-shop-type="miner" data-item-id="${item.id}" ${disabled ? 'disabled' : ''}>Buy</button>`;
                }

                return `
                    <div class="shop-item">
                        <div class="item-name">${item.name}</div>
                        <div class="item-desc">${item.desc}</div>
                        <div class="item-cost">🪙 ${item.cost.toLocaleString()} gold</div>
                        ${btnHtml}
                    </div>
                `;
            }).join('');
        } else if (tab === 'areas') {
            this.el.shopContent.innerHTML = AREAS.filter(a => a.id !== 'surface').map(area => {
                const owned = player.state.purchasedAreas.includes(area.id);
                const levelOk = player.state.level >= area.levelReq;
                const canAfford = player.state.gold >= area.cost;
                const disabled = owned || !levelOk || !canAfford;
                const isCurrent = player.state.currentArea === area.id;

                let btnHtml;
                if (owned) {
                    if (isCurrent) {
                        btnHtml = '<span class="owned-tag">✓ Active</span>';
                    } else {
                        btnHtml = `<button class="buy-btn" data-shop-type="area-switch" data-item-id="${area.id}">Switch</button>`;
                    }
                } else if (!levelOk) {
                    btnHtml = `<span class="locked-tag">🔒 Requires Level ${area.levelReq}</span>`;
                } else {
                    btnHtml = `<button class="buy-btn" data-shop-type="area" data-item-id="${area.id}" ${disabled ? 'disabled' : ''}>Buy</button>`;
                }

                return `
                    <div class="shop-item">
                        <div class="item-name">${area.name}</div>
                        <div class="item-desc">Ore: ${area.oreName} (💰 ${area.oreSell} gold)</div>
                        <div class="item-cost">🪙 ${area.cost.toLocaleString()} gold</div>
                        ${btnHtml}
                    </div>
                `;
            }).join('');
        }
    }

    updateInventory(player) {
        this.el.inventory.innerHTML = AREAS.map(area => {
            const count = player.state.ores[area.id] || 0;
            return `
                <div class="inv-item">
                    <span class="inv-ore-name">${area.oreEmoji} ${area.oreName}</span>
                    <span class="inv-ore-count">${count.toLocaleString()}</span>
                    <button class="sell-btn" data-sell-ore="${area.id}" ${count <= 0 ? 'disabled' : ''}>💰 Sell (${area.oreSell}g)</button>
                </div>
            `;
        }).join('');

        this.el.sellAllBtn.disabled = !player.hasOres();
    }

    flyDamage(amount) {
        const el = this.el.damageFly;
        el.textContent = `-${amount}`;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'flyUp 1s ease-out forwards';
    }

    flyLoot(text) {
        const el = this.el.lootFly;
        el.textContent = text;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'flyUp 1s ease-out forwards';
    }

    updateAll(player, ore) {
        this.updatePlayer(player);
        this.renderAreaTabs(player);
        this.updateOre(ore);
        this.updateShop(player);
        this.updateInventory(player);
    }
}

// ============================================================
//  GAME CLASS
// ============================================================

class Game {
    constructor() {
        this.ui = new UIRenderer();
        this.autoMinerInterval = null;
        this.autoSaveInterval = null;
        this.offlineResult = null;

        const saved = this.load();
        this.player = new Player(saved);
        const area = getAreaById(this.player.state.currentArea);
        this.ore = new Ore(area);

        this.offlineResult = this.simulateOfflineProgress();
        if (this.offlineResult) {
            this.ore.setHp(this.offlineResult.oreHp);
        }

        this.player.onStateChange = () => {
            this.ui.updatePlayer(this.player);
            this.ui.renderAreaTabs(this.player);
            this.ui.updateShop(this.player);
            this.ui.updateInventory(this.player);
        };

        this.bindEvents();
        this.ui.updateAll(this.player, this.ore);

        if (this.offlineResult) {
            this.showOfflineModal(this.offlineResult);
        }

        this.startAutoMiner();
        this.startAutoSave();
    }

    bindEvents() {
        window.addEventListener('beforeunload', () => this.save());

        this.ui.el.oreSprite.addEventListener('click', () => this.mine());
        this.ui.el.resetBtn.addEventListener('click', () => this.confirmReset());

        this.ui.el.areaTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.area-tab');
            if (!tab || tab.classList.contains('locked')) return;
            const areaId = tab.dataset.areaId;
            if (areaId && areaId !== this.player.state.currentArea) {
                if (this.player.switchArea(areaId)) {
                    const area = getAreaById(areaId);
                    this.ore = new Ore(area);
                    this.ui.updateAll(this.player, this.ore);
                }
            }
        });

        this.ui.el.sellAllBtn.addEventListener('click', () => {
            const earned = this.player.sellAllOres();
            if (earned > 0) {
                this.ui.flyLoot(`+${earned.toLocaleString()} 🪙`);
            }
        });

        this.ui.el.shopTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.shop-tab');
            if (!tab) return;
            this.ui.el.shopTabs.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            this.ui.updateShop(this.player);
        });

        this.ui.el.shopContent.addEventListener('click', (e) => this.handleShopClick(e));

        this.ui.el.inventory.addEventListener('click', (e) => {
            const btn = e.target.closest('.sell-btn');
            if (!btn) return;
            const oreId = btn.dataset.sellOre;
            if (oreId) {
                const earned = this.player.sellOre(oreId);
                if (earned > 0) {
                    this.ui.flyLoot(`+${earned.toLocaleString()} 🪙`);
                }
                this.ui.updateAll(this.player, this.ore);
            }
        });
    }

    handleShopClick(e) {
        const btn = e.target.closest('.buy-btn');
        if (!btn) return;
        const type = btn.dataset.shopType;
        const itemId = btn.dataset.itemId;

        if (type === 'pickaxe') {
            const item = PICKAXES.find(i => i.id === itemId);
            if (item && this.player.buyPickaxe(item)) {
                this.ui.updateAll(this.player, this.ore);
            }
        } else if (type === 'miner') {
            const item = AUTO_MINERS.find(i => i.id === itemId);
            if (item && this.player.buyMiner(item)) {
                this.ui.updateAll(this.player, this.ore);
            }
        } else if (type === 'area') {
            const area = getAreaById(itemId);
            if (area && this.player.buyArea(area)) {
                this.ore = new Ore(area);
                this.ui.updateAll(this.player, this.ore);
            }
        } else if (type === 'area-switch') {
            if (this.player.switchArea(itemId)) {
                const area = getAreaById(itemId);
                this.ore = new Ore(area);
                this.ui.updateAll(this.player, this.ore);
            }
        }
    }

    mine() {
        const dmg = this.player.totalDamage;
        this.ore.takeDamage(dmg);
        this.ui.flyDamage(dmg);
        this.ui.updateOre(this.ore);

        if (this.ore.isBroken) {
            const area = this.ore.area;
            this.player.addXp(area.oreXp);
            this.player.addOre(area.id);
            this.ui.flyLoot(`+1 ${area.oreName}!`);

            this.ui.el.oreSprite.classList.add('shake');
            setTimeout(() => this.ui.el.oreSprite.classList.remove('shake'), 300);

            this.ore.reset();
            setTimeout(() => this.ui.updateOre(this.ore), 50);
        }

        this.ui.updatePlayer(this.player);
        this.ui.updateInventory(this.player);
    }

    autoMine() {
        const dps = this.player.state.autoMinerDPS;
        if (dps <= 0) return;

        this.ore.takeDamage(dps);
        this.ui.updateOre(this.ore);

        if (this.ore.isBroken) {
            const area = this.ore.area;
            this.player.addXp(area.oreXp);
            this.player.addOre(area.id);

            this.ui.el.oreSprite.classList.add('shake');
            setTimeout(() => this.ui.el.oreSprite.classList.remove('shake'), 300);

            this.ore.reset();
            setTimeout(() => this.ui.updateOre(this.ore), 50);
        }

        this.ui.updatePlayer(this.player);
        this.ui.updateInventory(this.player);
    }

    startAutoMiner() {
        if (this.autoMinerInterval) clearInterval(this.autoMinerInterval);
        this.autoMinerInterval = setInterval(() => {
            this.autoMine();
        }, 1000);
    }

    // --- Persistence ---

    save() {
        this.player.state.lastSavedTime = Date.now();
        localStorage.setItem(SAVE_KEY, this.player.toJSON());
    }

    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                const defaults = createInitialState();
                return Object.assign({}, defaults, data);
            }
        } catch (e) {
            console.warn('Failed to load save data, starting fresh.', e);
        }
        return createInitialState();
    }

    startAutoSave() {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = setInterval(() => {
            this.save();
        }, 5000);
    }

    confirmReset() {
        if (confirm('Are you sure you want to reset? All progress will be lost forever!')) {
            localStorage.removeItem(SAVE_KEY);
            this.player.reset();
            const area = getAreaById(this.player.state.currentArea);
            this.ore = new Ore(area);
            this.ui.updateAll(this.player, this.ore);
        }
    }

    // --- Offline Progress ---

    simulateOfflineProgress() {
        const dps = this.player.state.autoMinerDPS;
        if (dps <= 0) return null;

        const now = Date.now();
        const elapsed = Math.floor((now - this.player.state.lastSavedTime) / 1000);
        if (elapsed < MIN_OFFLINE_SECONDS) return null;

        const capped = Math.min(elapsed, MAX_OFFLINE_SECONDS);
        const area = this.ore.area;
        const maxHp = this.ore.maxHp;

        const totalDamagePool = dps * capped;
        const fullOresBroken = Math.floor(totalDamagePool / maxHp);
        const remainingDamage = totalDamagePool % maxHp;

        let totalOres = fullOresBroken;
        let newHp = this.ore.currentHp;

        if (remainingDamage >= newHp) {
            totalOres++;
            newHp = maxHp - (remainingDamage - newHp);
        } else {
            newHp -= remainingDamage;
        }

        if (newHp <= 0) {
            totalOres++;
            newHp = maxHp + newHp;
        }

        const totalXp = totalOres * area.oreXp;
        this.player.addOre(area.id, totalOres);
        this.player.addXp(totalXp);

        return {
            elapsedSeconds: capped,
            oresBroken: totalOres,
            oreName: area.oreName,
            oreEmoji: area.oreEmoji,
            xpGained: totalXp,
            oreHp: newHp,
        };
    }

    showOfflineModal(result) {
        const overlay = document.getElementById('offline-overlay');
        const timeEl = document.getElementById('offline-time');
        const oresEl = document.getElementById('offline-ores');
        const xpEl = document.getElementById('offline-xp');
        const closeBtn = document.getElementById('offline-close');

        if (!overlay) return;

        timeEl.textContent = formatDuration(result.elapsedSeconds);
        oresEl.textContent = `Your auto-miners broke ${result.oresBroken.toLocaleString()} ${result.oreEmoji} ${result.oreName}!`;
        xpEl.textContent = `+${result.xpGained.toLocaleString()} XP`;

        overlay.classList.add('visible');

        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('visible');
        }, { once: true });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
            }
        }, { once: true });
    }
}

// ============================================================
//  BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    new Game();
});
