const BUILTIN_TEMPLATES = {
  'action-log': { name: 'Action Log', template: null },
  'tech-short': { name: 'Техническая Сводка (Краткая)', template: null },
  'tech-full': { name: 'Техническая Сводка (Полная)', template: null }
};

let customTemplates = {};
let editingTemplateId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadBuiltinTemplates();
  await loadCustomTemplates();
  renderTemplates();
  
  document.getElementById('add-template-btn').addEventListener('click', () => {
    openTemplateModal();
  });
  
  document.getElementById('cancel-btn').addEventListener('click', () => {
    closeTemplateModal();
  });
  
  document.getElementById('template-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveTemplate();
  });

  document.getElementById('template-modal').addEventListener('click', (e) => {
    if (e.target.id === 'template-modal') {
      closeTemplateModal();
    }
  });
});

async function loadBuiltinTemplates() {
  for (const [id, data] of Object.entries(BUILTIN_TEMPLATES)) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTemplate',
        templateId: id
      });
      BUILTIN_TEMPLATES[id].template = response.template;
    } catch (error) {
      console.error('Ошибка загрузки шаблона:', error);
    }
  }
}

async function loadCustomTemplates() {
  const result = await chrome.storage.local.get(['customTemplates']);
  customTemplates = result.customTemplates || {};
}

async function saveCustomTemplates() {
  await chrome.storage.local.set({ customTemplates });
}

function renderTemplates() {
  const builtinContainer = document.getElementById('builtin-templates');
  const customContainer = document.getElementById('custom-templates');
  
  builtinContainer.innerHTML = '';
  customContainer.innerHTML = '';
  
  for (const [id, data] of Object.entries(BUILTIN_TEMPLATES)) {
    if (data.template) {
      const card = createTemplateCard(id, data.name, false);
      builtinContainer.appendChild(card);
    }
  }
  
  for (const [id, template] of Object.entries(customTemplates)) {
    const card = createTemplateCard(id, template.name, true);
    customContainer.appendChild(card);
  }
  
  if (Object.keys(customTemplates).length === 0) {
    customContainer.innerHTML = '<div class="empty-state">Нет пользовательских шаблонов</div>';
  }
}

function createTemplateCard(id, name, isCustom) {
  const card = document.createElement('div');
  card.className = 'template-card';
  
  const content = document.createElement('div');
  content.className = 'template-card-content';
  
  const title = document.createElement('div');
  title.className = 'template-title';
  title.textContent = name;
  
  const actions = document.createElement('div');
  actions.className = 'template-actions';
  
  const insertBtn = document.createElement('button');
  insertBtn.className = 'btn insert-btn';
  insertBtn.innerHTML = '<span>Вставить</span>';
  insertBtn.addEventListener('click', () => insertTemplate(id, isCustom));
  
  actions.appendChild(insertBtn);
  
  if (isCustom) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn edit-btn';
    editBtn.innerHTML = '<span>Изменить</span>';
    editBtn.addEventListener('click', () => editTemplate(id));
    actions.appendChild(editBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn delete-btn';
    deleteBtn.innerHTML = '<span>Удалить</span>';
    deleteBtn.addEventListener('click', () => deleteTemplate(id));
    actions.appendChild(deleteBtn);
  }
  
  content.appendChild(title);
  content.appendChild(actions);
  card.appendChild(content);
  
  return card;
}

async function insertTemplate(id, isCustom) {
  try {
    let template;
    
    if (isCustom) {
      template = customTemplates[id].content;
    } else {
      const response = await chrome.runtime.sendMessage({
        action: 'getTemplate',
        templateId: id
      });
      template = response.template;
    }
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const checkContentScript = async () => {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        return response && response.ready;
      } catch {
        return false;
      }
    };

    let isReady = await checkContentScript();
    
    if (!isReady) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        await new Promise(resolve => setTimeout(resolve, 150));
        isReady = await checkContentScript();
      } catch (injectError) {
        showNotification('Ошибка: расширение не может работать на этой странице', 'error');
        return;
      }
    }

    if (isReady) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'insertTemplate',
          template: template
        });
        showNotification('Шаблон вставлен!', 'success');
        setTimeout(() => window.close(), 500);
      } catch (error) {
        showNotification('Ошибка вставки', 'error');
      }
    } else {
      showNotification('Не удалось подключиться к странице', 'error');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showNotification('Произошла ошибка!', 'error');
  }
}

function openTemplateModal(templateId = null) {
  editingTemplateId = templateId;
  const modal = document.getElementById('template-modal');
  const form = document.getElementById('template-form');
  const header = document.getElementById('modal-header');
  const nameInput = document.getElementById('template-name');
  const contentInput = document.getElementById('template-content');
  
  if (templateId && customTemplates[templateId]) {
    header.textContent = 'Изменить шаблон';
    nameInput.value = customTemplates[templateId].name;
    contentInput.value = customTemplates[templateId].content;
  } else {
    header.textContent = 'Создать шаблон';
    form.reset();
  }
  
  modal.classList.add('show');
  setTimeout(() => {
    nameInput.focus();
  }, 100);
}

function closeTemplateModal() {
  const modal = document.getElementById('template-modal');
  modal.classList.remove('show');
  editingTemplateId = null;
  document.getElementById('template-form').reset();
}

async function saveTemplate() {
  const name = document.getElementById('template-name').value.trim();
  const content = document.getElementById('template-content').value.trim();
  
  if (!name || !content) {
    showNotification('Заполните все поля', 'error');
    return;
  }
  
  if (editingTemplateId) {
    customTemplates[editingTemplateId].name = name;
    customTemplates[editingTemplateId].content = content;
    showNotification('Шаблон изменен', 'success');
  } else {
    const id = 'custom_' + Date.now();
    customTemplates[id] = { name, content };
    showNotification('Шаблон создан', 'success');
  }
  
  await saveCustomTemplates();
  renderTemplates();
  closeTemplateModal();
}

function editTemplate(id) {
  openTemplateModal(id);
}

async function deleteTemplate(id) {
  if (confirm('Удалить этот шаблон?')) {
    delete customTemplates[id];
    await saveCustomTemplates();
    renderTemplates();
    showNotification('Шаблон удален', 'success');
  }
}

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = 'notification ' + type;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}
