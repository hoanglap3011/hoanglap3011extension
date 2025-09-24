const API_URL = 'https://script.google.com/macros/s/AKfycbyxgxsH9yJ4RzC-60Bi9BdSW6RoOsl0orc4IrBCXMBxyEkBacScI_FOEFk5f7kl502jBA/exec';
const CATEGORIES = ['Điều đang có', 'Sự giúp đỡ', 'Bài học', 'Tạo hoá', 'Điều vô hình', 'NVC', 'Khác'];
let entryCount = 0, quillInstances = {};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const byId = (id) => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const getLocalDatetime = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

document.addEventListener('DOMContentLoaded', () => {
    addEntry();
    byId('btnAdd').onclick = addEntry;
    byId('btnSubmit').onclick = submitData;
    byId('btnSavePass').onclick = savePass;
    const toggleBtn = byId('btnTogglePass');
    toggleBtn.onclick = togglePasswordInput;
    toggleBtn.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && togglePasswordInput();
    showPass();
    setTimeout(() => { if (!byId('txtPass').value) togglePasswordInput(); }, 1000);
});

function addEntry() {
    entryCount++;
    const container = byId('entriesContainer');
    const idx = container.querySelectorAll('.entry-item').length + 1;
    const entryId = entryCount;
    const catIdx = (idx - 1) % CATEGORIES.length;
    const entryDiv = document.createElement('div');
    entryDiv.className = 'entry-item';
    entryDiv.id = `entry-${entryId}`;
    entryDiv.innerHTML = `
        <div class="entry-header">
            <div style="display:flex;align-items:center;gap:12px;">
                <div class="entry-number">${idx}</div>
                <input type="datetime-local" id="time-${entryId}" value="${getLocalDatetime()}" style="min-width:200px;">
            </div>
            <div style="margin-left:auto;display:flex;gap:6px;">
                <button class="toggle-toolbar" data-entry-id="${entryId}" type="button" aria-label="Hiện/Ẩn thanh công cụ">▤</button>
                <button class="remove-entry" data-entry-id="${entryId}" type="button" aria-label="Xóa mục này">X</button>
            </div>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:12px;">
            <select id="category-${entryId}">
                ${CATEGORIES.map((c, i) => `<option${i === catIdx ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <div class="editor-container"><div id="editor-${entryId}"></div></div>
        </div>
    `;
    container.appendChild(entryDiv);
    quillInstances[entryId] = new Quill(`#editor-${entryId}`, {
        theme: 'snow',
        placeholder: 'Mời bạn chia sẻ ...',
        modules: { toolbar: [ ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], [{ indent: '-1' }, { indent: '+1' }], ['clean'] ] }
    });
    const toolbar = entryDiv.querySelector('.ql-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    entryDiv.querySelector('.toggle-toolbar').onclick = () => { if (toolbar) toolbar.style.display = toolbar.style.display === 'none' ? '' : 'none'; };
    entryDiv.querySelector('.remove-entry').onclick = () => removeEntry(entryId);
    updateRemoveButtons();
}

function removeEntry(id) {
    const el = byId(`entry-${id}`);
    if (el) el.remove();
    delete quillInstances[id];
    updateEntryNumbers();
    updateRemoveButtons();
}

function updateEntryNumbers() {
    $$('.entry-item').forEach((e, i) => e.querySelector('.entry-number').textContent = i + 1);
}

function updateRemoveButtons() {
    const btns = $$('.remove-entry');
    const show = btns.length > 1;
    btns.forEach(b => b.style.display = show ? 'flex' : 'none');
}

function collectData() {
    const key = byId('txtPass').value;
    const duLieu = [];
    $$('.entry-item').forEach((entry, i) => {
        const id = entry.id.split('-')[1];
        const time = byId(`time-${id}`).value;
        const cat = byId(`category-${id}`).value;
        const quill = quillInstances[id];
        if (quill) duLieu.push({ soThuTu: i + 1, thoiGian: time, theLoai: cat, noiDungText: quill.getText().trim(), noiDungHtml: quill.root.innerHTML });
    });
    return { tongSoMuc: duLieu.length, thoiGianTao: new Date().toISOString(), key, duLieu };
}

function validateData(d) {
    if (!d.duLieu.length) return 'Vui lòng thêm ít nhất một mục!';
    for (let i = 0; i < d.duLieu.length; i++) {
        const e = d.duLieu[i];
        if (!e.thoiGian) return `Vui lòng chọn thời gian cho mục ${i + 1}!`;
        if (!e.theLoai) return `Vui lòng chọn thể loại cho mục ${i + 1}!`;
        if (!e.noiDungText) return `Vui lòng nhập nội dung cho mục ${i + 1}!`;
    }
    return null;
}

async function submitData() {
    const data = collectData();
    const error = validateData(data);
    if (error) return showNotification(error, 'error');
    const btn = byId('btnSubmit');
    btn.disabled = true;
    btn.textContent = '🔄 Đang gửi...';
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
        const result = await res.json();
        if (result.code === 0) {
            showNotification(result.content, 'success');
            clearForm();
        } else throw new Error(result.error || 'Lỗi không xác định');
    } catch (e) {
        showNotification(`❌ Lỗi: ${e.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Gửi';
    }
}

function clearForm() {
    byId('entriesContainer').innerHTML = '';
    entryCount = 0;
    quillInstances = {};
    addEntry();
}

function showNotification(msg, type) {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 100);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}

function savePass() {
    const pass = byId('txtPass').value;
    if (!pass) return alert('Nhập pass');
    isExt() ? chrome.storage.local.set({ KEY: pass }) : localStorage.setItem('KEY', pass);
    togglePasswordInput();
}

function togglePasswordInput() {
    const d = byId('divPassword');
    d.style.display = d.style.display === 'none' ? 'block' : 'none';
    if (d.style.display === 'block') showPass();
}

function isExt() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

function showPass() {
    getStorage(['KEY'], r => { byId('txtPass').value = r['KEY'] || ''; });
}

function getStorage(keys, cb) {
    if (isExt()) chrome.storage.local.get(keys, cb);
    else {
        const r = {};
        keys.forEach(k => r[k] = localStorage.getItem(k));
        cb(r);
    }
}