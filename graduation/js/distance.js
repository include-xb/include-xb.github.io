/**
 * distance.js — 距昆山距离页面
 * 独立页面的横向柱状图，支持排序切换，点击姓名查看详情
 */
const DistancePage = (() => {
  const KUNSHAN = [121.01, 31.386]; // 昆山震川高级中学 [lng, lat]

  let sortDesc = true;
  let studentsWithDist = [];

  /* ---------- Haversine 距离 (km) ---------- */

  function haversine(lng1, lat1, lng2, lat2) {
    const R = 6371;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLng = (lng2 - lng1) * toRad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ---------- 构建城市坐标映射 ---------- */

  async function buildCityCoordMap(students) {
    const provinces = [...new Set(students.map((s) => s.province))];
    const coordMap = {};

    await Promise.allSettled(
      provinces.map(async (prov) => {
        try {
          const cities = await MapModule.getCities(prov);
          cities.forEach((c) => {
            if (c.center && c.center.length >= 2) {
              coordMap[prov + ':' + c.name] = c.center;
            }
          });
        } catch (e) {
          console.warn('Distance: 加载 ' + prov + ' 城市列表失败，回退省份中心', e);
          const info = MapModule._getProvinceInfo
            ? MapModule._getProvinceInfo(prov)
            : null;
          if (info && info.center) {
            const provCities = [
              ...new Set(students.filter((s) => s.province === prov).map((s) => s.city)),
            ];
            provCities.forEach((city) => {
              coordMap[prov + ':' + city] = info.center;
            });
          }
        }
      })
    );

    return coordMap;
  }

  /* ---------- 计算距离 ---------- */

  function computeDistances(students, cityCoordMap) {
    return students.map((s) => {
      const key = s.province + ':' + s.city;
      const coord = cityCoordMap[key];
      let dist = 0;
      if (coord && coord.length >= 2) {
        dist = haversine(KUNSHAN[0], KUNSHAN[1], coord[0], coord[1]);
      }
      return { student: s, distanceKm: dist };
    });
  }

  /* ---------- 渲染 ---------- */

  function render() {
    const listEl = document.getElementById('chartList');
    const emptyEl = document.getElementById('emptyEl');

    const sorted = [...studentsWithDist].sort((a, b) =>
      sortDesc ? b.distanceKm - a.distanceKm : a.distanceKm - b.distanceKm
    );

    if (sorted.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    const maxDist = Math.max(...sorted.map((d) => d.distanceKm), 1);

    listEl.innerHTML = sorted
      .map(({ student, distanceKm }, i) => {
        const pct = ((distanceKm / maxDist) * 100).toFixed(1);
        return (
          '<li class="distance-row" data-sid="' +
          student.id +
          '" title="' +
          esc(student.name) +
          ' · ' +
          esc(student.university) +
          ' · ' +
          esc(student.province) +
          esc(student.city) +
          '">' +
          '<span class="distance-rank">' +
          (i + 1) +
          '</span>' +
          '<span class="distance-name">' +
          esc(student.name) +
          '</span>' +
          '<span class="distance-uni">' +
          esc(student.university) +
          '</span>' +
          '<span class="distance-city">' +
          esc(student.province) +
          esc(student.city) +
          '</span>' +
          '<span class="distance-bar-wrap">' +
          '<span class="distance-bar-fill" style="width:' +
          pct +
          '%"></span>' +
          '</span>' +
          '<span class="distance-km">' +
          distanceKm.toFixed(0) +
          ' km</span>' +
          '</li>'
        );
      })
      .join('');

    document.getElementById('sortIcon').textContent = sortDesc ? '↓' : '↑';
    document.getElementById('totalCount').textContent =
      '共 ' + sorted.length + ' 位同学';
  }

  /* ---------- 同学详情弹窗 ---------- */

  function showDetail(student) {
    document.getElementById('dName').textContent = student.name || '—';
    document.getElementById('dUniversity').textContent = student.university || '—';
    document.getElementById('dMajor').textContent = student.major || '—';
    document.getElementById('dRegion').textContent =
      (student.province || '') + ' ' + (student.city || '').trim() || '—';
    document.getElementById('dWechat').textContent = student.wechat || '—';
    document.getElementById('dQq').textContent = student.qq || '—';
    document.getElementById('dPhone').textContent = student.phone || '—';
    document.getElementById('detailModal').classList.remove('hidden');
  }

  /* ---------- 主题 ---------- */

  function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved ? saved === 'dark' : prefersDark);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      applyTheme(current !== 'dark');
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) applyTheme(e.matches);
    });
  }

  function applyTheme(isDark) {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('themeToggle').textContent = isDark ? '☀️ 浅色' : '🌙 深色';
  }

  /* ---------- 工具 ---------- */

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /* ---------- 入口 ---------- */

  async function init() {
    initTheme();

    // 弹窗事件
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () =>
        document.getElementById(btn.dataset.close).classList.add('hidden')
      );
    });
    document.querySelectorAll('.modal-mask').forEach((mask) => {
      mask.addEventListener('click', (e) => {
        if (e.target === mask) mask.classList.add('hidden');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-mask').forEach((m) => m.classList.add('hidden'));
      }
    });

    // 排序按钮
    document.getElementById('sortBtn').addEventListener('click', () => {
      sortDesc = !sortDesc;
      render();
    });

    // 点击行 → 详情
    document.getElementById('chartList').addEventListener('click', (e) => {
      const row = e.target.closest('.distance-row');
      if (!row) return;
      const student = DataStore.findById(row.dataset.sid);
      if (student) showDetail(student);
    });

    // 加载数据
    await DataStore.load();
    // 加载省份索引（distance 页不渲染地图，需手动初始化省份→adcode 映射）
    await MapModule.ensureProvinceIndex();

    const students = DataStore.getAll();
    if (students.length === 0) {
      document.getElementById('loadingEl').classList.add('hidden');
      document.getElementById('emptyEl').classList.remove('hidden');
      return;
    }

    document.getElementById('loadingEl').classList.remove('hidden');
    const cityCoordMap = await buildCityCoordMap(students);
    studentsWithDist = computeDistances(students, cityCoordMap);
    document.getElementById('loadingEl').classList.add('hidden');
    render();
  }

  return { init };
})();

// 自启动
DistancePage.init();
