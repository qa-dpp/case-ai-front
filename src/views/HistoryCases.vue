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
        <el-button @click="resetSearch">重置</el-button>
      
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
        width="80%"
        height="80vh"
        :before-close="handleCloseDetail"
      >
        <!-- <template #header-append> -->
          <el-button type="primary" @click="saveCase">用例保存</el-button>
        <!-- </template> -->
        <div v-if="currentCase" class="case-detail-container">
          <!-- 上方卡片：显示原始内容 -->
          <el-card class="top-card">
            <h3>{{ currentCase.name }}</h3>
            <div class="case-content">
              <textarea
                v-model="currentCase.caseContent"
                ref="caseContentTextarea"
                style="max-height: 500px; overflow-y: auto; height: auto; width: 100%; resize: vertical;"
                @input="adjustTextareaHeight"
              ></textarea>
            </div>
          </el-card>
          
          <!-- 下方卡片：显示脑图 -->
          <el-card class="bottom-card">
            <h3>用例脑图可视化</h3>
            <div class="markmap-container">
              <svg ref="svgRef"></svg>
            </div>
          </el-card>
        </div>
      </el-dialog>
    </div>
  </el-card>
</template>

<script setup>
import { ref, reactive, watch, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
// 导入markmap相关依赖
import { Markmap } from 'markmap-view';
import { transformer } from './markmap';



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
// svg引用
const svgRef = ref(null);
// markmap实例
let mm = null;

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

// 保存用例
const saveCase = async () => {
  if (!currentCase.value) return;
  
  try {
    const response = await axios.post('/ai-api/case/save', {
      caseName: currentCase.value.name,
      caseContent: currentCase.value.caseContent // 修正属性名拼写错误
    });

    if (response.data.code === 200) {
      ElMessage.success('用例保存成功');
      // 保存成功后可以刷新用例列表
      loadCaseList();
    } else {
      ElMessage.error(`用例保存失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    ElMessage.error(`用例保存失败: ${error.message}`);
  }
};

// 查看用例
const viewCase = (row) => {
  currentCase.value = { ...row };
  caseDetailVisible.value = true;
  // 弹窗打开后立即更新脑图
  setTimeout(() => {
    update();
  }, 0);
};

// 当弹窗显示且currentCase变化时更新脑图
watch([() => caseDetailVisible.value, () => currentCase.value], async ([visible, caseData]) => {
  if (visible && caseData && caseData.caseContent) {
    await update();
  }
});

// 更新脑图函数
const update = async () => {
  if(mm == null && svgRef.value){
    // 创建markmap实例时添加配置，设置默认字体大小为14px
    mm = Markmap.create(svgRef.value, {
      styles: {
        '.node text': { 'font-size': '14px' }
      }
    });
  }
  if (mm && currentCase.value && currentCase.value.caseContent) {
    const { root } = transformer.transform(currentCase.value.caseContent);
    await mm.setData(root);
    mm.fit();
  }
};

// 关闭详情弹窗
const handleCloseDetail = () => {
  caseDetailVisible.value = false;
  currentCase.value = null;
  // 重置markmap实例
  mm = null;
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


// 添加重置按钮对应的函数
const resetSearch = () => {
  searchKeyword.value = '';
  loadCaseList();
};

const caseContentTextarea = ref(null);
// 定义textarea高度的ref变量
const textareaHeight = ref('auto');

// 调整textarea高度的方法
const adjustTextareaHeight = (e) => {
  // 优先使用ref获取元素，其次使用事件目标
  const textarea = caseContentTextarea.value || e?.target;
  if (!textarea) return;
  
  // 重置高度以获取正确的scrollHeight
  textarea.style.height = 'auto';
  // 设置新高度，确保至少200px，最大500px
  const newHeight = Math.min(500, Math.max(200, textarea.scrollHeight)) + 'px';
  textarea.style.height = newHeight;
  textareaHeight.value = newHeight;
  
  // 同步更新脑图高度
  if (mm) {
    mm.fit();
  }
};


// 监听文本变化调整高度和更新脑图
watch(() => currentCase.value?.caseContent, () => {
  nextTick(() => {
    adjustTextareaHeight();
    // 文本变化时自动更新脑图
    update();
  });
});

// 组件挂载时调整高度
onMounted(() => {
  adjustTextareaHeight();
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

.case-detail-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100% - 40px); /* 使用弹窗全部可用高度 */
  overflow: hidden;
}

.top-card {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 500px; /* 限制上方卡片最大高度 */
}

.bottom-card {
  flex: 1;
  min-height: 800px; /* 设置最小高度800px */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.markmap-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

.markmap-container svg {
  width: 100%;
  height: 100%;
}
</style>