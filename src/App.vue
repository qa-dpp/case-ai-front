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
          
          <div class="test-case-btn-container">
            <el-button
              v-if="analysisText.trim()"
              type="primary"
              @click="generateTestCase"
              class="generate-test-case-btn"
              :loading="isGeneratingTestCase"
            >
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

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { UploadFilled, Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { MdPreview, MdCatalog } from 'md-editor-v3';
// preview.css相比style.css少了编辑器那部分样式
import 'md-editor-v3/lib/preview.css';
  
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

// 生成测试用例
const generateTestCase = async () => {
  if (!analysisText.value.trim()) return;
  
  isGeneratingTestCase.value = true;
  testCaseResult.value = '';
  
  try {
    const response = await fetch('/ai-api/case/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: analysisText.value })
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
              const displayContent = jsonData.caseInfoMessage +'\n\n'+jsonData.caseFormatMessage+'\n\n'+ jsonData.caseReviewMessage;
              testCaseResult.value = displayContent;
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
