/**
 * map.js — 地图模块(基于 ECharts)
 * 全国视图:按各省人数着色的中国地图,点击进入省级视图
 * 省级视图:该省行政区划图 + 城市大头针(单人显示姓名,多人显示人数,悬停展开列表)
 */
const MapModule = (() => {
  /** 直辖市 / 特别行政区:不再细分地级市,整体视为一个"城市" */
  const SINGLE_CITY_PROVINCES = [
    '北京市', '天津市', '上海市', '重庆市',
    '香港特别行政区', '澳门特别行政区',
  ];

  // 省份 GeoJSON 从本地 maps/provinces/ 目录加载（已预下载）
  const GEOJSON_BASE = 'maps/provinces/';
  const GEOJSON_SUFFIX = '.json';

  let chart = null;
  let onShowStudent = null; // 点击同学姓名时的回调

  /** 同市同学浮层(自定义 DOM,替代 ECharts tooltip,保证鼠标可移入点击) */
  let popup = null;
  let popupHideTimer = null;

  /** 省份名 -> { adcode, center } */
  const provinceIndex = {};
  /** adcode -> 省级 GeoJSON(缓存,避免重复请求) */
  const geoCache = {};
  /** 省份名 -> [{ name, center }] 城市列表(缓存) */
  const cityListCache = {};

  let currentProvince = null; // null 表示全国视图

  /* ---------- ECharts 主题颜色 ---------- */

  function chartColors() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return {
      visualMapText:     dark ? '#a0aec0' : '#4a5568',
      labelColor:        dark ? '#a0aec0' : '#4a5568',
      emphasisLabel:     dark ? '#e2e8f0' : '#1a202c',
      emphasisArea:      dark ? '#dd6b20' : '#f6ad55',
      mapBorder:         dark ? '#2d3748' : '#ffffff',
      geoArea:           dark ? '#2a3f52' : '#e3eef8',
      geoBorder:         dark ? '#4a6a8a' : '#7db3dd',
      geoEmphasisArea:   dark ? '#3a5570' : '#cfe3f4',
      pinColor:          dark ? '#fc8181' : '#e53e3e',
      pinShadow:         dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
      scatterLabelColor: dark ? '#e2e8f0' : '#2d3748',
      scatterLabelBg:    dark ? 'rgba(45,55,72,0.92)' : 'rgba(255,255,255,0.88)',
      scatterLabelBorder: dark ? '#718096' : '#cbd5e0',
    };
  }

  /* ---------- 初始化 ---------- */

  async function init(el, callbacks) {
    onShowStudent = callbacks.onShowStudent;
    chart = echarts.init(el);

    popup = document.getElementById('cityPopup');
    // 鼠标进入浮层时取消隐藏计时,离开后延迟隐藏
    popup.addEventListener('mouseenter', () => clearTimeout(popupHideTimer));
    popup.addEventListener('mouseleave', scheduleHidePopup);
    // 浮层中点击同学姓名 -> 弹出资料
    popup.addEventListener('click', (e) => {
      const item = e.target.closest('.tip-student');
      if (item && onShowStudent) {
        const student = DataStore.findById(item.dataset.sid);
        if (student) {
          hidePopup();
          onShowStudent(student);
        }
      }
    });

    chart.on('click', (params) => {
      if (currentProvince === null && params.seriesType === 'map') {
        drillDown(params.name);
      } else if (params.seriesType === 'scatter') {
        handlePinClick(params.data);
      }
    });
    // 悬停大头针显示浮层,移出后延迟隐藏(留给鼠标移进浮层的时间)
    chart.on('mouseover', (params) => {
      if (params.seriesType === 'scatter') showCityPopup(params.data);
    });
    chart.on('mouseout', (params) => {
      if (params.seriesType === 'scatter') scheduleHidePopup();
    });
    // 缩放 / 平移地图时,大头针像素位置已变化,直接收起浮层
    chart.on('georoam', hidePopup);

    window.addEventListener('resize', () => {
      if (chart) {
        chart.resize();
        hidePopup();
      }
    });

    await loadChina();
  }

  /* ---------- 同市同学浮层 ---------- */

  function showCityPopup(data) {
    if (!data || !data.students) return;
    clearTimeout(popupHideTimer);

    const list = data.students;
    popup.innerHTML =
      `<div class="tip-city">${escapeHtml(data.name)} · ${list.length} 人</div>` +
      `<div class="tip-list">` +
      list
        .map(
          (s) =>
            `<div class="tip-student" data-sid="${s.id}">${escapeHtml(s.name)}` +
            `<span class="tip-uni">${escapeHtml(s.university)}</span></div>`
        )
        .join('') +
      `</div>`;
    popup.classList.remove('hidden');

    // 大头针经纬度 -> 像素坐标,浮层放在大头针右侧,靠近边缘时自动翻转
    const px = chart.convertToPixel('geo', [data.value[0], data.value[1]]);
    const cw = chart.getWidth();
    const ch = chart.getHeight();
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    let left = px[0] + 18;
    let top = px[1] - ph / 2;
    if (left + pw > cw - 8) left = px[0] - pw - 18;
    if (left < 8) left = 8;
    if (top + ph > ch - 8) top = ch - ph - 8;
    if (top < 8) top = 8;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  function scheduleHidePopup() {
    clearTimeout(popupHideTimer);
    popupHideTimer = setTimeout(hidePopup, 300);
  }

  function hidePopup() {
    clearTimeout(popupHideTimer);
    if (popup) popup.classList.add('hidden');
  }

  async function ensureProvinceIndex() {
    if (Object.keys(provinceIndex).length > 0) return; // 已加载

    const resp = await fetch('maps/china.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const geojson = await resp.json();
    geojson.features.forEach((f) => {
      provinceIndex[f.properties.name] = {
        adcode: f.properties.adcode,
        center: f.properties.center,
      };
    });
  }

  async function loadChina() {
    chart.showLoading({ text: '地图加载中…', color: chartColors().visualMapText });
    try {
      await ensureProvinceIndex();
      // 注册 ECharts 地图（需要 china.json 的 GeoJSON，复用已加载的数据）
      const resp = await fetch('maps/china.json');
      const geojson = await resp.json();
      echarts.registerMap('china', geojson);
      renderChina();
    } catch (e) {
      console.error(e);
      UI.toast('全国地图加载失败,请检查 maps/china.json', true);
    } finally {
      chart.hideLoading();
    }
  }

  /* ---------- 全国视图 ---------- */

  function countByProvince() {
    const counts = {};
    DataStore.getAll().forEach((s) => {
      counts[s.province] = (counts[s.province] || 0) + 1;
    });
    return counts;
  }

  function renderChina() {
    currentProvince = null;
    hidePopup();
    const c = chartColors();
    const counts = countByProvince();
    const data = Object.keys(provinceIndex).map((name) => ({
      name,
      value: counts[name] || 0,
    }));
    const max = Math.max(1, ...data.map((d) => d.value));

    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          formatter: (p) => `${p.name}<br/>同学人数:${p.value || 0} 人`,
        },
        visualMap: {
          min: 0,
          max,
          left: 20,
          bottom: 30,
          text: ['多', '少'],
          calculable: true,
          inRange: { color: ['#dcebf7', '#7db3dd', '#2b6cb0', '#123f6d'] },
          textStyle: { color: c.visualMapText },
        },
        series: [
          {
            type: 'map',
            map: 'china',
            roam: true,
            scaleLimit: { min: 0.8, max: 5 },
            label: { show: true, fontSize: 10, color: c.labelColor },
            itemStyle: { borderColor: c.mapBorder, borderWidth: 0.6 },
            emphasis: {
              label: { color: c.emphasisLabel, fontWeight: 'bold' },
              itemStyle: { areaColor: c.emphasisArea },
            },
            data,
          },
        ],
      },
      true
    );
  }

  /* ---------- 省级视图 ---------- */

  async function ensureProvinceGeo(provinceName) {
    const info = provinceIndex[provinceName];
    if (!info) throw new Error('未知省份:' + provinceName);
    if (!geoCache[info.adcode]) {
      const resp = await fetch(GEOJSON_BASE + info.adcode + GEOJSON_SUFFIX);
      if (!resp.ok) throw new Error('省级地图请求失败:HTTP ' + resp.status);
      geoCache[info.adcode] = await resp.json();
    }
    return geoCache[info.adcode];
  }

  /** 获取某省的城市列表 [{ name, center }],供大头针定位和添加表单下拉框使用 */
  async function getCities(provinceName) {
    if (cityListCache[provinceName]) return cityListCache[provinceName];

    const info = provinceIndex[provinceName];
    if (!info) return [];

    let cities;
    if (SINGLE_CITY_PROVINCES.includes(provinceName)) {
      cities = [{ name: provinceName, center: info.center }];
    } else {
      const geojson = await ensureProvinceGeo(provinceName);
      cities = geojson.features.map((f) => ({
        name: f.properties.name,
        center: f.properties.center || f.properties.centroid,
      }));
    }
    cityListCache[provinceName] = cities;
    return cities;
  }

  async function drillDown(provinceName) {
    if (!provinceIndex[provinceName]) return;
    chart.showLoading({ text: provinceName + '地图加载中…', color: chartColors().visualMapText });
    try {
      const geojson = await ensureProvinceGeo(provinceName);
      echarts.registerMap(provinceName, geojson);
      await getCities(provinceName); // 填充城市列表缓存,供大头针定位
      currentProvince = provinceName;
      renderProvince();
      UI.onViewChange(provinceName);
    } catch (e) {
      console.error(e);
      UI.toast(provinceName + '地图加载失败,请检查网络', true);
    } finally {
      chart.hideLoading();
    }
  }

  function renderProvince() {
    const provinceName = currentProvince;
    if (!provinceName) return;

    const c = chartColors();
    const info = provinceIndex[provinceName];
    const provinceCenter = info ? info.center : null;
    const cities = cityListCache[provinceName] || [];

    // 按城市分组
    const groups = {};
    DataStore.getAll()
      .filter((s) => s.province === provinceName)
      .forEach((s) => {
        (groups[s.city] = groups[s.city] || []).push(s);
      });

    const pinData = Object.entries(groups).map(([city, list]) => {
      const cityInfo = cities.find((c) => c.name === city);
      const center = cityInfo ? cityInfo.center : provinceCenter;
      return {
        name: city,
        value: center ? [...center, list.length] : [0, 0, list.length],
        students: list,
      };
    });

    chart.setOption(
      {
        // 同市列表使用自定义浮层(cityPopup),禁用内置 tooltip
        tooltip: { show: false },
        geo: {
          map: provinceName,
          roam: true,
          scaleLimit: { min: 0.8, max: 8 },
          label: { show: true, fontSize: 10, color: c.labelColor },
          itemStyle: {
            areaColor: c.geoArea,
            borderColor: c.geoBorder,
            borderWidth: 0.8,
          },
          emphasis: {
            label: { color: c.emphasisLabel },
            itemStyle: { areaColor: c.geoEmphasisArea },
          },
        },
        series: [
          {
            type: 'scatter',
            coordinateSystem: 'geo',
            symbol: 'pin',
            symbolSize: 42,
            symbolKeepAspect: true,
            itemStyle: { color: c.pinColor, shadowBlur: 6, shadowColor: c.pinShadow },
            label: {
              show: true,
              position: 'top',
              distance: 4,
              fontSize: 12,
              fontWeight: 600,
              color: c.scatterLabelColor,
              backgroundColor: c.scatterLabelBg,
              borderColor: c.scatterLabelBorder,
              borderWidth: 1,
              borderRadius: 4,
              padding: [2, 6],
              formatter: (p) => {
                const list = p.data.students;
                // 同市多人显示人数,单人显示姓名
                return list.length > 1 ? String(list.length) : list[0].name;
              },
            },
            emphasis: { scale: 1.15 },
            data: pinData,
            z: 10,
          },
        ],
      },
      true
    );
  }

  /** 点击大头针:单人弹出资料;多人展开浮层(方便触屏) */
  function handlePinClick(data) {
    if (!data || !data.students) return;
    if (data.students.length === 1 && onShowStudent) {
      onShowStudent(data.students[0]);
    } else {
      showCityPopup(data); // 每次点击都刷新浮层内容
    }
  }

  /* ---------- 公共方法 ---------- */

  function backToChina() {
    renderChina();
    UI.onViewChange(null);
  }

  /** 数据变化后刷新当前视图 */
  function refresh() {
    if (!chart) return; // 尚未初始化,无需刷新
    if (currentProvince) {
      renderProvince();
    } else {
      renderChina();
    }
  }

  function getCurrentProvince() {
    return currentProvince;
  }

  function getProvinceNames() {
    return Object.keys(provinceIndex);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function _getProvinceInfo(name) {
    return provinceIndex[name] || null;
  }

  return { init, backToChina, refresh, drillDown, getCities, getCurrentProvince, getProvinceNames, ensureProvinceIndex, _getProvinceInfo, _showPopup: showCityPopup, _hidePopup: hidePopup, _scheduleHide: scheduleHidePopup };
})();
