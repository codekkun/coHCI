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
    DOJO: 5,
};

const MODES = {
    classic: 1,
    zen: 2,
    arcade: 3,
};

const CARRY_ITEM = {
    NONE: "none",
    CLEAR: "clear",
    TIME_STOP: "timeStop",
};

const REQUIRED_HOLD_MS = 900;
const OPEN_HAND_CLEAR_HOLD_MS = 420;
const GESTURE_INTERLOCK_MS = 700;
const SNAP_BLOCK_REFRESH_MS = 220;
const COMBO_WINDOW_MS = 1300;
const BASE_FRUIT_SCORE = 10;
const COMBO_STEP = 4;
const TIME_STOP_DURATION_MS = 4100;
const TIME_STOP_COOLDOWN_MS = 7600;
const TIME_STOP_SLOW_FACTOR = 0.04;
const TIME_STOP_BGM_VOLUME_FACTOR = 0.18;
const TIME_STOP_SOUND = "时间停止";
const ADAPTIVE_CALIBRATION_MS = 3600;
const ADAPTIVE_SAMPLE_INTERVAL_MS = 45;
const ADAPTIVE_GRID_COLS = 3;
const ADAPTIVE_GRID_ROWS = 3;
const ADAPTIVE_MAX_POINTS = 900;
const ADAPTIVE_MIN_SENSITIVITY_SCALE = 0.78;
const ADAPTIVE_MAX_SENSITIVITY_SCALE = 1.38;
const ADAPTIVE_PROFILE_KEY = "cohci_adaptive_profile";
const ADAPTIVE_SCORE_THRESHOLD = 4;

const EFFECT_LEVELS = {
    low: {
        label: "低",
        maxEffects: 4,
        shardCap: 6,
        shardBase: 3,
        shadowScale: 0.35,
        edgeEnabled: false,
        burstEnabled: true,
        passiveEdge: false,
    },
    medium: {
        label: "中",
        maxEffects: 8,
        shardCap: 12,
        shardBase: 4,
        shadowScale: 0.62,
        edgeEnabled: true,
        burstEnabled: true,
        passiveEdge: false,
    },
    high: {
        label: "高",
        maxEffects: 14,
        shardCap: 20,
        shardBase: 6,
        shadowScale: 1,
        edgeEnabled: true,
        burstEnabled: true,
        passiveEdge: true,
    },
};

const EFFECT_LEVEL_ORDER = ["low", "medium", "high"];

// 将原本的 menuItems 替换为以下代码：
const menuItems = [
    { text: "经典模式", mode: MODES.classic, x: W / 2, y: 248, width: 300, height: 58, color: "#7ef7c5" },
    { text: "禅意模式", mode: MODES.zen, x: W / 2, y: 318, width: 300, height: 58, color: "#6db8ff" },
    { text: "街机模式", mode: MODES.arcade, x: W / 2, y: 388, width: 300, height: 58, color: "#dba4ff" },
    { text: "道场", mode: "dojo", x: W / 2, y: 458, width: 300, height: 58, color: "#8be9fd" },
    { text: "设置", mode: "settings", x: W / 2 - 120, y: 538, width: 210, height: 52, color: "#ffd166" },
    { text: "商店", mode: "shop", x: W / 2 + 135, y: 538, width: 190, height: 52, color: "#ff9f1c" },
];

const settingsItems = [
    { action: "toggleMute", text: () => `静音：${window.settings && window.settings.muted ? "开" : "关"}`, x: W / 2, y: 220, color: "#7ef7c5" },
    { action: "togglePreview", text: () => `摄像头画面：${window.settings && window.settings.showCameraPreview === false ? "关" : "开"}`, x: W / 2, y: 320, color: "#6db8ff" },
    { action: "sensitivitySlider", text: () => "灵敏度", x: W / 2, y: 420, color: "#ffd166" },
    { action: "cycleEffects", text: () => `特效强度：${getEffectConfig().label}`, x: W / 2, y: 500, color: "#ff9f1c" },
    { action: "back", text: () => "返回菜单", x: W / 2, y: 550, color: "#dba4ff" },
];

const settingsSliderRows = [
    { target: "sensitivity", label: "灵敏度", y: 240 },
    { target: "music", label: "音乐音量", y: 330 },
    { target: "sfx", label: "音效音量", y: 420 },
];

const gameoverItems = [
    { text: "重新开始", action: "restart", x: W / 2 - 150, y: 548, color: "#7ef7c5" },
    { text: "返回菜单", action: "menu", x: W / 2 + 150, y: 548, color: "#ffd166" },
];

const loadoutOptions = [
    { item: CARRY_ITEM.NONE, label: () => "不携带", x: W / 2 - 210, y: 178, width: 136, color: "#7ef7c5" },
    { item: CARRY_ITEM.CLEAR, label: () => `清屏 x${clearItems}`, x: W / 2, y: 178, width: 154, color: "#ff6b6b" },
    { item: CARRY_ITEM.TIME_STOP, label: () => `时停 x${timeStopItems}`, x: W / 2 + 210, y: 178, width: 154, color: "#9de7ff" },
];

let gameState = GAME.MENU;
let chosenMode = MODES.classic;
let score = 0;
let lives = 3;
let remainingTime = 0;
let comboCount = 0;
let comboTimer = 0;
let bestCombo = 0;
let comboMessage = "";
let comboMessageTimer = 0;
let fruits = [];
let particles = [];
let slices = [];
let splats = [];
let comboEffects = [];
let clearEffects = [];
let trail = [];
let menuHold = menuItems.map(() => 0);
let loadoutHold = loadoutOptions.map(() => 0);
let gameoverHold = [0, 0];
let playExitHold = 0;
let clearItemHold = 0;
let openHandClearHold = 0;
let openHandClearLatched = false;
let openHandClearBlockedUntil = 0;
let clearScreenFlash = 0;
let clearScreenPulse = 0;
let mouseX = W / 2;
let mouseY = H / 2;
let mouseMovedRecently = false;
let lastTimestamp = 0;
let pointerX = mouseX;
let pointerY = mouseY;
let lastInputWasHand = false;
let usingMouse = false;
let settingsHold = settingsItems.map(() => 0);
let settingsSliderDragging = false;
let settingsSliderDragSource = null;
let settingsSliderDragTarget = null; // "sensitivity" | "music" | "sfx"
let settingsLatchedIndex = -1;
// 金钱与商店数据
let money = readStoredInteger("fn_money", 0);
let clearItems = readStoredInteger("fn_clear_items", 0);
let timeStopItems = readStoredInteger("fn_time_stop_items", 0);
let unlockedColors = readStoredColors(); // 默认初始颜色
let currentColor = readStoredCurrentColor(unlockedColors);
let carriedItem = CARRY_ITEM.NONE;

let shopHold = [0, 0, 0, 0, 0]; // 控制商店商品的长按购买
let shopExitHold = 0; 
let shopMessage = "";        // 商店提示信息文本
let shopMessageTimer = 0;
let comboEdgePulse = 0;
let comboEdgeColor = "#7ef7c5";
let timeStopTimer = 0;
let timeStopCooldown = 0;
let timeStopFlash = 0;
let timeStopMessageTimer = 0;
let timeStopX = W / 2;
let timeStopY = H / 2;
let timeStopBgmDucked = false;
let fruitIdSeed = 1;
let adaptiveProfile = loadAdaptiveProfile();
let adaptiveSession = createAdaptiveSession();
window.adaptiveSensitivityScale = 1;

const shopItems = [
    { type: "item", item: CARRY_ITEM.CLEAR, text: "清屏道具", detail: "¥20", cost: 20, x: W / 2 - 220, y: 230, width: 230, height: 76, color: "#ff6b6b" },
    { type: "item", item: CARRY_ITEM.TIME_STOP, text: "时停道具", detail: "¥30", cost: 30, x: W / 2 + 220, y: 230, width: 230, height: 76, color: "#9de7ff" },
    { type: "color", text: "红色刀刃", detail: "¥50", cost: 50, value: "#ff4b4b", x: W / 2 - 220, y: 342, width: 230, height: 76, color: "#ff4b4b" },
    { type: "color", text: "金色刀刃", detail: "¥50", cost: 50, value: "#ffd166", x: W / 2 + 220, y: 342, width: 230, height: 76, color: "#ffd166" },
    { type: "color", text: "绿色刀刃", detail: "¥50", cost: 50, value: "#7ef7c5", x: W / 2, y: 450, width: 230, height: 76, color: "#7ef7c5" },
];

const DOJO_BACKGROUND_LIBRARY = [
    { id: "bg-1", label: "bg1", src: "assets/images/bg1.jpg", accent: "#7ef7c5", note: "bg1.jpg" },
    { id: "bg-2", label: "bg2", src: "assets/images/bg2.jpg", accent: "#6db8ff", note: "bg2.jpg" },
    { id: "bg-3", label: "bg3", src: "assets/images/bg3.jpg", accent: "#ff9f1c", note: "bg3.jpg" },
];

const DOJO_EFFECT_LIBRARY = [
    { id: "none", label: "默认" },
    { id: "rain", label: "下雨" },
    { id: "snow", label: "下雪" },
];

let dojoState = {
    focus: "background",
    previewBackgroundIndex: 0,
    previewEffectIndex: 0,
    activeBackgroundIndex: 0,
    activeEffectIndex: 0,
};

let dojoHold = {
    modeToggle: 0,
    exit: 0,
    left: 0,
    center: 0,
    right: 0,
};

const dojoImageCache = new Map();

function updateShop(delta, input) {
    drawText("商 店", W / 2, 88, 58, "#ffffff");
    drawText(`💰 当前金币: ${money}   |   💣 清屏: ${clearItems}   |   ⏱ 时停: ${timeStopItems}`, W / 2, 150, 24, "#ffd166");
    
    // 返回按钮
    const exitLeft = W / 2 - 60, exitTop = H - 78, exitWidth = 120, exitHeight = 46;
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
    const hoveredIndex = getShopItemIndexAt(input.x, input.y);

    shopItems.forEach((item, index) => {
        const hovered = index === hoveredIndex;
        if (hovered) {
            shopHold[index] = Math.min(REQUIRED_HOLD_MS, shopHold[index] + delta);
        } else {
            shopHold[index] = Math.max(0, shopHold[index] - delta * 2);
        }
        
        let displayStr = item.text;
        let isBought = false;
        let detailStr = item.detail;
        
        // 判断饰品是否已经解锁或装备
        if (item.type === "color") {
            isBought = unlockedColors.includes(item.value);
            if (isBought) {
                detailStr = currentColor === item.value ? "已装备" : "点击装备";
            }
        } else if (item.item === CARRY_ITEM.CLEAR) {
            detailStr = `${item.detail}  库存 ${clearItems}`;
        } else if (item.item === CARRY_ITEM.TIME_STOP) {
            detailStr = `${item.detail}  库存 ${timeStopItems}`;
        }
        
        const canAfford = money >= item.cost;
        const color = (!isBought && !canAfford) ? "rgba(255,255,255,0.36)" : item.color; // 买不起显示为灰色
        const bounds = getButtonBounds(item);
        const fill = hovered ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.065)";
        const stroke = hovered ? color : "rgba(255,255,255,0.14)";

        drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 18, fill, stroke);

        if (item.type === "color") {
            ctx.save();
            ctx.fillStyle = item.value;
            ctx.beginPath();
            ctx.arc(bounds.x + 26, item.y - 9, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.45)";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        drawText(displayStr, item.x, item.y - 12, 22, color);
        drawText(detailStr, item.x, item.y + 16, 16, isBought || canAfford ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.34)");
        drawLoadingArc(bounds.x + bounds.width - 26, item.y, 14, shopHold[index] / REQUIRED_HOLD_MS, color);
        
        // 判定长按购买/装备成功
        if (shopHold[index] >= REQUIRED_HOLD_MS) {
            shopHold[index] = 0; // 重置进度条
            
            if (item.type === "item") {
                if (money >= item.cost) {
                    money -= item.cost;
                    if (item.item === CARRY_ITEM.TIME_STOP) {
                        timeStopItems += 1;
                    } else {
                        clearItems += 1;
                    }
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
    writeStoredValue("fn_money", money);
    writeStoredValue("fn_clear_items", clearItems);
    writeStoredValue("fn_time_stop_items", timeStopItems);
    writeStoredValue("fn_colors", JSON.stringify(unlockedColors));
    writeStoredValue("fn_current_color", currentColor);
}

function readStoredValue(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function writeStoredValue(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {}
}

function readStoredInteger(key, fallback) {
    const value = Number.parseInt(readStoredValue(key), 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function readStoredColors() {
    const fallback = ["#cff4ff"];
    try {
        const parsed = JSON.parse(readStoredValue("fn_colors") || "[]");
        if (!Array.isArray(parsed)) return fallback;
        const colors = parsed.filter(isHexColor);
        if (!colors.includes(fallback[0])) colors.unshift(fallback[0]);
        return Array.from(new Set(colors));
    } catch (error) {
        return fallback;
    }
}

function readStoredCurrentColor(colors) {
    const stored = readStoredValue("fn_current_color");
    return isHexColor(stored) && colors.includes(stored) ? stored : colors[0];
}

function getDojoImage(src) {
    if (!src) {
        return null;
    }
    if (!dojoImageCache.has(src)) {
        const image = new Image();
        image.src = src;
        dojoImageCache.set(src, image);
    }
    return dojoImageCache.get(src);
}

function drawDojoEffectOverlay(effectId, x, y, width, height, opacity = 1) {
    const time = lastTimestamp / 1000;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    if (effectId === "rain") {
        for (let layer = 0; layer < 3; layer += 1) {
            const layerSpeed = 150 + layer * 70;
            const dropCount = 18 + layer * 10;
            ctx.strokeStyle = layer === 0 ? "rgba(190, 235, 255, 0.35)" : layer === 1 ? "rgba(160, 220, 255, 0.28)" : "rgba(125, 195, 255, 0.18)";
            ctx.lineWidth = 1 + layer;
            for (let i = 0; i < dropCount; i += 1) {
                const seed = i + layer * 21;
                const px = x + ((seed * 57 + time * 110 + layer * 33) % width);
                const py = y + ((time * layerSpeed + seed * 41) % height);
                const length = 10 + layer * 6;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + 6, py + length);
                ctx.stroke();
            }
        }

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        for (let i = 0; i < 5; i += 1) {
            const px = x + ((time * 70 + i * 137) % width);
            const py = y + ((time * 90 + i * 97) % height);
            ctx.fillRect(px, py, 18, 1.5);
        }
    } else if (effectId === "snow") {
        const drifts = [
            { alpha: 0.60, size: 1.8, speed: 14, sway: 18 },
            { alpha: 0.38, size: 2.8, speed: 10, sway: 32 },
            { alpha: 0.22, size: 4.0, speed: 6, sway: 52 },
        ];

        drifts.forEach((drift, layer) => {
            ctx.fillStyle = `rgba(248, 252, 255, ${drift.alpha})`;
            const flakeCount = 14 + layer * 8;
            for (let i = 0; i < flakeCount; i += 1) {
                const seed = i + layer * 19;
                const px = x + ((seed * 71 + Math.sin(time * 1.2 + seed) * drift.sway + time * 18) % width);
                const py = y + ((time * drift.speed + seed * 49) % height);
                const radius = drift.size + (seed % 3) * 0.35;
                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.ellipse(x + width * 0.5, y + height * 0.22, width * 0.46, height * 0.10, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function drawDojoPreviewFrame(frameX, frameY, frameWidth, frameHeight, backgroundItem, effectItem, selected) {
    const frameRadius = 30;
    const image = getDojoImage(backgroundItem.src);
    const pulse = 1 + Math.sin(lastTimestamp / 520) * (selected ? 0.018 : 0.01);
    const scaledWidth = frameWidth * pulse;
    const scaledHeight = frameHeight * pulse;
    const drawX = frameX - (scaledWidth - frameWidth) / 2;
    const drawY = frameY - (scaledHeight - frameHeight) / 2;

    ctx.save();
    ctx.shadowColor = backgroundItem.accent;
    ctx.shadowBlur = selected ? 34 : 18;
    drawRoundedRect(drawX, drawY, scaledWidth, scaledHeight, frameRadius, "rgba(8, 14, 24, 0.72)", backgroundItem.accent);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(drawX + frameRadius, drawY);
    ctx.arcTo(drawX + scaledWidth, drawY, drawX + scaledWidth, drawY + scaledHeight, frameRadius);
    ctx.arcTo(drawX + scaledWidth, drawY + scaledHeight, drawX, drawY + scaledHeight, frameRadius);
    ctx.arcTo(drawX, drawY + scaledHeight, drawX, drawY, frameRadius);
    ctx.arcTo(drawX, drawY, drawX + scaledWidth, drawY, frameRadius);
    ctx.closePath();
    ctx.clip();

    if (image && image.complete && image.naturalWidth > 0) {
        const imageRatio = image.naturalWidth / image.naturalHeight;
        const frameRatio = scaledWidth / scaledHeight;
        let imgWidth = scaledWidth;
        let imgHeight = scaledHeight;
        let imgX = drawX;
        let imgY = drawY;

        if (imageRatio > frameRatio) {
            imgHeight = scaledHeight;
            imgWidth = scaledHeight * imageRatio;
            imgX = drawX - (imgWidth - scaledWidth) / 2;
        } else {
            imgWidth = scaledWidth;
            imgHeight = scaledWidth / imageRatio;
            imgY = drawY - (imgHeight - scaledHeight) / 2;
        }

        ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
    } else {
        const gradient = ctx.createLinearGradient(drawX, drawY, drawX + scaledWidth, drawY + scaledHeight);
        gradient.addColorStop(0, "rgba(126, 247, 197, 0.18)");
        gradient.addColorStop(0.5, "rgba(109, 184, 255, 0.12)");
        gradient.addColorStop(1, "rgba(219, 164, 255, 0.16)");
        ctx.fillStyle = gradient;
        ctx.fillRect(drawX, drawY, scaledWidth, scaledHeight);

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(drawX + 18, drawY + 18, scaledWidth - 36, scaledHeight - 36);
    }

    drawDojoEffectOverlay(effectItem.id, drawX, drawY, scaledWidth, scaledHeight, 1);
    ctx.restore();

    drawRoundedRect(drawX + 20, drawY + 20, 160, 36, 16, "rgba(3,8,16,0.72)", backgroundItem.accent);
    drawText(backgroundItem.label, drawX + 100, drawY + 38, 20, backgroundItem.accent);

    drawRoundedRect(drawX + scaledWidth - 170, drawY + 20, 150, 36, 16, "rgba(3,8,16,0.72)", effectItem.id === "none" ? "#7ef7c5" : "#8be9fd");
    drawText(`特效：${effectItem.label}`, drawX + scaledWidth - 95, drawY + 38, 18, effectItem.id === "none" ? "#7ef7c5" : "#8be9fd");

    const note = backgroundItem.src ? backgroundItem.note : backgroundItem.note;
    drawText(note, drawX + scaledWidth / 2, drawY + scaledHeight - 28, 18, "rgba(255,255,255,0.70)");
}

function updateDojo(delta, input) {
    drawText("道 场", W / 2, 72, 60, "#5b3f23");
    drawText("左/右区域停留一秒切换预览，中间攥拳一秒确认", W / 2, 118, 22, "rgba(91,63,35,0.72)");

    const frameX = 110;
    const frameY = 150;
    const frameWidth = W - 220;
    const frameHeight = 340;
    const toggleX = W - 260;
    const toggleY = 26;
    const toggleWidth = 230;
    const toggleHeight = 46;
    const exitX = 18;
    const exitY = 18;
    const exitWidth = 120;
    const exitHeight = 46;

    const exitHovered = input.x >= exitX && input.x <= exitX + exitWidth && input.y >= exitY && input.y <= exitY + exitHeight;
    if (exitHovered) {
        dojoHold.exit = Math.min(REQUIRED_HOLD_MS, dojoHold.exit + delta);
    } else {
        dojoHold.exit = Math.max(0, dojoHold.exit - delta * 2);
    }

    drawRoundedRect(exitX, exitY, exitWidth, exitHeight, 18, exitHovered ? "rgba(91, 63, 35, 0.20)" : "rgba(255,255,255,0.14)", "rgba(91, 63, 35, 0.45)");
    drawText("返回", exitX + exitWidth / 2, exitY + 24, 22, exitHovered ? "#5b3f23" : "rgba(91,63,35,0.90)");
    drawLoadingArc(exitX + exitWidth / 2, exitY + exitHeight + 6, 14, dojoHold.exit / REQUIRED_HOLD_MS, "#5b3f23");

    if (dojoHold.exit >= REQUIRED_HOLD_MS) {
        returnToMenu();
        return;
    }

    const toggleHovered = input.x >= toggleX && input.x <= toggleX + toggleWidth && input.y >= toggleY && input.y <= toggleY + toggleHeight;
    if (toggleHovered) {
        dojoHold.modeToggle = Math.min(REQUIRED_HOLD_MS, dojoHold.modeToggle + delta);
    } else {
        dojoHold.modeToggle = Math.max(0, dojoHold.modeToggle - delta * 2);
    }

    drawRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, 20, toggleHovered ? "rgba(91,63,35,0.20)" : "rgba(255,255,255,0.12)", "rgba(91,63,35,0.45)");
    drawText(dojoState.focus === "background" ? "当前：切背景" : "当前：切特效", toggleX + toggleWidth / 2, toggleY + 24, 20, "#5b3f23");
    drawLoadingArc(toggleX + toggleWidth / 2, toggleY + toggleHeight + 6, 16, dojoHold.modeToggle / REQUIRED_HOLD_MS, "#5b3f23");

    const modeToggleTriggered = dojoHold.modeToggle >= REQUIRED_HOLD_MS;
    if (modeToggleTriggered) {
        toggleDojoFocus();
        return;
    }

    const leftZone = { x: 30, y: frameY + 40, w: 90, h: frameHeight - 80 };
    const rightZone = { x: W - 120, y: frameY + 40, w: 90, h: frameHeight - 80 };
    const centerZone = { x: frameX + 120, y: frameY + 40, w: frameWidth - 240, h: frameHeight - 80 };

    const inLeft = input.x >= leftZone.x && input.x <= leftZone.x + leftZone.w && input.y >= leftZone.y && input.y <= leftZone.y + leftZone.h;
    const inRight = input.x >= rightZone.x && input.x <= rightZone.x + rightZone.w && input.y >= rightZone.y && input.y <= rightZone.y + rightZone.h;
    const inCenter = input.x >= centerZone.x && input.x <= centerZone.x + centerZone.w && input.y >= centerZone.y && input.y <= centerZone.y + centerZone.h;

    dojoHold.left = inLeft ? Math.min(REQUIRED_HOLD_MS, dojoHold.left + delta) : Math.max(0, dojoHold.left - delta * 2);
    dojoHold.right = inRight ? Math.min(REQUIRED_HOLD_MS, dojoHold.right + delta) : Math.max(0, dojoHold.right - delta * 2);
    dojoHold.center = (inCenter && input.fist) ? Math.min(REQUIRED_HOLD_MS, dojoHold.center + delta) : Math.max(0, dojoHold.center - delta * 2);

    const backgroundItem = dojoState.focus === "background"
        ? (DOJO_BACKGROUND_LIBRARY[dojoState.previewBackgroundIndex] || DOJO_BACKGROUND_LIBRARY[0])
        : (DOJO_BACKGROUND_LIBRARY[dojoState.activeBackgroundIndex] || DOJO_BACKGROUND_LIBRARY[0]);
    const effectItem = dojoState.focus === "effect"
        ? (DOJO_EFFECT_LIBRARY[dojoState.previewEffectIndex] || DOJO_EFFECT_LIBRARY[0])
        : (DOJO_EFFECT_LIBRARY[dojoState.activeEffectIndex] || DOJO_EFFECT_LIBRARY[0]);

    drawDojoPreviewFrame(frameX, frameY, frameWidth, frameHeight, backgroundItem, effectItem, true);

    drawRoundedRect(leftZone.x, leftZone.y, leftZone.w, leftZone.h, 24, inLeft ? "rgba(126, 247, 197, 0.18)" : "rgba(255,255,255,0.05)", "rgba(126, 247, 197, 0.18)");
    drawRoundedRect(rightZone.x, rightZone.y, rightZone.w, rightZone.h, 24, inRight ? "rgba(219, 164, 255, 0.18)" : "rgba(255,255,255,0.05)", "rgba(219, 164, 255, 0.18)");

    drawText("上一张", leftZone.x + leftZone.w / 2, leftZone.y + leftZone.h / 2 - 10, 24, inLeft ? "#7ef7c5" : "rgba(255,255,255,0.75)");
    drawText("下一张", rightZone.x + rightZone.w / 2, rightZone.y + rightZone.h / 2 - 10, 24, inRight ? "#dba4ff" : "rgba(255,255,255,0.75)");
    drawLoadingArc(leftZone.x + leftZone.w / 2, leftZone.y + leftZone.h - 10, 16, dojoHold.left / REQUIRED_HOLD_MS, "#7ef7c5");
    drawLoadingArc(rightZone.x + rightZone.w / 2, rightZone.y + rightZone.h - 10, 16, dojoHold.right / REQUIRED_HOLD_MS, "#dba4ff");

    drawRoundedRect(centerZone.x, centerZone.y, centerZone.w, centerZone.h, 24, inCenter ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", "rgba(255,255,255,0.10)");
    drawText("攥拳 1 秒选中", centerZone.x + centerZone.w / 2, centerZone.y + centerZone.h / 2 - 4, 24, inCenter ? "#8be9fd" : "rgba(255,255,255,0.68)");
    drawLoadingArc(centerZone.x + centerZone.w / 2, centerZone.y + centerZone.h - 20, 38, dojoHold.center / REQUIRED_HOLD_MS, "#8be9fd");

    if (dojoHold.left >= REQUIRED_HOLD_MS) {
        moveDojoPreview(-1);
        dojoHold.left = 0;
    } else if (dojoHold.right >= REQUIRED_HOLD_MS) {
        moveDojoPreview(1);
        dojoHold.right = 0;
    } else if (dojoHold.center >= REQUIRED_HOLD_MS) {
        confirmDojoSelection();
        dojoHold.center = 0;
    }

    drawText(`背景：${DOJO_BACKGROUND_LIBRARY[dojoState.activeBackgroundIndex]?.label || "bg1"}`, W / 2, H - 54, 20, "rgba(91,63,35,0.80)");
    drawText(`特效：${DOJO_EFFECT_LIBRARY[dojoState.activeEffectIndex]?.label || "默认"}`, W / 2, H - 28, 20, "rgba(91,63,35,0.80)");
}

function resetSettingsHold() {
    settingsHold = settingsItems.map(() => 0);
}

function resetShopState() {
    shopHold = shopItems.map(() => 0);
    shopExitHold = 0;
    shopMessage = "";
    shopMessageTimer = 0;
}

function enterShop() {
    resetShopState();
    gameState = GAME.SHOP;
}

function getItemCount(item) {
    if (item === CARRY_ITEM.CLEAR) return clearItems;
    if (item === CARRY_ITEM.TIME_STOP) return timeStopItems;
    return Infinity;
}

function canCarryItem(item) {
    return item === CARRY_ITEM.NONE || getItemCount(item) > 0;
}

function isClearItemCarried() {
    return carriedItem === CARRY_ITEM.CLEAR && clearItems > 0;
}

function isTimeStopItemCarried() {
    return carriedItem === CARRY_ITEM.TIME_STOP && timeStopItems > 0;
}

function normalizeCarriedItem() {
    if (!canCarryItem(carriedItem)) {
        carriedItem = CARRY_ITEM.NONE;
    }
}

function setCarriedItem(item) {
    if (!canCarryItem(item)) {
        if (window.playSound) window.playSound("miss");
        return false;
    }
    carriedItem = item;
    loadoutHold = loadoutOptions.map(() => 0);
    if (window.playSound) window.playSound("ui");
    return true;
}

function resetLoadoutHold() {
    loadoutHold = loadoutOptions.map(() => 0);
}

function getButtonBounds(item) {
    return {
        x: item.x - item.width / 2,
        y: item.y - item.height / 2,
        width: item.width,
        height: item.height,
    };
}

function pointInBounds(x, y, bounds) {
    return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}

function getLoadoutBounds(option) {
    return {
        x: option.x - option.width / 2,
        y: option.y - 22,
        width: option.width,
        height: 44,
    };
}

function getLoadoutIndexAt(x, y) {
    for (let i = 0; i < loadoutOptions.length; i += 1) {
        const bounds = getLoadoutBounds(loadoutOptions[i]);
        if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
            return i;
        }
    }
    return -1;
}

function getMenuItemIndexAt(x, y) {
    for (let i = 0; i < menuItems.length; i += 1) {
        if (pointInBounds(x, y, getButtonBounds(menuItems[i]))) {
            return i;
        }
    }
    return -1;
}

function getShopItemIndexAt(x, y) {
    for (let i = 0; i < shopItems.length; i += 1) {
        if (pointInBounds(x, y, getButtonBounds(shopItems[i]))) {
            return i;
        }
    }
    return -1;
}

function updateLoadoutSelector(delta, input) {
    normalizeCarriedItem();
    drawText("本局携带", W / 2, 158, 18, "rgba(255,255,255,0.58)");

    const hoveredIndex = getLoadoutIndexAt(input.x, input.y);
    loadoutOptions.forEach((option, index) => {
        const hovered = index === hoveredIndex;
        const selected = carriedItem === option.item;
        const enabled = canCarryItem(option.item);
        if (hovered && enabled) {
            loadoutHold[index] = Math.min(REQUIRED_HOLD_MS, loadoutHold[index] + delta);
        } else {
            loadoutHold[index] = Math.max(0, loadoutHold[index] - delta * 2);
        }

        const bounds = getLoadoutBounds(option);
        const color = enabled ? option.color : "rgba(255,255,255,0.34)";
        const fill = selected ? "rgba(255,255,255,0.16)" : hovered && enabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
        drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 16, fill, selected ? option.color : "rgba(255,255,255,0.12)");
        drawText(option.label(), bounds.x + 18, option.y - 1, 18, color, "left");
        drawLoadingArc(bounds.x + bounds.width - 20, option.y, 12, loadoutHold[index] / REQUIRED_HOLD_MS, option.color);

        if (loadoutHold[index] >= REQUIRED_HOLD_MS) {
            setCarriedItem(option.item);
        }
    });

    return hoveredIndex !== -1;
}

function setTimeStopBgmDucked(ducked) {
    if (!window.setMusicVolume) {
        timeStopBgmDucked = ducked;
        return;
    }

    const settings = getSettingsState();
    const baseVolume = clamp(Number(settings.musicVolume) || 0, 0, 1);
    const targetVolume = ducked && !settings.muted ? baseVolume * TIME_STOP_BGM_VOLUME_FACTOR : baseVolume;
    window.setMusicVolume(targetVolume);
    timeStopBgmDucked = ducked;
}

function lockSnapGesture(duration = GESTURE_INTERLOCK_MS) {
    const until = performance.now() + duration;
    window.gestureLockUntil = Math.max(Number(window.gestureLockUntil) || 0, until);
    window.snapTriggered = false;
}

function lockOpenHandClear(duration = GESTURE_INTERLOCK_MS) {
    openHandClearBlockedUntil = Math.max(openHandClearBlockedUntil, performance.now() + duration);
    openHandClearHold = 0;
    openHandClearLatched = true;
}

function resetTimeStop() {
    if (timeStopBgmDucked) {
        setTimeStopBgmDucked(false);
    }
    timeStopTimer = 0;
    timeStopCooldown = 0;
    timeStopFlash = 0;
    timeStopMessageTimer = 0;
}

function updateTimeStopTimers(delta) {
    const wasActive = timeStopTimer > 0;
    if (timeStopTimer > 0) {
        timeStopTimer = Math.max(0, timeStopTimer - delta);
    }
    if (timeStopCooldown > 0) {
        timeStopCooldown = Math.max(0, timeStopCooldown - delta);
    }
    if (timeStopFlash > 0) {
        timeStopFlash = Math.max(0, timeStopFlash - delta / 380);
    }
    if (timeStopMessageTimer > 0) {
        timeStopMessageTimer = Math.max(0, timeStopMessageTimer - delta);
    }
    if (wasActive && timeStopTimer === 0 && timeStopBgmDucked) {
        setTimeStopBgmDucked(false);
    }
}

function triggerTimeStop(x, y) {
    if (timeStopTimer > 0 || timeStopCooldown > 0) {
        return false;
    }
    timeStopTimer = TIME_STOP_DURATION_MS;
    timeStopCooldown = TIME_STOP_COOLDOWN_MS;
    timeStopFlash = 1;
    timeStopMessageTimer = 1050;
    timeStopX = clamp(x, 0, W);
    timeStopY = clamp(y, 0, H);
    comboEdgePulse = Math.max(comboEdgePulse, 0.7);
    comboEdgeColor = "#9de7ff";
    setTimeStopBgmDucked(true);
    if (window.playSound) window.playSound(TIME_STOP_SOUND);
    lockOpenHandClear();
    return true;
}

function activateTimeStopItem(x, y) {
    if (!isTimeStopItemCarried()) {
        return false;
    }
    if (!triggerTimeStop(x, y)) {
        return false;
    }

    timeStopItems = Math.max(0, timeStopItems - 1);
    normalizeCarriedItem();
    saveShopData();
    return true;
}

function consumeSnapTrigger(input) {
    if (!window.snapTriggered) {
        return false;
    }
    window.snapTriggered = false;
    if (input.openHand || openHandClearHold > 0 || performance.now() < (Number(window.gestureLockUntil) || 0)) {
        return false;
    }
    return activateTimeStopItem(window.snapX || pointerX, window.snapY || pointerY);
}

function getClearItemButtonBounds() {
    return { x: W / 2 - 105, y: 62, width: 210, height: 38 };
}

function activateClearItem(source = "button") {
    if (!isClearItemCarried()) return false;

    clearItems -= 1;
    clearItemHold = 0;
    openHandClearHold = 0;
    openHandClearLatched = source === "openHand";
    resetCombo();
    if (window.playBomb) window.playBomb();
    if (source === "openHand" && window.playSound) {
        window.playSound("bomb");
        window.playSound("ui");
    }

    const clearedTargets = [];
    fruits.forEach((fruit) => {
        if (fruit.alive && fruit.type !== "bomb") {
            clearedTargets.push({ x: fruit.x, y: fruit.y, type: fruit.type });
            fruit.alive = false;
            score += 1;
            money += 1;
        }
    });
    triggerClearItemEffects(pointerX, pointerY, clearedTargets, source);
    normalizeCarriedItem();
    saveShopData();
    return true;
}

function updateClearItemControl(delta, input) {
    const bounds = getClearItemButtonBounds();
    const hovered = input.x >= bounds.x && input.x <= bounds.x + bounds.width && input.y >= bounds.y && input.y <= bounds.y + bounds.height;
    const openHandBlocked = performance.now() < openHandClearBlockedUntil;
    const clearReady = isClearItemCarried();
    const openHandReady = input.openHand && clearReady && !openHandClearLatched && !openHandBlocked;

    if (input.openHand && clearReady) {
        lockSnapGesture(SNAP_BLOCK_REFRESH_MS);
    }

    if (hovered && clearReady) {
        clearItemHold = Math.min(REQUIRED_HOLD_MS, clearItemHold + delta);
    } else {
        clearItemHold = Math.max(0, clearItemHold - delta * 2);
    }

    if (!input.openHand) {
        if (!openHandBlocked) {
            openHandClearLatched = false;
        }
        openHandClearHold = Math.max(0, openHandClearHold - delta * 2);
    } else if (openHandReady) {
        openHandClearHold = Math.min(OPEN_HAND_CLEAR_HOLD_MS, openHandClearHold + delta);
    } else {
        openHandClearHold = 0;
    }

    let clearActivated = false;
    if (clearItemHold >= REQUIRED_HOLD_MS) {
        clearActivated = activateClearItem("button");
        if (clearActivated && input.openHand) {
            openHandClearLatched = true;
        }
    }

    if (!clearActivated && openHandClearHold >= OPEN_HAND_CLEAR_HOLD_MS) {
        activateClearItem("openHand");
    }

    return hovered;
}

function drawClearItemButton(hovered) {
    const bounds = getClearItemButtonBounds();
    const active = isClearItemCarried();
    const color = active ? "#ff6b6b" : "rgba(255,255,255,0.38)";

    drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 16, hovered && active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)", hovered && active ? color : "rgba(255,255,255,0.12)");
    drawText(`清屏道具: ${clearItems}`, W / 2, bounds.y + bounds.height / 2 - 1, 20, color);
    drawLoadingArc(W / 2, bounds.y + bounds.height + 4, 16, clearItemHold / REQUIRED_HOLD_MS, color);
}

function drawTimeStopItemButton() {
    const bounds = getClearItemButtonBounds();
    const active = isTimeStopItemCarried();
    const color = active ? "#9de7ff" : "rgba(255,255,255,0.38)";
    const detail = timeStopCooldown > 0 ? `冷却 ${Math.ceil(timeStopCooldown / 1000)}s` : active ? "响指触发" : "未携带";
    drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 16, "rgba(255,255,255,0.07)", active ? "rgba(157,231,255,0.55)" : "rgba(255,255,255,0.12)");
    drawText(`时停道具: ${timeStopItems}`, W / 2, bounds.y + bounds.height / 2 - 8, 18, color);
    drawText(detail, W / 2, bounds.y + bounds.height / 2 + 11, 14, color);
}

function drawCarriedItemHud(clearHovered) {
    if (carriedItem === CARRY_ITEM.CLEAR) {
        drawClearItemButton(clearHovered);
    } else if (carriedItem === CARRY_ITEM.TIME_STOP) {
        drawTimeStopItemButton();
    } else {
        const bounds = getClearItemButtonBounds();
        drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 16, "rgba(255,255,255,0.045)", "rgba(255,255,255,0.10)");
        drawText("未携带道具", W / 2, bounds.y + bounds.height / 2 - 1, 18, "rgba(255,255,255,0.46)");
    }
}

function drawOpenHandClearIndicator(input) {
    if (!isClearItemCarried() || !input.hand || (!input.openHand && openHandClearHold <= 0)) {
        return;
    }

    const progress = clamp(openHandClearHold / OPEN_HAND_CLEAR_HOLD_MS, 0, 1);
    const alpha = input.openHand ? 0.9 : 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = clearItems > 0 ? "#ffb84d" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(input.x, input.y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();

    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI * 0.9 + i * (Math.PI * 0.45);
        const inner = 15;
        const outer = input.openHand ? 30 : 24;
        ctx.beginPath();
        ctx.moveTo(input.x + Math.cos(angle) * inner, input.y + Math.sin(angle) * inner);
        ctx.lineTo(input.x + Math.cos(angle) * outer, input.y + Math.sin(angle) * outer);
        ctx.stroke();
    }
    ctx.restore();
}

function getFruitPalette(type) {
    return {
        apple: { flesh: "rgba(255, 128, 128, 0.95)", skin: "rgba(255, 77, 77, 0.95)" },
        orange: { flesh: "rgba(255, 214, 150, 0.95)", skin: "rgba(255, 159, 28, 0.95)" },
        banana: { flesh: "rgba(255, 245, 176, 0.95)", skin: "rgba(255, 224, 102, 0.95)" },
        watermelon: { flesh: "rgba(255, 115, 131, 0.95)", skin: "rgba(76, 175, 80, 0.95)" },
    }[type] || { flesh: "rgba(255, 209, 102, 0.95)", skin: "rgba(255, 107, 107, 0.95)" };
}

function triggerClearItemEffects(x, y, targets, source) {
    const effectLevel = getSettingsState().effectLevel;
    const effectConfig = getEffectConfig();
    const isOpenHand = source === "openHand";
    const targetCap = effectLevel === "low" ? 5 : effectLevel === "medium" ? 10 : 16;
    const particlesPerTarget = effectLevel === "low" ? 2 : effectLevel === "medium" ? 4 : 7;
    const effectCap = Math.max(2, Math.ceil(effectConfig.maxEffects / 2));

    clearScreenFlash = Math.max(clearScreenFlash, isOpenHand ? 1 : 0.72);
    clearScreenPulse = Math.max(clearScreenPulse, isOpenHand ? 1 : 0.68);
    clearEffects.push(new ClearWave(x, y, targets.length, source));
    if (clearEffects.length > effectCap) {
        clearEffects.splice(0, clearEffects.length - effectCap);
    }

    targets.slice(0, targetCap).forEach((target) => {
        const palette = getFruitPalette(target.type);
        splats.push(new SplatJuice(target.x, target.y, palette.flesh));
        for (let i = 0; i < particlesPerTarget; i += 1) {
            particles.push(new Particle(target.x, target.y, palette.skin));
        }
    });
}

function drawClearScreenEffect() {
    const intensity = clamp(Math.max(clearScreenFlash, clearScreenPulse * 0.7), 0, 1);
    if (intensity <= 0) {
        return;
    }

    const effectConfig = getEffectConfig();
    const edgeSize = 85 + intensity * 110;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255, 120, 70, ${0.06 + clearScreenFlash * 0.18})`;
    ctx.fillRect(0, 0, W, H);

    if (effectConfig.edgeEnabled) {
        const topGlow = ctx.createLinearGradient(0, 0, 0, edgeSize);
        topGlow.addColorStop(0, `rgba(255, 107, 107, ${0.22 + intensity * 0.24})`);
        topGlow.addColorStop(1, "rgba(255, 107, 107, 0)");
        ctx.fillStyle = topGlow;
        ctx.fillRect(0, 0, W, edgeSize);

        const bottomGlow = ctx.createLinearGradient(0, H, 0, H - edgeSize);
        bottomGlow.addColorStop(0, `rgba(255, 184, 77, ${0.18 + intensity * 0.22})`);
        bottomGlow.addColorStop(1, "rgba(255, 184, 77, 0)");
        ctx.fillStyle = bottomGlow;
        ctx.fillRect(0, H - edgeSize, W, edgeSize);

        const leftGlow = ctx.createLinearGradient(0, 0, edgeSize, 0);
        leftGlow.addColorStop(0, `rgba(255, 107, 107, ${0.16 + intensity * 0.18})`);
        leftGlow.addColorStop(1, "rgba(255, 107, 107, 0)");
        ctx.fillStyle = leftGlow;
        ctx.fillRect(0, 0, edgeSize, H);

        const rightGlow = ctx.createLinearGradient(W, 0, W - edgeSize, 0);
        rightGlow.addColorStop(0, `rgba(255, 209, 102, ${0.16 + intensity * 0.18})`);
        rightGlow.addColorStop(1, "rgba(255, 209, 102, 0)");
        ctx.fillStyle = rightGlow;
        ctx.fillRect(W - edgeSize, 0, edgeSize, H);
    }

    ctx.strokeStyle = `rgba(255, 184, 77, ${0.24 + intensity * 0.45})`;
    ctx.lineWidth = 3 + intensity * 5;
    ctx.shadowColor = "#ffb84d";
    ctx.shadowBlur = (14 + intensity * 22) * effectConfig.shadowScale;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.restore();
}

function resetCombo() {
    comboCount = 0;
    comboTimer = 0;
    comboMessage = "";
    comboMessageTimer = 0;
    comboEdgePulse = 0;
}

function resetComboStats() {
    resetCombo();
    bestCombo = 0;
    comboMessage = "";
    comboMessageTimer = 0;
    comboEffects = [];
}

function updateComboTimers(delta) {
    if (comboTimer > 0) {
        comboTimer = Math.max(0, comboTimer - delta);
        if (comboTimer === 0) {
            comboCount = 0;
        }
    }
    if (comboMessageTimer > 0) {
        comboMessageTimer = Math.max(0, comboMessageTimer - delta);
    }
    comboEdgePulse = Math.max(0, comboEdgePulse - delta / 620);
    comboEffects = comboEffects.filter((effect) => effect.life > 0);
    comboEffects.forEach((effect) => effect.update(delta / 16.67));
    clearScreenFlash = Math.max(0, clearScreenFlash - delta / 420);
    clearScreenPulse = Math.max(0, clearScreenPulse - delta / 680);
    clearEffects = clearEffects.filter((effect) => effect.life > 0);
    clearEffects.forEach((effect) => effect.update(delta / 16.67));
}

function getComboMultiplierForCount(count) {
    if (count < COMBO_STEP) return 1;
    return Math.floor(count / COMBO_STEP) + 1;
}

function getComboMultiplier() {
    return getComboMultiplierForCount(comboCount);
}

function getComboColor(count = comboCount) {
    const multiplier = getComboMultiplierForCount(count);
    if (multiplier >= 30) return "#ff3b6b";
    if (multiplier >= 20) return "#ff7ab8";
    if (multiplier >= 10) return "#ff9f1c";
    if (multiplier >= 5) return "#ffd166";
    if (multiplier >= 3) return "#dba4ff";
    return "#7ef7c5";
}

function registerComboHit(x, y) {
    comboCount = comboTimer > 0 ? comboCount + 1 : 1;
    comboTimer = COMBO_WINDOW_MS;
    bestCombo = Math.max(bestCombo, comboCount);

    const multiplier = getComboMultiplier();
    const gainedScore = BASE_FRUIT_SCORE * multiplier;
    const comboColor = getComboColor();

    if (comboCount >= 2) {
        comboMessage = `${comboCount} COMBO x${multiplier}`;
        comboMessageTimer = 720;
    }

    const effectConfig = getEffectConfig();
    if (comboCount >= 2 && effectConfig.burstEnabled) {
        comboEffects.push(new ComboBurst(x, y, comboCount, multiplier, comboColor));
        if (comboEffects.length > effectConfig.maxEffects) {
            comboEffects.splice(0, comboEffects.length - effectConfig.maxEffects);
        }
    }

    if (multiplier >= 2 && effectConfig.edgeEnabled) {
        const milestoneBoost = comboCount % COMBO_STEP === 0 ? 0.34 : 0;
        comboEdgePulse = Math.min(1, Math.max(comboEdgePulse, 0.20 + Math.min(multiplier, 12) * 0.055 + milestoneBoost));
        comboEdgeColor = comboColor;
    }

    return gainedScore;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}

function createAdaptiveGrid() {
    return Array.from({ length: ADAPTIVE_GRID_ROWS }, () =>
        Array.from({ length: ADAPTIVE_GRID_COLS }, () => ({
            visitMs: 0,
            hits: 0,
            misses: 0,
            bombs: 0,
            spawns: 0,
        }))
    );
}

function createAdaptiveSession() {
    return {
        enabled: true,
        phase: "idle",
        calibrationRemaining: ADAPTIVE_CALIBRATION_MS,
        elapsedMs: 0,
        playElapsedMs: 0,
        baseSensitivity: 1,
        roundSensitivityScale: 1,
        previousRound: null,
        roundIndex: 1,
        sensitivityScale: 1,
        comfortRect: { x: W * 0.18, y: H * 0.18, width: W * 0.64, height: H * 0.64 },
        calibrationSamples: [],
        samples: [],
        lastSampleTime: 0,
        lastPoint: null,
        totalDistance: 0,
        speedEma: 0,
        fatigueEma: 0,
        fatigueTrend: [],
        grid: createAdaptiveGrid(),
        hitPoints: [],
        missPoints: [],
        bombPoints: [],
        recentEdgeMissPressure: 0,
        strategy: "本局固定灵敏度",
        calibrationSummary: "",
        nextScale: 1,
        adjustmentReason: "",
        comparison: null,
        report: null,
        noticeTimer: 0,
        notice: "",
    };
}

function loadAdaptiveProfile() {
    const fallback = { nextScale: 1, roundIndex: 0, lastRound: null };
    try {
        const parsed = JSON.parse(readStoredValue(ADAPTIVE_PROFILE_KEY) || "null");
        if (!parsed || typeof parsed !== "object") return fallback;
        const nextScale = clamp(Number(parsed.nextScale) || 1, ADAPTIVE_MIN_SENSITIVITY_SCALE, ADAPTIVE_MAX_SENSITIVITY_SCALE);
        const roundIndex = Math.max(0, Number.parseInt(parsed.roundIndex, 10) || 0);
        return {
            nextScale,
            roundIndex,
            lastRound: parsed.lastRound && typeof parsed.lastRound === "object" ? parsed.lastRound : null,
        };
    } catch (error) {
        return fallback;
    }
}

function saveAdaptiveProfile(profile) {
    adaptiveProfile = profile;
    writeStoredValue(ADAPTIVE_PROFILE_KEY, JSON.stringify(profile));
}

function isAdaptiveEnabled() {
    return getSettingsState().autoSensitivity !== false;
}

function startAdaptiveSession() {
    adaptiveSession = createAdaptiveSession();
    adaptiveSession.enabled = isAdaptiveEnabled();
    adaptiveSession.phase = adaptiveSession.enabled ? "calibrating" : "playing";
    adaptiveSession.baseSensitivity = Number(getSettingsState().sensitivity) || 1;
    adaptiveSession.previousRound = adaptiveProfile.lastRound;
    adaptiveSession.roundIndex = (Number(adaptiveProfile.roundIndex) || 0) + 1;
    adaptiveSession.roundSensitivityScale = adaptiveSession.enabled
        ? clamp(Number(adaptiveProfile.nextScale) || 1, ADAPTIVE_MIN_SENSITIVITY_SCALE, ADAPTIVE_MAX_SENSITIVITY_SCALE)
        : 1;
    adaptiveSession.sensitivityScale = adaptiveSession.roundSensitivityScale;
    adaptiveSession.nextScale = adaptiveSession.roundSensitivityScale;
    window.adaptiveSensitivityScale = adaptiveSession.roundSensitivityScale;
}

function getAdaptiveCellAt(x, y) {
    const col = clamp(Math.floor((clamp(x, 0, W - 1) / W) * ADAPTIVE_GRID_COLS), 0, ADAPTIVE_GRID_COLS - 1);
    const row = clamp(Math.floor((clamp(y, 0, H - 1) / H) * ADAPTIVE_GRID_ROWS), 0, ADAPTIVE_GRID_ROWS - 1);
    return { row, col, cell: adaptiveSession.grid[row][col] };
}

function getAdaptiveCellLabel(row, col) {
    const vertical = ["上", "中", "下"][row] || "中";
    const horizontal = ["左", "中", "右"][col] || "中";
    if (row === 1 && col === 1) return "中心区域";
    if (row === 1) return `${horizontal}侧`;
    if (col === 1) return `${vertical}方`;
    return `${horizontal}${vertical}`;
}

function rememberAdaptivePoint(list, point, limit = 90) {
    list.push(point);
    if (list.length > limit) {
        list.splice(0, list.length - limit);
    }
}

function appendAdaptiveSample(input, delta, now) {
    if (!adaptiveSession.enabled) return;
    if (now - adaptiveSession.lastSampleTime < ADAPTIVE_SAMPLE_INTERVAL_MS && adaptiveSession.lastPoint) return;

    const x = clamp(input.x, 0, W);
    const y = clamp(input.y, 0, H);
    let speed = 0;
    if (adaptiveSession.lastPoint) {
        const dt = Math.max(0.016, (now - adaptiveSession.lastPoint.t) / 1000);
        const moved = distance(x, y, adaptiveSession.lastPoint.x, adaptiveSession.lastPoint.y);
        speed = moved / dt;
        adaptiveSession.totalDistance += moved;
    }

    adaptiveSession.speedEma = adaptiveSession.speedEma === 0 ? speed : adaptiveSession.speedEma * 0.82 + speed * 0.18;
    const cellInfo = getAdaptiveCellAt(x, y);
    cellInfo.cell.visitMs += delta;

    const sample = { x, y, t: now, speed };
    adaptiveSession.samples.push(sample);
    if (adaptiveSession.samples.length > ADAPTIVE_MAX_POINTS) {
        adaptiveSession.samples.splice(0, adaptiveSession.samples.length - ADAPTIVE_MAX_POINTS);
    }
    if (adaptiveSession.phase === "calibrating") {
        adaptiveSession.calibrationSamples.push(sample);
    }

    const seconds = Math.max(1, adaptiveSession.playElapsedMs / 1000);
    const distancePerSecond = adaptiveSession.totalDistance / seconds;
    const speedLoad = clamp((adaptiveSession.speedEma - 430) / 950, 0, 1);
    const distanceLoad = clamp((distancePerSecond - 380) / 700, 0, 1);
    const fatigue = clamp(speedLoad * 0.58 + distanceLoad * 0.42, 0, 1);
    adaptiveSession.fatigueEma = adaptiveSession.fatigueEma * 0.92 + fatigue * 0.08;

    const lastTrend = adaptiveSession.fatigueTrend[adaptiveSession.fatigueTrend.length - 1];
    if (!lastTrend || now - lastTrend.t > 1000) {
        adaptiveSession.fatigueTrend.push({ t: now, value: adaptiveSession.fatigueEma });
        if (adaptiveSession.fatigueTrend.length > 80) {
            adaptiveSession.fatigueTrend.shift();
        }
    }

    adaptiveSession.lastPoint = sample;
    adaptiveSession.lastSampleTime = now;
}

function getBoundsFromPoints(points) {
    if (!points.length) {
        return { minX: W * 0.32, maxX: W * 0.68, minY: H * 0.28, maxY: H * 0.72 };
    }
    return points.reduce((bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y),
    }), { minX: W, maxX: 0, minY: H, maxY: 0 });
}

function expandRectFromBounds(bounds) {
    const spanX = Math.max(180, bounds.maxX - bounds.minX);
    const spanY = Math.max(150, bounds.maxY - bounds.minY);
    const padX = clamp(spanX * 0.34, 70, 160);
    const padY = clamp(spanY * 0.34, 55, 125);
    const x = clamp(bounds.minX - padX, 80, W - 180);
    const y = clamp(bounds.minY - padY, 70, H - 160);
    const right = clamp(bounds.maxX + padX, x + 180, W - 80);
    const bottom = clamp(bounds.maxY + padY, y + 160, H - 80);
    return { x, y, width: right - x, height: bottom - y };
}

function finishAdaptiveCalibration() {
    const samples = adaptiveSession.calibrationSamples.length >= 8 ? adaptiveSession.calibrationSamples : adaptiveSession.samples;
    const bounds = getBoundsFromPoints(samples);
    const rawCoverageX = clamp((bounds.maxX - bounds.minX) / W, 0, 1);
    const rawCoverageY = clamp((bounds.maxY - bounds.minY) / H, 0, 1);
    const tooLittleMotion = samples.length < 10 || rawCoverageX < 0.08 || rawCoverageY < 0.08;
    adaptiveSession.comfortRect = tooLittleMotion
        ? { x: W * 0.22, y: H * 0.20, width: W * 0.56, height: H * 0.58 }
        : expandRectFromBounds(bounds);

    const coverageX = tooLittleMotion ? 0.38 : clamp(rawCoverageX, 0.15, 1);
    const coverageY = tooLittleMotion ? 0.38 : clamp(rawCoverageY, 0.15, 1);
    const coverage = (coverageX + coverageY) / 2;
    const targetScale = adaptiveSession.roundSensitivityScale;
    adaptiveSession.sensitivityScale = targetScale;
    adaptiveSession.phase = "playing";
    adaptiveSession.calibrationSummary = tooLittleMotion
        ? "校准轨迹不足，先采用默认舒适区"
        : coverage < 0.42
        ? "活动范围偏窄，结算时会倾向提高下一局灵敏度"
        : coverage > 0.68
            ? "活动范围充足，可评估是否降低过高灵敏度"
            : "活动范围适中，作为本局基线记录";
    adaptiveSession.strategy = "本局固定灵敏度";
    adaptiveSession.notice = `校准完成：${adaptiveSession.calibrationSummary}`;
    adaptiveSession.noticeTimer = 1800;
    window.adaptiveSensitivityScale = targetScale;
}

function updateAdaptiveTarget(delta) {
    if (!adaptiveSession.enabled || adaptiveSession.phase !== "playing") return;

    adaptiveSession.recentEdgeMissPressure = Math.max(0, adaptiveSession.recentEdgeMissPressure - delta / 8500);
    adaptiveSession.strategy = "本局固定灵敏度";

    if (adaptiveSession.noticeTimer > 0) {
        adaptiveSession.noticeTimer = Math.max(0, adaptiveSession.noticeTimer - delta);
    }
    window.adaptiveSensitivityScale = adaptiveSession.roundSensitivityScale;
}

function updateAdaptiveSession(delta, input) {
    if (!adaptiveSession.enabled || gameState !== GAME.PLAYING) {
        window.adaptiveSensitivityScale = 1;
        return;
    }

    const now = performance.now();
    adaptiveSession.elapsedMs += delta;
    if (adaptiveSession.phase === "playing") {
        adaptiveSession.playElapsedMs += delta;
    }
    appendAdaptiveSample(input, delta, now);

    if (adaptiveSession.phase === "calibrating") {
        adaptiveSession.calibrationRemaining = Math.max(0, adaptiveSession.calibrationRemaining - delta);
        if (adaptiveSession.calibrationRemaining <= 0) {
            finishAdaptiveCalibration();
        }
        return;
    }

    updateAdaptiveTarget(delta);
}

function isPointOutsideComfortRect(x, y) {
    const rect = adaptiveSession.comfortRect;
    return x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height;
}

function recordAdaptiveSpawn(fruit) {
    if (!adaptiveSession.enabled || adaptiveSession.phase !== "playing") return;
    const cellInfo = getAdaptiveCellAt(fruit.x, H * 0.55);
    cellInfo.cell.spawns += 1;
}

function recordAdaptiveFruitResult(fruit, result) {
    if (!adaptiveSession.enabled) return;
    const x = clamp(fruit.x, 0, W);
    const y = clamp(fruit.y, 0, H);
    const cellInfo = getAdaptiveCellAt(x, y);

    if (result === "hit") {
        cellInfo.cell.hits += 1;
        rememberAdaptivePoint(adaptiveSession.hitPoints, { x, y });
        adaptiveSession.recentEdgeMissPressure = Math.max(0, adaptiveSession.recentEdgeMissPressure - 0.04);
    } else if (result === "miss") {
        cellInfo.cell.misses += 1;
        rememberAdaptivePoint(adaptiveSession.missPoints, { x, y });
        if (isPointOutsideComfortRect(x, y)) {
            adaptiveSession.recentEdgeMissPressure = clamp(adaptiveSession.recentEdgeMissPressure + 0.22, 0, 1);
        }
    } else if (result === "bomb") {
        cellInfo.cell.bombs += 1;
        rememberAdaptivePoint(adaptiveSession.bombPoints, { x, y }, 45);
    }
}

function getAdaptiveRoundScore({ hitRate, coveragePercent, fatigueEnd, bestComboValue }) {
    const comboScore = clamp(bestComboValue * 8, 0, 100);
    return Math.round(
        hitRate * 0.46 +
        coveragePercent * 0.24 +
        (100 - fatigueEnd) * 0.18 +
        comboScore * 0.12
    );
}

function decideNextSensitivity(summary, previousRound) {
    let nextScale = summary.scale;
    let reason = "保持当前灵敏度，继续收集下一局数据";

    if (summary.coveragePercent < 28) {
        nextScale += 0.10;
        reason = "覆盖范围偏小，下局提高灵敏度以减少大幅伸手";
    } else if (summary.hitRate < 55 && summary.avgSpeed > 900) {
        nextScale -= 0.08;
        reason = "移动速度高但命中率低，下局降低灵敏度以减少过冲";
    } else if (summary.hitRate < 60) {
        nextScale += 0.06;
        reason = "命中率偏低且覆盖不足迹象明显，下局轻微提高灵敏度";
    } else if (summary.fatigueEnd > 68 && summary.coveragePercent > 42) {
        nextScale -= 0.06;
        reason = "疲劳较高但覆盖已足够，下局降低灵敏度让动作更稳";
    } else if (summary.hitRate > 78 && summary.coveragePercent > 58 && summary.fatigueEnd < 42) {
        nextScale -= 0.03;
        reason = "本局表现稳定，下局轻微降低灵敏度验证是否更省力";
    }

    if (previousRound && Math.abs(summary.scale - previousRound.scale) > 0.015) {
        const scoreDelta = summary.roundScore - previousRound.roundScore;
        const scaleWentUp = summary.scale > previousRound.scale;
        const scaleWentDown = summary.scale < previousRound.scale;
        if (scoreDelta <= -ADAPTIVE_SCORE_THRESHOLD && scaleWentUp) {
            nextScale = summary.scale - 0.08;
            reason = "上调后表现下降，下局回退部分灵敏度";
        } else if (scoreDelta <= -ADAPTIVE_SCORE_THRESHOLD && scaleWentDown) {
            nextScale = summary.scale + 0.08;
            reason = "下调后表现下降，下局回退部分灵敏度";
        }
    }

    return {
        nextScale: Math.round(clamp(nextScale, ADAPTIVE_MIN_SENSITIVITY_SCALE, ADAPTIVE_MAX_SENSITIVITY_SCALE) * 100) / 100,
        reason,
    };
}

function compareAdaptiveRounds(current, previous) {
    if (!previous) {
        return {
            label: "首次记录",
            scoreDelta: 0,
            hitRateDelta: 0,
            coverageDelta: 0,
            fatigueDelta: 0,
            detail: "完成下一局后将显示对比结果",
        };
    }

    const scoreDelta = current.roundScore - previous.roundScore;
    const hitRateDelta = current.hitRate - previous.hitRate;
    const coverageDelta = current.coveragePercent - previous.coveragePercent;
    const fatigueDelta = current.fatigueEnd - previous.fatigueEnd;
    const label = scoreDelta >= ADAPTIVE_SCORE_THRESHOLD
        ? "优于上一局"
        : scoreDelta <= -ADAPTIVE_SCORE_THRESHOLD
            ? "低于上一局"
            : "基本持平";

    return {
        label,
        scoreDelta,
        hitRateDelta,
        coverageDelta,
        fatigueDelta,
        detail: `交互分 ${scoreDelta >= 0 ? "+" : ""}${scoreDelta}，命中 ${hitRateDelta >= 0 ? "+" : ""}${hitRateDelta}%`,
    };
}

function getAdaptiveReport() {
    if (adaptiveSession.report) return adaptiveSession.report;

    const samples = adaptiveSession.samples;
    const bounds = getBoundsFromPoints(samples);
    const coverageWidth = Math.max(0, bounds.maxX - bounds.minX);
    const coverageHeight = Math.max(0, bounds.maxY - bounds.minY);
    const coveragePercent = Math.round(clamp((coverageWidth * coverageHeight) / (W * H), 0, 1) * 100);
    const attempts = adaptiveSession.hitPoints.length + adaptiveSession.missPoints.length;
    const hitRate = attempts > 0 ? Math.round((adaptiveSession.hitPoints.length / attempts) * 100) : 0;
    const trend = adaptiveSession.fatigueTrend;
    const firstFatigue = trend.length ? trend.slice(0, Math.max(1, Math.ceil(trend.length * 0.25))).reduce((sum, item) => sum + item.value, 0) / Math.max(1, Math.ceil(trend.length * 0.25)) : 0;
    const lastSlice = trend.slice(-Math.max(1, Math.ceil(trend.length * 0.25)));
    const lastFatigue = lastSlice.length ? lastSlice.reduce((sum, item) => sum + item.value, 0) / lastSlice.length : adaptiveSession.fatigueEma;
    const fatigueDelta = lastFatigue - firstFatigue;
    const fatigueTrendText = fatigueDelta > 0.10 ? "上升" : fatigueDelta < -0.08 ? "下降" : "平稳";
    const avgSpeed = Math.round(adaptiveSession.samples.reduce((sum, item) => sum + item.speed, 0) / Math.max(1, adaptiveSession.samples.length));

    let hardest = { row: 1, col: 1, score: -1 };
    let maxVisit = 1;
    adaptiveSession.grid.forEach((row) => row.forEach((cell) => {
        maxVisit = Math.max(maxVisit, cell.visitMs);
    }));
    adaptiveSession.grid.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
        const cellAttempts = cell.hits + cell.misses;
        const missRate = cellAttempts ? cell.misses / cellAttempts : 0;
        const lowVisit = 1 - cell.visitMs / maxVisit;
        const score = lowVisit * 0.55 + missRate * 0.45 + Math.min(0.25, cell.misses * 0.05);
        if (score > hardest.score) {
            hardest = { row: rowIndex, col: colIndex, score };
        }
    }));

    const roundSummary = {
        roundIndex: adaptiveSession.roundIndex,
        mode: chosenMode,
        scale: Math.round(adaptiveSession.roundSensitivityScale * 100) / 100,
        score,
        bestCombo,
        coveragePercent,
        hitRate,
        fatigueEnd: Math.round(lastFatigue * 100),
        avgSpeed,
        hardestLabel: getAdaptiveCellLabel(hardest.row, hardest.col),
        hardestRow: hardest.row,
        hardestCol: hardest.col,
    };
    roundSummary.roundScore = getAdaptiveRoundScore({
        hitRate,
        coveragePercent,
        fatigueEnd: roundSummary.fatigueEnd,
        bestComboValue: bestCombo,
    });
    const previousRound = adaptiveSession.previousRound;
    const comparison = compareAdaptiveRounds(roundSummary, previousRound);
    const decision = decideNextSensitivity(roundSummary, previousRound);
    adaptiveSession.nextScale = decision.nextScale;
    adaptiveSession.adjustmentReason = decision.reason;
    adaptiveSession.comparison = comparison;

    saveAdaptiveProfile({
        nextScale: decision.nextScale,
        roundIndex: adaptiveSession.roundIndex,
        lastRound: Object.assign({}, roundSummary, {
            nextScale: decision.nextScale,
            adjustmentReason: decision.reason,
        }),
    });

    adaptiveSession.report = {
        roundIndex: adaptiveSession.roundIndex,
        coveragePercent,
        coverageWidth: Math.round(coverageWidth),
        coverageHeight: Math.round(coverageHeight),
        hitRate,
        fatigueTrendText,
        fatigueStart: Math.round(firstFatigue * 100),
        fatigueEnd: Math.round(lastFatigue * 100),
        avgSpeed,
        hardestLabel: getAdaptiveCellLabel(hardest.row, hardest.col),
        hardestRow: hardest.row,
        hardestCol: hardest.col,
        roundScore: roundSummary.roundScore,
        currentScale: roundSummary.scale,
        nextScale: decision.nextScale,
        adjustmentReason: decision.reason,
        previousRound,
        comparison,
        calibrationSummary: adaptiveSession.calibrationSummary,
        recommendation: decision.reason,
        grid: adaptiveSession.grid.map((row) => row.map((cell) => Object.assign({}, cell))),
        hitPoints: adaptiveSession.hitPoints.slice(),
        missPoints: adaptiveSession.missPoints.slice(),
        comfortRect: Object.assign({}, adaptiveSession.comfortRect),
    };
    return adaptiveSession.report;
}

function getSettingsState() {
    if (!window.settings) {
        window.settings = { muted: false, sensitivity: 1.0, autoSensitivity: true, showCameraPreview: true, musicVolume: 0.45, sfxVolume: 0.8, effectLevel: "medium" };
    }
    window.settings.autoSensitivity = window.settings.autoSensitivity !== false;
    if (!EFFECT_LEVELS[window.settings.effectLevel]) {
        window.settings.effectLevel = "medium";
    }
    return window.settings;
}

function getEffectConfig() {
    const settings = getSettingsState();
    return EFFECT_LEVELS[settings.effectLevel] || EFFECT_LEVELS.medium;
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
    writeStoredValue("cohci_settings", JSON.stringify(settings));
}

function saveDojoState() {
    localStorage.setItem("cohci_dojo_state", JSON.stringify(dojoState));
}

function loadDojoState() {
    const raw = localStorage.getItem("cohci_dojo_state");
    const fallback = {
        focus: "background",
        previewBackgroundIndex: 0,
        previewEffectIndex: 0,
        activeBackgroundIndex: 0,
        activeEffectIndex: 0,
    };

    try {
        if (raw) {
            const parsed = Object.assign({}, fallback, JSON.parse(raw));
            dojoState.focus = parsed.focus === "effect" ? "effect" : "background";
            dojoState.previewBackgroundIndex = clamp(Number(parsed.previewBackgroundIndex) || 0, 0, DOJO_BACKGROUND_LIBRARY.length - 1);
            dojoState.previewEffectIndex = clamp(Number(parsed.previewEffectIndex) || 0, 0, DOJO_EFFECT_LIBRARY.length - 1);
            dojoState.activeBackgroundIndex = clamp(Number(parsed.activeBackgroundIndex) || 0, 0, DOJO_BACKGROUND_LIBRARY.length - 1);
            dojoState.activeEffectIndex = clamp(Number(parsed.activeEffectIndex) || 0, 0, DOJO_EFFECT_LIBRARY.length - 1);
        }
    } catch (e) {
        dojoState = Object.assign({}, fallback);
    }
}

function resetDojoHold() {
    dojoHold.modeToggle = 0;
    dojoHold.exit = 0;
    dojoHold.left = 0;
    dojoHold.center = 0;
    dojoHold.right = 0;
}

function getDojoPreviewItem() {
    if (dojoState.focus === "effect") {
        return DOJO_EFFECT_LIBRARY[dojoState.previewEffectIndex] || DOJO_EFFECT_LIBRARY[0];
    }
    return DOJO_BACKGROUND_LIBRARY[dojoState.previewBackgroundIndex] || DOJO_BACKGROUND_LIBRARY[0];
}

function moveDojoPreview(direction) {
    if (dojoState.focus === "effect") {
        const max = DOJO_EFFECT_LIBRARY.length;
        dojoState.previewEffectIndex = (dojoState.previewEffectIndex + direction + max) % max;
    } else {
        const max = DOJO_BACKGROUND_LIBRARY.length;
        dojoState.previewBackgroundIndex = (dojoState.previewBackgroundIndex + direction + max) % max;
    }
    saveDojoState();
}

function confirmDojoSelection() {
    if (dojoState.focus === "effect") {
        dojoState.activeEffectIndex = dojoState.previewEffectIndex;
    } else {
        dojoState.activeBackgroundIndex = dojoState.previewBackgroundIndex;
    }
    saveDojoState();
}

function toggleDojoFocus() {
    dojoState.focus = dojoState.focus === "background" ? "effect" : "background";
    if (dojoState.focus === "background") {
        dojoState.previewBackgroundIndex = dojoState.activeBackgroundIndex;
    } else {
        dojoState.previewEffectIndex = dojoState.activeEffectIndex;
    }
    resetDojoHold();
    saveDojoState();
}

function drawDefaultBackdrop() {
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

function drawGameBackdrop() {
    const background = DOJO_BACKGROUND_LIBRARY[dojoState.activeBackgroundIndex] || DOJO_BACKGROUND_LIBRARY[0];
    const image = getDojoImage(background.src);

    drawDefaultBackdrop();

    if (image && image.complete && image.naturalWidth > 0) {
        const ratio = image.naturalWidth / image.naturalHeight;
        const canvasRatio = W / H;
        let drawWidth = W;
        let drawHeight = H;
        let drawX = 0;
        let drawY = 0;

        if (ratio > canvasRatio) {
            drawHeight = H;
            drawWidth = H * ratio;
            drawX = (W - drawWidth) / 2;
        } else {
            drawWidth = W;
            drawHeight = W / ratio;
            drawY = (H - drawHeight) / 2;
        }

        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();

        const veil = ctx.createLinearGradient(0, 0, 0, H);
        veil.addColorStop(0, "rgba(11, 16, 26, 0.30)");
        veil.addColorStop(0.48, "rgba(11, 16, 26, 0.16)");
        veil.addColorStop(1, "rgba(11, 16, 26, 0.42)");
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, W, H);
    }

    const effect = DOJO_EFFECT_LIBRARY[dojoState.activeEffectIndex] || DOJO_EFFECT_LIBRARY[0];
    if (effect.id !== "none") {
        drawDojoEffectOverlay(effect.id, 0, 0, W, H, 0.9);
    }

    const ring = ctx.createLinearGradient(0, 0, W, H);
    ring.addColorStop(0, "rgba(255,255,255,0.03)");
    ring.addColorStop(0.5, "rgba(139,233,253,0.03)");
    ring.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, W - 24, H - 24);
}

function drawDojoBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#f4efe6");
    gradient.addColorStop(0.55, "#ebe0d0");
    gradient.addColorStop(1, "#d8c7b1");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.fillStyle = "rgba(161, 122, 72, 0.10)";
    for (let i = 0; i < 12; i += 1) {
        const x = (i * 83 + (lastTimestamp * 0.012)) % W;
        const y = 90 + (i % 4) * 110;
        ctx.fillRect(x, y, 66, 2);
        ctx.fillRect(x + 12, y + 12, 2, 56);
    }
    ctx.restore();

    const mist = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.7);
    mist.addColorStop(0, "rgba(255,255,255,0.18)");
    mist.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(93, 61, 34, 0.12)";
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = "rgba(93, 61, 34, 0.22)";
    ctx.fillRect(0, H - 64, W, 12);
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
    if (window.setMusicVolume) {
        window.setMusicVolume(timeStopBgmDucked ? settings.musicVolume * TIME_STOP_BGM_VOLUME_FACTOR : settings.musicVolume);
    }
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

function getSettingsSliderTargetAt(x, y) {
    const left = W / 2 - 180;
    const right = W / 2 + 180;
    if (x < left || x > right) {
        return null;
    }

    const row = settingsSliderRows.find((slider) => y >= slider.y - 28 && y <= slider.y + 28);
    return row ? row.target : null;
}

function setSettingsSliderFromX(target, x) {
    if (target === "sensitivity") setSensitivityFromSliderX(x);
    else if (target === "music") setMusicFromSliderX(x);
    else if (target === "sfx") setSfxFromSliderX(x);
}

function toggleSetting(key) {
    const settings = getSettingsState();
    settings[key] = !settings[key];
    applySettingsState();
    saveSettings();
}

function cycleEffectLevel() {
    const settings = getSettingsState();
    const currentIndex = EFFECT_LEVEL_ORDER.indexOf(settings.effectLevel);
    const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % EFFECT_LEVEL_ORDER.length;
    settings.effectLevel = EFFECT_LEVEL_ORDER[nextIndex];
    comboEffects = [];
    comboEdgePulse = 0;
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

function drawWrappedText(text, x, y, maxWidth, size = 18, color = "#ffffff", lineHeight = 24) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let line = "";
    let lineY = y;
    Array.from(String(text)).forEach((char) => {
        const testLine = line + char;
        if (ctx.measureText(testLine).width > maxWidth && line) {
            ctx.fillText(line, x, lineY);
            line = char;
            lineY += lineHeight;
        } else {
            line = testLine;
        }
    });
    if (line) {
        ctx.fillText(line, x, lineY);
    }
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

function drawComboHud() {
    const comboColor = getComboColor();
    const multiplier = getComboMultiplier();
    const effectConfig = getEffectConfig();

    if (comboCount > 0) {
        const width = 230;
        const height = 40;
        const left = W / 2 - width / 2;
        const top = 106;
        const progress = clamp(comboTimer / COMBO_WINDOW_MS, 0, 1);

        drawRoundedRect(left, top, width, height, 18, "rgba(3, 8, 16, 0.48)", "rgba(255,255,255,0.12)");
        ctx.save();
        ctx.shadowColor = comboColor;
        ctx.shadowBlur = Math.min(28, (6 + multiplier * 2.4) * effectConfig.shadowScale);
        drawText(`${comboCount} Combo  x${multiplier}`, W / 2, top + 18, 22, comboColor);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(left + 22, top + 30, width - 44, 5);
        ctx.fillStyle = comboColor;
        ctx.fillRect(left + 22, top + 30, (width - 44) * progress, 5);
        ctx.restore();
    }

    if (comboMessageTimer > 0 && comboMessage) {
        ctx.save();
        ctx.globalAlpha = clamp(comboMessageTimer / 180, 0, 1);
        ctx.shadowColor = comboColor;
        ctx.shadowBlur = 22 * effectConfig.shadowScale;
        drawText(comboMessage, W / 2, 182, comboCount >= 12 ? 52 : 42, comboColor);
        ctx.restore();
    }
}

function drawComboEdgeEffect() {
    const effectConfig = getEffectConfig();
    if (!effectConfig.edgeEnabled) return;

    const multiplier = getComboMultiplier();
    const passiveGlow = effectConfig.passiveEdge && multiplier >= 2 ? 0.12 + Math.min(0.30, multiplier * 0.018) : 0;
    const intensity = clamp(Math.max(comboEdgePulse, passiveGlow), 0, 1);
    if (intensity <= 0) return;

    const rgb = hexToRgb(comboEdgeColor);
    const edgeSize = 70 + intensity * 90;
    const alpha = 0.12 + intensity * 0.30;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const topGlow = ctx.createLinearGradient(0, 0, 0, edgeSize);
    topGlow.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    topGlow.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, edgeSize);

    const bottomGlow = ctx.createLinearGradient(0, H, 0, H - edgeSize);
    bottomGlow.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    bottomGlow.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, H - edgeSize, W, edgeSize);

    const leftGlow = ctx.createLinearGradient(0, 0, edgeSize, 0);
    leftGlow.addColorStop(0, `rgba(${rgb}, ${alpha * 0.82})`);
    leftGlow.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, edgeSize, H);

    const rightGlow = ctx.createLinearGradient(W, 0, W - edgeSize, 0);
    rightGlow.addColorStop(0, `rgba(${rgb}, ${alpha * 0.82})`);
    rightGlow.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = rightGlow;
    ctx.fillRect(W - edgeSize, 0, edgeSize, H);

    ctx.strokeStyle = `rgba(${rgb}, ${0.24 + intensity * 0.46})`;
    ctx.lineWidth = 3 + intensity * 5;
    ctx.shadowColor = comboEdgeColor;
    ctx.shadowBlur = (12 + intensity * 22) * effectConfig.shadowScale;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.restore();
}

function drawTimeStopEffect() {
    if (timeStopTimer <= 0 && timeStopFlash <= 0) return;

    const effectConfig = getEffectConfig();
    const activeRatio = clamp(timeStopTimer / TIME_STOP_DURATION_MS, 0, 1);
    const flashRatio = clamp(timeStopFlash, 0, 1);
    const intensity = clamp(Math.max(activeRatio * 0.68, flashRatio) * (0.65 + effectConfig.shadowScale * 0.35), 0, 1);
    const edgeSize = 90 + intensity * 95;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(110, 210, 255, ${0.06 + intensity * 0.12})`;
    ctx.fillRect(0, 0, W, H);

    if (effectConfig.edgeEnabled) {
        const radial = ctx.createRadialGradient(timeStopX, timeStopY, 0, timeStopX, timeStopY, 260 + flashRatio * 180);
        radial.addColorStop(0, `rgba(190, 245, 255, ${0.34 * intensity})`);
        radial.addColorStop(0.38, `rgba(95, 200, 255, ${0.16 * intensity})`);
        radial.addColorStop(1, "rgba(95, 200, 255, 0)");
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(timeStopX, timeStopY, 280 + flashRatio * 180, 0, Math.PI * 2);
        ctx.fill();

        const topGlow = ctx.createLinearGradient(0, 0, 0, edgeSize);
        topGlow.addColorStop(0, `rgba(130, 225, 255, ${0.24 + intensity * 0.22})`);
        topGlow.addColorStop(1, "rgba(130, 225, 255, 0)");
        ctx.fillStyle = topGlow;
        ctx.fillRect(0, 0, W, edgeSize);

        const bottomGlow = ctx.createLinearGradient(0, H, 0, H - edgeSize);
        bottomGlow.addColorStop(0, `rgba(130, 225, 255, ${0.20 + intensity * 0.18})`);
        bottomGlow.addColorStop(1, "rgba(130, 225, 255, 0)");
        ctx.fillStyle = bottomGlow;
        ctx.fillRect(0, H - edgeSize, W, edgeSize);
    }

    ctx.strokeStyle = `rgba(190, 245, 255, ${0.32 + intensity * 0.48})`;
    ctx.lineWidth = 2 + intensity * 5;
    ctx.shadowColor = "#9de7ff";
    ctx.shadowBlur = (16 + intensity * 24) * effectConfig.shadowScale;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    if (flashRatio > 0) {
        const ringProgress = 1 - flashRatio;
        ctx.lineWidth = 4 + flashRatio * 5;
        ctx.beginPath();
        ctx.arc(timeStopX, timeStopY, 50 + ringProgress * 320, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawTimeStopHud() {
    if (timeStopTimer > 0) {
        ctx.save();
        ctx.shadowColor = "#9de7ff";
        ctx.shadowBlur = 28;
        drawText(`TIME STOP ${(timeStopTimer / 1000).toFixed(1)}s`, W / 2, H - 44, 34, "#bff5ff");
        ctx.restore();
    } else if (timeStopCooldown > 0) {
        drawText(`响指冷却 ${Math.ceil(timeStopCooldown / 1000)}s`, W / 2, H - 34, 20, "rgba(191,245,255,0.76)");
    } else if (!isTimeStopItemCarried()) {
        drawText("赛前携带时停道具后可响指时停", W / 2, H - 34, 20, "rgba(191,245,255,0.50)");
    } else if (!window.cameraReady) {
        drawText("摄像头连接后可响指时停", W / 2, H - 34, 20, "rgba(191,245,255,0.54)");
    } else {
        drawText("响指使用时停道具", W / 2, H - 34, 20, "rgba(191,245,255,0.64)");
    }

    if (timeStopMessageTimer > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(timeStopMessageTimer / 260, 0, 1);
        ctx.shadowColor = "#9de7ff";
        ctx.shadowBlur = 34;
        drawText("SNAP TIME STOP", W / 2, 236, 48, "#bff5ff");
        ctx.restore();
    }
}

function drawBackground() {
    if (gameState === GAME.PLAYING) {
        drawGameBackdrop();
        return;
    }

    if (gameState === GAME.DOJO) {
        drawDojoBackdrop();
        return;
    }

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

function drawAdaptiveCalibrationOverlay(input) {
    const progress = 1 - adaptiveSession.calibrationRemaining / ADAPTIVE_CALIBRATION_MS;
    const panelX = W / 2 - 285;
    const panelY = 170;
    const panelW = 570;
    const panelH = 220;
    drawRoundedRect(panelX, panelY, panelW, panelH, 24, "rgba(5, 12, 22, 0.68)", "rgba(126,247,197,0.35)");
    drawText("自适应校准", W / 2, panelY + 44, 42, "#7ef7c5");
    drawText("自然挥动手部，系统正在学习你的舒适范围", W / 2, panelY + 88, 22, "rgba(255,255,255,0.78)");
    drawText(input.hand ? "摄像头轨迹采集中" : "鼠标轨迹采集中", W / 2, panelY + 120, 18, "rgba(255,255,255,0.56)");

    const barX = panelX + 82;
    const barY = panelY + 158;
    const barW = panelW - 164;
    const barH = 10;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(barX, barY, barW, barH);
    const gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    gradient.addColorStop(0, "#7ef7c5");
    gradient.addColorStop(1, "#ffd166");
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barW * clamp(progress, 0, 1), barH);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(126,247,197,0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(input.x, input.y, 26 + Math.sin(performance.now() / 160) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawAdaptiveHeatmap(report, x, y, width, height) {
    const cellW = width / ADAPTIVE_GRID_COLS;
    const cellH = height / ADAPTIVE_GRID_ROWS;
    const maxVisit = Math.max(1, ...report.grid.flat().map((cell) => cell.visitMs));

    drawRoundedRect(x - 12, y - 34, width + 24, height + 56, 18, "rgba(255,255,255,0.045)", "rgba(255,255,255,0.10)");
    drawText("轨迹热力图 / 区域命中率", x, y - 16, 18, "rgba(255,255,255,0.78)", "left");

    report.grid.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
        const left = x + colIndex * cellW;
        const top = y + rowIndex * cellH;
        const heat = clamp(cell.visitMs / maxVisit, 0, 1);
        const attempts = cell.hits + cell.misses;
        const hitRate = attempts ? Math.round((cell.hits / attempts) * 100) : null;
        const hardest = report.hardestRow === rowIndex && report.hardestCol === colIndex;

        ctx.save();
        ctx.fillStyle = hardest ? "rgba(255, 184, 77, 0.30)" : `rgba(126, 247, 197, ${0.07 + heat * 0.34})`;
        ctx.fillRect(left, top, cellW, cellH);
        ctx.strokeStyle = hardest ? "rgba(255,184,77,0.90)" : "rgba(255,255,255,0.16)";
        ctx.lineWidth = hardest ? 3 : 1;
        ctx.strokeRect(left, top, cellW, cellH);
        ctx.restore();

        if (hitRate !== null) {
            drawText(`${hitRate}%`, left + cellW / 2, top + cellH / 2, 18, cell.misses > cell.hits ? "#ffd166" : "#ffffff");
        }
    }));

    ctx.save();
    ctx.strokeStyle = "rgba(255,209,102,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
        x + (report.comfortRect.x / W) * width,
        y + (report.comfortRect.y / H) * height,
        (report.comfortRect.width / W) * width,
        (report.comfortRect.height / H) * height
    );
    ctx.fillStyle = "rgba(255,209,102,0.7)";
    report.missPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(x + (point.x / W) * width, y + (point.y / H) * height, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = "rgba(126,247,197,0.74)";
    report.hitPoints.slice(-70).forEach((point) => {
        ctx.beginPath();
        ctx.arc(x + (point.x / W) * width, y + (point.y / H) * height, 2.2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawAdaptiveReport(report) {
    drawText("灵敏度学习报告", W / 2, 186, 28, "#7ef7c5");
    drawAdaptiveHeatmap(report, 112, 232, 250, 166);

    const left = 414;
    const top = 218;
    const lineGap = 30;
    drawRoundedRect(left - 24, top - 24, 406, 270, 18, "rgba(255,255,255,0.045)", "rgba(255,255,255,0.10)");
    drawText(`本局固定灵敏度：x${report.currentScale.toFixed(2)}`, left, top, 21, "#ffffff", "left");
    drawText(`下局建议灵敏度：x${report.nextScale.toFixed(2)}`, left, top + lineGap, 21, "#7ef7c5", "left");
    drawText(`交互分：${report.roundScore}   ${report.comparison.label}`, left, top + lineGap * 2, 19, report.comparison.scoreDelta >= ADAPTIVE_SCORE_THRESHOLD ? "#7ef7c5" : report.comparison.scoreDelta <= -ADAPTIVE_SCORE_THRESHOLD ? "#ffd166" : "#ffffff", "left");
    drawText(report.previousRound ? report.comparison.detail : "暂无上一局对比", left, top + lineGap * 3, 17, "rgba(255,255,255,0.72)", "left");
    drawText(`命中率 ${report.hitRate}%   覆盖 ${report.coveragePercent}%   疲劳 ${report.fatigueEnd}%`, left, top + lineGap * 4, 18, "#ffffff", "left");
    drawText(`最难触达：${report.hardestLabel}   平均速度：${report.avgSpeed}px/s`, left, top + lineGap * 5, 18, "#ffd166", "left");
    drawWrappedText(report.adjustmentReason, left, top + lineGap * 6 + 4, 350, 16, "rgba(255,255,255,0.78)", 22);
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
    constructor(mode, options = {}) {
        const fruitPool = ["apple", "orange", "banana", "watermelon"];
        const bombChance = mode === MODES.zen ? 0 : (1 / 13) * (Number(options.bombRateFactor) || 1);
        this.type = Math.random() < bombChance ? "bomb" : fruitPool[Math.floor(Math.random() * fruitPool.length)];
        this.id = fruitIdSeed++;
        this.r = this.type === "bomb" ? 40 : 38;
        this.x = Number.isFinite(options.x) ? clamp(options.x, 110, W - 110) : Math.random() * (W - 300) + 150;
        this.y = H + 50;
        const speedScale = Number(options.speedScale) || 1;
        const horizontalScale = Number(options.horizontalScale) || 1;
        this.vx = (Math.random() * 6 - 3) * horizontalScale;
        this.vy = (-Math.random() * 5 - 13) * speedScale;
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

class ComboBurst {
    constructor(x, y, count, multiplier, color) {
        const effectConfig = getEffectConfig();
        this.x = x;
        this.y = y;
        this.count = count;
        this.multiplier = multiplier;
        this.color = color;
        this.rgb = hexToRgb(color);
        this.effectLevel = getSettingsState().effectLevel;
        this.shadowScale = effectConfig.shadowScale;
        this.life = Math.round((26 + Math.min(multiplier, 12) * 1.6) * (effectConfig.shadowScale + 0.55));
        this.maxLife = this.life;
        this.radius = 20;
        this.rotation = Math.random() * Math.PI * 2;
        this.shards = [];

        const shardCount = Math.min(effectConfig.shardCap, effectConfig.shardBase + Math.floor(multiplier * 0.9));
        for (let i = 0; i < shardCount; i += 1) {
            const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.35;
            const speed = 3 + Math.random() * (3 + Math.min(multiplier, 10) * 0.45);
            this.shards.push({
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 5,
            });
        }
    }

    update(step = 1) {
        this.life -= step;
        this.radius += (3.2 + Math.min(this.multiplier, 12) * 0.25) * step;
        this.rotation += 0.05 * step;

        this.shards.forEach((shard) => {
            shard.x += shard.vx * step;
            shard.y += shard.vy * step;
            shard.vx *= Math.pow(0.95, step);
            shard.vy *= Math.pow(0.95, step);
        });
    }

    draw() {
        if (this.life <= 0) return;

        const progress = clamp(1 - this.life / this.maxLife, 0, 1);
        const alpha = 1 - progress;
        const ringAlpha = Math.max(0, alpha * 0.75);
        const textAlpha = Math.max(0, Math.min(1, alpha * 1.25));

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.strokeStyle = `rgba(${this.rgb}, ${ringAlpha})`;
        ctx.lineWidth = 4 + Math.min(this.multiplier, 12) * 0.25;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = (12 + Math.min(this.multiplier, 14)) * this.shadowScale;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (this.effectLevel !== "low") {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.55, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.shards.forEach((shard) => {
            ctx.fillStyle = `rgba(${this.rgb}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(shard.x, shard.y, shard.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        if (this.multiplier >= 2) {
            ctx.save();
            ctx.globalAlpha = textAlpha;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = (12 + Math.min(this.multiplier, 14)) * this.shadowScale;
            drawText(`x${this.multiplier}`, this.x, this.y - 42 - progress * 18, 24 + Math.min(this.multiplier, 20), this.color);
            ctx.restore();
        }
    }
}

class ClearWave {
    constructor(x, y, targetCount, source) {
        const effectConfig = getEffectConfig();
        const effectLevel = getSettingsState().effectLevel;
        const isOpenHand = source === "openHand";
        this.x = x;
        this.y = y;
        this.targetCount = targetCount;
        this.source = source;
        this.rgb = isOpenHand ? "255, 184, 77" : "255, 107, 107";
        this.color = isOpenHand ? "#ffb84d" : "#ff6b6b";
        this.shadowScale = effectConfig.shadowScale;
        this.life = effectLevel === "low" ? 28 : effectLevel === "medium" ? 38 : 48;
        this.maxLife = this.life;
        this.ringCount = effectLevel === "low" ? 1 : effectLevel === "medium" ? 2 : 3;
        this.shards = [];

        const shardCount = effectLevel === "low" ? 6 : effectLevel === "medium" ? 12 : 20;
        for (let i = 0; i < shardCount; i += 1) {
            const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.28;
            const speed = 5 + Math.random() * (isOpenHand ? 8 : 5);
            this.shards.push({
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 5,
            });
        }
    }

    update(step = 1) {
        this.life -= step;
        this.shards.forEach((shard) => {
            shard.x += shard.vx * step;
            shard.y += shard.vy * step;
            shard.vx *= Math.pow(0.94, step);
            shard.vy *= Math.pow(0.94, step);
        });
    }

    draw() {
        if (this.life <= 0) return;

        const progress = clamp(1 - this.life / this.maxLife, 0, 1);
        const alpha = 1 - progress;

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.translate(this.x, this.y);
        ctx.shadowColor = this.color;
        ctx.shadowBlur = (18 + progress * 28) * this.shadowScale;

        for (let i = 0; i < this.ringCount; i += 1) {
            const offset = i * 46;
            const radius = 44 + progress * (360 + offset);
            ctx.strokeStyle = `rgba(${this.rgb}, ${Math.max(0, alpha * (0.74 - i * 0.16))})`;
            ctx.lineWidth = 5 - i;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.shards.forEach((shard) => {
            ctx.fillStyle = `rgba(${this.rgb}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(shard.x, shard.y, shard.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        });

        if (this.source === "openHand") {
            ctx.globalAlpha = Math.min(1, alpha * 1.2);
            drawText("PALM CLEAR", 0, -58 - progress * 18, 28, "#ffdc8f");
        }
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
    normalizeCarriedItem();
    chosenMode = mode;
    score = 0;
    lives = 3;
    fruits = [];
    particles = [];
    slices = [];
    splats = [];
    clearEffects = [];
    clearScreenFlash = 0;
    clearScreenPulse = 0;
    trail = [];
    menuHold = menuItems.map(() => 0);
    resetLoadoutHold();
    gameoverHold = gameoverItems.map(() => 0);
    playExitHold = 0;
    clearItemHold = 0;
    openHandClearHold = 0;
    openHandClearLatched = false;
    openHandClearBlockedUntil = 0;
    window.gestureLockUntil = 0;
    resetComboStats();
    resetTimeStop();
    startAdaptiveSession();

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
    clearEffects = [];
    clearScreenFlash = 0;
    clearScreenPulse = 0;
    trail = [];
    menuHold = menuItems.map(() => 0);
    resetLoadoutHold();
    gameoverHold = gameoverItems.map(() => 0);
    playExitHold = 0;
    clearItemHold = 0;
    openHandClearHold = 0;
    openHandClearLatched = false;
    openHandClearBlockedUntil = 0;
    window.gestureLockUntil = 0;
    resetComboStats();
    resetTimeStop();
    adaptiveSession.phase = "idle";
    window.adaptiveSensitivityScale = 1;
    resetDojoHold();
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
    } else if (gameState === GAME.DOJO) {
        window.playBgm("dojo");
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

    return {
        x: pointerX,
        y: pointerY,
        active,
        hand: cameraActive,
        fist: Boolean(window.isFist && cameraActive),
        openHand: Boolean((window.isOpenHand || window.isOpenPalm) && cameraActive),
    };
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
        const fruit = new Fruit(chosenMode);
        fruits.push(fruit);
        recordAdaptiveSpawn(fruit);
    }
}

function updateMenu(delta, input) {
    drawText("Select Game Mode", W / 2, 88, 58, "#ffffff");
    drawText("先选择本局携带道具，再停留到模式按钮开始", W / 2, 132, 24, "rgba(255,255,255,0.78)");

    const loadoutHovered = updateLoadoutSelector(delta, input);

    let trigger = null;
    const hoveredIndex = loadoutHovered ? -1 : getMenuItemIndexAt(input.x, input.y);
    menuItems.forEach((item, index) => {
        const hovered = index === hoveredIndex;
        if (hovered) {
            menuHold[index] = Math.min(REQUIRED_HOLD_MS, menuHold[index] + delta);
        } else {
            menuHold[index] = Math.max(0, menuHold[index] - delta * 2);
        }

        const bounds = getButtonBounds(item);
        drawRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 18, hovered ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)", hovered ? item.color : "rgba(255,255,255,0.12)");
        drawText(item.text, item.x, item.y - 2, item.height > 60 ? 32 : 26, hovered ? item.color : "#ffffff");
        drawLoadingArc(bounds.x + bounds.width - 30, item.y, 15, menuHold[index] / REQUIRED_HOLD_MS, item.color);

        if (menuHold[index] >= REQUIRED_HOLD_MS) {
            trigger = item;
        }
    });

    if (trigger) {
        if (trigger.mode === "settings") {
            gameState = GAME.SETTINGS;
            resetSettingsHold();
            settingsSliderDragging = false;
            settingsSliderDragSource = null;
            settingsLatchedIndex = -1;
        } else if (trigger.mode === "dojo") {
            gameState = GAME.DOJO;
            resetDojoHold();
            syncBgmForScene();
        } else if (trigger.mode === "dojo") {
            gameState = GAME.DOJO;
            resetDojoHold();
            syncBgmForScene();
        } else if (trigger.mode === "shop") { 
            enterShop();
        } else { 
            normalizeCarriedItem();
            resetGame(trigger.mode);
        }
    }
}

function updateSettings(delta, input) {
    drawText("Settings", W / 2, 90, 58, "#ffffff");
    drawText("同样支持鼠标或手势，停留 1 秒即可选中", W / 2, 132, 24, "rgba(255,255,255,0.78)");
    drawText(`当前灵敏度：${(getSettingsState().sensitivity || 1.0).toFixed(2)}  |  自动调节：${getSettingsState().autoSensitivity === false ? "关" : "开"}`, W / 2, 170, 22, "rgba(255,255,255,0.62)");

    const centerX = W / 2;
    const sliderLeft = centerX - 180;
    const sliderRight = centerX + 180;
    const muteX = 110;
    const muteY = 320;
    const cameraX = W - 110;
    const cameraY = 320;
    const effectsX = centerX - 240;
    const effectsY = 520;
    const backX = centerX + 170;
    const backY = 520;

    settingsItems[0].x = muteX;
    settingsItems[0].y = muteY;
    settingsItems[1].x = cameraX;
    settingsItems[1].y = cameraY;
    settingsItems[2].x = centerX;
    settingsItems[2].y = 390;
    settingsItems[3].x = effectsX;
    settingsItems[3].y = effectsY;
    settingsItems[4].x = backX;
    settingsItems[4].y = backY;

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
            const settings = getSettingsState();
            const values = {
                sensitivity: settings.sensitivity || 1.0,
                music: settings.musicVolume || 0,
                sfx: settings.sfxVolume || 0,
            };

            settingsSliderRows.forEach((slider) => {
                const y = slider.y;
                const top = y - 28;
                const bottom = y + 28;
                const sliderHovered = input.x >= sliderLeft && input.x <= sliderRight && input.y >= top && input.y <= bottom;
                if (sliderHovered && input.hand) {
                    setSettingsSliderFromX(slider.target, input.x);
                }
                const rowHovered = sliderHovered || (settingsSliderDragging && settingsSliderDragTarget === slider.target);

                drawRoundedRect(sliderLeft - 10, y - 28, 380, 56, 18, rowHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", rowHovered ? item.color : "rgba(255,255,255,0.10)");
                drawText(slider.label, centerX, y - 10, 24, rowHovered ? item.color : "#ffffff");

                ctx.save();
                ctx.strokeStyle = "rgba(255,255,255,0.35)";
                ctx.lineWidth = 8;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(sliderLeft, y + 10);
                ctx.lineTo(sliderRight, y + 10);
                ctx.stroke();

                let handleX;
                if (slider.target === "sensitivity") {
                    const v = values.sensitivity;
                    handleX = sliderLeft + ((v - 0.6) / (1.6 - 0.6)) * (sliderRight - sliderLeft);
                } else {
                    const v = values[slider.target];
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

                const valueText = slider.target === "sensitivity" ? (values.sensitivity || 1.0).toFixed(2) : Math.round((values[slider.target] || 0) * 100) + "%";
                drawText(valueText, sliderRight + 52, y - 10, 18, item.color, "right");

                if (settingsSliderDragging && settingsSliderDragTarget === slider.target) {
                    const dragX = settingsSliderDragSource === "mouse" ? mouseX : input.x;
                    setSettingsSliderFromX(settingsSliderDragTarget, dragX);
                }
            });

            if (settingsSliderDragging) {
                trigger = null;
            }
        } else {
            // 对于静音、摄像头和特效强度，显示为小圆形控件
            if (item.action === "toggleMute" || item.action === "togglePreview" || item.action === "cycleEffects") {
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

                if (item.action === "cycleEffects") {
                    const level = getEffectConfig().label;
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2);
                    ctx.fill();
                    drawText(level, cx, cy + 1, 22, "#121826");
                } else {
                    const stateVal = item.action === "toggleMute" ? (getSettingsState().muted ? 1 : 0) : (getSettingsState().showCameraPreview === false ? 0 : 1);
                    // inner indicator
                    ctx.beginPath();
                    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = stateVal ? item.color : "rgba(255,255,255,0.12)";
                    ctx.fill();
                }
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
        resetSettingsHold();
    } else if (trigger === "togglePreview") {
        toggleSetting("showCameraPreview");
        settingsLatchedIndex = hoveredIndex;
        resetSettingsHold();
    } else if (trigger === "cycleEffects") {
        cycleEffectLevel();
        settingsLatchedIndex = hoveredIndex;
        resetSettingsHold();
    } else if (trigger === "back") {
        returnToMenu();
        gameState = GAME.MENU;
    }

    if (hoveredIndex === -1) {
        settingsLatchedIndex = -1;
        resetSettingsHold();
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

    consumeSnapTrigger(input);
    updateTimeStopTimers(delta);
    updateAdaptiveSession(delta, input);

    trail.push({ x: input.x, y: input.y });
    if (trail.length > 14) {
        trail.shift();
    }

    if (adaptiveSession.enabled && adaptiveSession.phase === "calibrating") {
        drawTrail();
        drawAdaptiveCalibrationOverlay(input);
        return;
    }

    const timeStopped = timeStopTimer > 0;
    const simulationDelta = timeStopped ? delta * TIME_STOP_SLOW_FACTOR : delta;
    const comboDelta = timeStopped ? delta * 0.12 : delta;

    updateComboTimers(comboDelta);

    if (!timeStopped && (chosenMode === MODES.zen || chosenMode === MODES.arcade)) {
        remainingTime -= delta / 1000;
        if (remainingTime <= 0) {
            getAdaptiveReport();
            gameState = GAME.GAMEOVER;
            if (window.playGameOver) window.playGameOver();
            return;
        }
    }

    if (!timeStopped) {
        spawnFruit(delta / 16.67);
    }

    fruits.forEach((fruit) => fruit.update(simulationDelta / 16.67));

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
                    recordAdaptiveFruitResult(fruit, "bomb");
                    resetCombo();
                    if (chosenMode === MODES.classic) {
                        getAdaptiveReport();
                        gameState = GAME.GAMEOVER;
                        if (window.playGameOver) window.playGameOver();
                    } else if (chosenMode === MODES.arcade) {
                        score = Math.max(0, score - 20);
                    }
                } else {
                    recordAdaptiveFruitResult(fruit, "hit");
                    score += registerComboHit(fruit.x, fruit.y);
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
            if (fruit.type !== "bomb") {
                recordAdaptiveFruitResult(fruit, "miss");
                resetCombo();
                if (chosenMode === MODES.classic) {
                    lives -= 1;
                    if (window.playMiss) window.playMiss();
                    if (lives <= 0) {
                        getAdaptiveReport();
                        gameState = GAME.GAMEOVER;
                        if (window.playGameOver) window.playGameOver();
                    }
                }
            }
        }
    });

    const clearButtonHovered = updateClearItemControl(delta, input);

    fruits = fruits.filter((fruit) => fruit.alive && fruit.y < H + 80);
    particles = particles.filter((particle) => particle.life > 0);
    slices = slices.filter((slice) => slice.life > 0);
    splats = splats.filter((splat) => splat.alpha > 0);

    particles.forEach((particle) => particle.update(simulationDelta / 16.67));
    slices.forEach((slice) => slice.update(simulationDelta / 16.67));
    splats.forEach((splat) => splat.update(simulationDelta / 16.67));

    drawTrail();
    fruits.forEach((fruit) => fruit.draw());
    slices.forEach((slice) => slice.draw());
    particles.forEach((particle) => particle.draw());
    splats.forEach((splat) => splat.draw());
    clearEffects.forEach((effect) => effect.draw());
    drawClearScreenEffect();
    drawTimeStopEffect();
    comboEffects.forEach((effect) => effect.draw());
    drawComboEdgeEffect();
    drawOpenHandClearIndicator(input);

    drawText(`Score: ${score}`, 80, 80, 30, "#ffffff", "left");
    drawText(`💰 金币: ${money}`, W / 2, 45, 24, "#ffd166", "center");
    drawCarriedItemHud(clearButtonHovered);
    drawComboHud();
    drawTimeStopHud();
    if (chosenMode === MODES.classic) {
        drawText(`Lives: ${"❤".repeat(Math.max(0, lives))}`, W - 120, 80, 30, lives === 1 ? "#ff6b6b" : "#7ef7c5", "right");
    } else {
        drawText(`Time: ${Math.max(0, Math.ceil(remainingTime))}s`, W - 120, 80, 30, chosenMode === MODES.zen ? "#6db8ff" : "#dba4ff", "right");
    }
}

function updateGameover(delta, input) {
    const bestMultiplier = getComboMultiplierForCount(bestCombo);
    const bestComboColor = getComboColor(bestCombo);
    const report = getAdaptiveReport();

    drawRoundedRect(54, 42, W - 108, H - 70, 28, "rgba(3, 8, 16, 0.62)", "rgba(255,255,255,0.12)");
    drawText(chosenMode === MODES.zen || chosenMode === MODES.arcade ? "TIME UP!" : "GAME OVER", W / 2, 84, 48, "#ff6b6b");
    drawText(`Final Score: ${score}`, W / 2 - 42, 136, 28, "#ffffff", "right");
    drawText(`Best Combo: ${bestCombo}   Best x${bestMultiplier}`, W / 2 + 30, 136, 24, bestComboColor, "left");
    drawAdaptiveReport(report);

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
    ctx.strokeStyle = input.openHand ? "#ffb84d" : input.fist ? "#ff6b6b" : "#7ef7c5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(input.x, input.y, input.openHand ? 16 : input.fist ? 14 : 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function loop(timestamp) {
    const delta = lastTimestamp ? Math.min(34, timestamp - lastTimestamp) : 16.67;
    lastTimestamp = timestamp;
    const input = getInputPosition();

    drawBackground();
    if (gameState !== GAME.PLAYING && window.snapTriggered) {
        window.snapTriggered = false;
    }

    if (gameState === GAME.MENU) {
        updateMenu(delta, input);
    } else if (gameState === GAME.SETTINGS) {
        updateSettings(delta, input);
    } else if (gameState === GAME.PLAYING) {
        updatePlaying(delta, input);
    } else if (gameState === GAME.GAMEOVER) {
        updateGameover(delta, input);
    } else if (gameState === GAME.DOJO) {
        updateDojo(delta, input);
    } else if (gameState === GAME.SHOP) {
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
        setSettingsSliderFromX(settingsSliderDragTarget, mouseX);
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
        const loadoutIndex = getLoadoutIndexAt(x, y);
        if (loadoutIndex !== -1) {
            setCarriedItem(loadoutOptions[loadoutIndex].item);
            return;
        }

        const idx = getMenuItemIndexAt(x, y);
        if (idx !== -1) {
            const selected = menuItems[idx];
            if (selected.mode === "settings") {
                gameState = GAME.SETTINGS;
                resetSettingsHold();
                settingsSliderDragging = false;
                settingsSliderDragSource = null;
                settingsLatchedIndex = -1;
            } else if (selected.mode === "dojo") {
                gameState = GAME.DOJO;
                resetDojoHold();
                syncBgmForScene();
            } else if (selected.mode === "dojo") {
                gameState = GAME.DOJO;
                resetDojoHold();
                syncBgmForScene();
            } 
            else if (selected.mode === "shop") { 
                enterShop();
            }else {
                resetGame(selected.mode);
            }
            return;
        }
    } else if (gameState === GAME.SETTINGS) {
        const sliderTarget = getSettingsSliderTargetAt(x, y);
        if (sliderTarget) {
            settingsSliderDragging = true;
            settingsSliderDragSource = "mouse";
            settingsSliderDragTarget = sliderTarget;
            setSettingsSliderFromX(sliderTarget, x);
            return;
        }

        const idx = getHoveredIndex(settingsItems, x, y, 130);
        if (idx !== -1) {
            const action = settingsItems[idx].action;
            if (action === "toggleMute") {
                toggleSetting("muted");
                syncBgmForScene();
            } else if (action === "togglePreview") {
                toggleSetting("showCameraPreview");
            } else if (action === "cycleEffects") {
                cycleEffectLevel();
            } else if (action === "sensitivitySlider") {
                return;
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
    const raw = readStoredValue("cohci_settings");
    let s = { muted: false, sensitivity: 1.0, autoSensitivity: true, showCameraPreview: true, musicVolume: 0.45, sfxVolume: 0.8, effectLevel: "medium" };
    try {
        if (raw) s = Object.assign(s, JSON.parse(raw));
    } catch (e) {}
    const sensitivityValue = Number(s.sensitivity);
    const musicVolumeValue = Number(s.musicVolume);
    const sfxVolumeValue = Number(s.sfxVolume);
    s.muted = !!s.muted;
    s.autoSensitivity = s.autoSensitivity !== false;
    s.showCameraPreview = s.showCameraPreview !== false;
    s.sensitivity = Number.isFinite(sensitivityValue) ? clamp(sensitivityValue, 0.6, 1.6) : 1.0;
    s.musicVolume = Number.isFinite(musicVolumeValue) ? clamp(musicVolumeValue, 0, 1) : 0.45;
    s.sfxVolume = Number.isFinite(sfxVolumeValue) ? clamp(sfxVolumeValue, 0, 1) : 0.8;
    if (!EFFECT_LEVELS[s.effectLevel]) {
        s.effectLevel = "medium";
    }
    window.settings = s;
    applySettingsState();
    loadDojoState();
    saveSettings();
}

window.addEventListener("DOMContentLoaded", () => {
    loadSettings();
});
