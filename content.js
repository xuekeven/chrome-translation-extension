// 标记是否正在拖动弹出框
let isDragging = false;

// 存储拖动时鼠标相对于弹出框左上角的偏移量
let dragOffsetX, dragOffsetY;

// 存储最后选中的文本
let lastSelectedText = '';

// 在文件开头添加一个变量来存储开关状态
let isTranslationEnabled = true;

// 添加一个变量来存储当前正在翻译的单词
let currentTranslatingWord = '';

// 添加一个变量来存储直接翻译开关状态
let isDirectTranslateEnabled = false;

// 添加一个变量来存储是否正在等待翻译结果
let isWaitingForTranslateResult = false;

// 添加一个监听器来接收开关状态的更新
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "toggleTranslation") {
    isTranslationEnabled = request.isEnabled;
    // 如果关闭了翻译功能，清除所有已存在的翻译相关元素
    if (!isTranslationEnabled) {
      hideTranslateIcon();
      hideTranslatePopup();
    }
    return false; // 不需要异步响应
  }
  if (request.action === "toggleDirectTranslate") {
    isDirectTranslateEnabled = request.directTranslate;
    return false;
  }
  if (request.action === "playAudioInContent") {
    // 创建 AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 将数组转回 ArrayBuffer
    const arrayBuffer = new Uint8Array(request.audioData).buffer;
    
    // 解码音频数据
    audioContext.decodeAudioData(arrayBuffer, function(buffer) {
      // 创建音频源
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    }, function(error) {
      console.error('Error decoding audio data:', error);
    });
  }
  return false;
});

// 在初始化时获取开关状态
chrome.storage.sync.get(['isEnabled'], function(data) {
  isTranslationEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
});

// 在初始化时获取直接翻译开关状态
chrome.storage.sync.get(['directTranslate'], function(data) {
  isDirectTranslateEnabled = data.directTranslate || false;
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
    position: fixed;
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
  translateIcon.addEventListener('click', e => handleIconClick(e, x, y));
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
 * 处理翻译图标的点击事件
 * @param {Event} e - 点击事件对象
 */
function handleIconClick(e, x, y) {
  if (!isTranslationEnabled) return; // 如果翻译功能被禁用，直接返回

  e.preventDefault(); // 阻止默认行为
  e.stopPropagation(); // 阻止事件冒泡

  const iconRect = e.currentTarget.getBoundingClientRect();
  console.log('iconRect:', iconRect);
  translateText(lastSelectedText, iconRect.left, iconRect.top);

  // 在短暂延迟后重新选择文本
  setTimeout(() => {
    selectTextInDocument(lastSelectedText, x, y);
  }, 0);
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
    text-align: left;
    position: fixed;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08);
    max-width: 400px;
    cursor: move;
    font-family: Arial, sans-serif;
    left: ${x}px;
    top: ${y}px; // 添加当前滚动位置
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
 * 检查文本是否要翻译
 * @param {string} text - 要检查的文本
 * @returns {boolean} - 如果包含有意义的英文内容返回true，否则返回false
 */
function isTranslateable(text) {
    // 至少包含一个英文单词（1个或以上字母）的正则表达式
    const englishWordPattern = /[a-zA-Z]{1,}/;
  
    // 排除常见的无意义字符串模式
    const excludePatterns = [
      /^[0-9-]+$/, // 纯数字和连字符
      /^[a-f0-9-]{8,}$/i, // UUID类格式
      /^\d+$/, // 纯数字
      /^[^a-zA-Z]*$/ // 不包含任何英文字母的文本
    ];
  
    // 检查是否包含至少一个有意义的英文单词
    return englishWordPattern.test(text) && !excludePatterns.some(pattern => pattern.test(text));
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

  isWaitingForTranslateResult = true;
  chrome.runtime.sendMessage({action: "translate", text: text});
}

/**
 * 在文档中选择指定的文本
 * @param {string} text - 要选择的文本
 * @param {number} [x] - 目标位置的横坐标（可选）
 * @param {number} [y] - 目标位置的纵坐标（可选）
 */
function selectTextInDocument(text, x, y) {
  const selection = window.getSelection();
  selection.removeAllRanges();

  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  let closestNode = null;
  let closestIndex = -1;
  let closestDistance = Infinity;

  // 遍历所有文本节点
  while (node = treeWalker.nextNode()) {
    const index = node.textContent.indexOf(text);
    if (index > -1) {
      // 如果提供了坐标，计算距离并找到最近的节点
      if (x !== undefined && y !== undefined) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        const rect = range.getBoundingClientRect();
        
        // 计算节点中心点到目标位置的距离
        const nodeX = rect.left + rect.width / 2;
        const nodeY = rect.top + rect.height / 2 + window.scrollY;
        const distance = Math.sqrt(
          Math.pow(nodeX - x, 2) + 
          Math.pow(nodeY - y, 2)
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestNode = node;
          closestIndex = index;
        }
      } else {
        // 如果没有提供坐标，使用第一个匹配的节点
        closestNode = node;
        closestIndex = index;
        break;
      }
    }
  }

  // 如果找到了节点，创建选区
  if (closestNode) {
    const range = document.createRange();
    range.setStart(closestNode, closestIndex);
    range.setEnd(closestNode, closestIndex + text.length);
    selection.addRange(range);
  }
}

// 修改开始拖动、拖动和停止拖动的函数
let dragTarget = null;

function startDragging(e) {
  // 如果点击的是按钮、链接或文本内容，不触发拖动
  if (e.target.tagName.toLowerCase() === 'button' || 
      e.target.tagName.toLowerCase() === 'a' || 
      e.target.tagName.toLowerCase() === 'span' 
    ) {
    return;
  }

  // 获取最近的 translate-popup 父元素
  const popup = e.target.closest('.translate-popup');
  if (popup) {
    isDragging = true;
    dragTarget = popup;
    dragOffsetX = e.clientX - popup.offsetLeft;
    dragOffsetY = e.clientY - popup.offsetTop;
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
  // 如果选中的文本不是英文单词，则不进行翻译
  if (!selectedText || !isTranslateable(selectedText)) return;

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
  const x = e.x;
  const y = e.y + rect.height;

  if (isDirectTranslateEnabled) {
    // 清除选中状态，以便弹层和页面可以正常滚动
    window.getSelection().removeAllRanges();
    // 创建弹层并发送翻译请求
    translateText(selectedText, x, y);
    // 防止事件冒泡
    e.stopPropagation();
    // 在短暂延迟后重新选择文本
    setTimeout(() => {
      selectTextInDocument(selectedText, x, y);
    }, 0);
  } else {
    // 显示翻译图标
    saveAndRestoreSelection(() => {
      showTranslateIcon(x, y);
    });
  }
});

// 监听点击事件，用于隐藏翻译图标和弹出框
document.addEventListener('click', function(e) {
  // 然后检查translatePopup是否存在，如果存在且点击不在其内部，则隐藏它
  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) {
    hideTranslateIcon();
  }
  const translatePopup = document.querySelector('.translate-popup');
  if (translatePopup && !translatePopup.contains(e.target) && !isWaitingForTranslateResult) {
    hideTranslatePopup();
  }
});

// 修改消息监听器
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "translate") {
    if (!isTranslationEnabled) {
      sendResponse({text: null});
      return false;
    }
    var selectedText = window.getSelection().toString().trim();
    if (selectedText && isTranslateable(selectedText)) {
      sendResponse({text: selectedText});
    } else {
      sendResponse({text: null});
    }
    return false; // 不需要异步响应
  } else if (request.action === "updateTranslation") {
    isWaitingForTranslateResult = false;
    if (!isTranslationEnabled) return false;
    updateTranslatePopup(request.translation, request.word, request.complete);
    return false; // 不需要异步响应
  }
  return false; // 默认返回 false
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
      text-align: left;
      position: fixed;
      padding: 10px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 8px;
      width: 350px;
      max-height: 500px;
      z-index: 1000;
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
  
  // 修改播放按钮的击事件处理
  const playButtons = translatePopup.querySelectorAll('.playButton');
  playButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const word = this.getAttribute('data-word');
      const type = this.getAttribute('data-type');
      
      // 直接发送消息给 background 脚本播放音频
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

      // 播放新选择的音标发音
      if (currentTranslatingWord) {
        chrome.runtime.sendMessage({
          action: "playAudio",
          word: currentTranslatingWord,
          type: newPhonetic === 'us' ? 2 : 1  // 2代表美音，1代表英音
        });
      }
    });
  }

  // 为所有包含文本的元素添加样式
  const textElements = translatePopup.querySelectorAll('span');
  textElements.forEach(element => {
    if (element.textContent.trim()) {  // 只为包含文本的元素添加样式
      element.style.userSelect = 'text';  // 允许文本选择
      element.style.cursor = 'text';      // 文本光标
    } else {
      element.style.cursor = 'move';      // 空白区域显示移动光标
    }
  });

  // 在更新弹窗内容后，如果是完整的翻译结果且有单词，根据用户偏好自动播放发音
  if (complete && word) {
    // 获取用户的音标偏好
    chrome.storage.sync.get(['phoneticPreference'], function(result) {
      // 默认使用美音
      const preference = result.phoneticPreference || 'us';
      const type = preference === 'us' ? 2 : 1;  // 2代表美音，1代表英音
      
      // 发送播放音频消息
      chrome.runtime.sendMessage({
        action: "playAudio",
        word: word,
        type: type
      });
    });
  }
}
