/**
 * game.js
 * 游戏逻辑：Canvas 2D渲染、拖拽交互、吸附检测
 */

// ============================================================
// 2D 渲染器
// ============================================================
export class Renderer2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.triangles = [];
        this.ghostOpacity = 0;
        this.particleBursts = [];  // 吸附时的粒子爆发
    }

    /** 设置三角形数据 */
    setTriangles(triangles) {
        this.triangles = triangles;
    }

    /** 添加吸附粒子特效 */
    addSnapParticles(cx, cy, hue) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            this.particleBursts.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.02 + Math.random() * 0.04,
                hue: hue,
                size: 1.5 + Math.random() * 2.5
            });
        }
    }

    /** 适配窗口 */
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.width = rect.width;
        this.height = rect.height;
    }

    /** 主渲染循环 */
    render(draggedTri = null) {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;
        ctx.clearRect(0, 0, W, H);

        // 绘制未吸附三角形的目标位置虚影
        for (const tri of this.triangles) {
            if (!tri.snapped && tri !== draggedTri) {
                this.drawGhostTriangle(tri);
            }
        }

        // 绘制已吸附三角形
        for (const tri of this.triangles) {
            if (tri.snapped) {
                this.drawTriangle(tri, false);
            }
        }

        // 绘制未吸附三角形（拖拽中的最后画，在最上层）
        for (const tri of this.triangles) {
            if (!tri.snapped && tri !== draggedTri) {
                this.drawTriangle(tri, false);
            }
        }

        // 绘制拖拽中的三角形（放大 + 发光）
        if (draggedTri) {
            this.drawTriangle(draggedTri, true);
        }

        // 绘制粒子
        this.renderParticles(ctx);

        // 底部提示文字
        if (this.triangles.some(t => !t.snapped)) {
            const remaining = this.triangles.filter(t => !t.snapped).length;
            if (remaining === this.triangles.length) {
                // 还没开始拼
                ctx.fillStyle = 'rgba(200, 160, 200, 0.35)';
                ctx.font = `${Math.max(13, W / 28)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('拖动三角形拼成爱心吧 💎', W / 2, H - Math.max(30, H * 0.06));
            }
        }
    }

    /** 绘制虚影三角形（目标位置提示） */
    drawGhostTriangle(tri) {
        const ctx = this.ctx;
        const [v0, v1, v2] = tri.targetVertices;
        ctx.beginPath();
        ctx.moveTo(v0[0], v0[1]);
        ctx.lineTo(v1[0], v1[1]);
        ctx.lineTo(v2[0], v2[1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 180, 200, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 180, 200, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /** 绘制三角形（带宝石渐变） */
    drawTriangle(tri, isDragging) {
        const ctx = this.ctx;
        const [v0, v1, v2] = tri.vertices;
        const { hue, saturation, lightness } = tri.color;

        ctx.beginPath();
        ctx.moveTo(v0[0], v0[1]);
        ctx.lineTo(v1[0], v1[1]);
        ctx.lineTo(v2[0], v2[1]);
        ctx.closePath();

        // 宝石切面渐变：从亮角到暗边
        const edgeMidX = (v1[0] + v2[0]) / 2;
        const edgeMidY = (v1[1] + v2[1]) / 2;

        const grad = ctx.createLinearGradient(v0[0], v0[1], edgeMidX, edgeMidY);
        const lightL = Math.min(85, lightness + 18);
        const darkL = Math.max(15, lightness - 14);
        grad.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightL}%)`);
        grad.addColorStop(0.5, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
        grad.addColorStop(1, `hsl(${hue}, ${Math.max(30, saturation - 10)}%, ${darkL}%)`);

        ctx.fillStyle = grad;
        ctx.fill();

        // 三角形边框：宝石棱线
        ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${Math.min(90, lightness + 20)}%, 0.5)`;
        ctx.lineWidth = isDragging ? 2 : 0.8;
        ctx.stroke();

        // 拖拽时发光
        if (isDragging) {
            ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness + 20}%, 0.6)`;
            ctx.shadowBlur = 18;
            ctx.strokeStyle = `hsla(${hue}, 100%, 80%, 0.7)`;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    /** 渲染粒子 */
    renderParticles(ctx) {
        for (let i = this.particleBursts.length - 1; i >= 0; i--) {
            const p = this.particleBursts[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particleBursts.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.life * 0.7})`;
            ctx.fill();
        }
    }
}

// ============================================================
// 游戏逻辑
// ============================================================
export class Game {
    constructor(triangles, snapThreshold) {
        this.triangles = triangles;
        this.snapThreshold = snapThreshold;
        this.draggedTriangle = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.snappedCount = triangles.filter(t => t.snapped).length;
        this.totalCount = triangles.length;

        // 回调
        this.onSnap = null;       // (triangle) => void
        this.onComplete = null;   // () => void
        this.onProgress = null;   // (snapped, total) => void
    }

    /** 重心坐标法判断点是否在三角形内 */
    pointInTriangle(px, py, vertices) {
        const [v0, v1, v2] = vertices;
        const d1 = this._sign(px, py, v0[0], v0[1], v1[0], v1[1]);
        const d2 = this._sign(px, py, v1[0], v1[1], v2[0], v2[1]);
        const d3 = this._sign(px, py, v2[0], v2[1], v0[0], v0[1]);
        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        return !(hasNeg && hasPos);
    }

    _sign(x1, y1, x2, y2, x3, y3) {
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    }

    /** 命中检测：找到点所在的未吸附三角形 */
    hitTest(px, py) {
        // 从上到下检查（数组后面的三角形更晚绘制，视觉上在上层）
        for (let i = this.triangles.length - 1; i >= 0; i--) {
            const tri = this.triangles[i];
            if (tri.snapped) continue;
            if (this.pointInTriangle(px, py, tri.vertices)) {
                return tri;
            }
        }
        return null;
    }

    /** 开始拖拽 */
    startDrag(triangle, px, py) {
        this.draggedTriangle = triangle;
        this.dragStartX = px;
        this.dragStartY = py;
    }

    /** 拖拽移动 */
    moveDrag(px, py) {
        const tri = this.draggedTriangle;
        if (!tri) return;

        const dx = px - this.dragStartX;
        const dy = py - this.dragStartY;

        for (const v of tri.vertices) {
            v[0] += dx;
            v[1] += dy;
        }
        tri.centroid[0] += dx;
        tri.centroid[1] += dy;

        this.dragStartX = px;
        this.dragStartY = py;
    }

    /** 结束拖拽 → 检测吸附 */
    endDrag() {
        const tri = this.draggedTriangle;
        if (!tri) return false;

        const dist = Math.hypot(
            tri.centroid[0] - tri.targetCentroid[0],
            tri.centroid[1] - tri.targetCentroid[1]
        );

        if (dist < this.snapThreshold) {
            this.snapTriangle(tri);
            this.draggedTriangle = null;
            return true;
        }

        this.draggedTriangle = null;
        return false;
    }

    /** 吸附三角形到目标位置 */
    snapTriangle(tri) {
        // 平滑动画到目标位置（瞬时吸附，保留粒子提示）
        for (let i = 0; i < 3; i++) {
            tri.vertices[i] = [...tri.targetVertices[i]];
        }
        tri.centroid = [...tri.targetCentroid];
        tri.snapped = true;
        this.snappedCount++;

        if (this.onSnap) this.onSnap(tri);
        if (this.onProgress) this.onProgress(this.snappedCount, this.totalCount);

        if (this.isComplete() && this.onComplete) {
            this.onComplete();
        }
    }

    /** 是否全部拼完 */
    isComplete() {
        return this.snappedCount >= this.totalCount;
    }

    /** 获取进度 */
    getProgress() {
        return { snapped: this.snappedCount, total: this.totalCount };
    }

    /** 获取正在拖拽的三角形 */
    getDragged() {
        return this.draggedTriangle;
    }
}
