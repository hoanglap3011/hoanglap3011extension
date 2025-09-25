// --- Config ---
const API_URL = 'https://your-api-url.com/submit';
const API_TYPE_URL = 'https://your-api-url.com/get-types';
const TYPE_KEYS = ['loai0', 'loai1', 'loai2', 'loai3'];

let entryCount = 0;
let quillInstances = {};
let choicesInstances = {};
let useServer = true;

// --- Storage helpers ---
function isExtensionEnv() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}
function getStorage(keys, cb) {
    if (isExtensionEnv()) chrome.storage.local.get(keys, cb);
    else {
        const result = {};
        keys.forEach(k => result[k] = JSON.parse(localStorage.getItem(k) || '[]'));
        cb(result);
    }
}
function setStorage(obj, cb) {
    if (isExtensionEnv()) chrome.storage.local.set(obj, cb);
    else {
        Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
        cb && cb();
    }
}

// --- DOM helpers ---
const byId = id => document.getElementById(id);
const setBtnEmoji = (id, emoji) => byId(id).innerHTML = emoji;

// --- UI Init ---
document.addEventListener('DOMContentLoaded', () => {
    // Set emoji for buttons
    setBtnEmoji('addBtn', '➕');
    setBtnEmoji('submitBtn', '💾');
    setBtnEmoji('updateTypeBtn', '🔄');

    // Button events
    byId('addBtn').onclick = addEntry;
    byId('submitBtn').onclick = submitData;
    byId('btnSavePass').onclick = savePass;
    byId('updateTypeBtn').onclick = updateTypesFromAPI;
    byId('serverSwitch').onchange = e => useServer = e.target.checked;

    showPass();
    setTimeout(() => { if (!byId("txtPass").value) togglePasswordInput(); }, 1000);

    addEntry();
    initLoai0Select();
    reloadLoai0Combobox();
});

// --- Loai0 Select Init ---
function initLoai0Select() {
    getStorage(['loai0'], types => {
        const select = byId('loai0Select');
        updateSelectOptions(select, types.loai0 || []);
        if (!select.choices) {
            select.choices = new Choices(select, {
                removeItemButton: true,
                shouldSort: false,
                duplicateItemsAllowed: false,
                addItems: true,
                addItemFilter: v => !!v.trim(),
                closeOnSelect: true
            });
        } else {
            select.choices.clearChoices();
            select.choices.setChoices((types.loai0 || []).map(v => ({value: v, label: v})), 'value', 'label', true);
        }
    });
}

// --- Entry logic ---
function addEntry() {
    entryCount++;
    const container = byId('entriesContainer');
    const entryId = entryCount;
    const entryDiv = document.createElement('div');
    entryDiv.className = 'vg-entry';
    entryDiv.id = `vg-entry-${entryId}`;
    entryDiv.innerHTML = `
        <div class="vg-entry-header">
            <div class="vg-entry-number">${container.querySelectorAll('.vg-entry').length + 1}</div>
            <div class="vg-entry-actions">
                <button class="toggle-toolbar" data-entry-id="${entryId}" type="button" aria-label="Hiện/Ẩn thanh công cụ">▤</button>
                <button class="remove-entry" data-entry-id="${entryId}" type="button" aria-label="Xóa vùng này">X</button>
            </div>
        </div>
        ${[1,2,3].map(i=>`<div class="form-group"><select id="type${i}-${entryId}" multiple></select></div>`).join('')}
        <div class="form-group"><div class="editor-container"><div id="editor-${entryId}"></div></div></div>
    `;
    container.appendChild(entryDiv);

    // Init Choices.js cho loai1, loai2, loai3
    getStorage(['loai1','loai2','loai3'], types => {
        choicesInstances[entryId] = [1,2,3].map(i => {
            const select = entryDiv.querySelector(`#type${i}-${entryId}`);
            updateSelectOptions(select, types[`loai${i}`] || []);
            const choices = new Choices(select, {
                removeItemButton: true,
                shouldSort: false,
                duplicateItemsAllowed: false,
                addItems: true,
                addItemFilter: v => !!v.trim(),
                closeOnSelect: true
            });
            select.addEventListener('change', () => setTimeout(() => {
                const input = select.closest('.choices')?.querySelector('input');
                if (input) input.blur();
            }, 0));
            return choices;
        });
    });

    // Init Quill
    quillInstances[entryId] = new Quill(`#editor-${entryId}`, {
        theme: 'snow',
        placeholder: 'Nhập nội dung...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'indent': '-1'}, { 'indent': '+1' }],
                ['clean']
            ]
        }
    });

    // Hide toolbar by default
    const toolbar = entryDiv.querySelector('.ql-toolbar');
    if (toolbar) toolbar.style.display = 'none';

    // Toggle toolbar
    entryDiv.querySelector('.toggle-toolbar').onclick = () => {
        if (toolbar) toolbar.style.display = (toolbar.style.display === 'none') ? '' : 'none';
    };

    // Remove entry
    entryDiv.querySelector('.remove-entry').onclick = () => removeEntry(entryId);

    updateRemoveButtons();
    updateEntryNumbers();

    setTimeout(() => quillInstances[entryId].focus(), 200);

    // Gắn sự kiện togglePasswordInput cho entry-number đầu tiên
    if (entryId === 1) {
        const entryNumber = document.querySelector('.vg-entry-number');
        if (entryNumber) {
            entryNumber.style.cursor = 'pointer';
            entryNumber.onclick = togglePasswordInput;
        }
    }
}

function removeEntry(entryId) {
    byId(`vg-entry-${entryId}`)?.remove();
    delete quillInstances[entryId];
    delete choicesInstances[entryId];
    updateEntryNumbers();
    updateRemoveButtons();
}

function updateEntryNumbers() {
    document.querySelectorAll('.vg-entry').forEach((entry, idx) => {
        entry.querySelector('.vg-entry-number').textContent = idx + 1;
    });
}
function updateRemoveButtons() {
    const buttons = document.querySelectorAll('.remove-entry');
    const show = buttons.length > 1;
    buttons.forEach(btn => btn.style.display = show ? 'flex' : 'none');
}

// --- Password logic ---
function savePass() {
    const pass = byId('txtPass').value;
    if (!pass) return alert("Nhập pass");
    isExtensionEnv()
        ? chrome.storage.local.set({ KEY: pass })
        : localStorage.setItem("KEY", pass);
    togglePasswordInput();
}
function togglePasswordInput() {
    const divPassword = byId('divPassword');
    divPassword.style.display = (divPassword.style.display === 'none') ? 'block' : 'none';
    if (divPassword.style.display === 'block') showPass();
}
function showPass() {
    if (isExtensionEnv()) {
        chrome.storage.local.get(["KEY"], r => byId("txtPass").value = r["KEY"] || "");
    } else {
        byId("txtPass").value = localStorage.getItem("KEY") || "";
    }
}

// --- Data collect & validate ---
function collectData() {
    const keyParam = byId('txtPass').value;
    const entries = [];
    document.querySelectorAll('.vg-entry').forEach((entry, idx) => {
        const entryId = entry.id.split('-')[2];
        const types = [1,2,3].map(i =>
            Array.from(entry.querySelector(`#type${i}-${entryId}`).selectedOptions).map(opt => opt.value)
        );
        const quill = quillInstances[entryId];
        if (quill) entries.push({
            soThuTu: idx + 1,
            loai1: types[0],
            loai2: types[1],
            loai3: types[2],
            noiDungText: quill.getText().trim(),
            noiDungHtml: quill.root.innerHTML
        });
    });
    return {
        tongSoMuc: entries.length,
        thoiGianTao: new Date().toISOString(),
        key: keyParam,
        duLieu: entries
    };
}
function validateData(data) {
    if (!data.duLieu.length) return 'Vui lòng thêm ít nhất một vùng!';
    for (let i = 0; i < data.duLieu.length; i++) {
        if (!data.duLieu[i].noiDungText) return `Vui lòng nhập nội dung cho vùng ${i + 1}!`;
    }
    return null;
}

// --- Submit ---
async function submitData() {
    const data = collectData();
    const error = validateData(data);
    if (error) return showNotification(error, 'error');
    console.log('Dữ liệu gửi lên server:', data);

    const btn = byId('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '🔄';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.code === 0) {
            showNotification(result.content || "Đã lưu thành công!", "success");
            clearForm();
            showCongrats();
        } else {
            throw new Error(result.error || 'Lỗi không xác định');
        }
    } catch (error) {
        showNotification(`❌ Lỗi: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '💾';
    }
}

function clearForm() {
    byId('entriesContainer').innerHTML = '';
    entryCount = 0;
    quillInstances = {};
    choicesInstances = {};
    addEntry();
}

// --- Notification ---
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

// --- Confetti ---
function showCongrats() {
    const overlay = byId('congratsOverlay');
    const canvas = byId('confettiCanvas');
    overlay.style.display = 'flex';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    startConfetti(canvas);
    setTimeout(() => {
        overlay.style.display = 'none';
        stopConfetti();
    }, 2200);
}
let confettiAnimationId = null, confettiParticles = [];
function startConfetti(canvas) {
    const ctx = canvas.getContext('2d');
    const colors = ['#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6','#facc15','#38bdf8'];
    confettiParticles = Array.from({length: 120}, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * 40 + 10,
        color: colors[Math.floor(Math.random()*colors.length)],
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltAngleIncremental: (Math.random() * 0.07) + 0.05
    }));
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confettiParticles.forEach(p => {
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r/3, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.d/3);
            ctx.stroke();
        });
        confettiParticles.forEach(p => {
            p.y += (Math.cos(p.d) + 3 + p.r/2) / 2;
            p.x += Math.sin(0.01 * p.d);
            p.tiltAngle += p.tiltAngleIncremental;
            p.tilt = Math.sin(p.tiltAngle) * 15;
            if (p.y > canvas.height) {
                p.x = Math.random() * canvas.width;
                p.y = -10;
            }
        });
        confettiAnimationId = requestAnimationFrame(draw);
    }
    draw();
}
function stopConfetti() {
    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
    const canvas = byId('confettiCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// --- Loại ---
function genRandomTypes() {
    setStorage({
        loai0: ['Chung', 'Riêng', 'Khẩn'],
        loai1: ['Công việc', 'Gia đình', 'Sức khoẻ'],
        loai2: ['Bạn bè', 'Học tập', 'Thể thao'],
        loai3: ['Du lịch', 'Sách', 'Âm nhạc']
    }, () => {
        showNotification('Đã sinh loại mẫu!', 'success');
        reloadAllComboboxes();
        reloadLoai0Combobox();
    });
}
async function updateTypesFromAPI() {
    try {
        const response = await fetch(API_TYPE_URL);
        const data = await response.json();
        if (data.loai0 && data.loai1 && data.loai2 && data.loai3) {
            setStorage({
                loai0: data.loai0,
                loai1: data.loai1,
                loai2: data.loai2,
                loai3: data.loai3
            }, () => {
                showNotification('Đã cập nhật loại từ server!', 'success');
                reloadAllComboboxes();
                reloadLoai0Combobox();
            });
        } else throw new Error('Dữ liệu loại không hợp lệ');
    } catch {
        genRandomTypes();
    }
}
function reloadAllComboboxes() {
    getStorage(['loai1','loai2','loai3'], types => {
        Object.entries(choicesInstances).forEach(([entryId, arr]) => {
            arr.forEach((choices, i) => {
                choices.clearChoices();
                const key = `loai${i+1}`;
                const opts = Array.isArray(types[key]) ? types[key] : [];
                choices.setChoices(opts.map(v => ({value: v, label: v})), 'value', 'label', true);
            });
        });
    });
}
function reloadLoai0Combobox() {
    getStorage(['loai0'], types => {
        const select = byId('loai0Select');
        if (!select) return;
        updateSelectOptions(select, types.loai0 || []);
        if (select.choices) {
            select.choices.clearChoices();
            select.choices.setChoices((types.loai0 || []).map(v => ({value: v, label: v})), 'value', 'label', true);
        }
    });
}

// --- Utility ---
function updateSelectOptions(select, options) {
    while (select.options.length) select.remove(0);
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = option.textContent = opt;
        select.appendChild(option);
    });
}