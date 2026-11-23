' WorkBuddy Pet - independent desktop launcher
' Double-click this file to start the pet as a standalone process.
' It clears WorkBuddy's internal env vars that break Electron GUI mode.
Option Explicit

Dim shell, fso, root, exe, main
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
exe = root & "\node_modules\electron\dist\electron.exe"
main = root & "\src\electron-main.cjs"

If Not fso.FileExists(exe) Then
    MsgBox "Electron not found. Run 'npm install' first.", vbCritical, "WorkBuddy Pet"
    WScript.Quit 1
End If

' WorkBuddy sets ELECTRON_RUN_AS_NODE=1 globally; remove it for GUI mode.
shell.Environment("PROCESS").Remove("ELECTRON_RUN_AS_NODE")
shell.Environment("PROCESS").Remove("NODE_OPTIONS")

shell.CurrentDirectory = root
shell.Run """" & exe & """ """ & main & """", 1, False
