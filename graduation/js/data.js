/**
 * data.js — 数据存取模块
 * 生产环境通过 Vercel API 读写,本地开发可选择 data.json 或 server.js
 */
const DataStore = (() => {
  // 改为 true 可切回本地 server.js + data.json 模式
  const LOCAL_MODE = false;

  const API_BASE = LOCAL_MODE
    ? ''                         // 本地模式: 使用 server.js 的 /api/data 和 data.json
    : 'https://vercel-api-gamma-ruby.vercel.app';

  let students = [];

  /** 加载数据 */
  async function load() {
    const url = LOCAL_MODE
      ? 'data.json?t=' + Date.now()
      : API_BASE + '/api/data';
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      students = Array.isArray(data.students) ? data.students : [];
    } catch (e) {
      console.warn('加载数据失败,使用空数据:', e);
      students = [];
    }
    return students;
  }

  function getAll() {
    return students;
  }

  function findById(id) {
    return students.find((s) => String(s.id) === String(id));
  }

  /**
   * 新增或更新同学(按姓名查重)
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
   * 保存到服务器
   * @returns {Promise<'server'|'failed'>}
   */
  async function save() {
    const payload = JSON.stringify({ students }, null, 2);
    const url = LOCAL_MODE ? '/api/data' : API_BASE + '/api/data';
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return 'server';
    } catch (e) {
      console.error('保存失败:', e);
      return 'failed';
    }
  }

  return { load, getAll, findById, add, save };
})();
