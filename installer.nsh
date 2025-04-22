!include "LogicLib.nsh"
!include "FileFunc.nsh"

!macro customInit
  # Skip Node.js setup during installation - we'll handle it at runtime
  DetailPrint "Node.js setup will be handled at runtime"
!macroend 