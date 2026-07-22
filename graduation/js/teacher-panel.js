/**
 * teacher-panel.js — 教师信息面板模块
 * 在页面右下角展示教师列表，点击弹出 QQ/电话联系方式
 */
const TeacherPanel = (() => {
  let panelEl = null;
  let popupEl = null;
  let popupVisible = false;

  /* ---------- DOM 创建 ---------- */
  function createDOM() {
    // 面板
    panelEl = document.createElement('div');
    panelEl.id = 'teacherPanel';
    panelEl.className = 'teacher-panel';
    panelEl.innerHTML =
      '<div class="teacher-panel-header">' +
      '<span>👨‍🏫 教师信息</span>' +
      '<span class="teacher-panel-arrow">▼</span>' +
      '</div>' +
      '<div class="teacher-panel-body"></div>';
    document.body.appendChild(panelEl);

    // 弹窗
    popupEl = document.createElement('div');
    popupEl.id = 'teacherPopup';
    popupEl.className = 'teacher-popup hidden';
    document.body.appendChild(popupEl);
  }

  /* ---------- XSS 防护 ---------- */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ---------- 渲染教师列表 ---------- */
  function render() {
    var teachers = DataStore.getTeachers();
    var body = panelEl.querySelector('.teacher-panel-body');

    if (!teachers || teachers.length === 0) {
      body.innerHTML = '<div class="teacher-empty">暂无教师信息</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < teachers.length; i++) {
      var t = teachers[i];
      var isHead = t.role === '班主任';
      html +=
        '<div class="teacher-item" data-role="' + escapeHtml(t.role) + '"' +
        ' data-name="' + escapeHtml(t.name || '') + '"' +
        ' data-qq="' + escapeHtml(t.qq || '') + '"' +
        ' data-phone="' + escapeHtml(t.phone || '') + '">' +
        '<span class="teacher-role-badge' + (isHead ? ' head-teacher' : '') + '">' +
        escapeHtml(t.role) +
        '</span>' +
        '<span class="teacher-name">' + escapeHtml(t.name || '未填写') + '</span>' +
        '</div>';
    }
    body.innerHTML = html;
  }

  /* ---------- 折叠/展开 ---------- */
  function toggle() {
    panelEl.classList.toggle('teacher-panel-collapsed');
  }

  /* ---------- 弹窗 ---------- */
  function showPopup(teacher, anchorEl) {
    var name = teacher.name || '未填写';
    var role = teacher.role;
    var qq = teacher.qq || '';
    var phone = teacher.phone || '';

    var html =
      '<div class="teacher-popup-name">' + escapeHtml(name) + '</div>' +
      '<div class="teacher-popup-role">' + escapeHtml(role) + '</div>' +
      '<div class="teacher-popup-contact">' +
      '<span class="teacher-popup-contact-label">QQ</span>' +
      (qq ? '<span>' + escapeHtml(qq) + '</span>' : '<span class="teacher-contact-empty">未填写</span>') +
      '</div>' +
      '<div class="teacher-popup-contact">' +
      '<span class="teacher-popup-contact-label">电话</span>' +
      (phone ? '<span>' + escapeHtml(phone) + '</span>' : '<span class="teacher-contact-empty">未填写</span>') +
      '</div>';

    popupEl.innerHTML = html;
    popupEl.classList.remove('hidden');
    popupVisible = true;

    // 计算位置：优先显示在面板左侧
    var anchorRect = anchorEl.getBoundingClientRect();
    var popupW = popupEl.offsetWidth || 200;
    var popupH = popupEl.offsetHeight || 120;

    var left = anchorRect.left - popupW - 8;
    var top = anchorRect.top;

    // 左侧空间不足则翻转到右侧
    if (left < 8) {
      left = anchorRect.right + 8;
    }

    // 垂直方向保持在视口内
    if (top + popupH > window.innerHeight - 8) {
      top = window.innerHeight - popupH - 8;
    }
    if (top < 8) top = 8;

    // 水平方向保持在视口内
    if (left + popupW > window.innerWidth - 8) {
      left = window.innerWidth - popupW - 8;
    }

    popupEl.style.left = left + 'px';
    popupEl.style.top = top + 'px';
  }

  function hidePopup() {
    if (!popupVisible) return;
    popupEl.classList.add('hidden');
    popupVisible = false;
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    // 面板标题：折叠/展开
    panelEl.querySelector('.teacher-panel-header').addEventListener('click', toggle);

    // 教师条目：弹出联系方式
    panelEl.querySelector('.teacher-panel-body').addEventListener('click', function (e) {
      var item = e.target.closest('.teacher-item');
      if (!item) return;

      var teacher = {
        role: item.getAttribute('data-role'),
        name: item.getAttribute('data-name'),
        qq: item.getAttribute('data-qq'),
        phone: item.getAttribute('data-phone'),
      };
      showPopup(teacher, item);
    });

    // 点击外部关闭弹窗
    document.addEventListener('click', function (e) {
      if (!popupVisible) return;
      if (!panelEl.contains(e.target) && !popupEl.contains(e.target)) {
        hidePopup();
      }
    });

    // Escape 关闭弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popupVisible) {
        hidePopup();
      }
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    if (panelEl) return; // 防止重复初始化
    createDOM();
    bindEvents();
    render();
  }

  return { init };
})();
