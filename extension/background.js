importScripts('templates.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'jjk-templates-main',
    title: 'JJK RP Templates',
    contexts: ['editable', 'page']
  });

  chrome.contextMenus.create({
    id: 'action-log-insert',
    parentId: 'jjk-templates-main',
    title: 'Action Log',
    contexts: ['editable', 'page']
  });

  chrome.contextMenus.create({
    id: 'tech-short-insert',
    parentId: 'jjk-templates-main',
    title: 'Техническая Сводка (Краткая)',
    contexts: ['editable', 'page']
  });

  chrome.contextMenus.create({
    id: 'tech-full-insert',
    parentId: 'jjk-templates-main',
    title: 'Техническая Сводка (Полная)',
    contexts: ['editable', 'page']
  });
  
  updateContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId;
  
  let template = null;
  
  if (menuId === 'action-log-insert') {
    template = TEMPLATES.ACTION_LOG;
  } else if (menuId === 'tech-short-insert') {
    template = TEMPLATES.TECH_SUMMARY_SHORT;
  } else if (menuId === 'tech-full-insert') {
    template = TEMPLATES.TECH_SUMMARY_FULL;
  } else if (menuId.startsWith('custom-')) {
    const templateId = menuId.replace('custom-', '');
    const result = await chrome.storage.local.get(['customTemplates']);
    const customTemplates = result.customTemplates || {};
    if (customTemplates[templateId]) {
      template = customTemplates[templateId].content;
    }
  }
  
  if (template) {
    await insertTemplateIntoTab(tab.id, template);
  }
});

async function insertTemplateIntoTab(tabId, template) {
  const checkContentScript = async () => {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return response && response.ready;
    } catch {
      return false;
    }
  };

  let isReady = await checkContentScript();
  
  if (!isReady) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      await new Promise(resolve => setTimeout(resolve, 150));
      isReady = await checkContentScript();
    } catch (injectError) {
      console.error('Не удалось инжектировать скрипт:', injectError);
      return;
    }
  }

  if (isReady) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'insertTemplate',
        template: template
      });
    } catch (error) {
      console.error('Ошибка вставки шаблона:', error);
    }
  }
}

async function updateContextMenu() {
  const result = await chrome.storage.local.get(['customTemplates']);
  const customTemplates = result.customTemplates || {};
  
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'jjk-templates-main',
      title: 'JJK RP Templates',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'action-log-insert',
      parentId: 'jjk-templates-main',
      title: 'Action Log',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'tech-short-insert',
      parentId: 'jjk-templates-main',
      title: 'Техническая Сводка (Краткая)',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'tech-full-insert',
      parentId: 'jjk-templates-main',
      title: 'Техническая Сводка (Полная)',
      contexts: ['editable', 'page']
    });
    
    for (const [id, template] of Object.entries(customTemplates)) {
      chrome.contextMenus.create({
        id: 'custom-' + id,
        parentId: 'jjk-templates-main',
        title: template.name,
        contexts: ['editable', 'page']
      });
    }
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.customTemplates) {
    updateContextMenu();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTemplate') {
    const templates = {
      'action-log': TEMPLATES.ACTION_LOG,
      'tech-short': TEMPLATES.TECH_SUMMARY_SHORT,
      'tech-full': TEMPLATES.TECH_SUMMARY_FULL
    };
    sendResponse({ template: templates[request.templateId] });
  }
  return true;
});

