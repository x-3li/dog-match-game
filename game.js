const ICONS = ["🍎", "🍊", "🍒", "🍓", "🥝", "🍉", "🍇", "🥥"];
const BASE_TYPES = ICONS.length;
const BASE_EACH_COUNT = 6;
const HARD_EACH_COUNT = 10;
const STACKS_COUNT_NORMAL = 24;
const STACKS_COUNT_HARD = 32;
const MAX_SLOT_SIZE = 7;

// Game state
let currentScreen = "start";
let currentLevel = 1;
let stacks = [];
let slot = [];
let gameOver = false;
let gameWin = false;
let historyStack = null;
let props = { moveOut: 0, undo: 0, shuffle: 0 };

let showPropDialog = false;
let pendingProp = null;
let showReviveDialog = false;
let rewardedVideoAd = null;

let dogImage = null;
let dogImageLoaded = false;
let dogAnim = { angle: 0, dir: 1, bounce: 0, runX: 0 };

let particles = [];
let clouds = [];
let grassDecor = [];

let canvas, ctx;
let screenWidth, screenHeight;

let stackRects = [];
let btnRects = {};
let gridCols, gridRows;
let stackW, stackH, gap = 8;
let stacksStartY, slotAreaY;

// Utils
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function generateCardsForLevel(level) {
    let eachCount = (level === 1) ? BASE_EACH_COUNT : HARD_EACH_COUNT;
    let pool = [];
    for (let i = 0; i < BASE_TYPES; i++) {
        for (let j = 0; j < eachCount; j++) pool.push(ICONS[i]);
    }
    shuffleArray(pool);
    return pool;
}

function resetGame() {
    let stacksCount = (currentLevel === 1) ? STACKS_COUNT_NORMAL : STACKS_COUNT_HARD;
    let pool = generateCardsForLevel(currentLevel);
    stacks = [];
    for (let i = 0; i < stacksCount; i++) stacks.push([]);
    for (let i = 0; i < pool.length; i++) stacks[i % stacksCount].push(pool[i]);
    slot = [];
    gameOver = false;
    gameWin = false;
    historyStack = null;
    calcLayout();
}

function startGame() {
    currentScreen = "game";
    currentLevel = 1;
    props = { moveOut: 0, undo: 0, shuffle: 0 };
    resetGame();
}

function goToNextLevel() {
    if (currentLevel === 1) {
        currentLevel = 2;
        resetGame();
        props = { moveOut: 0, undo: 0, shuffle: 0 };
    } else {
        gameWin = true;
        gameOver = true;
    }
}

function winGame() {
    gameWin = true;
    gameOver = true;
    setTimeout(() => { if (currentLevel === 1) goToNextLevel(); }, 500);
}

function loseGame() {
    gameOver = true;
    gameWin = false;
}

function executeMoveOut() {
    if (gameOver) return false;
    const freq = {};
    for (let c of slot) freq[c] = (freq[c] || 0) + 1;
    let target = null;
    for (let c in freq) if (freq[c] >= 3) { target = c; break; }
    if (!target) return false;
    let removed = 0;
    const newSlot = [];
    for (let c of slot) {
        if (c === target && removed < 3) { removed++; continue; }
        newSlot.push(c);
    }
    slot = newSlot;
    return true;
}

function executeUndo() {
    if (gameOver || !historyStack) return false;
    stacks = JSON.parse(JSON.stringify(historyStack.stacks));
    slot = [...historyStack.slot];
    historyStack = null;
    return true;
}

function executeShuffle() {
    if (gameOver) return false;
    let all = [];
    for (let s of stacks) all.push(...s);
    if (all.length === 0) return false;
    shuffleArray(all);
    for (let i = 0; i < stacks.length; i++) stacks[i] = [];
    for (let i = 0; i < all.length; i++) stacks[i % stacks.length].push(all[i]);
    return true;
}

function useProp(propType) {
    if (gameOver) return;
    if (props[propType] > 0) {
        props[propType]--;
        if (propType === 'moveOut') executeMoveOut();
        else if (propType === 'undo') executeUndo();
        else if (propType === 'shuffle') executeShuffle();
    } else {
        pendingProp = propType;
        showPropDialog = true;
    }
}

function grantProp(propType) {
    props[propType]++;
    pendingProp = null;
    showPropDialog = false;
}

function reviveByAd() {
    if (!gameOver || gameWin) return;
    showReviveDialog = true;
}

function executeRevive() {
    let savedLevel = currentLevel;
    let savedProps = JSON.parse(JSON.stringify(props));
    currentLevel = savedLevel;
    resetGame();
    props = savedProps;
    gameOver = false;
    gameWin = false;
    showReviveDialog = false;
}

function saveToHistory() {
    historyStack = { stacks: JSON.parse(JSON.stringify(stacks)), slot: [...slot] };
}

function autoEliminate() {
    let changed = true;
    while (changed) {
        changed = false;
        const freq = {};
        for (let c of slot) freq[c] = (freq[c] || 0) + 1;
        let target = null;
        for (let c in freq) if (freq[c] >= 3) { target = c; break; }
        if (target) {
            let removed = 0;
            const newSlot = [];
            for (let c of slot) {
                if (c === target && removed < 3) { removed++; continue; }
                newSlot.push(c);
            }
            slot = newSlot;
            changed = true;
        }
    }
    if (slot.length > MAX_SLOT_SIZE) loseGame();
}

function onCardClick(idx) {
    if (gameOver) return;
    const stack = stacks[idx];
    if (stack.length === 0) return;
    saveToHistory();
    const card = stack.pop();
    slot.push(card);
    autoEliminate();
    let allEmpty = true;
    for (let s of stacks) if (s.length > 0) { allEmpty = false; break; }
    if (allEmpty && slot.length === 0 && !gameOver) winGame();
    else if (slot.length > MAX_SLOT_SIZE) loseGame();
}

function calcLayout() {
    let cnt = stacks.length;
    if (cnt <= 24) { gridCols = 6; gridRows = 4; }
    else { gridCols = 8; gridRows = 4; }
    gap = 8;
    stackW = (screenWidth - 24 - gap * (gridCols - 1)) / gridCols;
    stackH = stackW * 1.2;
    stacksStartY = 100;
    slotAreaY = stacksStartY + gridRows * (stackH + gap) + 20;
}

function loadDogImage() {
    dogImage = tt.createImage();
    dogImage.src = 'assets/images/dog.png';
    dogImage.onload = () => { dogImageLoaded = true; };
    dogImage.onerror = () => { dogImageLoaded = false; };
}

// 跑动的小狗
function drawRunningDog(x, y, size) {
    // 跑动动画
    dogAnim.runX += 1.2;
    if (dogAnim.runX > screenWidth + 100) {
        dogAnim.runX = -100;
    }
    const posX = dogAnim.runX;
    const bounce = Math.sin(Date.now() / 120) * 6;

    // 身体
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(posX, y + bounce, size / 2, size / 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.fillStyle = "#FFB347";
    ctx.beginPath();
    ctx.ellipse(posX - size / 3, y + bounce - size / 4, size / 6, size / 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(posX + size / 3, y + bounce - size / 4, size / 6, size / 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(posX - size / 5, y + bounce, size / 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(posX + size / 5, y + bounce, size / 10, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(posX - size / 8, y + bounce + size / 8);
    ctx.lineTo(posX, y + bounce + size / 6);
    ctx.lineTo(posX + size / 8, y + bounce + size / 8);
    ctx.stroke();
}

function drawDog(x, y, size) {
    if (dogImageLoaded && dogImage) {
        ctx.save();
        ctx.translate(x, y);
        ctx.drawImage(dogImage, -size / 2, -size / 2, size, size);
        ctx.restore();
    } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFB347";
        ctx.beginPath();
        ctx.arc(x - size / 3, y - size / 4, size / 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + size / 3, y - size / 4, size / 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(x - size / 5, y, size / 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + size / 5, y, size / 10, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < 25; i++) {
        particles.push({
            x: Math.random() * screenWidth,
            y: Math.random() * screenHeight,
            size: 2 + Math.random() * 5,
            speedY: 0.4 + Math.random() * 1.5,
            alpha: 0.2 + Math.random() * 0.4
        });
    }
}

function updateParticles() {
    for (let p of particles) {
        p.y += p.speedY;
        if (p.y > screenHeight) p.y = -10;
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.fillStyle = `rgba(255, 245, 200, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initClouds() {
    clouds = [];
    for (let i = 0; i < 5; i++) {
        clouds.push({
            x: Math.random() * screenWidth,
            y: 20 + Math.random() * 60,
            size: 40 + Math.random() * 30,
            speed: 0.2 + Math.random() * 0.3
        });
    }
}

function updateClouds() {
    for (let c of clouds) {
        c.x += c.speed;
        if (c.x > screenWidth + 100) c.x = -100;
    }
}

function drawClouds() {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let c of clouds) {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.size, c.size * 0.6, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x - c.size * 0.6, c.y, c.size * 0.7, c.size * 0.5, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + c.size * 0.6, c.y, c.size * 0.7, c.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initGrass() {
    grassDecor = [];
    for (let i = 0; i < 16; i++) {
        grassDecor.push({
            x: Math.random() * screenWidth,
            y: screenHeight - 10 - Math.random() * 40,
            height: 12 + Math.random() * 10
        });
    }
}

function drawGrass() {
    ctx.fillStyle = "#2d6a21";
    for (let g of grassDecor) {
        ctx.beginPath();
        ctx.moveTo(g.x, screenHeight);
        ctx.lineTo(g.x - 8, g.y);
        ctx.lineTo(g.x + 8, g.y);
        ctx.fill();
    }
}

function initRewardedVideo() {
    if (tt.createRewardedVideoAd) {
        rewardedVideoAd = tt.createRewardedVideoAd({ adUnitId: 'your-ad-unit-id' });
        rewardedVideoAd.onLoad(() => console.log('Ad loaded'));
        rewardedVideoAd.onError((err) => console.error('Ad error', err));
        rewardedVideoAd.onClose((res) => {
            if (res && res.isEnded) {
                if (pendingProp) grantProp(pendingProp);
                else if (showReviveDialog) executeRevive();
            } else {
                pendingProp = null;
                showReviveDialog = false;
            }
        });
    }
}

function showRewardedVideo() {
    if (rewardedVideoAd) {
        rewardedVideoAd.show().catch(() => {
            rewardedVideoAd.load().then(() => rewardedVideoAd.show());
        });
    } else {
        if (pendingProp) grantProp(pendingProp);
        else if (showReviveDialog) executeRevive();
    }
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ================== 全新简洁主页：小狗跑动 + 英文开始游戏 ==================
function drawStartScreen() {
    // 渐变背景
    const grad = ctx.createLinearGradient(0, 0, 0, screenHeight);
    grad.addColorStop(0, "#87CEEB");
    grad.addColorStop(0.5, "#90EE90");
    grad.addColorStop(1, "#90EE90");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    drawClouds();
    updateClouds();
    drawGrass();

    // 标题
    ctx.textAlign = "center";
    ctx.fillStyle = "#222";
    ctx.font = "bold 42px Arial";
    ctx.fillText("DOGGY RUN", screenWidth / 2, screenHeight * 0.25);

    // 跑动的小狗
    drawRunningDog(0, screenHeight * 0.5, 100);

    // 开始按钮
    const btnW = 260;
    const btnH = 70;
    const btnX = (screenWidth - btnW) / 2;
    const btnY = screenHeight * 0.7;

    ctx.fillStyle = "#FF8A65";
    roundRect(btnX, btnY, btnW, btnH, 35);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px Arial";
    ctx.fillText("START GAME", screenWidth / 2, btnY + 45);
    btnRects.start = { x: btnX, y: btnY, w: btnW, h: btnH };

    drawParticles();
    updateParticles();
    ctx.textAlign = "left";
}

function drawPropDialogUI() {
    if (!showPropDialog) return;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, screenWidth, screenHeight);
    const popW = 300, popH = 210;
    const popX = (screenWidth - popW) / 2, popY = (screenHeight - popH) / 2;
    ctx.fillStyle = "#fff2df";
    roundRect(popX, popY, popW, popH, 20);
    ctx.fill();
    ctx.fillStyle = "#8b4513";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("Get Prop", popX + 105, popY + 45);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#5a3a1a";
    ctx.fillText("Watch ad to get this prop", popX + 55, popY + 90);

    const getBtn = { x: popX + 40, y: popY + 155, w: 90, h: 36 };
    ctx.fillStyle = "#ffaa66";
    roundRect(getBtn.x, getBtn.y, getBtn.w, getBtn.h, 18);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Get", getBtn.x + 32, getBtn.y + 25);

    const cancelBtn = { x: popX + 170, y: popY + 155, w: 90, h: 36 };
    ctx.fillStyle = "#b8da8c";
    roundRect(cancelBtn.x, cancelBtn.y, cancelBtn.w, cancelBtn.h, 18);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("Close", cancelBtn.x + 28, cancelBtn.y + 25);

    btnRects.propGet = getBtn;
    btnRects.propCancel = cancelBtn;
}

function drawReviveDialogUI() {
    if (!showReviveDialog) return;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, screenWidth, screenHeight);
    const popW = 300, popH = 180;
    const popX = (screenWidth - popW) / 2, popY = (screenHeight - popH) / 2;
    ctx.fillStyle = "#fff2df";
    roundRect(popX, popY, popW, popH, 20);
    ctx.fill();
    ctx.fillStyle = "#8b4513";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Game Over", popX + 90, popY + 50);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#5a3a1a";
    ctx.fillText("Watch ad to revive", popX + 75, popY + 100);

    const reviveBtn = { x: popX + 50, y: popY + 130, w: 80, h: 36 };
    ctx.fillStyle = "#ffaa66";
    roundRect(reviveBtn.x, reviveBtn.y, reviveBtn.w, reviveBtn.h, 18);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Revive", reviveBtn.x + 18, reviveBtn.y + 25);

    const cancelBtn = { x: popX + 170, y: popY + 130, w: 80, h: 36 };
    ctx.fillStyle = "#b8da8c";
    roundRect(cancelBtn.x, cancelBtn.y, cancelBtn.w, cancelBtn.h, 18);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("Give Up", cancelBtn.x + 18, cancelBtn.y + 25);

    btnRects.reviveYes = reviveBtn;
    btnRects.reviveNo = cancelBtn;
}

// ================== 游戏界面：卡槽严格7个位置 ==================
function renderGame() {
    ctx.fillStyle = "#90EE90";
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    drawClouds();
    updateClouds();
    drawGrass();

    // 顶部栏
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    roundRect(10, 10, screenWidth - 20, 80, 40);
    ctx.fill();
    ctx.fillStyle = "#3a7d44";
    ctx.font = "bold 28px 'Arial'";
    ctx.fillText("DOGGY RUN", 30, 55);
    ctx.fillStyle = "#333";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(`Level ${currentLevel}`, screenWidth / 2 - 35, 55);
    let remain = 0;
    for (let s of stacks) remain += s.length;
    remain += slot.length;
    ctx.fillStyle = "#d32f2f";
    ctx.fillText(`Left: ${remain}`, screenWidth - 130, 55);
    drawDog(screenWidth - 50, 45, 48);

    // 牌堆
    stackRects = [];
    const startX = (screenWidth - (gridCols * stackW + (gridCols - 1) * gap)) / 2;
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            const idx = row * gridCols + col;
            if (idx >= stacks.length) break;
            const x = startX + col * (stackW + gap);
            const y = stacksStartY + row * (stackH + gap);
            const stack = stacks[idx];
            const empty = stack.length === 0;

            ctx.shadowBlur = 4;
            ctx.shadowColor = "rgba(0,0,0,0.15)";
            ctx.fillStyle = empty ? "#c4a484" : "#fff9e6";
            roundRect(x, y, stackW, stackH, 10);
            ctx.fill();
            ctx.strokeStyle = "#c79a6e";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (!empty) {
                const top = stack[stack.length - 1];
                ctx.font = `${Math.min(40, stackW * 0.6)}px sans-serif`;
                ctx.fillStyle = "#222";
                ctx.fillText(top, x + stackW / 2 - 15, y + stackH / 2 + 12);
            }
            stackRects.push({ x, y, w: stackW, h: stackH, idx });
        }
    }

    // ========== 卡槽严格只显示 7 个位置 ==========
    ctx.fillStyle = "#5d4037";
    roundRect(20, slotAreaY, screenWidth - 40, 100, 22);
    ctx.fill();

    const slotCardW = Math.min(65, (screenWidth - 60) / 7 - 6);
    const slotCardH = slotCardW * 1.05;
    const slotStartX = (screenWidth - (slotCardW * 7 + 6 * 6)) / 2;

    // 7个背景槽
    for (let i = 0; i < 7; i++) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        roundRect(slotStartX + i * (slotCardW + 6), slotAreaY + 12, slotCardW, slotCardH, 10);
        ctx.fill();
    }

    // 绘制卡牌
    for (let i = 0; i < slot.length; i++) {
        if (i >= 7) break;
        const x = slotStartX + i * (slotCardW + 6);
        ctx.fillStyle = "#fff1db";
        roundRect(x, slotAreaY + 12, slotCardW, slotCardH, 10);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = `${Math.min(36, slotCardW * 0.7)}px sans-serif`;
        ctx.fillText(slot[i], x + slotCardW / 2 - 12, slotAreaY + 12 + slotCardH / 2 + 8);
    }

    // Game Over
    if (gameOver && !gameWin) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        roundRect(40, screenHeight - 220, screenWidth - 80, 50, 25);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("GAME OVER", screenWidth / 2 - ctx.measureText("GAME OVER").width / 2, screenHeight - 188);
    }

    // 道具按钮
    const btnW = 100;
    const btnH = 60;
    const gapBtn = 15;
    const total = btnW * 3 + gapBtn * 2;
    const btnX = (screenWidth - total) / 2;
    const btnY = slotAreaY + 130;

    ctx.fillStyle = "#42a5f5";
    roundRect(btnX, btnY, btnW, btnH, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("Remove", btnX + 15, btnY + 38);
    btnRects.moveOut = { x: btnX, y: btnY, w: btnW, h: btnH };

    const x2 = btnX + btnW + gapBtn;
    ctx.fillStyle = "#42a5f5";
    roundRect(x2, btnY, btnW, btnH, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("Undo", x2 + 28, btnY + 38);
    btnRects.undo = { x: x2, y: btnY, w: btnW, h: btnH };

    const x3 = btnX + btnW * 2 + gapBtn * 2;
    ctx.fillStyle = "#42a5f5";
    roundRect(x3, btnY, btnW, btnH, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("Shuffle", x3 + 18, btnY + 38);
    btnRects.shuffle = { x: x3, y: btnY, w: btnW, h: btnH };

    drawParticles();
    updateParticles();
    drawPropDialogUI();
    drawReviveDialogUI();
}

function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, screenWidth, screenHeight);
    if (currentScreen === "start") drawStartScreen();
    else renderGame();
}

function handleTap(x, y) {
    if (currentScreen === "start") {
        if (btnRects.start && isPointInRect(x, y, btnRects.start)) startGame();
        return;
    }
    if (showPropDialog) {
        if (btnRects.propGet && isPointInRect(x, y, btnRects.propGet)) showRewardedVideo();
        else if (btnRects.propCancel && isPointInRect(x, y, btnRects.propCancel)) {
            showPropDialog = false;
            pendingProp = null;
        }
        return;
    }
    if (showReviveDialog) {
        if (btnRects.reviveYes && isPointInRect(x, y, btnRects.reviveYes)) showRewardedVideo();
        else if (btnRects.reviveNo && isPointInRect(x, y, btnRects.reviveNo)) showReviveDialog = false;
        return;
    }
    if (gameOver && !gameWin) {
        reviveByAd();
        return;
    }
    if (gameOver) return;

    if (btnRects.moveOut && isPointInRect(x, y, btnRects.moveOut)) useProp('moveOut');
    else if (btnRects.undo && isPointInRect(x, y, btnRects.undo)) useProp('undo');
    else if (btnRects.shuffle && isPointInRect(x, y, btnRects.shuffle)) useProp('shuffle');
    else {
        for (let rect of stackRects) {
            if (isPointInRect(x, y, rect)) { onCardClick(rect.idx); break; }
        }
    }
}

function isPointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

function init() {
    const sys = tt.getSystemInfoSync();
    screenWidth = sys.windowWidth;
    screenHeight = sys.windowHeight;
    canvas = tt.createCanvas();
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    ctx = canvas.getContext('2d');
    loadDogImage();
    initRewardedVideo();
    initParticles();
    initClouds();
    initGrass();

    tt.onTouchStart((e) => {
        if (!e.touches.length) return;
        const t = e.touches[0];
        handleTap(t.clientX, t.clientY);
    });

    function loop() {
        render();
        requestAnimationFrame(loop);
    }
    loop();
}

init();