// Cấu hình
const API_URL = 'https://script.google.com/macros/s/AKfycbxWKZLv9ch5MOWZCgvSVOQZUk4ilBnpn28F2iPgwgDwUE0Z2aNXdUl8D9DuSrbdM5ccCQ/exec'; // TODO: Thay đổi URL này
const CATEGORIES = [    
    { value: 'Điều đang có', text: 'Điều đang có' },
    { value: 'Sự giúp đỡ', text: 'Sự giúp đỡ' },
    { value: 'Bài học', text: 'Bài học' },
    { value: 'Tạo hoá', text: 'Tạo hoá' },
    { value: 'Điều vô hình', text: 'Điều vô hình' },
    { value: 'NVC', text: 'NVC' },
    { value: 'Khác', text: 'Khác' }
];

// State
let entryCount = 0;
let quillInstances = {};

// Helper: return a string suitable for <input type="datetime-local"> in the user's local timezone
function getLocalDatetimeLocalValue(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Khởi tạo
document.addEventListener('DOMContentLoaded', init);

function init() {
    addEntry();
    document.getElementById('add-btn').onclick = addEntry;
    document.getElementById('submit-btn').onclick = submitData;
    document.getElementById('btnSavePass').onclick = savePass;
    document.getElementById('togglePassBtn').onclick = togglePasswordInput;
    document.getElementById('togglePassBtn').onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') togglePasswordInput();
    };
    showPass();
    setTimeout(() => {
        const pass = document.getElementById("txtPass").value;
        if (!pass) togglePasswordInput();
    }, 1000);
}

function addEntry() {
    entryCount++;
    const container = document.getElementById('entries-container');
    const now = getLocalDatetimeLocalValue();
    const displayIndex = container.querySelectorAll('.gratitude-entry').length + 1;
    const entryId = entryCount;

    const selectedCategoryIndex = (displayIndex - 1) % CATEGORIES.length;
    const optionsHtml = CATEGORIES.map((cat, idx) =>
        `<option value="${cat.value}"${idx === selectedCategoryIndex ? ' selected' : ''}>${cat.text}</option>`
    ).join('');

    const entryDiv = document.createElement('div');
    entryDiv.className = 'gratitude-entry';
    entryDiv.id = `entry-${entryId}`;
    entryDiv.innerHTML = `
    <div class="entry-header">
        <div style="display:flex;align-items:center;gap:12px;">
            <div class="entry-number">${displayIndex}</div>
            <input type="datetime-local" id="time-${entryId}" value="${now}" style="min-width:200px;">
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="toggle-toolbar" data-entry-id="${entryId}" type="button" aria-label="Hiện/Ẩn thanh công cụ">▤</button>
            <button class="remove-entry" data-entry-id="${entryId}" type="button" aria-label="Xóa mục này">X</button>
        </div>
    </div>
    <div class="form-group" style="display:none;align-items:center;gap:12px;">
        <select id="category-${entryId}">
            ${optionsHtml}
        </select>
    </div>
    <div class="form-group">
        <div class="editor-container">
            <div id="editor-${entryId}"></div>
        </div>
    </div>
    `;

    container.appendChild(entryDiv);

    const toolbarOptions = [
        ['bold', 'italic', 'underline'],        // toggled buttons
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
        ['clean']                                         // remove formatting button
        ];


    // Khởi tạo Quill editor (dùng toolbar mặc định)
    quillInstances[entryId] = new Quill(`#editor-${entryId}`, {
        theme: 'snow',
        placeholder: 'Hãy chia sẻ điều bạn hài lòng ...',
        modules: {
            toolbar: toolbarOptions
        }
    });

    // Ẩn toolbar mặc định
    const toolbar = entryDiv.querySelector('.ql-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    // Toggle toolbar
    entryDiv.querySelector('.toggle-toolbar').onclick = () => {
        if (toolbar) toolbar.style.display = (toolbar.style.display === 'none') ? '' : 'none';
    };

    // Xóa entry
    entryDiv.querySelector('.remove-entry').onclick = () => removeEntry(entryId);

    updateRemoveButtons();
}

function removeEntry(entryId) {
    const el = document.getElementById(`entry-${entryId}`);
    if (el) el.remove();
    delete quillInstances[entryId];
    updateEntryNumbers();
    updateRemoveButtons();
}

function updateEntryNumbers() {
    document.querySelectorAll('.gratitude-entry').forEach((entry, idx) => {
        entry.querySelector('.entry-number').textContent = idx + 1;
    });
}

function updateRemoveButtons() {
    const buttons = document.querySelectorAll('.remove-entry');
    const shouldShow = buttons.length > 1;
    buttons.forEach(btn => btn.style.display = shouldShow ? 'flex' : 'none');
}

function collectData() {
    const keyParam = document.getElementById('txtPass').value;
    const entries = [];
    document.querySelectorAll('.gratitude-entry').forEach((entry, idx) => {
        const entryId = entry.id.split('-')[1];
        const time = entry.querySelector(`#time-${entryId}`).value;
        const category = entry.querySelector(`#category-${entryId}`).value;
        const quill = quillInstances[entryId];
        if (quill) {
            entries.push({
                soThuTu: idx + 1,
                thoiGian: time,
                theLoai: category,
                noiDungText: quill.getText().trim(),
                noiDungHtml: quill.root.innerHTML
            });
        }
    });
    return {
        tongSoMuc: entries.length,
        thoiGianTao: new Date().toISOString(),
        key: keyParam,
        duLieu: entries
    };
}

function validateData(data) {
    if (!data.duLieu.length) return 'Vui lòng thêm ít nhất một mục!';
    for (let i = 0; i < data.duLieu.length; i++) {
        const entry = data.duLieu[i];
        if (!entry.thoiGian) return `Vui lòng chọn thời gian cho mục ${i + 1}!`;
        if (!entry.theLoai) return `Vui lòng chọn thể loại cho mục ${i + 1}!`;
        if (!entry.noiDungText) return `Vui lòng nhập nội dung cho mục ${i + 1}!`;
    }
    return null;
}

async function submitData() {
    const data = collectData();
    const error = validateData(data);
    if (error) return showNotification(error, 'error');

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '🔄 Đang gửi...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.code === 0) {
            showNotification(result.content, "success");
            clearForm();
        } else {
            throw new Error(result.error || 'Lỗi không xác định');
        }
    } catch (error) {
        showNotification(`❌ Lỗi: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Gửi';
    }
}

function clearForm() {
    document.getElementById('entries-container').innerHTML = '';
    entryCount = 0;
    quillInstances = {};
    addEntry();
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function savePass() {
    const pass = document.getElementById('txtPass').value;
    if (!pass) {
        alert("Nhập pass");
        return;
    }
    if (isExtensionEnv()) {
        chrome.storage.local.set({ KEY: pass });
    } else {
        localStorage.setItem("KEY", pass);
    }
    togglePasswordInput();
}

function togglePasswordInput() {
    const divPassword = document.getElementById('divPassword');
    divPassword.style.display = (divPassword.style.display === 'none') ? 'block' : 'none';
    if (divPassword.style.display === 'block') showPass();
}

function isExtensionEnv() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}

function showPass() {
    getStorage(["KEY"], result => {
        document.getElementById("txtPass").value = result["KEY"] || "";
    });
}

function getStorage(keys, cb) {
    if (isExtensionEnv()) {
        chrome.storage.local.get(keys, cb);
    } else {
        const result = {};
        keys.forEach(k => result[k] = localStorage.getItem(k));
        cb(result);
    }
}