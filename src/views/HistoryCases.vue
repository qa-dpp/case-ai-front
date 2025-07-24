<template>
  <el-card style="width: 100% !important;">
    <div class="history-cases-container">
      <h2>历史用例查询</h2>
      <div style="display: flex; gap: 10px; margin-bottom: 20px;">
        <el-input
          v-model="searchKeyword"
          placeholder="请输入用例名称搜索"
          style="width: 300px;"
          suffix-icon="Search"
        ></el-input>
        <el-button type="primary" @click="loadCaseList">搜索</el-button>
       
      </div>
      <el-table :data="caseList" style="width: 100%">
        <el-table-column prop="id" label="用例ID" width="300"></el-table-column>
        <el-table-column prop="name" label="用例名称"></el-table-column>
        <!-- 注意：原数据中没有createTime字段，暂时注释掉 -->
        <!-- <el-table-column prop="createTime" label="创建时间" width="180"></el-table-column> -->
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button size="small" @click="viewCase(scope.row)">查看</el-button>
            <el-button size="small" type="danger" @click="deleteCase(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container" v-if="total > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        ></el-pagination>
      </div>

      <!-- 用例详情弹窗 -->
      <el-dialog
        v-model="caseDetailVisible"
        title="用例详情"
        width="800px"
        :before-close="handleCloseDetail"
      >
        <div v-if="currentCase">
          <h3>{{ currentCase.name }}</h3>
          <div class="case-content">
            <pre>{{ currentCase.caseContent }}</pre>
          </div>
        </div>
      </el-dialog>
    </div>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';

// 搜索关键词
const searchKeyword = ref('');
// 用例列表
const caseList = ref([]);
// 总条数
const total = ref(0);
// 当前页码
const currentPage = ref(1);
// 每页条数
const pageSize = ref(10);
// 用例详情可见性
const caseDetailVisible = ref(false);
// 当前查看的用例
const currentCase = ref(null);

// 加载用例列表
const loadCaseList = async () => {
  try {
    const response = await axios.post('/ai-api/case/list', {
      keyword: searchKeyword.value, // 使用用户输入的关键词
      page: currentPage.value,
      pageSize: pageSize.value
    });

    if (response.data.code === 200) {
      // 直接使用data数组
      caseList.value = response.data.data;
      // 总数为data数组的长度
      total.value = response.data.data.length;
    } else {
      ElMessage.error(`获取用例列表失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    ElMessage.error(`获取用例列表失败: ${error.message}`);
  }
};

// 查看用例
const viewCase = (row) => {
  currentCase.value = { ...row };
  caseDetailVisible.value = true;
};

// 删除用例
const deleteCase = async (id) => {
  try {
    const response = await axios.delete(`/ai-api/case/delete/${id}`);

    if (response.data.code === 200) {
      ElMessage.success('用例删除成功');
      loadCaseList();
    } else {
      ElMessage.error(`用例删除失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    ElMessage.error(`用例删除失败: ${error.message}`);
  }
};

// 关闭详情弹窗
const handleCloseDetail = () => {
  caseDetailVisible.value = false;
  currentCase.value = null;
};

// 页码变化
const handleCurrentChange = (val) => {
  currentPage.value = val;
  loadCaseList();
};

// 每页条数变化
const handleSizeChange = (val) => {
  pageSize.value = val;
  currentPage.value = 1;
  loadCaseList();
};

// 初始化加载
onMounted(() => {
  loadCaseList();
});


</script>

<style scoped>
.history-cases-container {
  padding: 20px;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}

.case-content {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background-color: #f9f9f9;
  max-height: 400px;
  overflow-y: auto;
}
</style>