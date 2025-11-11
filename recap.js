document.addEventListener('DOMContentLoaded', () => {    

    // --- 2. CACHE DOM VÀ TRẠNG THÁI ---
    const searchInput = document.getElementById('searchInput');
    const commandList = document.getElementById('commandList');
    
    // DOM của Popup lựa chọn
    const choiceOverlay = document.getElementById('choiceOverlay');
    const btnOpenNotebookLM = document.getElementById('btnOpenNotebookLM');
    const btnOpenMindomo = document.getElementById('btnOpenMindomo');
    const btnCancelChoice = document.getElementById('btnCancelChoice');
    
    const btnRefreshApi = document.getElementById('btnRefreshApi');

    let allCommands = []; // Lưu trữ toàn bộ data (từ API hoặc cache)
    let filteredCommands = []; // Lưu trữ data đã lọc
    let selectedIndex = 0;    

    // ==========================================================
    // --- 3. HÀM TIỆN ÍCH MỚI (GIẢI PHÁP) ---
    // ==========================================================

    /**
     * Kiểm tra xem có đang chạy trong môi trường extension hay không.
     * (Giả định StorageUtil là global và đã được định nghĩa)
     */
    function isExtensionEnv() {
        // Chúng ta có thể dùng trực tiếp StorageUtil.isExtension 
        // nếu bạn đã định nghĩa nó, hoặc dùng cách kiểm tra chung:
        return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
    }

    /**
     * Hàm mới để mở tab, tự động chọn API phù hợp
     */
    function openNewTab(url) {
        if (isExtensionEnv()) {
            // 1. Môi trường Extension
            chrome.tabs.create({ url: url });
        } else {
            // 2. Môi trường Web (github.io)
            window.open(url, '_blank');
        }
        // Tự động đóng cửa sổ popup (nếu là web)
        if (!isExtensionEnv()) {
             window.close();
        }
    }


    // --- 4. KHỞI TẠO VÀ LẤY DATA ---

    /**
     * <<< THAY ĐỔI: Hàm này giờ là hàm CHÍNH để gọi API >>>
     * Nó cũng sẽ tự động LƯU VÀO CACHE sau khi fetch.
     * Nút Refresh sẽ gọi trực tiếp hàm này.
     */
    async function fetchData() {
        LoadingOverlayUtil.show(); // Hiển thị loading

        // Giả định StorageUtil được tải global
        const pass = await new Promise(resolve => {
            StorageUtil.get([CACHE_PASS], (result) => resolve(result[CACHE_PASS] || ''));
        });

        fetch(API, {
            method: 'POST',
            body: JSON.stringify({
                pass: pass, 
                action: API_ACTION_GET_SUMMARY_BY_CATEGORY,
                category: 'book'
            })
        })
        .then(response => {
            if (!response.ok) {
                alert('Lỗi khi gọi API');
                throw new Error("Lỗi khi gọi API");
            }
            return response.json();
        })
        .then(result => {
            const code = result.code;
            if (code !== 1) {
                const errMsg = result.error || 'Có lỗi xảy ra';
                alert('Lỗi: ' + errMsg);
                return;
            }
            const data = result.data;
            allCommands = data; 
            filteredCommands = [...allCommands]; 
            renderList(filteredCommands); // Render danh sách
            
            // <<< THÊM MỚI: Lưu vào cache sau khi fetch thành công >>>
            StorageUtil.set({ [CACHE_DATA_RECAP]: data }, () => {
                console.log("Đã lưu dữ liệu API vào cache.");
            });
    
        })
        .catch(err => {
            alert('Lỗi khi gọi API: ' + err);
            commandList.innerHTML = `<li class="error-msg">Lỗi tải dữ liệu.</li>`;
        }).finally(() => {  
            LoadingOverlayUtil.hide(); 
        });
    }

    /**
     * <<< THÊM MỚI: Hàm kiểm tra cache khi tải trang >>>
     * Hàm này sẽ được gọi trong init()
     */
    function loadDataFromCacheOrApi() {
        LoadingOverlayUtil.show(); // Hiện loading trong lúc kiểm tra cache
        StorageUtil.get([CACHE_DATA_RECAP], (result) => {
            const cachedData = result[CACHE_DATA_RECAP];
            
            // Nếu có cache và cache là một mảng
            if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
                console.log("Đã tải dữ liệu từ cache.");
                allCommands = cachedData;
                filteredCommands = [...allCommands];
                renderList(filteredCommands);
                LoadingOverlayUtil.hide(); // Tắt loading
            } else {
                // Nếu không có cache, gọi API
                console.log("Cache rỗng. Đang tải từ API...");
                fetchData(); // Hàm này sẽ tự xử lý loading, render và lưu cache
            }
        });
    }

    function init() {
        // Khởi tạo Loading Overlay
        LoadingOverlayUtil.init({
            getStorageFunc: StorageUtil.get,
            cacheQuotesKey: CACHE_QUOTES
        });

        // Tự động focus vào input
        searchInput.focus();

        // <<< THAY ĐỔI: Gọi hàm check cache thay vì fetch thẳng >>>
        loadDataFromCacheOrApi();

        // Gán sự kiện
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keydown', handleSearchKeydown);
        btnCancelChoice.addEventListener('click', hideChoicePopup);
        choiceOverlay.addEventListener('click', (e) => {
            if (e.target === choiceOverlay) {
                hideChoicePopup();
            }
        });
        
        // <<< THÊM MỚI: Gán sự kiện cho nút Refresh >>>
        btnRefreshApi.addEventListener('click', fetchData);
    }


    // --- 5. HÀM XỬ LÝ LOGIC ---

    /**
     * Render danh sách kết quả ra UI
     */
    function renderList(commands) {
        commandList.innerHTML = ''; // Xoá danh sách cũ
        
        if (commands.length === 0) {
            commandList.innerHTML = `<li>Không tìm thấy kết quả.</li>`;
            return;
        }

        commands.forEach((command, index) => {
            const li = document.createElement('li');
            li.dataset.index = index; 
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = command.title; 
            li.appendChild(nameSpan);

            li.addEventListener('click', () => {
                selectedIndex = index;
                updateSelection(); 
                executeCommand(command); 
            });
            
            commandList.appendChild(li);
        });

        selectedIndex = 0;
        updateSelection();
    }

    /**
     * Xử lý khi người dùng gõ tìm kiếm
     */
    function handleSearchInput() {
        const query = searchInput.value.toLowerCase().trim();
        
        filteredCommands = allCommands.filter(command => 
            command.title.toLowerCase().includes(query)
        );
        
        renderList(filteredCommands);
    }

    /**
     * Cập nhật highlight cho mục đang chọn (bằng phím)
     */
    function updateSelection() {
        commandList.querySelectorAll('li').forEach(li => {
            li.classList.remove('selected');
        });

        const selectedLi = commandList.children[selectedIndex];
        if (selectedLi) {
            selectedLi.classList.add('selected');
            selectedLi.scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Xử lý khi nhấn phím (Lên, Xuống, Enter)
     */
    function handleSearchKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault(); 
                selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                updateSelection();
                break;
            
            case 'ArrowUp':
                e.preventDefault(); 
                selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                updateSelection();
                break;
            
            case 'Enter':
                e.preventDefault();
                executeCommand(filteredCommands[selectedIndex]);
                break;
            
            case 'Escape':
                window.close();
                break;
        }
    }

    /**
     * Hàm quan trọng: Thực thi lệnh khi được chọn
     */
    function executeCommand(command) {
        if (!command) return;

        const hasNotebook = command.notebooklm && command.notebooklm.length > 0;
        const hasMindomo = command.mindomo && command.mindomo.length > 0;

        if (hasNotebook && hasMindomo) {
            showChoicePopup(command.notebooklm, command.mindomo);
        } else if (hasNotebook) {
            // <<< THAY ĐỔI: Dùng hàm mới >>>
            openNewTab(command.notebooklm);
            if(isExtensionEnv()) window.close(); // Chỉ extension mới tự đóng cửa sổ hub
        } else if (hasMindomo) {
            // <<< THAY ĐỔI: Dùng hàm mới >>>
            openNewTab(command.mindomo);
            if(isExtensionEnv()) window.close(); // Chỉ extension mới tự đóng cửa sổ hub
        } else {
            alert("Mục này không có link để mở.");
        }
    }

    /**
     * Hiển thị popup lựa chọn và gán URL cho các nút
     */
    function showChoicePopup(notebookUrl, mindomoUrl) {
        btnOpenNotebookLM.dataset.url = notebookUrl;
        btnOpenMindomo.dataset.url = mindomoUrl;

        btnOpenNotebookLM.onclick = () => openChoice(notebookUrl);
        btnOpenMindomo.onclick = () => openChoice(mindomoUrl);

        choiceOverlay.classList.add('visible');
    }

    /**
     * Ẩn popup
     */
    function hideChoicePopup() {
        choiceOverlay.classList.remove('visible');
        btnOpenNotebookLM.onclick = null;
        btnOpenMindomo.onclick = null;
    }

    /**
     * Xử lý khi bấm nút trong popup
     */
    function openChoice(url) {
        // <<< THAY ĐỔI: Dùng hàm mới >>>
        openNewTab(url); 
        hideChoicePopup(); 
        if(isExtensionEnv()) window.close(); // Chỉ extension mới tự đóng cửa sổ hub
    }

    // --- 6. CHẠY HÀM KHỞI TẠO ---
    init();

});