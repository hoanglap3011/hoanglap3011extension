
        // Cấu hình
        const API_URL = 'https://api.example.com/gratitude'; // TODO: Thay đổi URL này
        const CATEGORIES = [
            { value: '', text: 'Chọn thể loại' },
            { value: 'điều đang có', text: 'Điều đang có' },
            { value: 'sự giúp đỡ', text: 'Sự giúp đỡ' },
            { value: 'bài học', text: 'Bài học' },
            { value: 'tạo hoá', text: 'Tạo hoá' },
            { value: 'điều vô hình', text: 'Điều vô hình' },
            { value: 'nvc', text: 'NVC' },
            { value: 'khác', text: 'Khác' }
        ];

        // State
        let entryCount = 0;
        let quillInstances = [];

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
            const now = new Date().toISOString().slice(0, 16);
            
            const entryDiv = document.createElement('div');
            entryDiv.className = 'gratitude-entry';
            entryDiv.id = `entry-${entryCount}`;
            
            entryDiv.innerHTML = `
                <div class="entry-header">
                    <div class="entry-number">${entryCount}</div>
                    <button class="remove-entry" data-entry-id="${entryCount}">❌</button>
                </div>
                
                <div class="form-group">
                    <label>⏰ Thời gian:</label>
                    <input type="datetime-local" id="time-${entryCount}" value="${now}">
                </div>
                
                <div class="form-group">
                    <label>🏷️ Thể loại:</label>
                    <select id="category-${entryCount}">
                        ${CATEGORIES.map(cat => `<option value="${cat.value}">${cat.text}</option>`).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>💝 Nội dung:</label>
                    <div class="editor-container">
                        <div id="editor-${entryCount}"></div>
                    </div>
                </div>
            `;
            
            container.appendChild(entryDiv);
            
            // Khởi tạo Quill editor
            quillInstances[entryCount] = new Quill(`#editor-${entryCount}`, {
                theme: 'snow',
                placeholder: 'Hãy chia sẻ điều bạn biết ơn...',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['clean']
                    ]
                }
            });
            
            // Gắn event cho nút xóa
            const removeBtn = entryDiv.querySelector('.remove-entry');
            removeBtn.addEventListener('click', () => removeEntry(entryCount));
            
            updateRemoveButtons();
        }

        function removeEntry(entryId) {
            document.getElementById(`entry-${entryId}`).remove();
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
            const entries = [];
            document.querySelectorAll('.gratitude-entry').forEach((entry, index) => {
                const entryId = entry.id.split('-')[1];
                const time = entry.querySelector(`#time-${entryId}`).value;
                const category = entry.querySelector(`#category-${entryId}`).value;
                const quill = quillInstances[entryId];
                
                if (quill) {
                    entries.push({
                        số_thứ_tự: index + 1,
                        thời_gian: time,
                        thể_loại: category,
                        nội_dung_text: quill.getText().trim(),
                        nội_dung_html: quill.root.innerHTML
                    });
                }
            });
            
            return {
                tổng_số_mục: entries.length,
                thời_gian_tạo: new Date().toISOString(),
                dữ_liệu: entries
            };
        }

        function validateData(data) {
            if (data.dữ_liệu.length === 0) return 'Vui lòng thêm ít nhất một mục!';
            
            for (let i = 0; i < data.dữ_liệu.length; i++) {
                const entry = data.dữ_liệu[i];
                if (!entry.thời_gian) return `Vui lòng chọn thời gian cho mục ${i + 1}!`;
                if (!entry.thể_loại) return `Vui lòng chọn thể loại cho mục ${i + 1}!`;
                if (!entry.nội_dung_text) return `Vui lòng nhập nội dung cho mục ${i + 1}!`;
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

                if (response.ok) {
                    showNotification('✅ Gửi thành công!', 'success');
                    clearForm();
                } else {
                    throw new Error(`HTTP ${response.status}`);
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
