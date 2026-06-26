/**
 * heart-geometry.js
 * 爱心几何生成器：参数方程 → 自适应扇状三角剖分 → 宝石颜色
 *
 * 核心思路：
 * 1. 爱心边界均匀采样 M 个基点（M ≥12 保证轮廓平滑）
 * 2. 计算每个扇片在中心点的张开角度
 * 3. 按角度比例分配三角形预算：宽扇多切、窄扇少切
 * 4. 保证所有三角形面积趋近均匀，消除极细三角形
 */

// ============================================================
// 爱心参数方程
// x = 16 * sin³(t)
// y = -(13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t))
// ============================================================

/** 生成爱心边界点（沿参数曲线等距采样） */
export function generateHeartBoundary(n) {
    const points = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const sinT = Math.sin(t);
        const x = 16 * sinT * sinT * sinT;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t)
                  - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        points.push([x, y]);
    }
    return points;
}

// ============================================================
// 基础几何工具
// ============================================================

/** 三角形面积 */
function triangleArea(v0, v1, v2) {
    const cross = (v1[0] - v0[0]) * (v2[1] - v0[1]) - (v1[1] - v0[1]) * (v2[0] - v0[0]);
    return Math.abs(cross) / 2;
}

// ============================================================
// 自适应扇状三角剖分
// ============================================================

/** 计算爱心边界质心 */
function computeHeartCenter() {
    const dense = generateHeartBoundary(200);
    let cx = 0, cy = 0;
    for (const [x, y] of dense) { cx += x; cy += y; }
    return [cx / dense.length, cy / dense.length];
}

let _heartCenter = null;
function getHeartCenter() {
    if (!_heartCenter) _heartCenter = computeHeartCenter();
    return _heartCenter;
}

/** 在给定缩放比例下生成爱心环上的 N 个等距采样点 */
function sampleHeartRing(scale, n) {
    const center = getHeartCenter();
    const raw = generateHeartBoundary(n);
    return raw.map(([x, y]) => [
        center[0] + (x - center[0]) * scale,
        center[1] + (y - center[1]) * scale
    ]);
}

/** 计算扇片在中心点的张开角度 */
function fanAngle(center, a, b) {
    const v1 = [a[0] - center[0], a[1] - center[1]];
    const v2 = [b[0] - center[0], b[1] - center[1]];
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const cross = v1[0] * v2[1] - v1[1] * v2[0];
    return Math.abs(Math.atan2(cross, dot));
}

/**
 * 将一个扇片沿外缘等分为 n 份
 * @returns {Array<[[number,number],[number,number],[number,number]]>}
 */
function subdivideFan(center, a, b, n) {
    if (n <= 1) return [[
        [center[0], center[1]],
        [a[0], a[1]],
        [b[0], b[1]]
    ]];
    const tris = [];
    for (let k = 0; k < n; k++) {
        const t1 = k / n;
        const t2 = (k + 1) / n;
        tris.push([
            [center[0], center[1]],
            [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1],
            [a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2]
        ]);
    }
    return tris;
}

// ============================================================
// 宝石颜色生成
// ============================================================

export function generateGemColor() {
    const ranges = [
        [340, 360], [342, 358], [348, 360],
        [280, 315], [322, 345], [330, 350],
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    let hue = range[0] + Math.random() * (range[1] - range[0]);
    if (hue < 0) hue += 360;
    if (hue > 360) hue -= 360;
    const saturation = 55 + Math.random() * 35;
    const lightness = 36 + Math.random() * 30;
    return { hue, saturation, lightness };
}

// ============================================================
// 主函数：生成爱心三角剖分
// ============================================================

/**
 * @param {object} config - { triangleCount }
 * @returns {Array} 三角形数组
 */
export function createTriangulatedHeart(config) {
    const T = config.triangleCount;

    // 基扇数量：
    // T≤10 时直接用 T 个边界点（每个扇1块，无需再切）
    // T>10 时 M = max(10, ceil(T*0.7))，保证爱心轮廓至少10边形
    const M = T <= 10 ? T : Math.max(10, Math.ceil(T * 0.7));
    const ring = sampleHeartRing(1.0, M);
    const center = getHeartCenter();

    // 1. 计算每个扇片的中心角度
    const angles = [];
    for (let i = 0; i < M; i++) {
        const j = (i + 1) % M;
        angles.push(fanAngle(center, ring[i], ring[j]));
    }

    // 2. 按角度比例分配三角形预算（贪心算法）
    const subCounts = new Array(M).fill(1);
    let remaining = T - M;

    while (remaining > 0) {
        let best = 0;
        let bestRatio = 0;
        for (let i = 0; i < M; i++) {
            const ratio = angles[i] / subCounts[i];
            if (ratio > bestRatio) { bestRatio = ratio; best = i; }
        }
        subCounts[best]++;
        remaining--;
    }

    // 3. 按配额切分每个扇片
    const rawTriangles = [];
    for (let i = 0; i < M; i++) {
        const j = (i + 1) % M;
        const pieces = subdivideFan(center, ring[i], ring[j], subCounts[i]);
        rawTriangles.push(...pieces);
    }

    // 4. 转换为游戏三角形格式
    const triangles = [];
    for (const [v0, v1, v2] of rawTriangles) {
        const cx = (v0[0] + v1[0] + v2[0]) / 3;
        const cy = (v0[1] + v1[1] + v2[1]) / 3;

        triangles.push({
            vertices: [[v0[0], v0[1]], [v1[0], v1[1]], [v2[0], v2[1]]],
            targetVertices: [[v0[0], v0[1]], [v1[0], v1[1]], [v2[0], v2[1]]],
            centroid: [cx, cy],
            targetCentroid: [cx, cy],
            color: generateGemColor(),
            snapped: false
        });
    }

    // 微调颜色增加色差
    for (const t of triangles) {
        t.color.hue += (Math.random() - 0.5) * 10;
        t.color.saturation += (Math.random() - 0.5) * 6;
        t.color.lightness += (Math.random() - 0.5) * 5;
        t.color.hue = ((t.color.hue % 360) + 360) % 360;
        t.color.saturation = Math.max(45, Math.min(95, t.color.saturation));
        t.color.lightness = Math.max(28, Math.min(72, t.color.lightness));
    }

    return triangles;
}

// ============================================================
// 缩放和散落
// ============================================================

/**
 * 缩放并居中三角形到画布坐标
 */
export function scaleAndCenterTriangles(triangles, canvasWidth, canvasHeight, padding = 50) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const tri of triangles) {
        for (const v of tri.targetVertices) {
            minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
            minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
        }
    }

    const heartW = maxX - minX;
    const heartH = maxY - minY;
    const heartCX = (minX + maxX) / 2;
    const heartCY = (minY + maxY) / 2;

    const availableW = canvasWidth - padding * 2;
    const availableH = canvasHeight - padding * 2;
    const scale = Math.min(availableW / heartW, availableH / heartH);
    const targetCX = canvasWidth / 2;
    const targetCY = canvasHeight * 0.48;

    const transform = (x, y) => [
        (x - heartCX) * scale + targetCX,
        (y - heartCY) * scale + targetCY
    ];

    for (const tri of triangles) {
        for (let i = 0; i < 3; i++) {
            const [nx, ny] = transform(tri.targetVertices[i][0], tri.targetVertices[i][1]);
            tri.targetVertices[i] = [nx, ny];
            tri.vertices[i] = [nx, ny];
        }
        tri.targetCentroid = [
            (tri.targetVertices[0][0] + tri.targetVertices[1][0] + tri.targetVertices[2][0]) / 3,
            (tri.targetVertices[0][1] + tri.targetVertices[1][1] + tri.targetVertices[2][1]) / 3
        ];
        tri.centroid = [...tri.targetCentroid];
    }
}

/**
 * 将三角形随机散落到画布各处
 */
export function scatterTriangles(triangles, canvasWidth, canvasHeight, scatterRadius) {
    if (!scatterRadius) scatterRadius = Math.min(canvasWidth, canvasHeight) * 0.35;

    let hcx = 0, hcy = 0;
    for (const tri of triangles) {
        hcx += tri.targetCentroid[0];
        hcy += tri.targetCentroid[1];
    }
    hcx /= triangles.length;
    hcy /= triangles.length;

    const placed = [];
    const margin = 35;

    for (const tri of triangles) {
        let ok = false;
        let attempts = 0;

        while (!ok && attempts < 120) {
            const angle = Math.random() * Math.PI * 2;
            const dist = scatterRadius * (0.35 + Math.random() * 0.65);
            const newCX = hcx + Math.cos(angle) * dist;
            const newCY = hcy + Math.sin(angle) * dist;

            if (newCX < margin || newCX > canvasWidth - margin ||
                newCY < margin || newCY > canvasHeight - margin) {
                attempts++;
                continue;
            }

            let overlaps = false;
            if (attempts < 90) {
                for (const p of placed) {
                    if (Math.hypot(newCX - p[0], newCY - p[1]) < 38) {
                        overlaps = true;
                        break;
                    }
                }
            }

            if (!overlaps || attempts > 100) {
                const dx = newCX - tri.centroid[0];
                const dy = newCY - tri.centroid[1];
                for (const v of tri.vertices) {
                    v[0] += dx;
                    v[1] += dy;
                }
                tri.centroid[0] = newCX;
                tri.centroid[1] = newCY;
                placed.push([newCX, newCY]);
                ok = true;
            }
            attempts++;
        }
    }
}

/**
 * 计算三角形面积（外部接口）
 */
export function getTriangleArea(tri) {
    return triangleArea(tri.targetVertices[0], tri.targetVertices[1], tri.targetVertices[2]);
}
