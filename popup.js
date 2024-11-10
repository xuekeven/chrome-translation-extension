document.getElementById('saveButton').addEventListener('click', function() {
  const googleApiKey = document.getElementById('googleApiKey').value;
  const baiduAppId = document.getElementById('baiduAppId').value;
  const baiduKey = document.getElementById('baiduKey').value;

  chrome.storage.sync.set({
    googleApiKey: googleApiKey,
    baiduAppId: baiduAppId,
    baiduKey: baiduKey
  }, function() {
    const saveMessage = document.getElementById('saveMessage');
    saveMessage.style.fontWeight = 'bold';

    if (googleApiKey && (!baiduAppId || !baiduKey)) {
      saveMessage.textContent = '✔ 保存 Google API Key 成功，但保存百度翻译的 App ID 或 Key 失败。';
      saveMessage.style.color = 'orange';
    } else if (!googleApiKey && (baiduAppId && baiduKey)) {
      saveMessage.textContent = '✔ 保存百度翻译的 App ID 和 Key 成功，但保存 Google API Key 失败。';
      saveMessage.style.color = 'orange';
    } else if (googleApiKey && baiduAppId && baiduKey) {
      saveMessage.textContent = '✔ 所有 API 密钥保存成功。快去翻译试试吧！';
      saveMessage.style.color = 'green';
    } else {
      saveMessage.textContent = '❌ 保存失败，请确保至少填写了 Google API Key 或百度翻译的 App ID 和 Key。';
      saveMessage.style.color = 'red';
    }

    // 3秒后移除成功提示
    setTimeout(() => {
      saveMessage.textContent = '';
    }, 3000);
  });
});

// 加载已保存的值，默认以密码形式显示
chrome.storage.sync.get(['googleApiKey', 'baiduAppId', 'baiduKey'], function(data) {
  const inputs = ['googleApiKey', 'baiduAppId', 'baiduKey'];
  inputs.forEach(id => {
    const input = document.getElementById(id);
    input.type = 'password';
    input.value = data[id] || '';
  });
});

// 保存开关状态
document.getElementById('enableSwitch').addEventListener('change', function() {
  // 添加 user-interacted 类以启用过渡动画
  this.parentElement.classList.add('user-interacted');
  
  chrome.storage.sync.set({
    isEnabled: this.checked
  }, function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleTranslation",
          isEnabled: document.getElementById('enableSwitch').checked
        });
      }
    });
  });
});

// 加载已保存的开关状态
chrome.storage.sync.get(['isEnabled'], function(data) {
  const enableSwitch = document.getElementById('enableSwitch');
  // 如果从未设置过，默认为开启状态
  enableSwitch.checked = data.isEnabled !== undefined ? data.isEnabled : true;
  // 初始加载时不添加 user-interacted 类，这样就不会触发动画
});

// 添加切换密码可见性的功能
document.querySelectorAll('.toggle-visibility').forEach(button => {
  button.addEventListener('click', function() {
    const targetId = this.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (input.type === 'password') {
      input.type = 'text';
      this.textContent = '🔒';
    } else {
      input.type = 'password';
      this.textContent = '👁️';
    }
  });
});

// 保存直接翻译开关状态
document.getElementById('directTranslateSwitch').addEventListener('change', function() {
  this.parentElement.classList.add('user-interacted');
  
  chrome.storage.sync.set({
    directTranslate: this.checked
  }, function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleDirectTranslate",
          directTranslate: document.getElementById('directTranslateSwitch').checked
        });
      }
    });
  });
});

// 加载已保存的直接翻译开关状态
chrome.storage.sync.get(['directTranslate'], function(data) {
  const directTranslateSwitch = document.getElementById('directTranslateSwitch');
  // 默认为关闭状态
  directTranslateSwitch.checked = data.directTranslate || false;
});
