#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent
ProcessSetPriority "AboveNormal"

; ================== CẤU HÌNH ==================
IDLE_POLL_MS  := 50     ; chu kỳ đọc icon UniKey lúc bình thường (ms)
BURST_POLL_MS := 15     ; chu kỳ đọc dồn dập ngay sau Ctrl/Shift/click (ms)
BURST_LEN_MS  := 700    ; thời gian đọc dồn dập (ms)
FOLLOW_MS     := 30     ; chu kỳ bám theo con trỏ khi overlay đang hiện (ms)
SHOW_MS       := 1200   ; overlay hiển thị bao lâu rồi tự ẩn (ms)
ALWAYS_SHOW   := false  ; true = overlay luôn bám theo con trỏ nhập liệu
COLOR_TOL     := 60     ; sai khác màu tối đa để coi là khớp V/E
INI           := A_ScriptDir "\UniKeyOverlay.ini"
; ==============================================

CoordMode "Mouse", "Screen"
DllCall("LoadLibrary", "str", "oleacc", "ptr")

IconX  := Integer(IniRead(INI, "Tray", "X", "-1"))
IconY  := Integer(IniRead(INI, "Tray", "Y", "-1"))
ColorV := Integer(IniRead(INI, "Tray", "ColorV", "-1"))
ColorE := Integer(IniRead(INI, "Tray", "ColorE", "-1"))

gMode := "", gHideAt := 0, gBurstUntil := 0, gInBurst := false, gTry := 0
gCurOv := 0, gCurX := "", gCurY := ""

; ---------- Bộ chụp màn hình 3x3 (1 lần BitBlt thay cho 9 lần PixelGetColor) ----------
gScreenDC := DllCall("GetDC", "ptr", 0, "ptr")
gMemDC    := DllCall("CreateCompatibleDC", "ptr", gScreenDC, "ptr")
bi := Buffer(40, 0)
NumPut("uint", 40, bi, 0), NumPut("int", 3, bi, 4), NumPut("int", -3, bi, 8)
NumPut("ushort", 1, bi, 12), NumPut("ushort", 32, bi, 14)
gBits := 0
gDib := DllCall("CreateDIBSection", "ptr", gMemDC, "ptr", bi, "uint", 0, "ptr*", &gBits, "ptr", 0, "uint", 0, "ptr")
gOldBmp := DllCall("SelectObject", "ptr", gMemDC, "ptr", gDib, "ptr")

; ---------- 3 overlay tạo sẵn ----------
S := A_ScreenDPI / 96
OV_W := Round(34 * S), OV_H := Round(20 * S)
OVS := Map("V", MakeOv("VI", "C62828"), "E", MakeOv("EN", "1565C0"), "?", MakeOv("?", "616161"))

; ---------- Hook sự kiện focus / đổi cửa sổ ----------
gHookCb := CallbackCreate(WinEventProc, , 7)
gHooks := []
for ev in [0x0003, 0x8005]   ; EVENT_SYSTEM_FOREGROUND, EVENT_OBJECT_FOCUS
    gHooks.Push(DllCall("SetWinEventHook", "uint", ev, "uint", ev, "ptr", 0, "ptr", gHookCb
        , "uint", 0, "uint", 0, "uint", 0x2, "ptr"))   ; OUTOFCONTEXT | SKIPOWNPROCESS
OnExit(Cleanup)

if (IconX < 0 || ColorV < 0 || ColorE < 0)
    TrayTip "Chưa hiệu chỉnh.`n1) Để UniKey ở chế độ V, rê chuột lên icon UniKey → Ctrl+Alt+F9`n2) Chuyển sang E → Ctrl+Alt+F10", "UniKey Overlay"

SetTimer(Poll, IDLE_POLL_MS)
if ALWAYS_SHOW
    SetTimer(Follow, FOLLOW_MS)

; ================== HOTKEYS ==================
~*LButton Up::
~*Tab Up::
{
    StartBurst()
    RequestShow()
}

~*Ctrl Up::
~*Shift Up::
{
    StartBurst()
}

^!F9:: Calibrate("V")
^!F10:: Calibrate("E")
^!F11:: {
    global ALWAYS_SHOW
    ALWAYS_SHOW := !ALWAYS_SHOW
    if ALWAYS_SHOW
        SetTimer(Follow, FOLLOW_MS)
    else
        HideOverlay()
    TrayTip "Luôn hiển thị: " (ALWAYS_SHOW ? "BẬT" : "TẮT"), "UniKey Overlay"
}

; ================== SỰ KIỆN ==================
WinEventProc(hHook, event, hwnd, idObject, idChild, idThread, time) {
    RequestShow()
}

RequestShow() {
    global gTry := 0
    SetTimer(TryShow, -1)
}

TryShow() {
    global gTry
    static delays := [30, 50, 80, 120]   ; thử lại khi ô nhập chưa kịp có con trỏ
    if GetCaret(&cx, &cy, &ch, &hf) {
        ShowOverlay(cx, cy, ch)
        return
    }
    gTry += 1
    if (gTry <= delays.Length)
        SetTimer(TryShow, -delays[gTry])
}

; ================== ĐỌC TRẠNG THÁI E/V ==================
StartBurst() {
    global gBurstUntil, gInBurst
    gBurstUntil := A_TickCount + BURST_LEN_MS
    if !gInBurst {
        gInBurst := true
        SetTimer(Poll, BURST_POLL_MS)
    }
}

Poll() {
    global gInBurst
    if (gInBurst && A_TickCount > gBurstUntil) {
        gInBurst := false
        SetTimer(Poll, IDLE_POLL_MS)
    }
    CheckMode()
}

CheckMode() {
    global gMode
    if (IconX < 0 || ColorV < 0 || ColorE < 0)
        return
    m := ReadMode()
    if (m = "" || m = gMode)
        return
    first := (gMode = "")
    gMode := m
    if (first && !ALWAYS_SHOW)
        return
    if GetCaret(&cx, &cy, &ch, &hf)
        ShowOverlay(cx, cy, ch)
}

ReadMode() {
    c := SampleColor(IconX, IconY)
    dV := ColorDist(c, ColorV), dE := ColorDist(c, ColorE)
    if (Min(dV, dE) > COLOR_TOL)
        return ""                       ; icon bị che/dịch chỗ → giữ trạng thái cũ
    return (dV <= dE) ? "V" : "E"
}

SampleColor(x, y) {
    DllCall("BitBlt", "ptr", gMemDC, "int", 0, "int", 0, "int", 3, "int", 3
        , "ptr", gScreenDC, "int", x - 1, "int", y - 1, "uint", 0x00CC0020)
    r := g := b := 0
    Loop 9 {
        p := NumGet(gBits, (A_Index - 1) * 4, "uint")   ; 0xAARRGGBB
        r += (p >> 16) & 0xFF, g += (p >> 8) & 0xFF, b += p & 0xFF
    }
    return (Round(r / 9) << 16) | (Round(g / 9) << 8) | Round(b / 9)
}

ColorDist(c1, c2) {
    dr := ((c1 >> 16) & 0xFF) - ((c2 >> 16) & 0xFF)
    dg := ((c1 >> 8) & 0xFF) - ((c2 >> 8) & 0xFF)
    db := (c1 & 0xFF) - (c2 & 0xFF)
    return Sqrt(dr * dr + dg * dg + db * db)
}

; ================== VỊ TRÍ CON TRỎ NHẬP LIỆU ==================
GetCaret(&x, &y, &h, &hFocus) {
    x := y := h := 0, hFocus := 0
    cb := 8 + 6 * A_PtrSize + 16
    gti := Buffer(cb, 0)
    NumPut("uint", cb, gti, 0)
    if !DllCall("GetGUIThreadInfo", "uint", 0, "ptr", gti)
        return false
    hFocus := NumGet(gti, 8 + A_PtrSize, "ptr")
    if !hFocus
        hFocus := NumGet(gti, 8, "ptr")
    hCaret := NumGet(gti, 8 + 5 * A_PtrSize, "ptr")

    ; 1) Caret Win32 chuẩn (Notepad, Office, hầu hết app desktop)
    if hCaret {
        off := 8 + 6 * A_PtrSize
        l := NumGet(gti, off, "int"), t := NumGet(gti, off + 4, "int")
        b := NumGet(gti, off + 12, "int")
        pt := Buffer(8, 0)
        NumPut("int", l, "int", t, pt)
        DllCall("ClientToScreen", "ptr", hCaret, "ptr", pt)
        x := NumGet(pt, 0, "int"), y := NumGet(pt, 4, "int"), h := b - t
        if ((x || y) && h > 0)
            return true
    }
    ; 2) MSAA OBJID_CARET (Chrome, Edge, Electron...)
    if (hFocus && AccCaret(hFocus, &x, &y, &h))
        return true
    return false
}

AccCaret(hwnd, &x, &y, &h) {
    static IID := 0
    if !IID {
        IID := Buffer(16)
        DllCall("ole32\CLSIDFromString", "wstr", "{618736E0-3C3D-11CF-810C-00AA00389B71}", "ptr", IID)
    }
    pacc := 0
    if (DllCall("oleacc\AccessibleObjectFromWindow", "ptr", hwnd, "uint", 0xFFFFFFF8
            , "ptr", IID, "ptr*", &pacc) != 0 || !pacc)
        return false
    acc := ComValue(9, pacc)
    xb := Buffer(4, 0), yb := Buffer(4, 0), wb := Buffer(4, 0), hb := Buffer(4, 0)
    try acc.accLocation(ComValue(0x4003, xb.Ptr), ComValue(0x4003, yb.Ptr)
                      , ComValue(0x4003, wb.Ptr), ComValue(0x4003, hb.Ptr), 0)
    catch
        return false
    x := NumGet(xb, "int"), y := NumGet(yb, "int"), h := NumGet(hb, "int")
    return ((x || y) && h > 0)
}

; ================== OVERLAY ==================
MakeOv(txt, color) {
    g := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale +E0x20 +E0x08000000 +E0x80000")
    g.MarginX := 0, g.MarginY := 0
    g.BackColor := color
    g.SetFont("s9 bold cWhite", "Segoe UI")
    g.AddText("x0 y0 w" OV_W " h" OV_H " Center 0x200", txt)
    g.Show("Hide w" OV_W " h" OV_H)
    DllCall("SetLayeredWindowAttributes", "ptr", g.Hwnd, "uint", 0, "uchar", 230, "uint", 2)
    return g
}

ShowOverlay(cx, cy, ch) {
    global gHideAt
    PlaceOverlay(cx, cy, ch)
    gHideAt := A_TickCount + SHOW_MS
    SetTimer(Follow, FOLLOW_MS)
}

PlaceOverlay(cx, cy, ch) {
    global gCurOv, gCurX, gCurY
    px := cx, py := cy - OV_H - 4
    if (py < MonitorTop(cx, cy))
        py := cy + ch + 4
    g := OVS[gMode = "" ? "?" : gMode]
    if (gCurOv && gCurOv != g)
        DllCall("ShowWindow", "ptr", gCurOv.Hwnd, "int", 0)
    if (g != gCurOv || px != gCurX || py != gCurY)
        DllCall("SetWindowPos", "ptr", g.Hwnd, "ptr", -1, "int", px, "int", py
            , "int", 0, "int", 0, "uint", 0x0051)   ; NOSIZE | NOACTIVATE | SHOWWINDOW
    gCurOv := g, gCurX := px, gCurY := py
}

Follow() {
    if (!ALWAYS_SHOW && A_TickCount >= gHideAt) {
        HideOverlay()
        return
    }
    if GetCaret(&cx, &cy, &ch, &hf)
        PlaceOverlay(cx, cy, ch)
    else
        HideWindowOnly()
}

HideOverlay() {
    if !ALWAYS_SHOW
        SetTimer(Follow, 0)
    HideWindowOnly()
}

HideWindowOnly() {
    global gCurOv
    if gCurOv
        DllCall("ShowWindow", "ptr", gCurOv.Hwnd, "int", 0)
    gCurOv := 0
}

MonitorTop(x, y) {
    Loop MonitorGetCount() {
        MonitorGet(A_Index, &l, &t, &r, &b)
        if (x >= l && x < r && y >= t && y < b)
            return t
    }
    return 0
}

; ================== HIỆU CHỈNH ==================
Calibrate(which) {
    global IconX, IconY, ColorV, ColorE
    if (which = "V") {
        MouseGetPos(&mx, &my)
        IconX := mx, IconY := my
    } else if (IconX < 0) {
        MsgBox "Hãy hiệu chỉnh chế độ V trước (Ctrl+Alt+F9).", "UniKey Overlay"
        return
    }
    MouseMove(IconX, IconY - 300, 0)   ; dời chuột ra để bỏ hiệu ứng hover của taskbar
    Sleep 400
    c := SampleColor(IconX, IconY)
    if (which = "V")
        ColorV := c
    else
        ColorE := c
    IniWrite(IconX, INI, "Tray", "X")
    IniWrite(IconY, INI, "Tray", "Y")
    IniWrite(ColorV, INI, "Tray", "ColorV")
    IniWrite(ColorE, INI, "Tray", "ColorE")

    msg := "Đã lưu màu " which " = " Format("0x{:06X}", c) " tại (" IconX "," IconY ")"
    if (ColorV >= 0 && ColorE >= 0) {
        d := ColorDist(ColorV, ColorE)
        msg .= (d < 80)
            ? "`nCẢNH BÁO: màu V và E quá giống nhau (" Round(d) "). Hãy chọn điểm khác trên icon rồi làm lại."
            : "`nHoàn tất! Độ khác màu = " Round(d)
    }
    TrayTip msg, "UniKey Overlay"
}

; ================== DỌN DẸP ==================
Cleanup(*) {
    for h in gHooks
        DllCall("UnhookWinEvent", "ptr", h)
    DllCall("SelectObject", "ptr", gMemDC, "ptr", gOldBmp)
    DllCall("DeleteObject", "ptr", gDib)
    DllCall("DeleteDC", "ptr", gMemDC)
    DllCall("ReleaseDC", "ptr", 0, "ptr", gScreenDC)
}