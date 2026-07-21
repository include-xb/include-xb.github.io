/**
 * stats.js — 统计概览页面
 * 总览卡片 + 省份排行 + 大学排行，支持排序切换，点击查看名单
 */
const StatsPage = (() => {
  let sortDesc = true;
  let provinceStats = [];
  let uniStats = [];
  let majorStats = [];

  /* ---------- 词云颜色 ---------- */

  function cloudColors() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return dark
      ? ['#63b3ed', '#fc8181', '#68d391', '#f6e05e', '#b794f4', '#4fd1c5', '#f687b3', '#90cdf4', '#fbb6ce', '#9ae6b4']
      : ['#2b6cb0', '#c53030', '#276749', '#b7791f', '#6b46c1', '#2c7a7b', '#b83280', '#2a69ac', '#9b2c2c', '#22543d'];
  }

  /* ---------- 数据聚合 ---------- */

  function aggregate() {
    const students = DataStore.getAll();

    // 省份聚合
    const provMap = {};
    students.forEach((s) => {
      if (!provMap[s.province]) provMap[s.province] = [];
      provMap[s.province].push(s);
    });
    provinceStats = Object.entries(provMap)
      .map(([name, list]) => ({ name, count: list.length, students: list }))
      .sort((a, b) => b.count - a.count);

    // 大学聚合
    const uniMap = {};
    students.forEach((s) => {
      const key = s.university || '(未知)';
      if (!uniMap[key]) uniMap[key] = [];
      uniMap[key].push(s);
    });
    uniStats = Object.entries(uniMap)
      .map(([name, list]) => ({ name, count: list.length, students: list }))
      .sort((a, b) => b.count - a.count);

    // 专业聚合
    const majorMap = {};
    students.forEach((s) => {
      const key = s.major || '(未知)';
      if (!majorMap[key]) majorMap[key] = [];
      majorMap[key].push(s);
    });
    majorStats = Object.entries(majorMap)
      .map(([name, list]) => ({ name, count: list.length, students: list }))
      .sort((a, b) => b.count - a.count);
  }

  /* ---------- 总览卡片 ---------- */

  function renderSummary() {
    const students = DataStore.getAll();
    const provinces = new Set(students.map((s) => s.province));
    const cities = new Set(students.map((s) => s.province + s.city));
    const unis = new Set(students.map((s) => s.university));

    document.getElementById('scTotal').textContent = students.length;
    document.getElementById('scProvinces').textContent = provinces.size;
    document.getElementById('scCities').textContent = cities.size;
    document.getElementById('scUnis').textContent = unis.size;

    document.getElementById('totalCount').textContent =
      '共 ' + students.length + ' 位同学';
  }

  /* ---------- 排行柱状图 ---------- */

  function renderChart(listElId, stats) {
    const listEl = document.getElementById(listElId);
    if (stats.length === 0) {
      listEl.innerHTML =
        '<li style="padding:12px;color:var(--text-light);font-size:13px">暂无数据</li>';
      return;
    }

    const sorted = sortDesc
      ? [...stats]
      : [...stats].reverse();

    const maxCount = Math.max(...stats.map((s) => s.count), 1);

    listEl.innerHTML = sorted
      .map(({ name, count, students }, i) => {
        const pct = ((count / maxCount) * 100).toFixed(1);
        const displayRank = sortDesc ? i + 1 : stats.length - i;
        return (
          '<li class="stats-row" data-name="' +
          esc(name) +
          '" data-students="' +
          esc(JSON.stringify(students.map((s) => ({ id: s.id, name: s.name, university: s.university, major: s.major })))) +
          '" title="' +
          esc(name) +
          ' · ' +
          count +
          ' 人">' +
          '<span class="stats-rank">' +
          displayRank +
          '</span>' +
          '<span class="stats-name" title="' +
          esc(name) +
          '">' +
          esc(name) +
          '</span>' +
          '<span class="stats-bar-wrap">' +
          '<span class="stats-bar-fill" style="width:' +
          pct +
          '%"></span>' +
          '</span>' +
          '<span class="stats-count">' +
          count +
          ' 人</span>' +
          '</li>'
        );
      })
      .join('');
  }

  /* ---------- 专业词云 ---------- */

  function renderWordCloud() {
    const el = document.getElementById('wordCloud');
    if (majorStats.length === 0) {
      el.innerHTML =
        '<span style="color:var(--text-light);font-size:13px">暂无数据</span>';
      return;
    }

    const colors = cloudColors();
    const maxCount = Math.max(...majorStats.map((s) => s.count), 1);
    const minCount = Math.min(...majorStats.map((s) => s.count), maxCount);
    const range = maxCount - minCount || 1;
    const MIN_FONT = 13;
    const MAX_FONT = 38;

    // 从中心向外排列：大词居中，小词靠边
    const sorted = [...majorStats].sort((a, b) => b.count - a.count);
    const n = sorted.length;
    const arranged = new Array(n);
    let center = Math.floor(n / 2);
    arranged[center] = sorted[0];
    let step = 1;
    for (let i = 1; i < n; i++) {
      if (i % 2 === 1) {
        // 放左侧
        const idx = center - step;
        if (idx >= 0) {
          arranged[idx] = sorted[i];
        } else {
          // 左侧已满，追加到右侧
          arranged[center + step] = sorted[i];
          step++;
        }
      } else {
        // 放右侧
        const idx = center + step;
        if (idx < n) {
          arranged[idx] = sorted[i];
        } else {
          // 右侧已满，追加到左侧
          arranged[center - step] = sorted[i];
        }
        step++;
      }
    }

    el.innerHTML = arranged
      .map(({ name, count, students }, i) => {
        const t = (count - minCount) / range; // 0..1
        const fontSize = (MIN_FONT + t * (MAX_FONT - MIN_FONT)).toFixed(0);
        const color = colors[i % colors.length];
        return (
          '<span class="word-cloud-tag" ' +
          'style="font-size:' + fontSize + 'px;color:' + color + '" ' +
          'data-name="' + esc(name) + '" ' +
          'data-students="' +
          esc(JSON.stringify(students.map((s) => ({ id: s.id, name: s.name, university: s.university, major: s.major })))) +
          '" ' +
          'title="' + esc(name) + ' · ' + count + ' 人">' +
          esc(name) +
          '</span>'
        );
      })
      .join('');
  }

  function renderAll() {
    renderWordCloud();
    renderChart('provinceChart', provinceStats);
    renderChart('uniChart', uniStats);
    document.getElementById('sortIcon').textContent = sortDesc ? '↓' : '↑';
  }

  /* ---------- 名单弹窗 ---------- */

  let currentGroupStudents = [];

  function showGroupList(name, students) {
    currentGroupStudents = students;
    document.getElementById('groupTitle').textContent = name + ' · ' + students.length + ' 人';

    const listEl = document.getElementById('groupStudentList');
    listEl.innerHTML = students
      .map(
        (s) =>
          '<div class="group-student" data-sid="' +
          s.id +
          '">' +
          '<span class="group-student-name">' +
          esc(s.name) +
          '</span>' +
          '<span class="group-student-sub">' +
          esc(s.university || '') +
          (s.major ? ' · ' + esc(s.major) : '') +
          '</span>' +
          '</div>'
      )
      .join('');

    document.getElementById('groupModal').classList.remove('hidden');
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
    applyTheme(saved ? saved === 'dark' : true);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      applyTheme(current !== 'dark');
    });

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) applyTheme(true);
      });
  }

  function applyTheme(isDark) {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('themeToggle').textContent = isDark ? '☀️ 浅色' : '🌙 深色';
    // 词云使用 inline 颜色，需重新渲染
    if (majorStats.length > 0) renderWordCloud();
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

    // 弹窗关闭
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
        document
          .querySelectorAll('.modal-mask')
          .forEach((m) => m.classList.add('hidden'));
      }
    });

    // 排序按钮
    document.getElementById('sortBtn').addEventListener('click', () => {
      sortDesc = !sortDesc;
      renderAll();
    });

    // 点击词云标签 → 名单弹窗
    document.getElementById('wordCloud').addEventListener('click', (e) => {
      const tag = e.target.closest('.word-cloud-tag');
      if (!tag) return;
      const name = tag.dataset.name;
      const students = JSON.parse(tag.dataset.students);
      showGroupList(name, students);
    });

    // 点击排行行 → 名单弹窗
    document.getElementById('provinceChart').addEventListener('click', (e) => {
      const row = e.target.closest('.stats-row');
      if (!row) return;
      const name = row.dataset.name;
      const students = JSON.parse(row.dataset.students);
      showGroupList(name, students);
    });

    document.getElementById('uniChart').addEventListener('click', (e) => {
      const row = e.target.closest('.stats-row');
      if (!row) return;
      const name = row.dataset.name;
      const students = JSON.parse(row.dataset.students);
      showGroupList(name, students);
    });

    // 名单弹窗内点击 → 详情
    document.getElementById('groupStudentList').addEventListener('click', (e) => {
      const item = e.target.closest('.group-student');
      if (!item) return;
      const student = DataStore.findById(item.dataset.sid);
      if (student) {
        document.getElementById('groupModal').classList.add('hidden');
        showDetail(student);
      }
    });

    // 加载
    await DataStore.load();
    aggregate();
    renderSummary();
    renderAll();
  }

  return { init };
})();

StatsPage.init();
