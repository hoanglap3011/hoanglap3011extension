// File: notebooklm.js

console.log("[Ext] NotebookLM Script: Chế độ 'Combo All-in-One'.");

// --- CÁC HÀM HỖ TRỢ (HELPER) ---

const simulateRealClick = (element) => {
    if (!element) return;
    if (element.focus) element.focus(); // Focus để đánh thức UI
    const options = { bubbles: true, cancelable: true, view: window };
    element.dispatchEvent(new MouseEvent('mousedown', options));
    element.dispatchEvent(new MouseEvent('mouseup', options));
    element.dispatchEvent(new MouseEvent('click', options));
};

const clickDeepestTextElement = (wrapper, text) => {
    const allChildren = wrapper.querySelectorAll('*');
    let target = null;
    for (const child of allChildren) {
        if (child.innerText?.includes(text) || child.textContent?.includes(text)) {
            target = child;
        }
    }
    if (target) {
        simulateRealClick(target);
        return true;
    }
    simulateRealClick(wrapper);
    return false;
};

const waitForCondition = (checkFn, timeout = 10000) => {
    return new Promise((resolve) => {
        const res = checkFn();
        if (res) return resolve(res);

        const observer = new MutationObserver(() => {
            const result = checkFn();
            if (result) {
                resolve(result);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
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

// --- LOGIC TỪNG TÍNH NĂNG ---

// 1. Logic Bản đồ tư duy
const runMindMapLogic = async () => {
    console.log("🔹 [Task 1] Bắt đầu: Bản đồ tư duy...");
    const wrapper = await waitForCondition(() => findArtifactButtonWrapper("Bản đồ tư duy"), 5000);

    if (wrapper) {
        clickDeepestTextElement(wrapper, "Bản đồ tư duy");
        console.log("✅ [Task 1] Đã click Bản đồ tư duy.");
        return true;
    } else {
        console.warn("⚠️ [Task 1] Không tìm thấy nút.");
        return false;
    }
};

// 2. Logic Tài liệu tóm tắt (Đa bước)
const runBriefingDocLogic = async () => {
    console.log("🔹 [Task 2] Bắt đầu: Tài liệu tóm tắt...");
    const STEP_1_TEXT = "Báo cáo";

    // Bước 2.1: Click "Báo cáo"
    const wrapper = await waitForCondition(() => findArtifactButtonWrapper(STEP_1_TEXT), 5000);

    if (!wrapper) {
        console.warn("⚠️ [Task 2] Không tìm thấy nút 'Báo cáo'.");
        return false;
    }

    console.log("👉 [Task 2] Click nút Báo cáo.");
    clickDeepestTextElement(wrapper, STEP_1_TEXT);

    // Bước 2.2: Chờ Popup (2 giây để chắc chắn MindMap không gây xung đột)
    console.log("⏳ [Task 2] Đợi Popup (2s)...");
    await new Promise(r => setTimeout(r, 2000));

    // Bước 2.3: Tìm Tile và Button trong Popup
    const findTileAndBtn = () => {
        const tiles = document.querySelectorAll('report-customization-tile');
        for (const tile of tiles) {
            const btn = tile.querySelector('button[aria-label="Tài liệu tóm tắt"]');
            if (btn) return { tile, btn };
        }
        return null;
    };

    const result = await waitForCondition(findTileAndBtn, 5000);

    if (result) {
        console.log("✅ [Task 2] Tìm thấy Tile. Đang click...");
        simulateRealClick(result.btn); // Click button
        setTimeout(() => simulateRealClick(result.tile), 100); // Click bồi tile
        return true;
    } else {
        console.warn("⚠️ [Task 2] Không tìm thấy 'Tài liệu tóm tắt' trong popup.");
        return false;
    }
};



// --- TRÌNH ĐIỀU PHỐI (ORCHESTRATOR) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "activateAll") {
        console.log("🚀 [Orchestrator] Nhận lệnh chạy Combo.");

        (async () => {
            // 1. Chạy MindMap trước
            await runMindMapLogic();

            // 2. Nghỉ 2 giây để UI ổn định
            console.log("☕ Nghỉ 2 giây...");
            await new Promise(r => setTimeout(r, 2000));

            // 3. Chạy Briefing Doc sau
            // Lưu kết quả trả về để biết có thành công không
            const briefingSuccess = await runBriefingDocLogic();

            // 4. [LOGIC MỚI] Kiểm tra Setting trước khi đóng tab
            if (briefingSuccess) {
                console.log("✅ [Done] Đã xong việc. Đang kiểm tra cài đặt đóng tab...");

                // Lấy cài đặt từ Storage (Key: 'LapsExtensionSettings' giống trong options.js của bạn)
                chrome.storage.local.get('LapsExtensionSettings', async (data) => {
                    const settings = data['LapsExtensionSettings'] || {};

                    // Kiểm tra xem switch có bật không (ytEnableAutoCloseNotebook)
                    if (settings.ytEnableAutoCloseNotebook) {
                        console.log("SETTINGS: Tự động đóng tab = ON. Đợi 1 giây rồi đóng...");
                        await new Promise(r => setTimeout(r, 1000));

                        console.log("👋 Gửi lệnh đóng tab về Background...");
                        chrome.runtime.sendMessage({ action: "closeThisTab" });
                    } else {
                        console.log("SETTINGS: Tự động đóng tab = OFF. Giữ nguyên tab.");
                    }
                });
            } else {
                console.warn("⚠️ Có lỗi ở bước Tóm tắt, không đóng tab.");
            }

        })();

        sendResponse({ status: "started" });
    }
    return true;
});