@echo off
REM ==============================================================
REM  export_all_source.bat  (1 FILE DUY NHAT - khong can .ps1)
REM  Cach dung:
REM     export_all_source.bat
REM     export_all_source.bat -Root "D:\project" -Output D:\out.txt
REM  Cau hinh loai tru file/thu muc: sua trong phan CONFIG o duoi.
REM ==============================================================
setlocal
set "EXPORT_SELF_PATH=%~f0"
set "TMPPS=%TEMP%\export_all_source_%RANDOM%%RANDOM%.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$m='#PSCODE'+'BEGIN#'; $l=Get-Content -LiteralPath '%~f0' -Encoding UTF8; $i=($l | Select-String -SimpleMatch $m | Select-Object -Last 1).LineNumber; $l | Select-Object -Skip $i | Set-Content -LiteralPath '%TMPPS%' -Encoding UTF8"
powershell -NoProfile -ExecutionPolicy Bypass -File "%TMPPS%" %*
del "%TMPPS%" >nul 2>&1
echo.
pause
exit /b
REM #PSCODEBEGIN#
<#
    Gop noi dung tat ca file con/chau trong 1 thu muc vao all_source.txt
    - Duong dan hien thi la duong dan TUONG DOI tu thu muc goc
    - Ho tro tieng Han / Unicode
    - Danh sach loai tru duoc cau hinh ngay trong phan CONFIG ben duoi
#>

[CmdletBinding()]
param(
    # Thu muc goc can quet (mac dinh: thu muc hien tai)
    [string]$Root = (Get-Location).Path,

    # File ket qua
    [string]$Output = "all_source.txt"
)

$ErrorActionPreference = 'Stop'

# ==================================================================
# ======================== CONFIG - SUA O DAY ======================
# ==================================================================

# --- Ten thu muc BO QUA (moi cap, ho tro wildcard) ---
$ExcludeDirs = @(
    '.git', '.svn', '.idea', '.vscode', '.settings',
    'node_modules', 'target', 'build', 'out', 'bin', 'obj',
    'dist', '.gradle', '.mvn', '__pycache__', 'venv', '.venv',
    'logs', 'coverage'
)

# --- Phan mo rong file BO QUA ---
$ExcludeExts = @(
    '.class', '.jar', '.war', '.ear', '.exe', '.dll', '.so', '.o', '.obj', '.pdb',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.pdf', '.xls', '.xlsx', '.doc', '.docx', '.ppt', '.pptx',
    '.mp3', '.mp4', '.avi', '.ttf', '.woff', '.woff2',
    '.lock', '.bin', '.dat'
)

# --- Mau TEN FILE bo qua (wildcard) ---
$ExcludeFiles = @(
    'all_source.txt',
    'export_all_source.bat',
    '*.log',
    'Thumbs.db',
    '.DS_Store'
)

# --- Neu khai bao, CHI lay cac duoi nay (bo qua $ExcludeExts) ---
#     Vi du: $IncludeExts = @('.java', '.xml', '.sql')
$IncludeExts = @()

# --- Bo qua file lon hon N MB (0 = khong gioi han) ---
$MaxFileSizeMB = 5

# --- Bo qua file nhi phan (tu phat hien qua byte 0x00) ---
$SkipBinary = $true

# ==================================================================
# ===================== HET PHAN CONFIG ============================
# ==================================================================

# ---------- Chuan hoa duong dan ----------
$Root = (Resolve-Path -LiteralPath $Root).Path
if (-not [System.IO.Path]::IsPathRooted($Output)) {
    $Output = Join-Path (Get-Location).Path $Output
}

# Duong dan file .bat dang chay (do batch truyen sang) -> luon tu loai tru
$SelfPath = $env:EXPORT_SELF_PATH

Write-Host "Root  : $Root"
Write-Host "Output: $Output"
Write-Host ""

# ---------- Ham phu ----------
function Test-ExcludedPath {
    param([string]$FullPath)
    $rel = $FullPath.Substring($Root.Length).TrimStart('\', '/')
    $parts = $rel -split '[\\/]'
    if ($parts.Count -gt 1) {
        foreach ($p in $parts[0..($parts.Count - 2)]) {
            foreach ($d in $ExcludeDirs) {
                if ($p -like $d) { return $true }
            }
        }
    }
    return $false
}

function Test-IsBinary {
    param([string]$Path)
    try {
        $fs = [System.IO.File]::OpenRead($Path)
        try {
            $len = [Math]::Min(4096, $fs.Length)
            if ($len -eq 0) { return $false }
            $buf = New-Object byte[] $len
            [void]$fs.Read($buf, 0, $len)
            if ($len -ge 2 -and (($buf[0] -eq 0xFF -and $buf[1] -eq 0xFE) -or ($buf[0] -eq 0xFE -and $buf[1] -eq 0xFF))) {
                return $false
            }
            foreach ($b in $buf) { if ($b -eq 0) { return $true } }
            return $false
        } finally { $fs.Dispose() }
    } catch { return $true }
}

function Read-TextSmart {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -eq 0) { return '' }

    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    }
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        return [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
    }
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        return [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2)
    }

    try {
        $utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
        return $utf8Strict.GetString($bytes)
    } catch {
        foreach ($cp in 949, 1258) {
            try { return [System.Text.Encoding]::GetEncoding($cp).GetString($bytes) } catch { }
        }
        return [System.Text.Encoding]::Default.GetString($bytes)
    }
}

# ---------- Thu thap file ----------
$allFiles = Get-ChildItem -LiteralPath $Root -Recurse -File -Force -ErrorAction SilentlyContinue

$maxBytes = if ($MaxFileSizeMB -gt 0) { [int64]($MaxFileSizeMB * 1MB) } else { [int64]::MaxValue }

$selected = @()
$skipped = @()

foreach ($f in $allFiles) {

    # Khong lay file ket qua va khong lay chinh file script .bat
    if ($f.FullName -eq $Output) { continue }
    if ($SelfPath -and $f.FullName -eq $SelfPath) { continue }

    if (Test-ExcludedPath $f.FullName) { continue }

    $ext = $f.Extension.ToLower()

    $nameExcluded = $false
    foreach ($pat in $ExcludeFiles) { if ($f.Name -like $pat) { $nameExcluded = $true; break } }
    if ($nameExcluded) { continue }

    if ($IncludeExts.Count -gt 0) {
        if ($IncludeExts -notcontains $ext) { continue }
    } elseif ($ExcludeExts -contains $ext) {
        continue
    }

    if ($f.Length -gt $maxBytes) {
        $rel = $f.FullName.Substring($Root.Length).TrimStart('\', '/')
        $skipped += "$rel  [qua lon: $([math]::Round($f.Length/1MB,2)) MB]"
        continue
    }
    if ($SkipBinary -and (Test-IsBinary $f.FullName)) {
        $rel = $f.FullName.Substring($Root.Length).TrimStart('\', '/')
        $skipped += "$rel  [binary]"
        continue
    }

    $selected += $f
}

$selected = $selected | Sort-Object FullName

# ---------- Ghi ket qua ----------
$sb = New-Object System.Text.StringBuilder
$null = $sb.AppendLine("==================================================================")
$null = $sb.AppendLine("ALL SOURCE EXPORT")
$null = $sb.AppendLine("Root      : $Root")
$null = $sb.AppendLine("Generated : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$null = $sb.AppendLine("Files     : $($selected.Count)")
$null = $sb.AppendLine("==================================================================")
$null = $sb.AppendLine()

$i = 0
foreach ($f in $selected) {
    $i++
    $rel = $f.FullName.Substring($Root.Length).TrimStart('\', '/')
    Write-Host ("[{0}/{1}] {2}" -f $i, $selected.Count, $rel)

    $null = $sb.AppendLine("==================== START FILE: $rel ====================")
    $null = $sb.AppendLine("SIZE: $($f.Length) bytes")
    $null = $sb.AppendLine("------------------------------------------------------------------")
    try {
        $null = $sb.AppendLine((Read-TextSmart $f.FullName))
    } catch {
        $null = $sb.AppendLine("<<< KHONG DOC DUOC FILE: $($_.Exception.Message) >>>")
    }
    $null = $sb.AppendLine("===================== END FILE: $rel =====================")
    $null = $sb.AppendLine()
}

if ($skipped.Count -gt 0) {
    $null = $sb.AppendLine("==================================================================")
    $null = $sb.AppendLine("SKIPPED FILES ($($skipped.Count))")
    $null = $sb.AppendLine("==================================================================")
    foreach ($s in $skipped) { $null = $sb.AppendLine($s) }
}

[System.IO.File]::WriteAllText($Output, $sb.ToString(), (New-Object System.Text.UTF8Encoding($true)))

Write-Host ""
Write-Host "DONE -> $Output" -ForegroundColor Green
Write-Host "Included: $($selected.Count) file | Skipped: $($skipped.Count) file"
