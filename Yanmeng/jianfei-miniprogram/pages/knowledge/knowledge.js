const KNOWLEDGE = require('../../data/knowledge.js');

const CATS = ['全部', '饮食', '运动', '心理'];

Page({
  data: {
    categories: CATS,
    catIdx: 0,
    items: [],
    expandedId: ''
  },

  onLoad() {
    this.applyFilter();
  },

  applyFilter() {
    const cat = CATS[this.data.catIdx];
    let list = KNOWLEDGE;
    if (cat !== '全部') {
      list = KNOWLEDGE.filter(function (k) { return k.cat === cat; });
    }
    this.setData({ items: list });
  },

  onCat(e) {
    this.setData({ catIdx: Number(e.currentTarget.dataset.i) });
    this.applyFilter();
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? '' : id });
  },

  onShareAppMessage() {
    return { title: '减肥小知识，每天学一点', path: '/pages/knowledge/knowledge' };
  }
});
