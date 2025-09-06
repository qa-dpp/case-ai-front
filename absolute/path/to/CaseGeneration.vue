// ... existing code ...
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = ''; // 创建缓冲区累积数据

while (true) {
  const { done, value } = await reader.read();
  if (done) {
    // 处理剩余的缓冲区数据
    if (buffer.trim()) {
      try {
        const jsonData = JSON.parse(buffer);
        processJsonData(jsonData);
      } catch (e) {
        console.error('解析最终数据失败:', e);
        testCaseResult.value = buffer;
      }
    }
    break;
  }

  const chunk = decoder.decode(value, { stream: true });
  buffer += chunk;

  // 尝试解析缓冲区中的JSON数据
  try {
    // 查找JSON对象的结束位置
    const jsonEndIndex = findJsonEndIndex(buffer);
    if (jsonEndIndex > -1) {
      const completeJson = buffer.substring(0, jsonEndIndex + 1);
      const jsonData = JSON.parse(completeJson);
      processJsonData(jsonData);

      // 移除已解析的部分，保留剩余数据
      buffer = buffer.substring(jsonEndIndex + 1);
    }
  } catch (e) {
    // 解析失败，继续累积数据
    console.error('解析部分数据失败，继续累积:', e);
  }
}
// ... existing code ...

// 添加辅助函数
function processJsonData(jsonData) {
  const displayContent = jsonData.caseInfoMessage +'\n\n'+jsonData.caseFormatMessage+'\n\n'+ jsonData.caseReviewMessage;
  testCaseResult.value = displayContent;
  if(jsonData.caseFormatMessage){
    testCaseofmarkdown.value = jsonData.caseInfoMessage;
    update();
  }
}

function findJsonEndIndex(buffer) {
  let braceCount = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];

    if (char === '"' && !escaped) {
      inString = !inString;
    }

    escaped = char === '\\' && !escaped;

    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return i;
        }
      }
    }
  }

  return -1;
}