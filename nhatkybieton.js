// Cấu hình
const API_URL = 'https://script.google.com/macros/s/AKfycbyt7vrcnaO__2rPZ1QJ0VIEQTRexusN_2CKrT1NvA9mKSTs5qBjPD3LlrwF0-SGdcPmAg/exec'; // TODO: Thay đổi URL này
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
let quillInstances = [];

// Helper: return a string suitable for <input type="datetime-local"> in the user's local timezone
function getLocalDatetimeLocalValue(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Khởi tạo
document.addEventListener('DOMContentLoaded', init);

function init() {
    addEntry();
    document.getElementById('add-btn').addEventListener('click', addEntry);
    document.getElementById('submit-btn').addEventListener('click', submitData);
}

function addEntry() {
    entryCount++;
    const container = document.getElementById('entries-container');
    const now = getLocalDatetimeLocalValue();
    const displayIndex = container.querySelectorAll('.gratitude-entry').length + 1;
    
    const entryDiv = document.createElement('div');
    entryDiv.className = 'gratitude-entry';
    entryDiv.id = `entry-${entryCount}`;
    
    const selectedCategoryIndex = (displayIndex - 1) % CATEGORIES.length;
    const optionsHtml = CATEGORIES.map((cat, idx) => `<option value="${cat.value}" ${idx === selectedCategoryIndex ? 'selected' : ''}>${cat.text}</option>`).join('');

    entryDiv.innerHTML = `
    <div class="entry-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
            <div class="entry-number">${displayIndex}</div>
            <input type="datetime-local" id="time-${entryCount}" value="${now}" style="min-width:200px;">
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="toggle-toolbar" data-entry-id="${entryCount}">▤</button>
            <button class="remove-entry" data-entry-id="${entryCount}">❌</button>
        </div>
    </div>
    
    <div class="form-group" style="display:flex;align-items:center;gap:12px;">
        <select id="category-${entryCount}">
            ${optionsHtml}
        </select>
    </div>
    
    <div class="form-group">
        <div class="editor-container">
            <div id="editor-${entryCount}"></div>
        </div>
    </div>
`;
    
    container.appendChild(entryDiv);
    
    // Khởi tạo Quill editor (dùng toolbar mặc định)
    quillInstances[entryCount] = new Quill(`#editor-${entryCount}`, {
        theme: 'snow',
        placeholder: 'Hãy chia sẻ điều bạn biết ơn...',
        modules: {
            toolbar: true
        }
    });
    
    // Attach toggle behavior to toolbar button (hide toolbar by default to save space)
    const toggleBtn = entryDiv.querySelector('.toggle-toolbar');
    const toolbar = entryDiv.querySelector('.ql-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const tb = entryDiv.querySelector('.ql-toolbar');
            if (!tb) return;
            tb.style.display = (tb.style.display === 'none') ? '' : 'none';
        });
    }
    
    // Gắn event cho nút xóa
    const removeBtn = entryDiv.querySelector('.remove-entry');
    removeBtn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.dataset.entryId);
        removeEntry(id);
    });
    
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
    const entries = document.querySelectorAll('.gratitude-entry');
    entries.forEach((entry, index) => {
        entry.querySelector('.entry-number').textContent = index + 1;
    });
}

function updateRemoveButtons() {
    const buttons = document.querySelectorAll('.remove-entry');
    const shouldShow = buttons.length > 1;
    buttons.forEach(btn => {
        btn.style.display = shouldShow ? 'flex' : 'none';
    });
}

function collectData() {
    const urlParams = new URLSearchParams(window.location.search);
    const keyParam = urlParams.get('key');
    const entries = [];
    document.querySelectorAll('.gratitude-entry').forEach((entry, index) => {
        const entryId = entry.id.split('-')[1];
        const time = entry.querySelector(`#time-${entryId}`).value;
        const category = entry.querySelector(`#category-${entryId}`).value;
        const quill = quillInstances[entryId];
        
        if (quill) {
            entries.push({
                soThuTu: index + 1,
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
    if (data.duLieu.length === 0) return 'Vui lòng thêm ít nhất một mục!';
    
    for (let i = 0; i < data.duLieu.length; i++) {
        const entry = data.duLieu[i];
        if (!entry.thoiGian) return `Vui lòng chọn thời gian cho mục ${i + 1}!`;
        if (!entry.theLoai) return `Vui lòng chọn thể loại cho mục ${i + 1}!`;
        if (!entry.noiDungText) return `Vui lòng nhập nội dung cho mục ${i + 1}!`;
    }
    return null;
}

async function submitData() {
    if (API_URL === 'https://api.example.com/gratitude') {
        showNotification('Vui lòng cấu hình URL API!', 'error');
        return;
    }

    const data = collectData();
    const error = validateData(data);
    if (error) {
        showNotification(error, 'error');
        return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '🔄 Đang gửi...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.code === 0) {
            // Thành công
            showNotification(result.content, "success");
            clearForm();
        } else {
            // Lỗi theo quy ước
            throw new Error(`${result.error}`);
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
    quillInstances = [];
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
