/**
 * data.js — 数据存取模块
 * 主要从本地 data.json 加载（快），保存时尝试 Vercel API，失败则触发浏览器下载
 */
const DataStore = (() => {
  // Vercel API（保存时尝试使用，网络不通则降级为下载）
  const API_BASE = 'https://vercel-api-gamma-ruby.vercel.app';

  let students = [];

  /** 加载数据：优先本地 data.json（速度快），失败则尝试 Vercel API */
  async function load() {
    // 先从本地 data.json 加载（秒开）
    try {
      const resp = await fetch('data.json?t=' + Date.now());
      if (resp.ok) {
        const data = await resp.json();
        students = Array.isArray(data.students) ? data.students : [];
        console.log('从本地 data.json 加载 ' + students.length + ' 位同学');
        return students;
      }
    } catch (e) {
      console.warn('本地 data.json 加载失败:', e.message);
    }

    // 本地失败则尝试 Vercel API
    try {
      const resp = await fetch(API_BASE + '/api/data');
      if (resp.ok) {
        const data = await resp.json();
        students = Array.isArray(data.students) ? data.students : [];
        console.log('从 Vercel API 加载 ' + students.length + ' 位同学');
        return students;
      }
    } catch (e) {
      console.warn('Vercel API 不可用:', e.message);
    }

    students = [];
    return students;
  }

  function getAll() {
    return students;
  }

  function findById(id) {
    return students.find((s) => String(s.id) === String(id));
  }

  /**
   * 新增或更新同学（按姓名查重）
   * @returns {{ student: object, isUpdate: boolean }}
   */
  function add(student) {
    const idx = students.findIndex((s) => s.name === student.name);
    if (idx !== -1) {
      student.id = students[idx].id;
      students[idx] = student;
      return { student, isUpdate: true };
    }
    student.id = Date.now();
    students.push(student);
    return { student, isUpdate: false };
  }

  /**
   * 保存数据：优先通过 Vercel API 写，失败则触发浏览器下载 data.json
   * @returns {Promise<'server'|'download'|'failed'>}
   */
  async function save() {
    const payload = JSON.stringify({ students }, null, 2);

    // 尝试 Vercel API
    try {
      const resp = await fetch(API_BASE + '/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (resp.ok) return 'server';
    } catch (e) {
      console.warn('Vercel API 保存失败,降级为下载:', e.message);
    }

    // 降级：触发浏览器下载 data.json
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
      return 'download';
    } catch (e2) {
      return 'failed';
    }
  }

  return { load, getAll, findById, add, save };
})();
