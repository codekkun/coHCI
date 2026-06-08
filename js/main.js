const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

window.GAME_WIDTH = W;
window.GAME_HEIGHT = H;

const ui = {
    cameraStatus: document.getElementById("cameraStatus"),
};

const GAME = {
    MENU: 0,
    SETTINGS: 1,
    PLAYING: 2,
    GAMEOVER: 3,
    SHOP: 4,
};

const MODES = {
    classic: 1,
    zen: 2,
    arcade: 3,
};

const REQUIRED_HOLD_MS = 900;

// 将原本的 menuItems 替换为以下代码：
const menuItems = [
    { text: "经典模式", mode: MODES.classic, x: W / 2, y: 220, color: "#7ef7c5" },
    { text: "禅意模式", mode: MODES.zen, x: W / 2, y: 320, color: "#6db8ff" },
    { text: "街机模式", mode: MODES.arcade, x: W / 2, y: 420, color: "#dba4ff" },
    { text: "设置", mode: "settings", x: W / 2, y: 520, color: "#ffd166" },
    { text: "商店", mode: "shop", x: W - 160, y: H - 50, color: "#ff9f1c" }, // 移动到右下角
];

const settingsItems = [
    { action: "toggleMute", text: () => `静音：${window.settings && window.settings.muted ? "开" : "关"}`, x: W / 2, y: 220, color: "#7ef7c5" },
    { action: "togglePreview", text: () => `摄像头画面：${window.settings && window.settings.showCameraPreview === false ? "关" : "开"}`, x: W / 2, y: 320, color: "#6db8ff" },
    { action: "sensitivitySlider", text: () => "灵敏度", x: W / 2, y: 420, color: "#ffd166" },
    { action: "back", text: () => "返回菜单", x: W / 2, y: 520, color: "#dba4ff" },
];

const gameoverItems = [
    { text: "重新开始", action: "restart", x: W / 2 - 150, y: 405, color: "#7ef7c5" },
    { text: "返回菜单", action: "menu", x: W / 2 + 150, y: 405, color: "#ffd166" },
];

let gameState = GAME.MENU;
let chosenMode = MODES.classic;
let score = 0;
let lives = 3;
let remainingTime = 0;
let fruits = [];
let particles = [];
let slices = [];
let splats = [];
let trail = [];
let menuHold = [0, 0, 0, 0,0];
let gameoverHold = [0, 0];
let playExitHold = 0;
let mouseX = W / 2;
let mouseY = H / 2;
let mouseMovedRecently = false;
let lastTimestamp = 0;
let pointerX = mouseX;
let pointerY = mouseY;
let lastInputWasHand = false;
let usingMouse = false;
let settingsHold = [0, 0, 0, 0];
let settingsSliderDragging = false;
let settingsSliderDragSource = null;
let settingsSliderDragTarget = null; // "sensitivity" | "music" | "sfx"
let settingsLatchedIndex = -1;
// 金钱与商店数据
let money = parseInt(localStorage.getItem("fn_money") || "0");
let clearItems = parseInt(localStorage.getItem("fn_clear_items") || "0");
let unlockedColors = JSON.parse(localStorage.getItem("fn_colors") || '["#cff4ff"]'); // 默认初始颜色
let currentColor = localStorage.getItem("fn_current_color") || "#cff4ff";

// 状态控制
let fistLatched = false; // 用于防止长按拳头触发多次清屏
let shopHold = [0, 0, 0, 0]; // 控制商店商品的长按购买
let shopExitHold = 0; 
let shopMessage = "";        // 商店提示信息文本
let shopMessageTimer = 0;

const shopItems = [
    { type: "item", text: "清屏道具 (¥50)", cost: 50, x: W / 2 - 200, y: 250, color: "#ff6b6b" },
    { type: "color", text: "红色刀刃 (¥100)", cost: 100, value: "#ff4b4b", x: W / 2 + 200, y: 250, color: "#ff4b4b" },
    { type: "color", text: "金色刀刃 (¥150)", cost: 150, value: "#ffd166", x: W / 2 - 200, y: 380, color: "#ffd166" },
    { type: "color", text: "绿色刀刃 (¥150)", cost: 150, value: "#7ef7c5", x: W / 2 + 200, y: 380, color: "#7ef7c5" },
];

function updateShop(delta, input) {
    drawText("商 店", W / 2, 88, 58, "#ffffff");
    drawText(`💰 当前金币: ${money}   |   💣 清屏道具: ${clearItems}`, W / 2, 150, 24, "#ffd166");
    
    // 返回按钮
    const exitLeft = W / 2 - 60, exitTop = H - 90, exitWidth = 120, exitHeight = 50;
    const exitHovered = input.x >= exitLeft && input.x <= exitLeft + exitWidth && input.y >= exitTop && input.y <= exitTop + exitHeight;
    if (exitHovered) shopExitHold = Math.min(REQUIRED_HOLD_MS, shopExitHold + delta);
    else shopExitHold = Math.max(0, shopExitHold - delta * 2);
    
    drawRoundedRect(exitLeft, exitTop, exitWidth, exitHeight, 18, exitHovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)", exitHovered ? "#ffb84d" : "rgba(255,255,255,0.12)");
    drawText("返回", exitLeft + exitWidth / 2, exitTop + exitHeight / 2, 24, exitHovered ? "#ffb84d" : "#ffffff");
    drawLoadingArc(exitLeft + exitWidth / 2, exitTop + exitHeight + 6, 18, shopExitHold / REQUIRED_HOLD_MS, "#ffb84d");
    
    if (shopExitHold >= REQUIRED_HOLD_MS) {
        returnToMenu(); // 返回菜单
        return;
    }

    // 绘制并判定商店物品
    let hoveredIndex = -1;
    let hoveredDist = Infinity;
    shopItems.forEach((item, index) => {
        const dist = distance(input.x, input.y, item.x, item.y);
        if (dist <= 100 && dist < hoveredDist) {
            hoveredDist = dist;
            hoveredIndex = index;
        }
    });

    shopItems.forEach((item, index) => {
        const hovered = index === hoveredIndex;
        if (hovered) {
            shopHold[index] = Math.min(REQUIRED_HOLD_MS, shopHold[index] + delta);
        } else {
            shopHold[index] = Math.max(0, shopHold[index] - delta * 2);
        }
        
        let displayStr = item.text;
        let isBought = false;
        
        // 判断饰品是否已经解锁或装备
        if (item.type === "color") {
            isBought = unlockedColors.includes(item.value);
            if (isBought) displayStr = currentColor === item.value ? "已装备" : "装备";
        }
        
        const canAfford = money >= item.cost;
        const color = (!isBought && !canAfford) ? "#666666" : item.color; // 买不起显示为灰色
        
        drawText(displayStr, item.x, item.y, 24, color);
        drawLoadingArc(item.x, item.y, 70, shopHold[index] / REQUIRED_HOLD_MS, color);
        
        // 判定长按购买/装备成功
        if (shopHold[index] >= REQUIRED_HOLD_MS) {
            shopHold[index] = 0; // 重置进度条
            
            if (item.type === "item") {
                if (money >= item.cost) {
                    money -= item.cost;
                    clearItems += 1;
                    if (window.playSound) window.playSound("ui");
                } else if (window.playSound) window.playSound("miss");
            } else if (item.type === "color") {
                if (isBought) {
                    currentColor = item.value; // 切换装备
                    if (window.playSound) window.playSound("ui");
                } else if (money >= item.cost) {
                    money -= item.cost; // 购买并装备
                    unlockedColors.push(item.value);
                    currentColor = item.value;
                    if (window.playSound) window.playSound("ui");
                } else if (window.playSound) window.playSound("miss");
            }
            saveShopData();
        }
    });
    if (shopMessageTimer > 0) {
        shopMessageTimer -= delta; // 根据帧时间递减
        // 让提示栏在最后 300 毫秒有一个平滑的淡出消失效果
        const alpha = Math.max(0, Math.min(1, shopMessageTimer / 300)); 
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        const msgWidth = 320;
        const msgHeight = 56;
        const msgX = W / 2 - msgWidth / 2;
        const msgY = H - 160; // 悬浮在返回按钮的上方
        
        // 画一个带红色边框的半透明警示框
        drawRoundedRect(msgX, msgY, msgWidth, msgHeight, 15, "rgba(255, 75, 75, 0.15)", "rgba(255, 75, 75, 0.8)");
        drawText(shopMessage, W / 2, msgY + msgHeight / 2, 24, "#ff4b4b");
        
        ctx.restore();
    }
}
function saveShopData() {
    localStorage.setItem("fn_money", money);
    localStorage.setItem("fn_clear_items", clearItems);
    localStorage.setItem("fn_colors", JSON.stringify(unlockedColors));
    localStorage.setItem("fn_current_color", currentColor);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}

function getSettingsState() {
    if (!window.settings) {
        window.settings = { muted: false, sensitivity: 1.0, showCameraPreview: true, musicVolume: 0.45, sfxVolume: 0.8 };
    }
    return window.settings;
}

function applySettingsState() {
    const settings = getSettingsState();
    if (window.setMuted) {
        window.setMuted(!!settings.muted);
    }
    if (window.setCameraPreviewVisible) {
        window.setCameraPreviewVisible(!!settings.showCameraPreview);
    }
    if (window.setMusicVolume && typeof settings.musicVolume !== "undefined") {
        window.setMusicVolume(Number(settings.musicVolume));
    }
    if (window.setSfxVolume && typeof settings.sfxVolume !== "undefined") {
        window.setSfxVolume(Number(settings.sfxVolume));
    }
}

function saveSettings() {
    const settings = getSettingsState();
    localStorage.setItem("cohci_settings", JSON.stringify(settings));
}

function changeSensitivity(delta) {
    const settings = getSettingsState();
    settings.sensitivity = clamp(Math.round(((Number(settings.sensitivity) || 1.0) + delta) * 20) / 20, 0.6, 1.6);
    saveSettings();
}

function setSensitivityFromSliderX(x) {
    const left = W / 2 - 180;
    const right = W / 2 + 180;
    const ratio = clamp((x - left) / (right - left), 0, 1);
    const value = 0.6 + ratio * (1.6 - 0.6);
    const settings = getSettingsState();
    settings.sensitivity = Math.round(value * 20) / 20;
    saveSettings();
}

function setMusicFromSliderX(x) {
    const left = W / 2 - 180;
    const right = W / 2 + 180;
    const ratio = clamp((x - left) / (right - left), 0, 1);
    const settings = getSettingsState();
    settings.musicVolume = Math.round(ratio * 100) / 100;
    saveSettings();
    if (window.setMusicVolume) window.setMusicVolume(settings.musicVolume);
}

function setSfxFromSliderX(x) {
    const left = W / 2 - 180;
    const right = W / 2 + 180;
    const ratio = clamp((x - left) / (right - left), 0, 1);
    const settings = getSettingsState();
    settings.sfxVolume = Math.round(ratio * 100) / 100;
    saveSettings();
    if (window.setSfxVolume) window.setSfxVolume(settings.sfxVolume);
}

function toggleSetting(key) {
    const settings = getSettingsState();
    settings[key] = !settings[key];
    applySettingsState();
    saveSettings();
}

function drawText(text, x, y, size = 48, color = "#ffffff", align = "center") {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle = null) {
    const right = x + width;
    const bottom = y + height;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(right, y, right, bottom, radius);
    ctx.arcTo(right, bottom, x, bottom, radius);
    ctx.arcTo(x, bottom, x, y, radius);
    ctx.arcTo(x, y, right, y, radius);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawLoadingArc(centerX, centerY, radius, progress, color) {
    if (progress <= 0) {
        return;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress), false);
    ctx.stroke();
    ctx.restore();
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#0d1629");
    gradient.addColorStop(0.55, "#152841");
    gradient.addColorStop(1, "#0f1320");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const blobs = [
        { x: 120, y: 90, r: 140, color: "rgba(126, 247, 197, 0.10)" },
        { x: 760, y: 110, r: 170, color: "rgba(255, 209, 102, 0.10)" },
        { x: 680, y: 500, r: 180, color: "rgba(110, 144, 255, 0.12)" },
    ];

    blobs.forEach((blob) => {
        const glow = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
        glow.addColorStop(0, blob.color);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawTrail() {
    if (trail.length < 2) {
        return;
    }

    ctx.save();
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i += 1) {
        const alpha = i / trail.length;
        ctx.strokeStyle = `rgba(207, 244, 255, ${0.18 + alpha * 0.82})`;
        ctx.lineWidth = 3 + alpha * 10;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
    }
    ctx.restore();
}

function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if(h.length === 3) h = h.split('').map(c=>c+c).join('');
    return `${parseInt(h.substring(0,2),16)}, ${parseInt(h.substring(2,4),16)}, ${parseInt(h.substring(4,6),16)}`;
}

function drawTrail() {
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    
    // 获取当前装备的刀刃颜色
    const rgbStr = hexToRgb(currentColor);

    for (let i = 1; i < trail.length; i += 1) {
        const alpha = i / trail.length;
        // 注入当前颜色并保留原有的渐隐透明度效果
        ctx.strokeStyle = `rgba(${rgbStr}, ${0.18 + alpha * 0.82})`; 
        ctx.lineWidth = 3 + alpha * 10;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
    }
    ctx.restore();
}
function checkSlicePerfect(center, radius, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
        return distance(center.x, center.y, start.x, start.y) <= radius + 8;
    }

    const t = clamp(((center.x - start.x) * dx + (center.y - start.y) * dy) / lengthSq, 0, 1);
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return distance(center.x, center.y, projX, projY) <= radius + 10;
}

class Fruit {
    constructor(mode) {
        const pool = mode === MODES.zen
            ? ["apple", "orange", "banana", "watermelon"]
            : ["apple", "apple", "orange", "orange", "banana", "banana", "watermelon", "watermelon", "apple", "orange", "banana", "watermelon", "bomb"];

        this.type = pool[Math.floor(Math.random() * pool.length)];
        this.r = this.type === "bomb" ? 40 : 38;
        this.x = Math.random() * (W - 300) + 150;
        this.y = H + 50;
        this.vx = Math.random() * 6 - 3;
        this.vy = -Math.random() * 5 - 13;
        this.gravity = 0.30;
        this.rotation = Math.random() * Math.PI * 2;
        this.spin = Math.random() * 0.12 - 0.06;
        this.alive = true;
    }

    update(step = 1) {
        this.vy += this.gravity * step;
        this.x += this.vx * step;
        this.y += this.vy * step;
        this.rotation += this.spin * step;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === "bomb") {
            ctx.fillStyle = "#1f232b";
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ff4d4d";
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.strokeStyle = "#ffd166";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, -this.r - 8);
            ctx.lineTo(10, -this.r - 24);
            ctx.stroke();
            ctx.fillStyle = "#ffd166";
            ctx.beginPath();
            ctx.arc(10, -this.r - 24, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const palette = {
                apple: { skin: "#ff4b4b", flesh: "#ffd7d7", leaf: "#5ec58f" },
                orange: { skin: "#ff9f1c", flesh: "#ffe1af", leaf: "#4caf50" },
                banana: { skin: "#ffe066", flesh: "#fff5b0", leaf: "#67c587" },
                watermelon: { skin: "#4caf50", flesh: "#ff7383", leaf: "#2d9c61" },
            }[this.type];

            ctx.fillStyle = palette.skin;
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = palette.flesh;
            ctx.beginPath();
            ctx.arc(0, 0, this.r - 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = palette.skin;
            ctx.beginPath();
            ctx.arc(0, 0, this.r - 16, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
            ctx.beginPath();
            ctx.ellipse(-this.r * 0.28, -this.r * 0.24, this.r * 0.18, this.r * 0.28, -0.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = palette.leaf;
            ctx.beginPath();
            ctx.ellipse(this.r * 0.18, -this.r * 0.96, this.r * 0.18, this.r * 0.4, -0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class HalfFruitSlice {
    constructor(x, y, vx, vy, type, side) {
        this.x = x;
        this.y = y;
        this.vx = vx + (side === "left" ? -3 : 3);
        this.vy = vy - 2;
        this.gravity = 0.34;
        this.type = type;
        this.side = side;
        this.life = 40;
        this.angle = 0;
        this.spin = Math.random() * 10 - 5;
        this.r = 38;
    }

    update(step = 1) {
        this.vy += this.gravity * step;
        this.x += this.vx * step;
        this.y += this.vy * step;
        this.angle += this.spin * step;
        this.life -= step;
    }

    draw() {
        const palette = {
            apple: { skin: "#ff4b4b", flesh: "#ffd7d7" },
            orange: { skin: "#ff9f1c", flesh: "#ffe1af" },
            banana: { skin: "#ffe066", flesh: "#fff5b0" },
            watermelon: { skin: "#4caf50", flesh: "#ff7383" },
        }[this.type];

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * Math.PI / 180);

        ctx.fillStyle = palette.skin;
        ctx.beginPath();
        if (this.side === "left") {
            ctx.arc(0, 0, this.r, Math.PI / 2, -Math.PI / 2, true);
            ctx.lineTo(0, this.r);
        } else {
            ctx.arc(0, 0, this.r, -Math.PI / 2, Math.PI / 2, true);
            ctx.lineTo(0, this.r);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.flesh;
        ctx.beginPath();
        if (this.side === "left") {
            ctx.arc(0, 0, this.r - 6, Math.PI / 2, -Math.PI / 2, true);
            ctx.lineTo(0, this.r - 6);
        } else {
            ctx.arc(0, 0, this.r - 6, -Math.PI / 2, Math.PI / 2, true);
            ctx.lineTo(0, this.r - 6);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.random() * 10 - 5;
        this.vy = Math.random() * -5 - 1;
        this.color = color;
        this.radius = Math.random() * 3 + 2;
        this.life = 25;
    }

    update(step = 1) {
        this.vy += 0.22 * step;
        this.x += this.vx * step;
        this.y += this.vy * step;
        this.life -= step;
    }

    draw() {
        if (this.life <= 0) {
            return;
        }
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class SplatJuice {
    constructor(x, y, color) {
        this.x = x + Math.random() * 30 - 15;
        this.y = y + Math.random() * 30 - 15;
        this.color = color;
        this.radius = Math.random() * 18 + 22;
        this.alpha = 180;
    }

    update(step = 1) {
        this.alpha = Math.max(0, this.alpha - 2 * step);
    }

    draw() {
        if (this.alpha <= 0) {
            return;
        }
        ctx.save();
        ctx.globalAlpha = this.alpha / 255;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 4; i += 1) {
            const angle = (Math.PI * 2 * i) / 4;
            ctx.beginPath();
            ctx.arc(this.x + Math.cos(angle) * this.radius * 0.45, this.y + Math.sin(angle) * this.radius * 0.45, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

function resetGame(mode) {
    chosenMode = mode;
    score = 0;
    lives = 3;
    fruits = [];
    particles = [];
    slices = [];
    splats = [];
    trail = [];
    menuHold = [0, 0, 0, 0];
    gameoverHold = [0, 0];
    playExitHold = 0;

    if (mode === MODES.zen) {
        remainingTime = 90;
    } else if (mode === MODES.arcade) {
        remainingTime = 60;
    } else {
        remainingTime = 0;
    }

    gameState = GAME.PLAYING;
    if (window.playSound) {
        if (window.playStart) window.playStart();
    }
    syncBgmForScene();
}

function returnToMenu() {
    gameState = GAME.MENU;
    fruits = [];
    particles = [];
    slices = [];
    splats = [];
    trail = [];
    menuHold = [0, 0, 0, 0];
    gameoverHold = [0, 0];
    playExitHold = 0;
    if (ui.cameraStatus) {
        ui.cameraStatus.textContent = window.cameraReady ? "摄像头已连接" : "鼠标模式运行中";
    }
    syncBgmForScene();
}

function syncBgmForScene() {
    if (!window.playBgm) {
        return;
    }
    if (window.settings && window.settings.muted) {
        if (window.stopBgm) {
            window.stopBgm();
        }
        return;
    }

    if (gameState === GAME.PLAYING) {
        window.playBgm(chosenMode === MODES.classic ? "classic" : chosenMode === MODES.zen ? "zen" : "arcade");
    } else {
        window.playBgm("menu");
    }
}

function getInputPosition() {
    const cameraActive = window.handTracked && window.cameraReady;
    // active when camera active or mouse recently moved or already using mouse
    const active = cameraActive || mouseMovedRecently || usingMouse;

    // Decide target source:
    // - If camera active -> follow hand
    // - Else if mouse moved recently -> start using mouse and follow mouse
    // - Else if already usingMouse -> keep following mouse
    // - Else -> keep current pointer (do not jump to mouse)
    let targetX, targetY;
    if (cameraActive) {
        targetX = clamp(window.handX, 0, W);
        targetY = clamp(window.handY, 0, H);
        usingMouse = false;
    } else if (mouseMovedRecently) {
        usingMouse = true;
        targetX = clamp(mouseX, 0, W);
        targetY = clamp(mouseY, 0, H);
    } else if (usingMouse) {
        targetX = clamp(mouseX, 0, W);
        targetY = clamp(mouseY, 0, H);
    } else {
        // keep pointer where it is
        targetX = pointerX;
        targetY = pointerY;
    }

    // 平滑：手势时响应快，鼠标切换时平滑过渡避免瞬移
    let alpha;
    if (cameraActive) {
        alpha = 0.7; // 手势跟随较快
    } else {
        // 如果刚从手势切换到鼠标，使用更小的 alpha 以平滑过渡
        alpha = lastInputWasHand ? 0.12 : 0.28;
    }

    pointerX = pointerX + (targetX - pointerX) * alpha;
    pointerY = pointerY + (targetY - pointerY) * alpha;

    lastInputWasHand = cameraActive;

    return { x: pointerX, y: pointerY, active, fist: Boolean(window.isFist && cameraActive) };
}

// 在一组交互 item 中选出距离指针最近且在阈值内的索引
function getHoveredIndex(items, px, py, radius) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const d = distance(px, py, it.x, it.y);
        if (d <= radius && d < bestDist) {
            bestDist = d;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function spawnFruit(step) {
    const chance = chosenMode === MODES.classic ? 0.05 : chosenMode === MODES.zen ? 0.045 : 0.055;
    if (Math.random() < chance * step) {
        fruits.push(new Fruit(chosenMode));
    }
}

function updateMenu(delta, input) {
    drawText("Select Game Mode", W / 2, 88, 58, "#ffffff");
    drawText("挥动或移动光标到按钮上，停留片刻即可开始", W / 2, 132, 24, "rgba(255,255,255,0.78)");

    let trigger = null;
    let hoveredIndex = -1;
    let hoveredDistance = Infinity;
    menuItems.forEach((item, index) => {
        const hitRadius = item.mode === "settings" ? 160 : 120;
        const dist = distance(input.x, input.y, item.x, item.y);
        if (dist <= hitRadius && dist < hoveredDistance) {
            hoveredDistance = dist;
            hoveredIndex = index;
        }
    });
    menuItems.forEach((item, index) => {
        const hovered = index === hoveredIndex;
        if (hovered) {
            menuHold[index] = Math.min(REQUIRED_HOLD_MS, menuHold[index] + delta);
        } else {
            menuHold[index] = Math.max(0, menuHold[index] - delta * 2);
        }

        drawRoundedRect(item.x - 150, item.y - 36, 300, 72, 22, hovered ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)", hovered ? item.color : "rgba(255,255,255,0.12)");
        drawText(item.text, item.x, item.y - 4, 36, hovered ? item.color : "#ffffff");
        drawLoadingArc(item.x, item.y + 30, 38, menuHold[index] / REQUIRED_HOLD_MS, item.color);

        if (menuHold[index] >= REQUIRED_HOLD_MS) {
            trigger = item;
        }
    });

    if (trigger) {
        if (trigger.mode === "settings") {
            gameState = GAME.SETTINGS;
            settingsHold = [0, 0, 0, 0];
            settingsSliderDragging = false;
            settingsSliderDragSource = null;
            settingsLatchedIndex = -1;
        } else if (trigger.mode === "shop") { 
            gameState = GAME.SHOP;
        } else { 
            resetGame(trigger.mode);
        }
    }
}

function updateSettings(delta, input) {
    drawText("Settings", W / 2, 90, 58, "#ffffff");
    drawText("同样支持鼠标或手势，停留 1 秒即可选中", W / 2, 132, 24, "rgba(255,255,255,0.78)");
    drawText(`当前灵敏度：${(getSettingsState().sensitivity || 1.0).toFixed(2)}  |  攥拳时才使用灵敏度加成`, W / 2, 170, 22, "rgba(255,255,255,0.62)");

    const centerX = W / 2;
    const sliderLeft = centerX - 180;
    const sliderRight = centerX + 180;
    const sliderYs = [240, 330, 420];
    const muteX = 110;
    const muteY = 320;
    const cameraX = W - 110;
    const cameraY = 320;

    settingsItems[0].x = muteX;
    settingsItems[0].y = muteY;
    settingsItems[1].x = cameraX;
    settingsItems[1].y = cameraY;
    settingsItems[2].x = centerX;
    settingsItems[2].y = 390;

    const hoveredIndex = getHoveredIndex(settingsItems, input.x, input.y, 130);
    let trigger = null;

    if (hoveredIndex !== settingsLatchedIndex) {
        settingsLatchedIndex = -1;
    }

    settingsItems.forEach((item, index) => {
        const hovered = index === hoveredIndex;
        const label = item.text();
        if (index === 2) {
            // Draw three separate slider cards in the middle column.
            const labels = ["灵敏度", "音乐音量", "音效音量"];
            const settings = getSettingsState();
            const values = [settings.sensitivity || 1.0, settings.musicVolume || 0.45, settings.sfxVolume || 0.8];

            for (let si = 0; si < 3; si += 1) {
                const y = sliderYs[si];
                const top = y - 28;
                const bottom = y + 28;
                const sliderHovered = input.x >= sliderLeft && input.x <= sliderRight && input.y >= top && input.y <= bottom;
                if (sliderHovered && input.fist) {
                    settingsSliderDragging = true;
                    settingsSliderDragSource = "hand";
                    settingsSliderDragTarget = si === 0 ? "sensitivity" : si === 1 ? "music" : "sfx";
                }
                const rowHovered = sliderHovered || (settingsSliderDragging && settingsSliderDragTarget === (si === 0 ? "sensitivity" : si === 1 ? "music" : "sfx"));

                drawRoundedRect(sliderLeft - 10, y - 28, 380, 56, 18, rowHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", rowHovered ? item.color : "rgba(255,255,255,0.10)");
                drawText(labels[si], centerX, y - 10, 24, rowHovered ? item.color : "#ffffff");

                ctx.save();
                ctx.strokeStyle = "rgba(255,255,255,0.35)";
                ctx.lineWidth = 8;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(sliderLeft, y + 10);
                ctx.lineTo(sliderRight, y + 10);
                ctx.stroke();

                let handleX;
                if (si === 0) {
                    const v = values[0];
                    handleX = sliderLeft + ((v - 0.6) / (1.6 - 0.6)) * (sliderRight - sliderLeft);
                } else {
                    const v = values[si];
                    handleX = sliderLeft + (v) * (sliderRight - sliderLeft);
                }

                ctx.strokeStyle = item.color;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(sliderLeft, y + 10);
                ctx.lineTo(handleX, y + 10);
                ctx.stroke();

                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(handleX, y + 10, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                const valueText = si === 0 ? (values[0] || 1.0).toFixed(2) : Math.round((values[si] || 0) * 100) + "%";
                drawText(valueText, sliderRight + 52, y - 10, 18, item.color, "right");

                if (settingsSliderDragging && settingsSliderDragTarget === (si === 0 ? "sensitivity" : si === 1 ? "music" : "sfx")) {
                    if (settingsSliderDragTarget === "sensitivity") setSensitivityFromSliderX(input.x);
                    else if (settingsSliderDragTarget === "music") setMusicFromSliderX(input.x);
                    else if (settingsSliderDragTarget === "sfx") setSfxFromSliderX(input.x);
                }
            }

            if (settingsSliderDragSource === "hand" && !input.fist) {
                settingsSliderDragging = false;
                settingsSliderDragSource = null;
                settingsSliderDragTarget = null;
            }

            if (settingsSliderDragging) {
                trigger = null;
            }
        } else {
            // 对于静音和摄像头开关，显示为右侧的小圆形控件
            if (item.action === "toggleMute" || item.action === "togglePreview") {
                const cx = item.x;
                const cy = item.y;
                const r = 34;
                const hoveredToggle = distance(input.x, input.y, cx, cy) <= r + 12;

                if (hoveredToggle && settingsLatchedIndex !== index) {
                    settingsHold[index] = Math.min(REQUIRED_HOLD_MS, settingsHold[index] + delta);
                } else {
                    settingsHold[index] = Math.max(0, settingsHold[index] - delta * 2);
                }

                // draw label above the circle
                drawText(label, cx, cy - r - 18, 22, "#ffffff");

                // draw circular toggle
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = hoveredToggle ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)";
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = hoveredToggle ? item.color : "rgba(255,255,255,0.12)";
                ctx.stroke();

                const stateVal = item.action === "toggleMute" ? (getSettingsState().muted ? 1 : 0) : (getSettingsState().showCameraPreview === false ? 0 : 1);
                // inner indicator
                ctx.beginPath();
                ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = stateVal ? item.color : "rgba(255,255,255,0.12)";
                ctx.fill();
                ctx.restore();

                drawLoadingArc(cx, cy + r + 10, 14, settingsHold[index] / REQUIRED_HOLD_MS, item.color);

                if (settingsHold[index] >= REQUIRED_HOLD_MS) {
                    trigger = item.action;
                }

            } else {
                if (hovered && settingsLatchedIndex !== index) {
                    settingsHold[index] = Math.min(REQUIRED_HOLD_MS, settingsHold[index] + delta);
                } else {
                    settingsHold[index] = Math.max(0, settingsHold[index] - delta * 2);
                }

                drawRoundedRect(item.x - 180, item.y - 36, 360, 72, 22, hovered ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)", hovered ? item.color : "rgba(255,255,255,0.12)");
                drawText(label, item.x, item.y - 4, 34, hovered ? item.color : "#ffffff");
                drawLoadingArc(item.x, item.y + 30, 38, settingsHold[index] / REQUIRED_HOLD_MS, item.color);

                if (settingsHold[index] >= REQUIRED_HOLD_MS) {
                    trigger = item.action;
                }
            }
        }
    });

    if (trigger === "toggleMute") {
        toggleSetting("muted");
        syncBgmForScene();
        settingsLatchedIndex = hoveredIndex;
        settingsHold = [0, 0, 0, 0];
    } else if (trigger === "togglePreview") {
        toggleSetting("showCameraPreview");
        settingsLatchedIndex = hoveredIndex;
        settingsHold = [0, 0, 0, 0];
    } else if (trigger === "back") {
        returnToMenu();
        gameState = GAME.MENU;
    }

    if (hoveredIndex === -1) {
        settingsLatchedIndex = -1;
        settingsHold = [0, 0, 0, 0];
        settingsSliderDragging = false;
        settingsSliderDragSource = null;
        settingsSliderDragTarget = null;
    }
}

function updatePlaying(delta, input) {
    const exitLeft = 20;
    const exitTop = 18;
    const exitWidth = 120;
    const exitHeight = 44;
    const exitHovered = input.x >= exitLeft && input.x <= exitLeft + exitWidth && input.y >= exitTop && input.y <= exitTop + exitHeight;

    if (exitHovered) {
        playExitHold = Math.min(REQUIRED_HOLD_MS, playExitHold + delta);
    } else {
        playExitHold = Math.max(0, playExitHold - delta * 2);
    }

    drawRoundedRect(exitLeft, exitTop, exitWidth, exitHeight, 18, exitHovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)", exitHovered ? "#ffb84d" : "rgba(255,255,255,0.12)");
    drawText("退出", exitLeft + exitWidth / 2, exitTop + exitHeight / 2 - 1, 24, exitHovered ? "#ffb84d" : "#ffffff");
    drawLoadingArc(exitLeft + exitWidth / 2, exitTop + exitHeight + 6, 18, playExitHold / REQUIRED_HOLD_MS, "#ffb84d");

    if (playExitHold >= REQUIRED_HOLD_MS) {
        returnToMenu();
        return;
    }

    if (chosenMode === MODES.zen || chosenMode === MODES.arcade) {
        remainingTime -= delta / 1000;
        if (remainingTime <= 0) {
            gameState = GAME.GAMEOVER;
            if (window.playGameOver) window.playGameOver();
            return;
        }
    }

    trail.push({ x: input.x, y: input.y });
    if (trail.length > 14) {
        trail.shift();
    }

    spawnFruit(delta / 16.67);

    fruits.forEach((fruit) => fruit.update(delta / 16.67));

    fruits.forEach((fruit) => {
        if (!fruit.alive) {
            return;
        }

        for (let i = 1; i < trail.length; i += 1) {
            if (checkSlicePerfect({ x: fruit.x, y: fruit.y }, fruit.r, trail[i - 1], trail[i])) {
                fruit.alive = false;
                if (window.playSound) {
                    if (fruit.type === "bomb") {
                        if (window.playBomb) window.playBomb();
                    } else {
                        if (window.playHit) window.playHit();
                    }
                }

                if (fruit.type === "bomb") {
                    if (chosenMode === MODES.classic) {
                        gameState = GAME.GAMEOVER;
                        if (window.playGameOver) window.playGameOver();
                    } else if (chosenMode === MODES.arcade) {
                        score = Math.max(0, score - 20);
                    }
                } else {
                    score += 10;
                    money += 1;
                    saveShopData();
                    const palette = {
                        apple: { flesh: "rgba(255, 128, 128, 0.95)", skin: "rgba(255, 77, 77, 0.95)" },
                        orange: { flesh: "rgba(255, 214, 150, 0.95)", skin: "rgba(255, 159, 28, 0.95)" },
                        banana: { flesh: "rgba(255, 245, 176, 0.95)", skin: "rgba(255, 224, 102, 0.95)" },
                        watermelon: { flesh: "rgba(255, 115, 131, 0.95)", skin: "rgba(76, 175, 80, 0.95)" },
                    }[fruit.type];
                    splats.push(new SplatJuice(fruit.x, fruit.y, palette.flesh));
                    slices.push(new HalfFruitSlice(fruit.x, fruit.y, fruit.vx, fruit.vy, fruit.type, "left"));
                    slices.push(new HalfFruitSlice(fruit.x, fruit.y, fruit.vx, fruit.vy, fruit.type, "right"));
                    for (let j = 0; j < 12; j += 1) {
                        particles.push(new Particle(fruit.x, fruit.y, palette.skin));
                    }
                }
                break;
            }
        }

        if (fruit.alive && fruit.y > H + 60 && fruit.vy > 0) {
            fruit.alive = false;
            if (chosenMode === MODES.classic && fruit.type !== "bomb") {
                lives -= 1;
                if (window.playMiss) window.playMiss();
                if (lives <= 0) {
                    gameState = GAME.GAMEOVER;
                    if (window.playGameOver) window.playGameOver();
                }
            }
        }
    });

    fruits = fruits.filter((fruit) => fruit.alive && fruit.y < H + 80);
    particles = particles.filter((particle) => particle.life > 0);
    slices = slices.filter((slice) => slice.life > 0);
    splats = splats.filter((splat) => splat.alpha > 0);

    particles.forEach((particle) => particle.update(delta / 16.67));
    slices.forEach((slice) => slice.update(delta / 16.67));
    splats.forEach((splat) => splat.update(delta / 16.67));

    drawTrail();
    fruits.forEach((fruit) => fruit.draw());
    slices.forEach((slice) => slice.draw());
    particles.forEach((particle) => particle.draw());
    splats.forEach((splat) => splat.draw());

    drawText(`Score: ${score}`, 80, 80, 30, "#ffffff", "left");
    drawText(`💰 金币: ${money}`, W / 2, 45, 24, "#ffd166", "center");
drawText(`💣 清屏道具: ${clearItems}`, W / 2, 80, 20, "#ff6b6b", "center");
    if (chosenMode === MODES.classic) {
        drawText(`Lives: ${"❤".repeat(Math.max(0, lives))}`, W - 120, 80, 30, lives === 1 ? "#ff6b6b" : "#7ef7c5", "right");
    } else {
        drawText(`Time: ${Math.max(0, Math.ceil(remainingTime))}s`, W - 120, 80, 30, chosenMode === MODES.zen ? "#6db8ff" : "#dba4ff", "right");
    }
    // 攥拳一键清屏逻辑 (建议放在 updatePlaying 的开头或结尾部分)
if (input.fist) {
    if (!fistLatched && clearItems > 0) {
        fistLatched = true;
        clearItems -= 1;
        
        // 播放爆炸音效
        if (window.playBomb) window.playBomb();
        
        // 销毁场上所有非炸弹水果
        fruits.forEach(fruit => {
            if (fruit.alive && fruit.type !== "bomb") {
                fruit.alive = false;
                score += 1;
                money += 1;
                // 此处你可自行决定是否调用 spawnParticles(fruit) 等特效
            }
        });
        saveShopData();
    }
} else {
    // 松开拳头时重置触发器
    fistLatched = false; 
}
}

function updateGameover(delta, input) {
    drawRoundedRect(90, 105, W - 180, H - 210, 28, "rgba(3, 8, 16, 0.58)", "rgba(255,255,255,0.12)");
    drawText(chosenMode === MODES.zen || chosenMode === MODES.arcade ? "TIME UP!" : "GAME OVER", W / 2, 170, 62, "#ff6b6b");
    drawText(`Final Score: ${score}`, W / 2, 238, 38, "#ffffff");

    let trigger = null;
    const hoveredIndexG = getHoveredIndex(gameoverItems, input.x, input.y, 95);
    gameoverItems.forEach((item, index) => {
        const hovered = index === hoveredIndexG;
        if (hovered) {
            gameoverHold[index] = Math.min(REQUIRED_HOLD_MS, gameoverHold[index] + delta);
        } else {
            gameoverHold[index] = Math.max(0, gameoverHold[index] - delta * 2);
        }

        drawRoundedRect(item.x - 110, item.y - 30, 220, 60, 20, hovered ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)", hovered ? item.color : "rgba(255,255,255,0.12)");
        drawText(item.text, item.x, item.y - 2, 30, hovered ? item.color : "#ffffff");
        drawLoadingArc(item.x, item.y + 26, 32, gameoverHold[index] / REQUIRED_HOLD_MS, item.color);

        if (gameoverHold[index] >= REQUIRED_HOLD_MS) {
            trigger = item.action;
        }
    });

    if (trigger === "restart") {
        resetGame(chosenMode);
    } else if (trigger === "menu") {
        returnToMenu();
    }
}

function drawPointer(input) {
    if (gameState === GAME.PLAYING) return; // only show pointer in menu/gameover
    ctx.save();
    ctx.strokeStyle = input.fist ? "#ff6b6b" : "#7ef7c5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(input.x, input.y, input.fist ? 14 : 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function loop(timestamp) {
    const delta = lastTimestamp ? Math.min(34, timestamp - lastTimestamp) : 16.67;
    lastTimestamp = timestamp;
    const input = getInputPosition();

    drawBackground();

    if (gameState === GAME.MENU) {
        updateMenu(delta, input);
    } else if (gameState === GAME.SETTINGS) {
        updateSettings(delta, input);
    } else if (gameState === GAME.PLAYING) {
        updatePlaying(delta, input);
    } else if (gameState === GAME.GAMEOVER) {
        updateGameover(delta, input);
    }
    else if (gameState === GAME.SHOP) {
    updateShop(delta, input);
}
    drawPointer(input);


    mouseMovedRecently = false;
    window.requestAnimationFrame(loop);
}

window.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * W;
    mouseY = ((event.clientY - rect.top) / rect.height) * H;
    mouseMovedRecently = true;

    if (gameState === GAME.SETTINGS && settingsSliderDragging) {
        if (settingsSliderDragTarget === "sensitivity") setSensitivityFromSliderX(mouseX);
        else if (settingsSliderDragTarget === "music") setMusicFromSliderX(mouseX);
        else if (settingsSliderDragTarget === "sfx") setSfxFromSliderX(mouseX);
    }
});

window.addEventListener("pointerup", () => {
    settingsSliderDragging = false;
    settingsSliderDragTarget = null;
    if (settingsSliderDragSource === "mouse") {
        settingsSliderDragSource = null;
    }
});

// 点击画布直接触发菜单/结算操作（便于鼠标用户）
canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;

    if (gameState === GAME.MENU) {
        let idx = -1;
        let bestDistance = Infinity;
        menuItems.forEach((item, itemIndex) => {
            const hitRadius = item.mode === "settings" ? 160 : 120;
            const dist = distance(x, y, item.x, item.y);
            if (dist <= hitRadius && dist < bestDistance) {
                bestDistance = dist;
                idx = itemIndex;
            }
        });
        if (idx !== -1) {
            const selected = menuItems[idx];
            if (selected.mode === "settings") {
                gameState = GAME.SETTINGS;
                settingsHold = [0, 0, 0, 0];
                settingsSliderDragging = false;
                settingsSliderDragSource = null;
                settingsLatchedIndex = -1;
            } else {
                resetGame(selected.mode);
            }
            return;
        }
    } else if (gameState === GAME.SETTINGS) {
        const idx = getHoveredIndex(settingsItems, x, y, 130);
        if (idx !== -1) {
            const action = settingsItems[idx].action;
            if (action === "toggleMute") {
                toggleSetting("muted");
                syncBgmForScene();
            } else if (action === "togglePreview") {
                toggleSetting("showCameraPreview");
                } else if (action === "sensitivitySlider") {
                    settingsSliderDragging = true;
                    settingsSliderDragSource = "mouse";
                    // Determine which of the three sliders was clicked: sensitivity/music/sfx
                    const item = settingsItems[idx];
                    const spacing = 64;
                    const relY = y - item.y;
                    if (relY < -spacing / 2) settingsSliderDragTarget = "sensitivity";
                    else if (relY > spacing / 2) settingsSliderDragTarget = "sfx";
                    else settingsSliderDragTarget = "music";
                    if (settingsSliderDragTarget === "sensitivity") setSensitivityFromSliderX(x);
                    else if (settingsSliderDragTarget === "music") setMusicFromSliderX(x);
                    else if (settingsSliderDragTarget === "sfx") setSfxFromSliderX(x);
            } else if (action === "back") {
                returnToMenu();
                gameState = GAME.MENU;
            }
            return;
        }
    } else if (gameState === GAME.GAMEOVER) {
        const idx = getHoveredIndex(gameoverItems, x, y, 95);
        if (idx !== -1) {
            const action = gameoverItems[idx].action;
            if (action === "restart") resetGame(chosenMode);
            else if (action === "menu") returnToMenu();
            return;
        }
    }
});

window.addEventListener("pointerdown", () => {
    if (window.unlockAudio) {
        window.unlockAudio();
    }
    syncBgmForScene();
});

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key.toLowerCase() === "m") {
        returnToMenu();
    }
});

window.addEventListener("load", () => {
    drawBackground();
    syncBgmForScene();
    window.requestAnimationFrame(loop);
});

// ---------------- Settings UI ----------------
function loadSettings() {
    const raw = localStorage.getItem("cohci_settings");
    let s = { muted: false, sensitivity: 1.0, showCameraPreview: true, musicVolume: 0.45, sfxVolume: 0.8 };
    try {
        if (raw) s = Object.assign(s, JSON.parse(raw));
    } catch (e) {}
    window.settings = s;
    applySettingsState();
    saveSettings();
}

window.addEventListener("DOMContentLoaded", () => {
    loadSettings();
});
