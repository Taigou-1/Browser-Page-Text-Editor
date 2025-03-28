let originalHTML = '';
let fileHandle = null;
let modifiedElements = new Map();

let lasttarget=null;    //记录上一次编辑的元素

// 初始化样式
const style = document.createElement('style');
style.textContent = `
  .editable-highlight {
    background: #fff3cd !important;
    outline: 2px solid #ffc107 !important;
  }
  #editorSaveBtn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    padding: 12px 24px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    display: none;
  }
`;
document.head.appendChild(style);

// 创建保存按钮
const saveBtn = document.createElement('button');
saveBtn.id = 'editorSaveBtn';
saveBtn.textContent = '💾 保存修改';
document.body.appendChild(saveBtn);

// 初始化文件访问
async function initFileAccess() {
  try {
    [fileHandle] = await window.showOpenFilePicker({
      types: [{ accept: {'text/html': ['.html']} }],
      multiple: false
    });
    
    const file = await fileHandle.getFile();
    originalHTML = await file.text();
    initEditing();
    
  } catch (error) {
    console.log('文件选择已取消');
  }
}

// 初始化编辑功能
function initEditing() {
  // 双击选择文本块
  document.addEventListener('dblclick', handleDoubleClick);
  
  // 保存按钮事件
  saveBtn.onclick = saveChanges;
  
  // 全局输入监听
  document.addEventListener('input', handleTextInput);
}

// 双击处理
function handleDoubleClick(e) {
  if(lasttarget) lasttarget.classList.remove('editable-highlight');
  if(lasttarget) lasttarget.contentEditable = false;
  const target = getEditableElement(e.target);
  lasttarget=target;
  target.contentEditable = true;
  if (!target) return;
  //console.log('target:', target);
  // 高亮目标元素
  target.classList.add('editable-highlight');
  //console.log('xpath:', getXPath(target));
  modifiedElements.set(target, {
    original: target.innerHTML,
    xpath: getXPath(target)
  });

  // 显示保存按钮
  saveBtn.style.display = 'block';
}

// 获取可编辑元素
function getEditableElement(node) {
  let element = node.nodeType === Node.TEXT_NODE ? 
    node.parentElement : 
    node;
  
  const allowedTags = ['P', 'DIV', 'SPAN', 'H1', 'H2', 'H3', 'LI'];
  while (element && !allowedTags.includes(element.tagName)) {
    element = element.parentElement;
  }
  
  return element?.textContent?.trim() ? element : null;
}

// 输入事件处理
function handleTextInput(e) {
  const target = getEditableElement(e.target);
  if (!target) return;

  // 更新修改记录
  if (modifiedElements.has(target)) {
    modifiedElements.get(target).modified = target.innerHTML;
  }
}

// 生成XPath
function getXPath(element) {
  const path = [];
  for (; element && element.nodeType === 1; element = element.parentNode) {
    let index = 0;
    for (let sib = element.previousSibling; sib; sib = sib.previousSibling) {
      if (sib.nodeType === 1 && sib.tagName === element.tagName) index++;
    }
    path.unshift(`${element.tagName.toLowerCase()}${index ? `[${index + 1}]` : ''}`);
  }
  return path.length ? `/${path.join('/')}` : null;
}

// 保存修改
async function saveChanges() {
  if (!fileHandle || modifiedElements.size === 0) return;

  // 创建新的DOMParser实例保持原始结构
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalHTML, 'text/html');
  const serializer = new XMLSerializer();
  
  // 遍历所有修改项
  modifiedElements.forEach(({ original, modified, xpath }) => {
    if (!modified || modified === original) return;

    // 使用XPath精准定位节点
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE
    );
    
    const targetNode = result.singleNodeValue;
    if (targetNode) {
      // 直接替换节点内容
      const tempDiv = doc.createElement('div');
      tempDiv.innerHTML = modified;
      
      // 保留原始标签结构，仅替换内容
      while (targetNode.firstChild) {
        targetNode.removeChild(targetNode.firstChild);
      }
      while (tempDiv.firstChild) {
        targetNode.appendChild(tempDiv.firstChild);
      }
    }
  });

  // 生成新内容（保留DOCTYPE声明）
  const newContent = `<!DOCTYPE html>\n${serializer.serializeToString(doc.documentElement)}`;
  
  // 写入文件
  const writable = await fileHandle.createWritable();
  await writable.write(newContent);
  await writable.close();

  // 重置状态
  modifiedElements.clear();
  document.querySelectorAll('.editable-highlight').forEach(el => 
    el.classList.remove('editable-highlight')
  );
  saveBtn.style.display = 'none';
  window.location.reload();
}

// 初始化入口
const initBtn = document.createElement('button');
initBtn.textContent = '📂 打开本地HTML文件';
initBtn.style = `
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 99999;
  padding: 12px 24px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;
initBtn.onclick = initFileAccess;
document.body.appendChild(initBtn);