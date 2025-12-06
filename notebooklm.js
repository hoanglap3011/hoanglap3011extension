// File: notebooklm.js

console.log("[Ext] NotebookLM Script: Chế độ 'Combo All-in-One' (Safe Wait).");

// --- CÁC HÀM HỖ TRỢ (HELPER) ---

const simulateRealClick = (element) => {
    if (!element) return;
    if (element.focus) element.focus(); 
    const options = { bubbles: true, cancelable: true, view: window };
    element.dispatchEvent(new MouseEvent('mousedown', options));
    element.dispatchEvent(new MouseEvent('mouseup', options));
    element.dispatchEvent(new MouseEvent('click', options));
};

const isElementReady = (element) => {
    if (!element) return false;
    if (element.disabled) return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;
    if (element.classList.contains('disabled')) return false;

    const internalBtn = element.querySelector('button');
    if (internalBtn) {
        if (internalBtn.disabled) return false;
        if (internalBtn.getAttribute('aria-disabled') === 'true') return false;
    }

    const style = window.getComputedStyle(element);
    if (style.pointerEvents === 'none') return false;
    
    return true;
};

const clickDeepestTextElementIfReady = (wrapper, text) => {
    const allChildren = wrapper.querySelectorAll('*');
    let target = null;
    for (const child of allChildren) {
        if (child.innerText?.includes(text) || child.textContent?.includes(text)) {
            target = child;
        }
    }
    const elementToClick = target || wrapper;
    if (isElementReady(wrapper) && isElementReady(elementToClick)) {
        simulateRealClick(elementToClick);
        return true;
    }
    return false;
};

const findArtifactButtonWrapper = (text) => {
    const wrappers = document.querySelectorAll('basic-create-artifact-button');
    for (const wrapper of wrappers) {
        if (wrapper.innerText?.includes(text) || wrapper.textContent?.includes(text)) {
            return wrapper;
        }
    }
    return null;
};

const waitForCondition = (checkFn, timeout = 60000) => {
    return new Promise((resolve) => {
        const res = checkFn();
        if (res) return resolve(res);

        const observer = new MutationObserver(() => {
            const result = checkFn();
            if (result) {
                observer.disconnect();
                resolve(result);
            }
        });

        observer.observe(document.body, { 
            childList: true, subtree: true, attributes: true, 
            attributeFilter: ['disabled', 'aria-disabled', 'class'] 
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
};

// --- LOGIC NGHIỆP VỤ MỚI: THEO DÕI TIẾN TRÌNH VÀ ĐÓNG TAB ---

const waitForGenerationToFinishAndClose = async () => {
    console.log("🕵️ [AutoClose] Bắt đầu giám sát tiến trình...");
    
    // Timeout an toàn: 10 phút
    const MAX_WAIT_TIME = 600000; 
    const START_TIME = Date.now();

    while (true) {
        // 1. Kiểm tra timeout an toàn
        if (Date.now() - START_TIME > MAX_WAIT_TIME) {
            console.warn("⚠️ [AutoClose] Hết thời gian chờ (10p). Buộc đóng tab.");
            chrome.runtime.sendMessage({ action: "closeThisTab" });
            break;
        }

        // 2. Tìm container
        const container = document.querySelector('.artifact-library-container');
        
        if (container) {
            const fullText = container.innerText || "";
            
            // Regex tìm: "Đang tạo" ... "..." (có thể xuống dòng)
            const isGenerating = /Đang tạo.*?\.\.\./si.test(fullText);

            if (isGenerating) {
                console.log(`⏳ [AutoClose] Đang tạo báo cáo/mindmap... (${Math.floor((Date.now() - START_TIME)/1000)}s)`);
            } else {
                // QUAN TRỌNG: Chỉ đóng khi KHÔNG còn text "Đang tạo"
                console.log("✅ [AutoClose] Đã hoàn tất (Text 'Đang tạo...' đã biến mất).");
                
                // Nghỉ thêm 2 giây để chắc chắn
                await new Promise(r => setTimeout(r, 2000));
                
                console.log("👋 Gửi lệnh đóng tab.");
                chrome.runtime.sendMessage({ action: "closeThisTab" });
                break;
            }
        } else {
            console.log("⏳ [AutoClose] Đang chờ khung danh sách hiển thị...");
        }

        // Kiểm tra mỗi 2 giây
        await new Promise(r => setTimeout(r, 2000));
    }
};

// --- LOGIC CLICK TÍNH NĂNG ---

const runMindMapLogic = async () => {
    console.log("🔹 [Task 1] Chờ nút 'Bản đồ tư duy'...");
    const checkReady = () => {
        const wrapper = findArtifactButtonWrapper("Bản đồ tư duy");
        if (wrapper && isElementReady(wrapper)) return wrapper;
        return null;
    };
    const wrapper = await waitForCondition(checkReady, 60000);
    if (wrapper) {
        clickDeepestTextElementIfReady(wrapper, "Bản đồ tư duy");
        console.log("✅ [Task 1] Đã click.");
    }
};

const runBriefingDocLogic = async () => {
    console.log("🔹 [Task 2] Chờ nút 'Báo cáo'...");
    const checkStep1Ready = () => {
        const wrapper = findArtifactButtonWrapper("Báo cáo");
        if (wrapper && isElementReady(wrapper)) return wrapper;
        return null;
    };
    const wrapper = await waitForCondition(checkStep1Ready, 60000);
    if (!wrapper) return;

    clickDeepestTextElementIfReady(wrapper, "Báo cáo");

    const findTileAndBtn = () => {
        const tiles = document.querySelectorAll('report-customization-tile');
        for (const tile of tiles) {
            const btn = tile.querySelector('button[aria-label="Tài liệu tóm tắt"]');
            if (btn && isElementReady(btn)) return { tile, btn };
        }
        return null;
    };
    const result = await waitForCondition(findTileAndBtn, 10000);
    if (result) {
        console.log("✅ [Task 2] Đã click Tài liệu tóm tắt.");
        simulateRealClick(result.btn);
        // Click bồi tile
        setTimeout(() => { if (document.body.contains(result.tile)) simulateRealClick(result.tile); }, 100);
    }
};

// --- TRÌNH ĐIỀU PHỐI (QUAN TRỌNG: ĐÃ SỬA LOGIC CHỜ) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "activateAll") {
        console.log("🚀 [Orchestrator] Bắt đầu quy trình.");

        (async () => {
            // 1. Chạy các task click
            await runMindMapLogic();
            
            console.log("☕ Nghỉ 2 giây...");
            await new Promise(r => setTimeout(r, 2000));

            await runBriefingDocLogic();

            console.log("🏁 [Done] Đã gửi lệnh click.");

            // 2. LOGIC ĐÓNG TAB AN TOÀN
            chrome.storage.local.get('LapsExtensionSettings', async (data) => {
                const settings = data['LapsExtensionSettings'] || {};

                if (settings.ytEnableAutoCloseNotebook) {
                    
                    // --- ĐIỂM SỬA QUAN TRỌNG NHẤT ---
                    console.log("🛡️ [Safety] Đợi 5 giây để NotebookLM hiện chữ 'Đang tạo'...");
                    await new Promise(r => setTimeout(r, 5000)); 
                    // --------------------------------
                    
                    console.log("⚙️ [Auto Close] Bắt đầu theo dõi để đóng tab.");
                    await waitForGenerationToFinishAndClose();
                } else {
                    console.log("⚙️ [Auto Close] OFF. Giữ tab.");
                }
            });

        })();

        sendResponse({ status: "started" });
    }
    return true;
});