
// 标记是否正在拖动弹出框
let isDragging = false;

// 存储拖动时鼠标相对于弹出框左上角的偏移量
let dragOffsetX, dragOffsetY;

// 存储最后选中的文本
let lastSelectedText = '';

// 用于延迟处理选择变化的定时器
let selectionTimeout = null;

// 标记是否已添加加载动画的样式
let loadingStyleAdded = false;

// 在文件开头添加一个变量来存储开关状态
let isTranslationEnabled = true;

// 添加一个变量来存储当前正在翻译的单词
let currentTranslatingWord = '';

// 添加一个监听器来接收开关状态的更新
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "toggleTranslation") {
    isTranslationEnabled = request.isEnabled;
    // 如果关闭了翻译功能，清除所有已存在的翻译相关元素
    if (!isTranslationEnabled) {
      hideTranslateIcon();
      hideTranslatePopup();
    }
  }
});

// 在初始化时获取开关状态
chrome.storage.sync.get(['isEnabled'], function(data) {
  isTranslationEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
});

// 添加这个新函数
function saveAndRestoreSelection(action) {
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  action();
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * 创建翻译图标
 * @param {number} x - 图标的横坐标
 * @param {number} y - 图标的纵坐标
 * @returns {HTMLElement} - 创建的翻译图标元素
 */
function createTranslateIcon(x, y) {
  const translateIcon = document.createElement('div');
  translateIcon.style.cssText = `
    position: absolute;
    width: 30px;
    height: 30px;
    background: #667eea;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    z-index: 1000;
    left: ${x}px;
    top: ${y}px;
  `;
  translateIcon.className = 'translate-icon';
  translateIcon.innerHTML = '<span style="color: white; font-weight: bold;">译</span>';
  translateIcon.addEventListener('click', handleIconClick);
  document.body.appendChild(translateIcon);
  console.log('Translate icon created at:', x, y); // 添加日志
  return translateIcon;
}

/**
 * 显示翻译图标
 * @param {number} x - 图标的横坐标
 * @param {number} y - 图标的纵坐标
 */
function showTranslateIcon(x, y) {
  // 移除可能存在的旧图标
  hideTranslateIcon();
  // 创建新图标
  createTranslateIcon(x, y);
}

/**
 * 隐藏翻译图标
 */
function hideTranslateIcon() {
  const existingIcon = document.querySelector('.translate-icon');
  if (existingIcon) {
    existingIcon.remove();
    console.log('Existing translate icon removed'); // 添加日志
  }
}

/**
 * 显示加载中的动画
 */
function showLoadingIcon() {
  const existingIcon = document.querySelector('.translate-icon');
  if (existingIcon) {
    existingIcon.innerHTML = '<div class="loading"></div>';
    if (!loadingStyleAdded) {
      const style = document.createElement('style');
      style.textContent = `
        .loading {
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top: 3px solid white;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      loadingStyleAdded = true;
    }
  }
}

/**
 * 处理翻译图标的点击事件
 * @param {Event} e - 点击事件对象
 */
function handleIconClick(e) {
  if (!isTranslationEnabled) return; // 如果翻译功能被禁用，直接返回

  e.preventDefault(); // 阻止默认行为
  e.stopPropagation(); // 阻止事件冒泡

  const iconRect = e.currentTarget.getBoundingClientRect();
  console.log('iconRect:', iconRect);
  translateText(lastSelectedText, iconRect.left, iconRect.top);

  // 在短暂延迟后重新选择文本
  setTimeout(() => {
    selectTextInDocument(lastSelectedText);
  }, 10);
}

/**
 * 创建翻译结果弹出框
 * @param {string} text - 翻译结果文本
 * @param {number} x - 弹出框的横坐标
 * @param {number} y - 弹出框的纵坐标
 * @returns {HTMLElement} - 创建的翻译结果弹出框元素
 */
function createTranslatePopup(text, x, y) {
  const translatePopup = document.createElement('div');
  translatePopup.style.cssText = `
    position: absolute;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08);
    max-width: 400px;
    cursor: move;
    font-family: Arial, sans-serif;
    left: ${x}px;
    top: ${y + window.scrollY}px; // 添加当前滚动位置
    overflow-y: auto;
    border-radius: 8px;
    width: 350px;
    max-height: 500px;
    z-index: 1000;
    cursor: move;
    line-height: 1.5;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  `;
  translatePopup.className = 'translate-popup';

  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.8);
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color 0.3s ease;
  `;
  closeButton.addEventListener('click', () => translatePopup.remove());
  closeButton.addEventListener('mouseover', function() {
    this.style.color = 'white';
  });
  closeButton.addEventListener('mouseout', function() {
    this.style.color = 'rgba(255,255,255,0.8)';
  });

  // 创建内容div
  const contentDiv = document.createElement('div');
  contentDiv.style.lineHeight = '1.4';
  contentDiv.style.cursor = 'auto';
  contentDiv.innerHTML = text; // 用 innerHTML 来渲染 HTML

  // 组装弹出框
  translatePopup.appendChild(closeButton);
  translatePopup.appendChild(contentDiv);
  document.body.appendChild(translatePopup);

  // 添加拖动事件监听器
  translatePopup.addEventListener('mousedown', startDragging);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDragging);

  // 添加一个用于更新内容的方法
  translatePopup.updateContent = function(newContent) {
    contentDiv.innerHTML = newContent;
  };

  return translatePopup;
}

/**
 * 显示翻译结果弹出框
 * @param {string} text - 翻译结果文本
 * @param {number} x - 弹出框的横坐标
 * @param {number} y - 弹出框的纵坐标
 */
function showTranslatePopup(text, x, y) {
  // 移除可能存在的旧弹出框
  hideTranslatePopup();
  
  // 创建新弹出框
  createTranslatePopup(text, x, y + window.scrollY); // 添加当前滚动位置

  hideTranslateIcon();

  // 在短暂延迟后重新选择文本
  setTimeout(() => {
    selectTextInDocument(lastSelectedText);
  }, 10);
}

/**
 * 隐藏翻译结果弹出框
 */
function hideTranslatePopup() {
  const existingPopup = document.querySelector('.translate-popup');
  if (existingPopup) {
    existingPopup.remove();
    currentTranslatingWord = ''; // 清除当前翻译的单词
  }
}

/**
 * 检查文本是否包含中文
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 如果包含中文返回true，否则返回false
 */
function isChinese(text) {
  // 使用正则表达式检查文本是否包含中文字符
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 检查文本是否为英文单词
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 如果是英文单词返回true，否则返回false
 */
function isEnglishWord(text) {
  return /^[a-zA-Z]+$/.test(text);
}

/**
 * 检查文本是否为英文句子
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 如果是英文句子返回true，否则返回false
 */
function isEnglishSentence(text) {
  // 使用正则表达式检查文本是否为英文句子
  return /^[A-Z][^.!?]*[.!?]$/.test(text);
}

/**
 * 发送翻译请求并显示结果
 * @param {string} text - 要翻译的文本
 * @param {number} x - 结果显示的横坐标
 * @param {number} y - 结果显示的纵坐标
 */
function translateText(text, x, y) {
  hideTranslateIcon(); // 隐藏翻译图标
  
  // 创建一个新的弹出框或获取现有的弹出框
  let popup = document.querySelector('.translate-popup');
  if (!popup) {
    popup = createTranslatePopup("正在翻译...", x, y);
  }
  
  chrome.runtime.sendMessage({action: "translate", text: text});
}

function updateTranslatePopup(newContent, word, complete) {
  currentTranslatingWord = word || ''; // 如果是句子翻译，word 可能为空

  const translatePopup = document.querySelector('.translate-popup');
  if (translatePopup && translatePopup.updateContent) {
    translatePopup.updateContent(newContent);
    
    if (complete) {
      // 添加按钮点击事件监听器（如果有的话）
      setTimeout(() => {
        const moreButtons = translatePopup.querySelectorAll('.moreButton');
        moreButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            const entryWord = button.getAttribute('data-word');
            window.open(`https://www.youdao.com/result?word=${encodeURIComponent(entryWord)}&lang=en`, '_blank');
          });
        });
      }, 0);
    }
  }
}

function hideLoadingIcon() {
  const existingIcon = document.querySelector('.translate-icon');
  if (existingIcon) {
    existingIcon.remove();
  }
}

/**
 * 在文档中选择指定的文本
 * @param {string} text - 要选的文本
 */
function selectTextInDocument(text) {
  const selection = window.getSelection();
  selection.removeAllRanges();

  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = treeWalker.nextNode()) {
    const index = node.textContent.indexOf(text);
    if (index > -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      selection.addRange(range);
      break;
    }
  }
}

// 修改开始拖动、拖动和停止拖动的函数
let dragTarget = null;

function startDragging(e) {
  if (e.target.style.cursor === 'move') {
    isDragging = true;
    dragTarget = e.target;
    dragOffsetX = e.clientX - dragTarget.offsetLeft;
    dragOffsetY = e.clientY - dragTarget.offsetTop;
  }
}

function drag(e) {
  if (isDragging && dragTarget) {
    dragTarget.style.left = (e.clientX - dragOffsetX) + 'px';
    dragTarget.style.top = (e.clientY - dragOffsetY) + 'px';
  }
}

function stopDragging() {
  isDragging = false;
  dragTarget = null;
}

// 修改鼠标释放事件监听器，添加开关状态检查
document.addEventListener('mouseup', function(e) {
  if (!isTranslationEnabled) return; // 如果翻译功能被禁用，直接返回

  const selectedText = window.getSelection().toString().trim();
  if (!selectedText || isChinese(selectedText)) return;

  // 检查选中的文本是否在翻译弹层内
  const translatePopup = document.querySelector('.translate-popup');
  const isInsidePopup = translatePopup && translatePopup.contains(e.target);

  // 如果在弹层内且选中的文本与当前翻译的单词相同，则不显示翻译图标
  if (isInsidePopup && selectedText === currentTranslatingWord) {
    return;
  }

  lastSelectedText = selectedText;
  const range = window.getSelection().getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const x = e.clientX;
  const y = window.pageYOffset + rect.bottom;
  saveAndRestoreSelection(() => {
    showTranslateIcon(x, y);
  });
});

// 监听点击事件，用于隐藏翻译图标和弹出框
document.addEventListener('click', function(e) {
  // 然后检查translatePopup是否存在，如果存在且点击不在其内部，则隐藏它
  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) {
    hideTranslateIcon();
  }
  const translatePopup = document.querySelector('.translate-popup');
  if (translatePopup && !translatePopup.contains(e.target)) {
    hideTranslatePopup();
  }
});

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "translate") {
    if (!isTranslationEnabled) {
      sendResponse({text: null});
      return;
    }
    var selectedText = window.getSelection().toString().trim();
    if (selectedText && !isChinese(selectedText)) {
      sendResponse({text: selectedText});
    } else {
      sendResponse({text: null});
    }
  } else if (request.action === "updateTranslation") {
    if (!isTranslationEnabled) return;
    updateTranslatePopup(request.translation, request.word, request.complete);
  } else if (request.action === "playAudioInContent") {
    if (!isTranslationEnabled) return;
    const audio = new Audio(request.audioUrl);
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
  }
  return true;
});

// 监听鼠标释放事件，用于处理拖动结束后的情况
document.addEventListener('mouseup', function() {
  if (isDragging) {
    isDragging = false;
    // 在拖动结束后，更新lastSelectedText为当前选中的文本
    lastSelectedText = window.getSelection().toString().trim();
  }
});

// 在 updateTranslatePopup 函数中添加事件监听
function updateTranslatePopup(translation, word, complete) {
  currentTranslatingWord = word || '';

  let translatePopup = document.querySelector('.translate-popup');
  
  if (!translatePopup) {
    translatePopup = document.createElement('div');
    translatePopup.className = 'translate-popup';
    translatePopup.style.cssText = `
      position: fixed;
      padding: 10px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 8px;
      width: 350px;
      max-height: 500px;
      z-index: 1000;
      cursor: move;
      line-height: 1.5;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
    `;
    document.body.appendChild(translatePopup);
    
    translatePopup.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);
  }
  
  translatePopup.innerHTML = translation;
  
  // 为播放按钮添加点击事件
  const playButtons = translatePopup.querySelectorAll('.playButton');
  playButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const word = this.getAttribute('data-word');
      const type = this.getAttribute('data-type');
      chrome.runtime.sendMessage({
        action: "playAudio",
        word: word,
        type: type
      });
    });
  });
  
  // 为查看更多按钮添加点击事件
  const moreButtons = translatePopup.querySelectorAll('.moreButton');
  moreButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const word = this.getAttribute('data-word');
      window.open(`https://dict.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`, '_blank');
    });
  });

  // 为音标切换按钮添加点击事件
  const flagSwitcher = translatePopup.querySelector('.flagSwitcher');
  if (flagSwitcher) {
    flagSwitcher.addEventListener('click', function(e) {
      e.stopPropagation();
      const currentPhonetic = this.getAttribute('data-current');
      const newPhonetic = currentPhonetic === 'us' ? 'uk' : 'us';
      
      // 更新显示状态
      const ukButton = translatePopup.querySelector('[data-phonetic="uk"]');
      const usButton = translatePopup.querySelector('[data-phonetic="us"]');
      
      if (newPhonetic === 'uk') {
        ukButton.style.display = '';
        usButton.style.display = 'none';
        this.textContent = '🇬🇧';
      } else {
        ukButton.style.display = 'none';
        usButton.style.display = '';
        this.textContent = '🇺🇸';
      }
      
      // 保存用户偏好
      chrome.storage.sync.set({ phoneticPreference: newPhonetic });
      this.setAttribute('data-current', newPhonetic);
    });
  }
}
