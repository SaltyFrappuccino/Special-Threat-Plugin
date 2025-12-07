let lastActiveElement = null;

document.addEventListener('focusin', (e) => {
  lastActiveElement = e.target;
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ ready: true });
    return true;
  }
  
  if (request.action === 'insertTemplate') {
    insertTextIntoActiveElement(request.template);
    sendResponse({ success: true });
    return true;
  }
});

function insertTextIntoActiveElement(text) {
  let activeElement = document.activeElement || lastActiveElement;
  
  if (!isEditableElement(activeElement)) {
    activeElement = findFirstEditableElement();
  }
  
  if (!activeElement) {
    alert('Не найдено активное текстовое поле. Пожалуйста, установите курсор в поле ввода.');
    return;
  }
  
  if (activeElement.isContentEditable) {
    insertIntoContentEditable(activeElement, text);
  } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
    insertIntoTextarea(activeElement, text);
  }
  
  showNotification('Шаблон вставлен!');
}

function isEditableElement(element) {
  if (!element) return false;
  
  return (
    element.isContentEditable ||
    element.tagName === 'TEXTAREA' ||
    (element.tagName === 'INPUT' && 
     ['text', 'search', 'url', 'tel', 'email'].includes(element.type))
  );
}

function findFirstEditableElement() {
  const textarea = document.querySelector('textarea');
  if (textarea) return textarea;
  
  const input = document.querySelector('input[type="text"], input:not([type])');
  if (input) return input;
  
  const contentEditable = document.querySelector('[contenteditable="true"]');
  if (contentEditable) return contentEditable;
  
  return null;
}

function insertIntoTextarea(element, text) {
  const startPos = element.selectionStart;
  const endPos = element.selectionEnd;
  const currentValue = element.value;
  
  const newValue = 
    currentValue.substring(0, startPos) + 
    text + 
    currentValue.substring(endPos);
  
  element.value = newValue;
  
  const newCursorPos = startPos + text.length;
  element.setSelectionRange(newCursorPos, newCursorPos);
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  element.focus();
}

function insertIntoContentEditable(element, text) {
  element.focus();
  
  const selection = window.getSelection();
  
  if (selection.rangeCount === 0) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.addRange(range);
  }
  
  const range = selection.getRangeAt(0);
  range.deleteContents();
  
  const lines = text.split('\n');
  const fragment = document.createDocumentFragment();
  
  lines.forEach((line, index) => {
    fragment.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) {
      fragment.appendChild(document.createElement('br'));
    }
  });
  
  range.insertNode(fragment);
  
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 999999;
    animation: slideIn 0.3s ease-out;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => {
      document.body.removeChild(notification);
      document.head.removeChild(style);
    }, 300);
  }, 2000);
}

