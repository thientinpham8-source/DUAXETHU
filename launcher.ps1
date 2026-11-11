# ============================================================
#  launcher.ps1  —  Đua Xe Thú Game Launcher
#  Shows a themed loading GUI, starts the Vite dev server,
#  opens the browser, then provides Stop / Reopen controls.
# ============================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Rounded-corner API
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class WinGdi {
    [DllImport("Gdi32.dll")]
    public static extern IntPtr CreateRoundRectRgn(int x1,int y1,int x2,int y2,int w,int h);
    [DllImport("user32.dll")]
    public static extern int SetWindowRgn(IntPtr hWnd,IntPtr hRgn,bool redraw);
}
"@ -ErrorAction SilentlyContinue

$projectDir = $PSScriptRoot
$serverUrl  = "http://127.0.0.1:3000"

# ---------- pre-flight: pnpm in PATH? ----------
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    [System.Windows.Forms.MessageBox]::Show(
        "Khong tim thay pnpm trong PATH.`nVui long cai dat Node.js va pnpm truoc.",
        "Loi", "OK", "Error") | Out-Null
    exit 1
}

# ============================================================
#  Palette  (matches game theme #1b1838)
# ============================================================
$bg       = [System.Drawing.ColorTranslator]::FromHtml("#1b1838")
$border   = [System.Drawing.ColorTranslator]::FromHtml("#302b55")
$trackBg  = [System.Drawing.ColorTranslator]::FromHtml("#252148")
$accent   = [System.Drawing.ColorTranslator]::FromHtml("#ffd35c")
$green    = [System.Drawing.ColorTranslator]::FromHtml("#4ade80")
$red      = [System.Drawing.ColorTranslator]::FromHtml("#f87171")
$sub      = [System.Drawing.ColorTranslator]::FromHtml("#8888aa")
$white    = [System.Drawing.Color]::White
$btnBg    = [System.Drawing.ColorTranslator]::FromHtml("#2a2650")
$btnHover = [System.Drawing.ColorTranslator]::FromHtml("#3a3670")
$stopHov  = [System.Drawing.ColorTranslator]::FromHtml("#3a2535")

# ============================================================
#  Form
# ============================================================
$W = 530; $H = 300
$form = New-Object System.Windows.Forms.Form
$form.Text            = "Dua Xe Thu"
$form.ClientSize      = New-Object System.Drawing.Size($W, $H)
$form.StartPosition   = "CenterScreen"
$form.FormBorderStyle = "None"
$form.BackColor       = $bg
$form.ShowInTaskbar   = $true
$form.TopMost         = $true

# rounded corners
$form.Add_Shown({
    try {
        $rgn = [WinGdi]::CreateRoundRectRgn(0, 0, $form.Width + 1, $form.Height + 1, 20, 20)
        [WinGdi]::SetWindowRgn($form.Handle, $rgn, $true) | Out-Null
    } catch {}
})

# border paint
$form.Add_Paint({
    param($s,$e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $pen = New-Object System.Drawing.Pen($border, 2)
    $r = 18; $rect = New-Object System.Drawing.Rectangle(1, 1, ($W-3), ($H-3))
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
    $gp.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
    $gp.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90)
    $gp.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
    $gp.CloseFigure()
    $g.DrawPath($pen, $gp)
    $pen.Dispose(); $gp.Dispose()
})

# ---- close button ----
$closeBtn = New-Object System.Windows.Forms.Label
$closeBtn.Text      = [string][char]0x2715
$closeBtn.Font      = New-Object System.Drawing.Font("Segoe UI", 11)
$closeBtn.ForeColor = $sub
$closeBtn.BackColor = $bg
$closeBtn.Size      = New-Object System.Drawing.Size(36, 28)
$closeBtn.Location  = New-Object System.Drawing.Point(($W - 44), 8)
$closeBtn.TextAlign = "MiddleCenter"
$closeBtn.Cursor    = [System.Windows.Forms.Cursors]::Hand
$closeBtn.Add_Click({ $form.Close() })
$closeBtn.Add_MouseEnter({ $closeBtn.ForeColor = $red })
$closeBtn.Add_MouseLeave({ $closeBtn.ForeColor = $sub })
$form.Controls.Add($closeBtn)

# ---- title ----
$titleLbl = New-Object System.Windows.Forms.Label
$titleLbl.Text      = "Dua Xe Thu"
$titleLbl.Font      = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
$titleLbl.ForeColor = $accent
$titleLbl.BackColor = $bg
$titleLbl.AutoSize  = $true
$titleLbl.Location  = New-Object System.Drawing.Point(36, 36)
$form.Controls.Add($titleLbl)

# ---- subtitle ----
$subLbl = New-Object System.Windows.Forms.Label
$subLbl.Text      = "Dua kart 3D cung sau thu con dang yeu"
$subLbl.Font      = New-Object System.Drawing.Font("Segoe UI", 10)
$subLbl.ForeColor = $sub
$subLbl.BackColor = $bg
$subLbl.AutoSize  = $true
$subLbl.Location  = New-Object System.Drawing.Point(40, 86)
$form.Controls.Add($subLbl)

# ---- progress track + fill ----
$barX = 36; $barY = 145; $barH = 12; $barW = $W - 72
$trackPanel = New-Object System.Windows.Forms.Panel
$trackPanel.Location  = New-Object System.Drawing.Point($barX, $barY)
$trackPanel.Size      = New-Object System.Drawing.Size($barW, $barH)
$trackPanel.BackColor = $trackBg
$form.Controls.Add($trackPanel)

$fillPanel = New-Object System.Windows.Forms.Panel
$fillPanel.Location  = New-Object System.Drawing.Point(0, 0)
$fillPanel.Size      = New-Object System.Drawing.Size(0, $barH)
$fillPanel.BackColor = $accent
$trackPanel.Controls.Add($fillPanel)

# ---- percentage ----
$pctLbl = New-Object System.Windows.Forms.Label
$pctLbl.Text      = "0 %"
$pctLbl.Font      = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$pctLbl.ForeColor = $accent
$pctLbl.BackColor = $bg
$pctLbl.AutoSize  = $true
$pctLbl.Location  = New-Object System.Drawing.Point(($W - 68), ($barY - 1))
$form.Controls.Add($pctLbl)

# ---- status ----
$statusLbl = New-Object System.Windows.Forms.Label
$statusLbl.Text      = "Dang chuan bi..."
$statusLbl.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
$statusLbl.ForeColor = $white
$statusLbl.BackColor = $bg
$statusLbl.AutoSize  = $true
$statusLbl.Location  = New-Object System.Drawing.Point(36, ($barY + $barH + 14))
$form.Controls.Add($statusLbl)

# ---- buttons (hidden until server ready) ----
$btnFont = New-Object System.Drawing.Font("Segoe UI", 10)
$btnH = 40; $btnW = 224; $btnY = $H - $btnH - 26

$openBtn = New-Object System.Windows.Forms.Button
$openBtn.Text      = "Mo trinh duyet"
$openBtn.Font      = $btnFont
$openBtn.Size      = New-Object System.Drawing.Size($btnW, $btnH)
$openBtn.Location  = New-Object System.Drawing.Point(36, $btnY)
$openBtn.FlatStyle = "Flat"
$openBtn.FlatAppearance.BorderSize = 0
$openBtn.BackColor = $btnBg
$openBtn.ForeColor = $white
$openBtn.Cursor    = [System.Windows.Forms.Cursors]::Hand
$openBtn.Visible   = $false
$openBtn.Add_Click({ Start-Process $serverUrl })
$openBtn.Add_MouseEnter({ $openBtn.BackColor = $btnHover })
$openBtn.Add_MouseLeave({ $openBtn.BackColor = $btnBg })
$form.Controls.Add($openBtn)

$stopBtn = New-Object System.Windows.Forms.Button
$stopBtn.Text      = "Dung va Thoat"
$stopBtn.Font      = $btnFont
$stopBtn.Size      = New-Object System.Drawing.Size(($W - $btnW - 84), $btnH)
$stopBtn.Location  = New-Object System.Drawing.Point(($btnW + 48), $btnY)
$stopBtn.FlatStyle = "Flat"
$stopBtn.FlatAppearance.BorderSize = 0
$stopBtn.BackColor = $btnBg
$stopBtn.ForeColor = $red
$stopBtn.Cursor    = [System.Windows.Forms.Cursors]::Hand
$stopBtn.Visible   = $false
$stopBtn.Add_Click({ $form.Close() })
$stopBtn.Add_MouseEnter({ $stopBtn.BackColor = $stopHov })
$stopBtn.Add_MouseLeave({ $stopBtn.BackColor = $btnBg })
$form.Controls.Add($stopBtn)

# ---- draggable ----
$script:drag = $false
$handler_down = { $script:drag = $true; $script:dO = [System.Windows.Forms.Cursor]::Position; $script:fO = $form.Location }
$handler_up   = { $script:drag = $false }
$handler_move = {
    if ($script:drag) {
        $c = [System.Windows.Forms.Cursor]::Position
        $form.Location = New-Object System.Drawing.Point(($script:fO.X+$c.X-$script:dO.X),($script:fO.Y+$c.Y-$script:dO.Y))
    }
}
foreach ($ctl in @($form, $titleLbl, $subLbl)) {
    $ctl.Add_MouseDown($handler_down)
    $ctl.Add_MouseUp($handler_up)
    $ctl.Add_MouseMove($handler_move)
}

# ============================================================
#  Process management
# ============================================================
$script:serverProc  = $null
$script:installProc = $null

function Start-Server {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName         = "cmd.exe"
    $psi.Arguments        = "/c pnpm dev"
    $psi.WorkingDirectory = $projectDir
    $psi.CreateNoWindow   = $true
    $psi.UseShellExecute  = $false
    $psi.WindowStyle      = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $script:serverProc    = [System.Diagnostics.Process]::Start($psi)
}

$needInstall = -not (Test-Path (Join-Path $projectDir "node_modules"))

if ($needInstall) {
    $statusLbl.Text = "Dang cai dat dependencies..."
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName         = "cmd.exe"
    $psi.Arguments        = "/c pnpm install"
    $psi.WorkingDirectory = $projectDir
    $psi.CreateNoWindow   = $true
    $psi.UseShellExecute  = $false
    $psi.WindowStyle      = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $script:installProc   = [System.Diagnostics.Process]::Start($psi)
} else {
    $statusLbl.Text = "Dang khoi dong server..."
    Start-Server
}

# ============================================================
#  Timer  — smooth animation + server polling
# ============================================================
$script:pct    = 0
$script:target = 12
$script:ready  = $false
$script:tick   = 0

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 60
$timer.Add_Tick({
    $script:tick++

    # ---- smooth ease-out ----
    if ($script:pct -lt $script:target) {
        $gap = $script:target - $script:pct
        $script:pct += [Math]::Max(0.2, $gap * 0.055)
        if ($script:pct -gt $script:target) { $script:pct = $script:target }
    }
    $ip = [int][Math]::Floor($script:pct)
    $fillPanel.Width = [int]($barW * $script:pct / 100)
    $pctLbl.Text = "$ip %"

    if ($script:ready) { return }

    # ---- timeout ~60 s ----
    if ($script:tick -gt 1000) {
        $timer.Stop()
        $statusLbl.Text      = "Qua thoi gian cho! Kiem tra lai project."
        $statusLbl.ForeColor = $red
        $fillPanel.BackColor = $red
        $pctLbl.ForeColor    = $red
        $stopBtn.Text = "  Dong  "
        $stopBtn.Visible = $true
        return
    }

    # ---- install phase ----
    if ($null -ne $script:installProc) {
        $script:target = [Math]::Min(45, $script:target + 0.1)
        if ($script:installProc.HasExited) {
            $script:installProc = $null
            $statusLbl.Text = "Dang khoi dong server..."
            Start-Server
            $script:target = 50
        }
        return
    }

    # ---- server phase: creep to 92% ----
    $script:target = [Math]::Min(92, $script:target + 0.07)

    # ---- poll every ~480 ms ----
    if (($script:tick % 8) -ne 0) { return }

    $dots = "." * ((($script:tick / 8) % 3) + 1)
    $statusLbl.Text = "Dang khoi dong server$dots"

    try {
        $req = [System.Net.WebRequest]::Create($serverUrl)
        $req.Timeout = 1200
        $req.Method  = "HEAD"
        $resp = $req.GetResponse()
        $resp.Close()

        # ---- READY ----
        $script:ready  = $true
        $timer.Interval = 25
        $script:target = 100
        $fillPanel.BackColor = $green
        $pctLbl.ForeColor    = $green
        $statusLbl.Text      = "Game dang chay tai cong 3000"
        $statusLbl.ForeColor = $green
        $subLbl.Text = "Server hoat dong — dong cua so nay de tat server"
        $form.TopMost = $false
        $openBtn.Visible = $true
        $stopBtn.Visible = $true
        Start-Process $serverUrl
    } catch {
        # not ready yet
    }
})
$timer.Start()

# ============================================================
#  Cleanup on close
# ============================================================
$form.Add_FormClosing({
    $timer.Stop(); $timer.Dispose()
    foreach ($p in @($script:serverProc, $script:installProc)) {
        if ($null -ne $p -and -not $p.HasExited) {
            try { Start-Process "taskkill.exe" -ArgumentList "/T","/F","/PID",$p.Id -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue } catch {}
        }
    }
})

# ============================================================
#  Go
# ============================================================
[System.Windows.Forms.Application]::EnableVisualStyles()
[void]$form.ShowDialog()
$form.Dispose()
