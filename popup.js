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

// 加载已保存的值
chrome.storage.sync.get(['googleApiKey', 'baiduAppId', 'baiduKey'], function(data) {
  document.getElementById('googleApiKey').value = data.googleApiKey || '';
  document.getElementById('baiduAppId').value = data.baiduAppId || '';
  document.getElementById('baiduKey').value = data.baiduKey || '';
});
