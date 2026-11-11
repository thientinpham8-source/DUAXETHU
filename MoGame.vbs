' =============================================
'  MoGame.vbs  —  Double-click to launch game
'  Runs launcher.ps1 with NO visible console.
' =============================================
Dim fso, shell, dir, ps

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

dir = fso.GetParentFolderName(WScript.ScriptFullName)
ps  = dir & "\launcher.ps1"

If Not fso.FileExists(ps) Then
    MsgBox "Khong tim thay file launcher.ps1!", vbCritical, "Loi"
    WScript.Quit 1
End If

shell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & ps & """", 0, False
