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
                支持上传txt、pdf、docx格式文件，最多5个文件
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
import { ref, onMounted, onUpdated, watch, nextTick } from 'vue'; // 添加watch和nextTick
import { UploadFilled, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { MdPreview, MdCatalog } from 'md-editor-v3';
// preview.css相比style.css少了编辑器那部分样式
import 'md-editor-v3/lib/preview.css';
// 导入markmap相关库
import { Markmap } from 'markmap-view';
import { transformer } from './markmap';
  
  // 文件上传状态
const fileList = ref([]);
const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const allowedExtensions = ['txt', 'pdf', 'docx'];

// 分析结果状态
const analysisText = ref('');
const isAnalyzing = ref(false);

// 测试用例状态
const testCaseResult = ref('');
const isGeneratingTestCase = ref(false);

// 文件上传处理函数
const beforeUpload = (file) => {
  const fileExtension = file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    ElMessage.error('只能上传txt、pdf、docx格式的文件');
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
  ElMessage.error('最多只能上传5个文件');
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
      const response = await axios.post('/ai-api/file/upload', formData);
      const responseData = response.data;
      
      if (responseData.code !== 200) {
        throw new Error(responseData.message || '文件分析失败');
      }
      
      analysisText.value = responseData.data;
    } catch (error) {
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

//创建响应式变量，用于存储从接口获取的 markdown 格式文本内容
const svgRef = ref();
const testCaseofmarkdown = ref("");
let mm= null;

// 添加textarea高度响应式变量
const textareaHeight = ref('200px');

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

// 修改update函数，添加markmap配置以调整文字大小
const update = async () => {
  if(mm == null){
    // 创建markmap实例时添加配置，设置默认字体大小为14px
    mm = Markmap.create(svgRef.value);
  }
  const { root } = transformer.transform(testCaseofmarkdown.value);
  await mm.setData(root);
  mm.fit();
};

//onUpdated(update);



// 生成测试用例
const generateTestCase = async () => {
  if (!analysisText.value.trim()) return;
  
  isGeneratingTestCase.value = true;
  testCaseResult.value = '';
  
  try {
    // 获取caseName的值：如果选中了历史用例则使用其name，否则为空字符串
    const caseId = selectedCase.value?.id || '';
    
    const response = await fetch('/ai-api/case/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: analysisText.value,
        caseId: caseId  // 新增caseId入参
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        let rawContent = '';
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data) {
            rawContent += data + '\n\n';
            console.log("返回结果",rawContent)
            try {
              const jsonData = JSON.parse(data);
              const displayContent = (jsonData.caseInfoMessage||'') +'\n\n'+ (jsonData.caseReviewMessage||'');
              testCaseResult.value = displayContent;
              if(jsonData.caseInfoMessage){
                // 判断是否包含```markdown标记并提取内容
                const markdownRegex = /```markdown\n([\s\S]*?)```/;
                const match = jsonData.caseInfoMessage.match(markdownRegex);
  
                // 如果匹配成功，使用匹配到的内容；否则使用原始值
                const formattedContent = match ? match[1] : jsonData.caseInfoMessage;
  
                testCaseofmarkdown.value = formattedContent;
                //console.log("处理后的数据", caseInfoMessage.value)
                update();
              }
              

            } catch (e) {
              console.error(e)
              testCaseResult.value = rawContent;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('生成测试用例失败:', error);
    ElMessage.error('生成测试用例失败: ' + error.message);
  } finally {
    isGeneratingTestCase.value = false;
  }
};

// 添加保存用例相关变量
const saveDialogVisible = ref(false);
const caseName = ref('');
const showError = ref(false);

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

// 保存用例
const saveTestCase = async () => {
  if (!caseName.value.trim()) {
    showError.value = true;
    return;
  }

  try {
    const response = await axios.post('/ai-api/case/save', {
      caseName: caseName.value.trim(),
      caseContent: testCaseofmarkdown.value
    });

    if (response.data.code === 200) {
      ElMessage.success('用例保存成功');
      saveDialogVisible.value = false;
    } else {
      ElMessage.error(`保存失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    ElMessage.error(`保存失败: ${error.message}`);
  }
};
// 历史用例选择相关变量
const selectedCase = ref(null);
const caseList = ref([]);
const isLoadingCaseList = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);

// 获取历史用例列表
const fetchCaseList = async (keyword) => {
  if (!keyword) {
    caseList.value = [];
    return;
  }

  isLoadingCaseList.value = true;
  try {
    const response = await axios.post('/ai-api/case/list', {
      keyword: keyword,
      page: currentPage.value,
      pageSize: pageSize.value
    });

    if (response.data.code === 200) {
      caseList.value = response.data.data || [];
    } else {
      ElMessage.error(`获取用例列表失败: ${response.data.message || '未知错误'}`);
    }
  } catch (error) {
    ElMessage.error(`获取用例列表失败: ${error.message}`);
  } finally {
    isLoadingCaseList.value = false;
  }
};

// 监听选中用例变化
watch(selectedCase, (newVal) => {
  if (newVal) {
    // 这里可以根据需求处理选中的用例
    console.log('选中的用例:', newVal);
  }
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
  gap: 10px;
  width: 100%;
}

/* 脑图输入框样式 */
.mindmap-input {
  width: 50%;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  resize: none;
  box-sizing: border-box;
}

/* 脑图SVG样式 */
.mindmap-svg {
  width: 50%;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-sizing: border-box;
  overflow: auto;
}
</style>
