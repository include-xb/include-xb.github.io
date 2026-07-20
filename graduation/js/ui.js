/**
 * ui.js — 界面交互模块
 * 搜索、同学详情弹窗、添加同学表单、Toast 提示、视图工具栏
 */
const UI = (() => {
  const $ = (sel) => document.querySelector(sel);

  let toastTimer = null;

  /* ---------- 初始化 ---------- */

  function init() {
    bindModals();
    bindSearch();
    bindAddForm();
    $('#backBtn').addEventListener('click', () => MapModule.backToChina());
  }

  /* ---------- Toast ---------- */

  function toast(msg, isError = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', isError);
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  /* ---------- 弹窗通用 ---------- */

  function bindModals() {
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => $('#' + btn.dataset.close).classList.add('hidden'));
    });
    document.querySelectorAll('.modal-mask').forEach((mask) => {
      mask.addEventListener('click', (e) => {
        if (e.target === mask) mask.classList.add('hidden');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-mask').forEach((m) => m.classList.add('hidden'));
        hideSearchResults();
      }
    });
  }

  /* ---------- 视图切换(全国 <-> 省) ---------- */

  function onViewChange(provinceName) {
    $('#mapToolbar').classList.toggle('hidden', !provinceName);
    $('#provinceTitle').textContent = provinceName
      ? `${provinceName}(${DataStore.getAll().filter((s) => s.province === provinceName).length} 人)`
      : '';
    $('#mapHint').textContent = provinceName
      ? '悬停大头针查看同市同学 · 点击姓名查看资料'
      : '点击省份查看详情 · 滚轮缩放 · 拖拽平移';
  }

  function updateTotalCount() {
    $('#totalCount').textContent = `共 ${DataStore.getAll().length} 位同学`;
  }

  /* ---------- 同学详情 ---------- */

  function showDetail(student) {
    $('#dName').textContent = student.name || '—';
    $('#dUniversity').textContent = student.university || '—';
    $('#dMajor').textContent = student.major || '—';
    $('#dRegion').textContent = `${student.province || ''} ${student.city || ''}`.trim() || '—';
    $('#dWechat').textContent = student.wechat || '—';
    $('#dQq').textContent = student.qq || '—';
    $('#dPhone').textContent = student.phone || '—';
    $('#detailModal').classList.remove('hidden');
  }

  /* ---------- 搜索 ---------- */

  function bindSearch() {
    const input = $('#searchInput');
    input.addEventListener('input', () => renderSearchResults(input.value.trim()));
    input.addEventListener('focus', () => renderSearchResults(input.value.trim()));
    // 点击搜索框以外的地方收起结果
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) hideSearchResults();
    });
  }

  function renderSearchResults(keyword) {
    const box = $('#searchResults');
    if (!keyword) {
      hideSearchResults();
      return;
    }
    const kw = keyword.toLowerCase();
    const matched = DataStore.getAll().filter(
      (s) =>
        (s.name || '').toLowerCase().includes(kw) ||
        (s.university || '').toLowerCase().includes(kw) ||
        (s.major || '').toLowerCase().includes(kw)
    );

    if (matched.length === 0) {
      box.innerHTML = '<div class="search-empty">未找到匹配的同学</div>';
    } else {
      box.innerHTML = matched
        .slice(0, 30)
        .map(
          (s) =>
            `<div class="search-result-item" data-sid="${s.id}">` +
            `<div class="sri-name">${escapeHtml(s.name)}</div>` +
            `<div class="sri-info">${escapeHtml(s.university)} · ${escapeHtml(s.major)} · ${escapeHtml(s.province)}${escapeHtml(s.city)}</div>` +
            `</div>`
        )
        .join('');
    }
    box.classList.remove('hidden');
  }

  function hideSearchResults() {
    $('#searchResults').classList.add('hidden');
  }

  function bindSearchResultClick() {
    // 结果项是动态生成的,用事件委托
    $('#searchResults').addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (!item) return;
      const student = DataStore.findById(item.dataset.sid);
      if (student) {
        showDetail(student);
        hideSearchResults();
        $('#searchInput').blur();
      }
    });
  }

  /* ---------- 添加同学 ---------- */

  function bindAddForm() {
    bindSearchResultClick();

    const form = $('#addForm');
    const provinceSel = form.elements.province;
    const citySel = form.elements.city;

    $('#addBtn').addEventListener('click', () => {
      form.reset();
      citySel.innerHTML = '<option value="">请先选择省份</option>';
      citySel.disabled = true;
      // 填充省份下拉框(与地图数据保持一致)
      provinceSel.innerHTML =
        '<option value="">请选择省份</option>' +
        MapModule.getProvinceNames()
          .map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
          .join('');
      $('#addModal').classList.remove('hidden');
    });

    // 省份 -> 城市 级联
    provinceSel.addEventListener('change', async () => {
      const province = provinceSel.value;
      citySel.innerHTML = '<option value="">加载中…</option>';
      citySel.disabled = true;
      if (!province) {
        citySel.innerHTML = '<option value="">请先选择省份</option>';
        return;
      }
      try {
        const cities = await MapModule.getCities(province);
        citySel.innerHTML =
          '<option value="">请选择城市</option>' +
          cities.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
        citySel.disabled = false;
        // 只有一个城市(直辖市)时自动选中
        if (cities.length === 1) citySel.value = cities[0].name;
      } catch (e) {
        console.error(e);
        citySel.innerHTML = '<option value="">城市列表加载失败</option>';
        toast('城市列表加载失败,请检查网络', true);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const student = {
        name: form.elements.name.value.trim(),
        university: form.elements.university.value.trim(),
        major: form.elements.major.value.trim(),
        province: provinceSel.value,
        city: citySel.value,
        wechat: form.elements.wechat.value.trim(),
        qq: form.elements.qq.value.trim(),
        phone: form.elements.phone.value.trim(),
      };

      // 校验必填项
      let valid = true;
      ['name', 'university', 'major', 'province', 'city'].forEach((key) => {
        const field = form.elements[key];
        const empty = !student[key];
        field.classList.toggle('invalid', empty);
        if (empty) valid = false;
      });
      if (!valid) {
        toast('请填写所有带 * 的必填项', true);
        return;
      }

      const { student: saved, isUpdate } = DataStore.add(student);
      const result = await DataStore.save();

      $('#addModal').classList.add('hidden');
      MapModule.refresh();
      updateTotalCount();
      onViewChange(MapModule.getCurrentProvince());

      if (result === 'server') {
        toast(isUpdate ? `已更新 ${saved.name} 的资料` : `已保存 ${saved.name} 的资料`);
      } else if (result === 'download') {
        toast('已触发下载 data.json,请用该文件替换 GitHub 仓库中原文件后提交', true);
      } else {
        toast('保存失败,请检查网络连接', true);
      }
    });
  }

  /* ---------- 工具 ---------- */

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  return { init, toast, showDetail, onViewChange, updateTotalCount };
})();
