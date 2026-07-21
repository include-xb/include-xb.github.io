/**
 * stats.js — 统计概览页面
 * 总览卡片 + 省份排行 + 大学排行，支持排序切换，点击查看名单
 */
const StatsPage = (() => {
  let sortDesc = true;
  let provinceStats = [];
  let uniStats = [];

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

  function renderAll() {
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
    applyTheme(saved ? saved === 'dark' : prefersDark);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      applyTheme(current !== 'dark');
    });

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
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
