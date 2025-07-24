import { createRouter, createWebHistory } from 'vue-router';
import CaseGeneration from '../views/CaseGeneration.vue';
import HistoryCases from '../views/HistoryCases.vue';

const routes = [
  {
    path: '/',
    redirect: '/case-generation'
  },
  {
    path: '/case-generation',
    name: 'CaseGeneration',
    component: CaseGeneration,
    meta: {
      title: '用例生成'
    }
  },
  {
    path: '/history-cases',
    name: 'HistoryCases',
    component: HistoryCases,
    meta: {
      title: '历史用例查询'
    }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;