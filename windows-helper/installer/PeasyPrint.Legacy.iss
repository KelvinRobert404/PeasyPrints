#define AppName "PeasyPrint Helper (Legacy)"
#define AppPublisher "PeasyPrints"
#define AppVersion "1.0.0"
#define AppExeName "PeasyPrint.Helper.Legacy.exe"

; Expected legacy app publish folder (to be created by future build):
#define SourceAppDir "..\\PeasyPrint.Helper.Legacy\\app"

[Setup]
AppId={{C2A9C8B1-0D31-4F4B-A2A2-8F0B6E3A9B12}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={pf}\\PeasyPrint\\PeasyPrint.Helper.Legacy
DefaultGroupName=PeasyPrint
DisableDirPage=no
DisableProgramGroupPage=yes
OutputBaseFilename=PeasyHelper-Win7
OutputDir=.
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
MinVersion=6.1
WizardStyle=modern
SetupLogging=yes
SetupIconFile=branding\\swoop.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "autoStart"; Description: "Start helper in tray after login"; Flags: checkedonce

[Files]
Source: "{#SourceAppDir}\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Bundle SumatraPDF for non-silent print dialog on Win7 (place in installer folder under files\)
Source: "files\\SumatraPDF.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\\PeasyPrint Helper (Legacy)"; Filename: "{app}\\{#AppExeName}"; IconFilename: "{src}\\branding\\swoop.ico"

[Run]
; Optional: bootstrap .NET Framework 4.8 if missing (place offline installer in files\\ndp48.exe)
; Filename: "{tmp}\\ndp48.exe"; Parameters: "/quiet /norestart"; StatusMsg: "Installing .NET Framework 4.8..."; Flags: skipifdoesntexist
Filename: "{app}\\{#AppExeName}"; Parameters: "--tray"; Description: "Launch in tray"; Flags: nowait postinstall skipifsilent

[Registry]
; Protocol registration: peasyprint://
Root: HKCR; Subkey: "peasyprint"; ValueType: string; ValueName: ""; ValueData: "URL:PeasyPrint Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "peasyprint"; ValueType: string; ValueName: "URL Protocol"; ValueData: "";
Root: HKCR; Subkey: "peasyprint\\shell\\open\\command"; ValueType: string; ValueName: ""; ValueData: '"{app}\\{#AppExeName}" "%1"'; Flags: uninsdeletekey

; Auto-start (all users) if selected
Root: HKLM; Subkey: "Software\\Microsoft\\Windows\\CurrentVersion\\Run"; ValueType: string; ValueName: "PeasyPrintHelperLegacy"; ValueData: '"{app}\\{#AppExeName}" --tray'; Tasks: autoStart; Flags: uninsdeletevalue

; Environment variables (user-scoped)
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "PEASYPRINT_API_KEY"; ValueData: "{code:GetApiKey}"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "PEASYPRINT_API_BASE"; ValueData: "{code:GetApiBase}"; Flags: uninsdeletevalue

[Code]
function IsDotNet48Installed: Boolean;
var
  Release: Cardinal;
begin
  Result := RegQueryDWordValue(HKLM, 'SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full', 'Release', Release) and (Release >= 528040);
end;

var
  ApiPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ApiPage := CreateInputQueryPage(wpSelectDir,
    'API Configuration',
    'Configure backend access for the helper.',
    'Enter the values used to authenticate and reach your backend API.');
  ApiPage.Add('API Key (PEASYPRINT_API_KEY):', False);
  ApiPage.Add('API Base (PEASYPRINT_API_BASE, optional):', False);
end;

function GetApiKey(Value: string): string;
begin
  Result := Trim(ApiPage.Values[0]);
end;

function GetApiBase(Value: string): string;
begin
  Result := Trim(ApiPage.Values[1]);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  if not IsDotNet48Installed then
  begin
    Result := 'Microsoft .NET Framework 4.8 is required. Please install it first, then re-run this installer.';
  end;
end;


