/**
 * main.js — 入口:加载数据,初始化地图与界面
 */
(async () => {
  UI.init();
  await DataStore.load();
  UI.updateTotalCount();
  await MapModule.init(document.getElementById('map'), {
    onShowStudent: (student) => UI.showDetail(student),
  });
})();
