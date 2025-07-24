<template>
  <div class="app-container">
    <header class="app-header">
      <h1>测试用例管理系统</h1>
    </header>
    <nav class="app-nav">
      <el-menu
        mode="horizontal"
        :default-active="$route.path"
        @select="handleMenuSelect"
      >
        <el-menu-item index="/case-generation">用例生成</el-menu-item>
        <el-menu-item index="/history-cases">历史用例查询</el-menu-item>
      </el-menu>
    </nav>
    <main class="app-main">
      <router-view></router-view> <!-- 路由出口 -->
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

globalThis.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

const router = useRouter();

const handleMenuSelect = (key) => {
  router.push(key);
};
</script>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #409eff;
  color: white;
  padding: 16px;
  text-align: center;
}

.app-nav {
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.app-main {
  flex: 1;
  padding: 20px;
}
</style>