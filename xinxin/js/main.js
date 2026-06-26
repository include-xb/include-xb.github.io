/**
 * main.js
 * 主入口：关卡管理、事件绑定、完成动画
 */
import { createTriangulatedHeart, scaleAndCenterTriangles, scatterTriangles } from './heart-geometry.js';
import { Renderer2D, Game } from './game.js';

// ============================================================
// DOM 引用
// ============================================================
const canvas2d = document.getElementById('canvas-2d');
const levelIndicator = document.getElementById('level-indicator');
const progressEl = document.getElementById('progress');
const resetBtn = document.getElementById('reset-btn');
const completionOverlay = document.getElementById('completion-overlay');
const completionTitle = document.getElementById('completion-title');
const completionText = document.getElementById('completion-text');
const nextLevelBtn = document.getElementById('next-level-btn');
const finalOverlay = document.getElementById('final-overlay');
const finalText = document.getElementById('final-text');
const restartBtn = document.getElementById('restart-btn');
const flashOverlay = document.getElementById('flash-overlay');

// ============================================================
// 全局状态
// ============================================================
let config = null;
let messages = null;
let currentLevel = 1;
let renderer2d = null;
let game = null;
let triangles = null;
let animFrameId = null;
let isComplete = false;

// ============================================================
// 初始化
// ============================================================
async function init() {
    try {
        const [levelsRes, messagesRes] = await Promise.all([
            fetch('config/levels.json'),
            fetch('config/messages.json')
        ]);
        config = await levelsRes.json();
        messages = await messagesRes.json();
    } catch (err) {
        console.error('加载配置文件失败:', err);
        alert('加载配置失败，请检查网络连接后刷新页面。');
        return;
    }

    renderer2d = new Renderer2D(canvas2d);
    bindEvents();
    loadLevel(1);
}

// ============================================================
// 关卡加载
// ============================================================
function loadLevel(levelNum) {
    // 清理旧状态
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }

    currentLevel = levelNum;
    isComplete = false;

    // 隐藏覆盖层
    completionOverlay.classList.add('hidden');
    finalOverlay.classList.add('hidden');
    nextLevelBtn.classList.add('hidden');
    flashOverlay.classList.add('hidden');
    canvas2d.style.display = 'block';

    // 获取关卡配置
    const levelConfig = config.levels[levelNum - 1];
    if (!levelConfig) return;

    // 生成爱心三角剖分（耳切法，精确爱心形状）
    triangles = createTriangulatedHeart({
        triangleCount: levelConfig.triangleCount
    });

    // 适配画布并缩放居中
    renderer2d.resize();
    scaleAndCenterTriangles(triangles, renderer2d.width, renderer2d.height);
    scatterTriangles(triangles, renderer2d.width, renderer2d.height, levelConfig.scatterRadius);
    renderer2d.setTriangles(triangles);

    // 创建游戏逻辑
    game = new Game(triangles, levelConfig.snapThreshold);
    game.onSnap = (tri) => {
        renderer2d.addSnapParticles(tri.centroid[0], tri.centroid[1], tri.color.hue);
        playSnapSound();
    };
    game.onProgress = (snapped, total) => updateProgress(snapped, total);
    game.onComplete = () => {
        isComplete = true;
        setTimeout(() => showCompletion(), 700);
    };

    // 更新 UI
    levelIndicator.textContent = levelConfig.name;
    updateProgress(0, levelConfig.triangleCount);

    // 启动渲染循环
    startRenderLoop();
}

// ============================================================
// 渲染循环
// ============================================================
function startRenderLoop() {
    if (animFrameId) cancelAnimationFrame(animFrameId);

    function loop() {
        renderer2d.render(game ? game.getDragged() : null);
        animFrameId = requestAnimationFrame(loop);
    }
    loop();
}

// ============================================================
// 完成流程（纯2D，无3D）
// ============================================================
async function showCompletion() {
    // 1. 闪烁效果
    await flashEffect();

    // 2. 淡入完成覆盖层
    completionOverlay.classList.remove('hidden');

    // 3. 显示文字
    const levelKey = String(currentLevel);
    const msg = messages.levels[levelKey];
    if (msg) {
        completionTitle.textContent = msg.title;
        completionText.textContent = msg.complete;
    }

    // 4. 显示下一关按钮或最终文字
    if (currentLevel < 5) {
        setTimeout(() => {
            nextLevelBtn.classList.remove('hidden');
            nextLevelBtn.textContent = currentLevel === 4 ? '最后一关 →' : '下一关 →';
        }, 1000);
    } else {
        setTimeout(() => showFinalMessage(), 2000);
    }
}

function flashEffect() {
    return new Promise((resolve) => {
        flashOverlay.classList.remove('hidden');
        flashOverlay.style.opacity = '1';

        let count = 0;
        const totalSteps = 6; // 3 flashes × 2 steps each

        function step(on) {
            flashOverlay.style.opacity = on ? '0.7' : '0';
            flashOverlay.style.transition = 'opacity 0.25s ease-out';
            count++;
            if (count < totalSteps) {
                setTimeout(() => step(!on), 250);
            } else {
                flashOverlay.style.opacity = '0';
                setTimeout(() => {
                    flashOverlay.classList.add('hidden');
                    resolve();
                }, 300);
            }
        }
        step(true);
    });
}

function showFinalMessage() {
    completionOverlay.classList.add('hidden');
    finalText.textContent = messages.final;
    finalOverlay.classList.remove('hidden');
}

// ============================================================
// 事件处理
// ============================================================
function bindEvents() {
    // 拖拽事件
    canvas2d.addEventListener('pointerdown', onPointerDown);
    canvas2d.addEventListener('pointermove', onPointerMove);
    canvas2d.addEventListener('pointerup', onPointerUp);
    canvas2d.addEventListener('pointercancel', onPointerUp);

    // 阻止移动端默认滚动
    canvas2d.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas2d.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // 窗口大小变化
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 300));

    // 按钮
    resetBtn.addEventListener('click', onReset);
    resetBtn.addEventListener('touchend', (e) => { e.preventDefault(); onReset(); });
    nextLevelBtn.addEventListener('click', onNextLevel);
    nextLevelBtn.addEventListener('touchend', (e) => { e.preventDefault(); onNextLevel(); });
    restartBtn.addEventListener('click', onRestart);
    restartBtn.addEventListener('touchend', (e) => { e.preventDefault(); onRestart(); });

    // 键盘
    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') onReset();
    });
}

function getEventPos(e) {
    const rect = canvas2d.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function onPointerDown(e) {
    if (isComplete || !game) return;
    const pos = getEventPos(e);
    const tri = game.hitTest(pos.x, pos.y);
    if (tri) {
        game.startDrag(tri, pos.x, pos.y);
        canvas2d.setPointerCapture(e.pointerId);
    }
}

function onPointerMove(e) {
    if (isComplete || !game || !game.getDragged()) return;
    const pos = getEventPos(e);
    game.moveDrag(pos.x, pos.y);
}

function onPointerUp(e) {
    if (isComplete || !game || !game.getDragged()) return;
    game.endDrag();
    try { canvas2d.releasePointerCapture(e.pointerId); } catch (_) {}
}

function onResize() {
    if (isComplete) return;
    // 重新加载当前关卡（最简单可靠的方案）
    loadLevel(currentLevel);
}

function onReset() {
    if (!game) return;
    loadLevel(currentLevel);
}

function onNextLevel() {
    if (currentLevel < 5) {
        loadLevel(currentLevel + 1);
    }
}

function onRestart() {
    loadLevel(1);
}

// ============================================================
// 音效
// ============================================================
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playSnapSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    } catch (_) {}
}

// ============================================================
// UI 更新
// ============================================================
function updateProgress(snapped, total) {
    progressEl.textContent = `${snapped} / ${total}`;
    if (snapped === total && total > 0) {
        progressEl.textContent = '✨ 完成！';
        progressEl.style.color = '#ffd700';
        progressEl.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.6)';
    } else {
        progressEl.style.color = '';
        progressEl.style.textShadow = '';
    }
}

// ============================================================
// 启动
// ============================================================
document.addEventListener('DOMContentLoaded', init);
