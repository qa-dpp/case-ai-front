<template>
  <!-- 简化测试布局 -->
  <div style="width: 100%; padding: 20px;">
    <div style="width: 90%; min-width: 800px; margin: 0 auto;">
      <!-- 第一个Card：文件上传 -->
      
      <el-card style="width: 100% !important; margin-bottom: 20px;">
        <div class="upload-container">
          <div v-if="isAnalyzing" class="loading-overlay">
            <el-icon :size="50" class="loading-icon"><Loading /></el-icon>
          </div>
          <el-upload
            class="upload-demo"
            drag
            action="#"
            :before-upload="beforeUpload"
            :on-change="handleChange"
            :on-remove="handleRemove"
            :file-list="fileList"
            :limit="5"
            :on-exceed="handleExceed"
            :auto-upload="false"
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip text-center">
                支持上传txt、pdf格式文件，最多5个文件
              </div>
            </template>
          </el-upload>
          
          <div class="button-group">
            <el-button type="primary" @click="clearFiles">清空文件</el-button>
            <el-button type="success" @click="startAnalysis">开始分析</el-button>
            <el-button type="danger" @click="clearAll">清空所有</el-button>
          </div>
          
          <el-input
            type="textarea"
            v-model="analysisText"
            :autosize="{ minRows: 10, maxRows: 20 }"
            placeholder="分析结果将显示在这里..."
            class="result-textarea"

          ></el-input>
          
          <!-- 生成测试用例按钮 -->
          <div class="test-case-btn-container">
            <span style="margin-right: 8px; font-weight: 500;">历史用例：</span>
            <el-select
              v-if="analysisText.trim()"
              v-model="selectedCase"
              filterable
              remote
              reserve-keyword
              placeholder="上传历史用例"
              :remote-method="fetchCaseList"
              :loading="isLoadingCaseList"
              value-key="name"  
              style="width: 240px; margin-right: 10px;"
            >
              <el-option
                v-for="caseItem in caseList"
                :key="caseItem.id"
                :label="caseItem.name"
                :value="caseItem"
              ></el-option>
            </el-select>
            <el-button
              v-if="analysisText.trim()"
              type="primary"
              @click="generateTestCase"
              class="generate-test-case-btn"
              :loading="isGeneratingTestCase">
              生成测试用例
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- 第二个Card：测试用例结果 -->
      <el-card style="width: 100% !important; margin-top: 20px;" v-if="testCaseResult || isGeneratingTestCase">
        <div class="test-case-container">
          <div v-if="isGeneratingTestCase" class="loading-overlay">
            <el-icon :size="50" class="loading-icon"><Loading /></el-icon>
          </div>
          <h3>测试用例结果</h3>
          <MdPreview v-if="testCaseResult" :modelValue="testCaseResult" style="text-align: left;"/>
          <div v-else class="empty-result">点击"生成测试用例"按钮查看结果</div>
        </div>
       
      </el-card>

      
<!-- v-if="testCaseResult || isGeneratingTestCase" -->
      <!-- 脑图显示卡片 -->
      <el-card style="width: 100% !important; margin-top: 20px;" >
        <div class="mindmap-container" style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
          <textarea 
            class="mindmap-input"
            v-model="testCaseofmarkdown"
            @input="adjustTextareaHeight"
            :style="{ width: '100%', height: textareaHeight, minHeight: '200px', maxHeight: '500px' }"
            placeholder="在此输入脑图内容..."
          ></textarea>
          <svg 
            class="mindmap-svg"
            ref="svgRef"
            :style="{ width: '100%', minHeight: '800px', height: 'auto' }"
          ></svg>
        </div>
      </el-card>
<!-- 新增保存用例按钮 -->
      <div style="text-align: center; margin-top: 10px;">
        <el-button type="primary" @click="openSaveDialog">保存用例</el-button>
      </div>

      <!-- 保存用例弹窗 -->
      <el-dialog 
        v-model="saveDialogVisible"
        title="保存用例"
        width="400px"
        :before-close="handleClose"
      >
        <div style="margin-bottom: 20px;">
          <span>请输入用例名称：</span>
          <el-input 
            v-model="caseName"
            placeholder="请输入用例名称"
            style="width: 100%; margin-top: 10px;"
            :validate-event="false"
          ></el-input>
          <div v-if="showError" style="color: #f56c6c; font-size: 12px; margin-top: 5px;">
            用例名称不能为空
          </div>
        </div>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="saveDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveTestCase">确定</el-button>
          </span>
        </template>
      </el-dialog>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { UploadFilled, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { MdPreview } from 'md-editor-v3';
// preview.css相比style.css少了编辑器那部分样式
import 'md-editor-v3/lib/preview.css';
// 导入markmap相关库
import { Markmap } from 'markmap-view';
import { transformer } from './markmap';

// 常量定义
const API_ENDPOINTS = {
  UPLOAD: '/ai-api/file/upload',
  CREATE_CASE: '/ai-api/case/create',
  SAVE_CASE: '/ai-api/case/save',
  LIST_CASES: '/ai-api/case/list'
};

const FILE_CONFIG = {
  ALLOWED_TYPES: ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ALLOWED_EXTENSIONS: ['txt', 'pdf'],
  MAX_FILES: 5
};

// 文件上传状态
const fileList = ref([]);

// 应用状态
const state = {
  // 分析结果状态
  analysisText: ref(''),
  isAnalyzing: ref(false),
  
  // 测试用例状态
  testCaseResult: ref(''),
  isGeneratingTestCase: ref(false),
  
  // 脑图状态
  svgRef: ref(),
  testCaseofmarkdown: ref(''),
  textareaHeight: ref('200px'),
  
  // 保存用例相关
  saveDialogVisible: ref(false),
  caseName: ref(''),
  showError: ref(false),
  
  // 历史用例选择相关
  selectedCase: ref(null),
  caseList: ref([]),
  isLoadingCaseList: ref(false),
  currentPage: ref(1),
  pageSize: ref(10)
};

// 解构状态以便在模板中使用
const { 
  analysisText, isAnalyzing, 
  testCaseResult, isGeneratingTestCase,
  svgRef, testCaseofmarkdown, textareaHeight,
  saveDialogVisible, caseName, showError,
  selectedCase, caseList, isLoadingCaseList
} = state;

// markmap实例
let mm = null;

// 工具函数
/**
 * 防抖函数
 * @param {Function} fn 需要防抖的函数
 * @param {number} delay 延迟时间(ms)
 * @returns {Function} 防抖处理后的函数
 */
const debounce = (fn, delay) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

/**
 * 提取Markdown内容
 * @param {string} text 包含markdown代码块的文本
 * @returns {string} 提取的markdown内容
 */
const extractMarkdownContent = (text) => {
  // 匹配```markdown块中的内容，支持结束的```不存在的场景
  // 1. 尝试匹配标准格式：```markdown\n内容```
  // 2. 如果没有匹配到，尝试匹配：```markdown\n内容（到结束）
  const standardRegex = /```markdown\n([\s\S]*?)```/g;
  const unclosedRegex = /```markdown\n([\s\S]*?)($|(?=```\w))/g;
  
  // 先尝试标准格式
  const standardMatches = [...text.matchAll(standardRegex)];
  if (standardMatches.length > 0) {
    // 合并所有匹配到的markdown内容
    return standardMatches.map(match => match[1]).join('\n\n');
  }
  
  // 如果标准格式没有匹配到，尝试未闭合的格式
  const unclosedMatches = [...text.matchAll(unclosedRegex)];
  if (unclosedMatches.length > 0) {
    return unclosedMatches.map(match => match[1]).join('\n\n');
  }
  
  // 如果两种格式都没匹配到，直接查找```markdown后的所有内容
  const fallbackRegex = /```markdown\n([\s\S]*)/;
  const fallbackMatch = text.match(fallbackRegex);
  if (fallbackMatch) {
    return fallbackMatch[1];
  }
  
  return text; // 如果没有匹配到，返回原始文本
};

// 文件上传处理函数
const beforeUpload = (file) => {
  const fileExtension = file.name.split('.').pop().toLowerCase();
  if (!FILE_CONFIG.ALLOWED_EXTENSIONS.includes(fileExtension)) {
    ElMessage.error(`只能上传${FILE_CONFIG.ALLOWED_EXTENSIONS.join('、')}格式的文件`);
    return false;
  }
  return true;
};

const handleChange = (file, files) => {
  fileList.value = files;
};

const handleRemove = (file, files) => {
  fileList.value = files;
};

const handleExceed = () => {
  ElMessage.error(`最多只能上传${FILE_CONFIG.MAX_FILES}个文件`);
};

// 按钮处理函数
const clearFiles = () => {
  fileList.value = [];
  analysisText.value = '';
  ElMessage.success('文件已清空');
};

const startAnalysis = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先上传文件');
    return;
  }
  
  isAnalyzing.value = true;
  analysisText.value = '';
  
  try {
    // 创建FormData对象并添加文件
    const formData = new FormData();
    fileList.value.forEach(file => {
      formData.append('files', file.raw);
    });   
    
    // 发送文件到后端API
    const response = await axios.post(API_ENDPOINTS.UPLOAD, formData);
    const responseData = response.data;
    
    if (responseData.code !== 200) {
      throw new Error(responseData.message || '文件分析失败');
    }
    
    analysisText.value = responseData.data;
    ElMessage.success('文件分析成功');
  } catch (error) {
    console.error('文件分析失败:', error);
    ElMessage.error(`上传失败: ${error.message}`);
    analysisText.value = `上传失败: ${error.message}`;
  } finally {
    isAnalyzing.value = false;
  }
};

const clearAll = () => {
  fileList.value = [];
  analysisText.value = '';
  testCaseResult.value = '';
  ElMessage.success('所有内容已清空');
};



// 修改textarea高度调整函数
const adjustTextareaHeight = (e) => {
  const textarea = e?.target || document.querySelector('.mindmap-input');
  if (!textarea) return;
  
  // 重置高度以获取正确的scrollHeight
  textarea.style.height = 'auto';
  // 设置新高度，确保至少200px
  const newHeight = Math.min(500,Math.max(200, textarea.scrollHeight)) + 'px';
  textareaHeight.value = newHeight;
  
  // 同步更新脑图高度
  if (mm) {
    mm.fit();
  }
};

// 初始化时设置默认高度
onMounted(() => {
  textareaHeight.value = '200px';
  adjustTextareaHeight();
});

// 监听文本变化调整高度和更新脑图
watch(testCaseofmarkdown, () => {
  nextTick(() => {
    adjustTextareaHeight();
    // 文本变化时自动更新脑图
    update();
  });
});

/**
 * 更新脑图
 */
const update = async () => {
  if (!svgRef.value) return;
  
  try {
    if (mm == null) {
      // 创建markmap实例时添加配置，设置默认字体大小为14px
      mm = Markmap.create(svgRef.value, {
        nodeFont: '14px sans-serif',
        nodeMinHeight: 16,
        duration: 500, // 动画持续时间
        maxWidth: 300, // 节点最大宽度
      });
    }
    
    if (testCaseofmarkdown.value) {
      const { root } = transformer.transform(testCaseofmarkdown.value);
      await mm.setData(root);
      mm.fit();
    }
  } catch (error) {
    console.error('更新脑图失败:', error);
  }
};

// 使用防抖优化脑图更新
const debouncedUpdate = debounce(update, 300);

//onUpdated(update);



/**
 * 处理流式响应数据
 * @param {ReadableStream} stream 可读流
 * @returns {Promise<string>} 处理后的完整内容
 */
const handleStreamResponse = async (stream) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      // 处理SSE格式数据
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          result = data ||'';
        } else if (line.trim()) {
          result += line;
        }
      }
    }
    return result;
  } catch (error) {
    console.error('处理流式响应失败:', error);
    throw error;
  }
};

/**
 * 处理测试用例数据
 * @param {string} rawContent JSON格式的原始内容
 */
const processTestCaseData = async (rawContent) => {
  console.log('处理测试用例数据:', rawContent);
  try {
    // 将返回的json字符串转换为对象
    const jsonData = JSON.parse(rawContent);
    
    // 组合显示内容
    const displayContent = [
      jsonData.caseInfoMessage || '',
      jsonData.caseReviewMessage || ''
    ].filter(Boolean).join('\n\n');
    
    testCaseResult.value = displayContent;
    
    // 提取并处理Markdown内容
    if (jsonData.caseInfoMessage) {
      const formattedContent = extractMarkdownContent(jsonData.caseInfoMessage);
      testCaseofmarkdown.value = formattedContent;
      
      // 使用nextTick确保DOM更新后再更新脑图
      nextTick(() => {
        update();
      });
    }
  } catch (error) {
    console.error('处理测试用例数据失败:', error);
    throw new Error(`处理测试用例数据失败: ${error.message}`);
  }
};

/**
 * 生成测试用例
 */
const generateTestCase = async () => {
  if (!analysisText.value.trim()) {
    ElMessage.warning('请先上传并分析文件');
    return;
  }
  
  isGeneratingTestCase.value = true;
  testCaseResult.value = '';
  
  try {
    // 获取caseName的值：如果选中了历史用例则使用其name，否则为空字符串
    const caseId = selectedCase.value?.id || '';
    
    const response = await fetch(API_ENDPOINTS.CREATE_CASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: analysisText.value,
        caseId: caseId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // 处理流式响应
    const rawContent = await handleStreamResponse(response.body);
    
    // 处理测试用例数据
    await processTestCaseData(rawContent);
    
    ElMessage.success('生成测试用例成功');
  } catch (error) {
    console.error('生成测试用例失败:', error);
    ElMessage.error('生成测试用例失败: ' + error.message);
    testCaseResult.value = '生成测试用例失败，请重试';
  } finally {
    isGeneratingTestCase.value = false;
  }
};



// 打开保存用例弹窗
const openSaveDialog = () => {
  caseName.value = '';
  showError.value = false;
  saveDialogVisible.value = true;
};

// 关闭弹窗
const handleClose = () => {
  saveDialogVisible.value = false;
};

/**
 * 保存测试用例
 */
const saveTestCase = async () => {
  if (!caseName.value.trim()) {
    showError.value = true;
    return;
  }

  try {
    // 检查是否有内容可保存
    if (!testCaseofmarkdown.value.trim()) {
      ElMessage.warning('没有可保存的测试用例内容');
      return;
    }

    const response = await axios.post(API_ENDPOINTS.SAVE_CASE, {
      caseName: caseName.value.trim(),
      caseContent: testCaseofmarkdown.value
    });

    if (response.data.code === 200) {
      ElMessage.success('用例保存成功');
      saveDialogVisible.value = false;
      
      // 刷新用例列表（如果当前有搜索关键词）
      if (selectedCase.value?.name) {
        fetchCaseList(selectedCase.value.name);
      }
    } else {
      ElMessage.error(`保存失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    console.error('保存用例失败:', error);
    ElMessage.error(`保存失败: ${error.message}`);
  }
};

/**
 * 获取历史用例列表
 * @param {string} keyword 搜索关键词
 */
const fetchCaseList = async (keyword) => {
  if (!keyword) {
    caseList.value = [];
    return;
  }

  isLoadingCaseList.value = true;
  try {
    const response = await axios.post(API_ENDPOINTS.LIST_CASES, {
      keyword: keyword,
      page: state.currentPage.value,
      pageSize: state.pageSize.value
    });

    if (response.data.code === 200) {
      caseList.value = response.data.data || [];
    } else {
      console.error('获取用例列表失败:', response.data);
      ElMessage.error(`获取用例列表失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    console.error('获取用例列表请求异常:', error);
    ElMessage.error(`获取用例列表失败: ${error.message}`);
  } finally {
    isLoadingCaseList.value = false;
  }
};

// 事件监听和生命周期钩子
onMounted(() => {
  textareaHeight.value = '200px';
  adjustTextareaHeight();
});

// 监听选中用例变化
watch(selectedCase, (newVal) => {
  if (newVal && newVal.content) {
    testCaseofmarkdown.value = newVal.content;
    nextTick(() => {
      update();
    });
  }
});

// 监听文本变化调整高度和更新脑图
watch(testCaseofmarkdown, () => {
  nextTick(() => {
    adjustTextareaHeight();
    debouncedUpdate();
  });
});
</script>

<style scoped>
/* 组件样式 */
:deep(.el-card__body) {
  position: relative;
  padding: 20px;
  margin: 0;
}

.upload-container {
  text-align: center;
  width: 100% !important;
}

.button-group {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

/* 加载状态样式 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-icon {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.result-container {
  position: relative;
}

.result-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.6;
}

.empty-result {
  color: #909399;
  text-align: center;
  padding: 20px;
}
</style>

<style>

/* 全局样式重置 */
html, body, #app { margin: 0; padding: 0; width: 100%; min-width: 100%; max-width: 100%; }
* { box-sizing: border-box; }

/* Markdown 基础样式 */
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  line-height: 1.6;
  word-wrap: break-word;
  padding: 16px;
}

.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 6px;
}

.markdown-body pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  word-break: normal;
  white-space: pre;
  background: transparent;
  border: 0;
}
</style>

<style scoped>
/* 简化样式 - 仅保留必要样式 */
:deep(.el-card__body) {
  position: relative;

  padding: 20px;
  margin: 0;
}

.upload-container {
  text-align: center;
  width: 100% !important;
}

.button-group {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

/* 加载状态样式 */
.loading-overlay {
   position: absolute;
   top: 0;
   left: 0;
   right: 0;
   bottom: 0;
   background-color: rgba(255, 255, 255, 0.8);
   display: flex;
   align-items: center;
   justify-content: center;
   z-index: 10;
 }

.result-content {
  text-align: left !important;
  white-space: pre-wrap;
  line-height: 1.2;
}



.loading-icon {
   animation: spin 1.5s linear infinite;
 }

@keyframes spin {
   from { transform: rotate(0deg); }
   to { transform: rotate(360deg); }
 }

.result-container {
  min-height: 300px;
}

.result-content {
  white-space: pre-wrap;
  line-height: 1.6;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.empty-result {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  border: 1px dashed #e0e0e0;
  border-radius: 4px;
  padding: 20px;
}

.result-textarea {
  width: 100%;
  min-height: 300px;
  margin-top: 20px;
}

.test-case-btn-container {
  position: relative;
  height: 40px;
}

.generate-test-case-btn {
  position: absolute;
  right: 0;
  bottom: 0;
}

.test-case-container {
  position: relative;
}
</style>

<style scoped>
/* 脑图容器样式 */
.mindmap-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
}

/* 脑图输入框样式 */
.mindmap-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  resize: none;
  box-sizing: border-box;
  font-family: monospace;
  line-height: 1.5;
  transition: border-color 0.3s;
}

.mindmap-input:focus {
  border-color: #409eff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

/* 脑图SVG样式 */
.mindmap-svg {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-sizing: border-box;
  overflow: auto;
  background-color: #fafafa;
  min-height: 600px;
}
</style>
