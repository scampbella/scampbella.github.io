// ============================================================
//  Clicker: Goblin Slayer — Game Engine
//  Modular vanilla JS architecture. Add enemies, shop items,
//  and challenges via the data arrays at the bottom.
// ============================================================

// === Save/Load Key ===
const SAVE_KEY = 'clicker_goblin_slayer_save';

// ============================================================
//  DATA DEFINITIONS (easy to expand)
// ============================================================

const ENEMY_TIERS = [
    { name: 'Goblin Grunt',    emoji: '👹', baseHp: 100,  gold: 10,  xp: 20,  minLevel: 1 },
    { name: 'Orc Warrior',     emoji: '👺', baseHp: 250,  gold: 25,  xp: 45,  minLevel: 10 },
    { name: 'Dark Knight',     emoji: '💀', baseHp: 500,  gold: 50,  xp: 80,  minLevel: 25 },
    { name: 'Fire Drake',      emoji: '🐉', baseHp: 1000, gold: 100, xp: 150, minLevel: 45 },
    { name: 'Lich King',       emoji: '🧙', baseHp: 2000, gold: 200, xp: 280, minLevel: 70 },
];

const SHOP_ITEMS = [
    { id: 'rusty_sword',   name: 'Rusty Sword',      desc: '+5 Attack',            stat: 'atk', amount: 5,  cost: 50 },
    { id: 'iron_sword',    name: 'Iron Sword',        desc: '+15 Attack',           stat: 'atk', amount: 15, cost: 200 },
    { id: 'steel_blade',   name: 'Steel Blade',       desc: '+40 Attack',           stat: 'atk', amount: 40, cost: 800 },
    { id: 'dragon_fang',   name: 'Dragon Fang',       desc: '+100 Attack',          stat: 'atk', amount: 100, cost: 3000 },
    { id: 'leather_armor', name: 'Leather Armor',     desc: '+3 Defense',           stat: 'def', amount: 3,  cost: 40 },
    { id: 'chainmail',     name: 'Chainmail',         desc: '+12 Defense',          stat: 'def', amount: 12, cost: 180 },
    { id: 'plate_armor',   name: 'Plate Armor',       desc: '+35 Defense',          stat: 'def', amount: 35, cost: 750 },
    { id: 'wardens_plate', name: "Warden's Plate",    desc: '+80 Defense',          stat: 'def', amount: 80, cost: 2800 },
    { id: 'health_potion', name: 'Health Potion',     desc: '+20 Max HP',           stat: 'hp',  amount: 20, cost: 60 },
    { id: 'vitality_elix', name: 'Vitality Elixir',   desc: '+60 Max HP',           stat: 'hp',  amount: 60, cost: 300 },
    { id: 'life_crystal',  name: 'Life Crystal',      desc: '+150 Max HP',          stat: 'hp',  amount: 150, cost: 1200 },
    { id: 'phoenix_heart', name: 'Phoenix Heart',     desc: '+400 Max HP',          stat: 'hp',  amount: 400, cost: 4000 },
];

const CHALLENGES = [
    { id: 'kill_10',     name: 'First Blood',     desc: 'Kill 10 enemies',            type: 'kills', target: 10,   gemReward: 5 },
    { id: 'kill_50',     name: 'Goblin Hunter',   desc: 'Kill 50 enemies',            type: 'kills', target: 50,   gemReward: 15 },
    { id: 'kill_100',    name: 'Seasoned Slayer', desc: 'Kill 100 enemies',           type: 'kills', target: 100,  gemReward: 30 },
    { id: 'kill_500',    name: 'Army of One',     desc: 'Kill 500 enemies',           type: 'kills', target: 500,  gemReward: 80 },
    { id: 'kill_1000',   name: 'Legendary Hero',  desc: 'Kill 1000 enemies',          type: 'kills', target: 1000, gemReward: 150 },
    { id: 'level_5',     name: 'Adventurer',      desc: 'Reach Level 5',              type: 'level', target: 5,    gemReward: 5 },
    { id: 'level_10',    name: 'Veteran',         desc: 'Reach Level 10',             type: 'level', target: 10,   gemReward: 15 },
    { id: 'level_25',    name: 'Champion',        desc: 'Reach Level 25',             type: 'level', target: 25,   gemReward: 30 },
    { id: 'level_50',    name: 'Demigod',         desc: 'Reach Level 50',             type: 'level', target: 50,   gemReward: 80 },
    { id: 'level_100',   name: 'Ascended',        desc: 'Reach Level 100',            type: 'level', target: 100,  gemReward: 200 },
];

// ============================================================
//  GAME STATE
// ============================================================

function createInitialState() {
    return {
        level: 1,
        xp: 0,
        gold: 0,
        gems: 0,
        statPoints: 0,
        baseHp: 100,
        baseAtk: 10,
        baseDef: 0,
        enemiesKilled: 0,
        purchasedItems: [],
        completedChallenges: [],
    };
}

// ============================================================
//  UTILITY
// ============================================================

function xpForLevel(level) {
    return Math.floor(100 * Math.pow(level, 1.5));
}

function enemyHpScalar(level) {
    return 1 + (level - 1) * 0.15;
}

// ============================================================
//  PLAYER CLASS
// ============================================================

class Player {
    constructor(state) {
        this.state = state;
        this.onStateChange = null;
    }

    get atk() {
        return this.state.baseAtk;
    }

    get def() {
        return this.state.baseDef;
    }

    get maxHp() {
        return this.state.baseHp;
    }

    get currentEnemyTier() {
        for (let i = ENEMY_TIERS.length - 1; i >= 0; i--) {
            if (this.state.level >= ENEMY_TIERS[i].minLevel) {
                return ENEMY_TIERS[i];
            }
        }
        return ENEMY_TIERS[0];
    }

    addXp(amount) {
        if (this.state.level >= 100) return;
        this.state.xp += amount;
        while (this.state.level < 100 && this.state.xp >= xpForLevel(this.state.level)) {
            this.state.xp -= xpForLevel(this.state.level);
            this.state.level++;
            this.state.statPoints++;
        }
        if (this.state.level >= 100) {
            this.state.xp = 0;
        }
        if (this.onStateChange) this.onStateChange();
    }

    addGold(amount) {
        this.state.gold += amount;
        if (this.onStateChange) this.onStateChange();
    }

    addGems(amount) {
        this.state.gems += amount;
        if (this.onStateChange) this.onStateChange();
    }

    addKill() {
        this.state.enemiesKilled++;
        if (this.onStateChange) this.onStateChange();
    }

    allocateStat(stat) {
        if (this.state.statPoints <= 0) return false;
        if (stat === 'hp') this.state.baseHp += 5;
        else if (stat === 'atk') this.state.baseAtk += 2;
        else if (stat === 'def') this.state.baseDef += 1;
        this.state.statPoints--;
        if (this.onStateChange) this.onStateChange();
        return true;
    }

    canBuy(shopItem) {
        return !this.state.purchasedItems.includes(shopItem.id) && this.state.gold >= shopItem.cost;
    }

    buyItem(shopItem) {
        if (!this.canBuy(shopItem)) return false;
        this.state.gold -= shopItem.cost;
        this.state.purchasedItems.push(shopItem.id);
        if (shopItem.stat === 'hp') this.state.baseHp += shopItem.amount;
        else if (shopItem.stat === 'atk') this.state.baseAtk += shopItem.amount;
        else if (shopItem.stat === 'def') this.state.baseDef += shopItem.amount;
        if (this.onStateChange) this.onStateChange();
        return true;
    }

    hasCompletedChallenge(id) {
        return this.state.completedChallenges.includes(id);
    }

    completeChallenge(id, gemReward) {
        if (this.hasCompletedChallenge(id)) return false;
        this.state.completedChallenges.push(id);
        this.state.gems += gemReward;
        if (this.onStateChange) this.onStateChange();
        return true;
    }

    reset() {
        this.state = createInitialState();
        if (this.onStateChange) this.onStateChange();
    }

    toJSON() {
        return JSON.stringify(this.state);
    }
}

// ============================================================
//  ENEMY CLASS
// ============================================================

class Enemy {
    constructor(playerLevel) {
        this.spawn(playerLevel);
    }

    spawn(playerLevel) {
        const tier = ENEMY_TIERS.reduce((best, t) => {
            if (playerLevel >= t.minLevel) return t;
            return best;
        }, ENEMY_TIERS[0]);

        const hpMult = enemyHpScalar(playerLevel);
        this.name = tier.name;
        this.emoji = tier.emoji;
        this.maxHp = Math.floor(tier.baseHp * hpMult);
        this.currentHp = this.maxHp;
        this.goldReward = tier.gold;
        this.xpReward = tier.xp;
    }

    takeDamage(damage) {
        this.currentHp = Math.max(0, this.currentHp - damage);
        return damage;
    }

    get isDead() {
        return this.currentHp <= 0;
    }

    get hpPercent() {
        return (this.currentHp / this.maxHp) * 100;
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
            gold:        document.getElementById('gold-display'),
            gem:         document.getElementById('gem-display'),
            level:       document.getElementById('level-display'),
            hp:          document.getElementById('hp-display'),
            atk:         document.getElementById('atk-display'),
            def:         document.getElementById('def-display'),
            kills:       document.getElementById('kills-display'),
            xpCurrent:   document.getElementById('xp-current'),
            xpNeeded:    document.getElementById('xp-needed'),
            xpBar:       document.getElementById('xp-bar-fill'),
            spDisplay:   document.getElementById('sp-display'),
            spArea:      document.getElementById('stat-points-area'),
            enemyName:   document.getElementById('enemy-name'),
            enemySprite: document.getElementById('enemy-sprite'),
            hpBar:       document.getElementById('hp-bar-fill'),
            hpText:      document.getElementById('hp-text'),
            shop:        document.getElementById('shop-items'),
            challenges:  document.getElementById('challenges-list'),
            damageFly:   document.getElementById('damage-fly'),
            goldFly:     document.getElementById('gold-fly'),
            attackBtn:   document.getElementById('attack-btn'),
            resetBtn:    document.getElementById('reset-btn'),
            allocBtns:   document.querySelectorAll('.alloc-btn'),
        };
    }

    updatePlayer(player) {
        const s = player.state;
        this.el.gold.textContent = s.gold.toLocaleString();
        this.el.gem.textContent = s.gems.toLocaleString();
        this.el.level.textContent = s.level;
        this.el.hp.textContent = player.maxHp;
        this.el.atk.textContent = player.atk;
        this.el.def.textContent = player.def;
        this.el.kills.textContent = s.enemiesKilled.toLocaleString();

        const needed = xpForLevel(s.level);
        this.el.xpCurrent.textContent = s.xp.toLocaleString();
        this.el.xpNeeded.textContent = needed.toLocaleString();
        this.el.xpBar.style.width = s.level >= 100 ? '100%' : ((s.xp / needed) * 100) + '%';

        this.el.spDisplay.textContent = s.statPoints;
        if (s.statPoints > 0) {
            this.el.spArea.classList.remove('hidden');
        } else {
            this.el.spArea.classList.add('hidden');
        }
    }

    updateEnemy(enemy) {
        this.el.enemyName.textContent = enemy.name;
        this.el.enemySprite.textContent = enemy.emoji;
        this.el.hpBar.style.width = enemy.hpPercent + '%';
        this.el.hpText.textContent = `${enemy.currentHp.toLocaleString()} / ${enemy.maxHp.toLocaleString()} HP`;

        if (enemy.hpPercent < 25) {
            this.el.hpBar.style.background = 'linear-gradient(180deg, #d9534f 0%, #a0302a 100%)';
        } else if (enemy.hpPercent < 60) {
            this.el.hpBar.style.background = 'linear-gradient(180deg, #f0ad4e 0%, #c07a20 100%)';
        } else {
            this.el.hpBar.style.background = 'linear-gradient(180deg, #5cb85c 0%, #3d8b3d 100%)';
        }
    }

    updateShop(player) {
        this.el.shop.innerHTML = SHOP_ITEMS.map(item => {
            const owned = player.state.purchasedItems.includes(item.id);
            const canAfford = player.state.gold >= item.cost;
            const disabled = owned || !canAfford;

            let btnHtml;
            if (owned) {
                btnHtml = '<span class="owned-tag">✓ Owned</span>';
            } else {
                btnHtml = `<button class="buy-btn" data-item-id="${item.id}" ${disabled ? 'disabled' : ''}>Buy</button>`;
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
    }

    updateChallenges(player) {
        this.el.challenges.innerHTML = CHALLENGES.map(c => {
            let current;
            if (c.type === 'kills') current = player.state.enemiesKilled;
            else current = player.state.level;

            const completed = player.hasCompletedChallenge(c.id);
            const pct = Math.min(100, Math.floor((current / c.target) * 100));
            const cls = completed ? 'challenge-item completed' : 'challenge-item';
            const rewardText = completed ? `💎 +${c.gemReward} (Claimed)` : `💎 +${c.gemReward} — ${pct}%`;

            return `
                <div class="${cls}">
                    <span class="challenge-name">${c.name}: ${c.desc}</span>
                    <span class="challenge-progress">${rewardText}</span>
                </div>
            `;
        }).join('');
    }

    flyDamage(amount) {
        const el = this.el.damageFly;
        el.textContent = `-${amount}`;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'flyUp 1s ease-out forwards';
    }

    flyGold(amount) {
        const el = this.el.goldFly;
        el.textContent = `+${amount} 🪙`;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'flyUp 1s ease-out forwards';
    }
}

// ============================================================
//  GAME CLASS (coordinates everything)
// ============================================================

class Game {
    constructor() {
        this.ui = new UIRenderer();
        const saved = this.load();
        this.player = new Player(saved);
        this.enemy = new Enemy(this.player.state.level);
        this.autoSaveInterval = null;

        this.player.onStateChange = () => {
            this.ui.updatePlayer(this.player);
            this.ui.updateShop(this.player);
            this.ui.updateChallenges(this.player);
            this.checkChallenges();
        };

        this.bindEvents();
        this.fullRender();
        this.startAutoSave();
    }

    bindEvents() {
        this.ui.el.attackBtn.addEventListener('click', () => this.attack());
        this.ui.el.enemySprite.addEventListener('click', () => this.attack());
        this.ui.el.resetBtn.addEventListener('click', () => this.confirmReset());
        this.ui.el.shop.addEventListener('click', (e) => {
            const btn = e.target.closest('.buy-btn');
            if (!btn) return;
            const itemId = btn.dataset.itemId;
            const item = SHOP_ITEMS.find(i => i.id === itemId);
            if (item) this.buyItem(item);
        });
        this.ui.el.allocBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const stat = btn.dataset.stat;
                this.player.allocateStat(stat);
                this.fullRender();
            });
        });
    }

    attack() {
        const atk = this.player.atk;
        const dmg = Math.max(1, atk);
        this.enemy.takeDamage(dmg);
        this.ui.flyDamage(dmg);
        this.ui.updateEnemy(this.enemy);

        if (this.enemy.isDead) {
            const goldEarned = this.enemy.goldReward;
            const xpEarned = this.enemy.xpReward;

            this.player.addGold(goldEarned);
            this.player.addXp(xpEarned);
            this.player.addKill();
            this.ui.flyGold(goldEarned);

            this.enemy.spawn(this.player.state.level);
            this.ui.updateEnemy(this.enemy);
        }
    }

    buyItem(item) {
        if (this.player.buyItem(item)) {
            this.fullRender();
        }
    }

    checkChallenges() {
        CHALLENGES.forEach(c => {
            let current;
            if (c.type === 'kills') current = this.player.state.enemiesKilled;
            else current = this.player.state.level;

            if (current >= c.target && !this.player.hasCompletedChallenge(c.id)) {
                this.player.completeChallenge(c.id, c.gemReward);
                this.ui.updateChallenges(this.player);
            }
        });
    }

    fullRender() {
        this.ui.updatePlayer(this.player);
        this.ui.updateEnemy(this.enemy);
        this.ui.updateShop(this.player);
        this.ui.updateChallenges(this.player);
    }

    // --- Persistence ---

    save() {
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
        if (confirm('Are you sure you want to hard reset? All progress will be lost forever!')) {
            localStorage.removeItem(SAVE_KEY);
            this.player.reset();
            this.enemy.spawn(1);
            this.fullRender();
        }
    }
}

// ============================================================
//  BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    new Game();
});