#define AppName "PeasyPrint Helper"
#define AppPublisher "PeasyPrints"
#define AppVersion "1.0.0"
#define AppExeName "PeasyPrint.Helper.exe"

; Source folder produced by packaging script: windows-helper/PeasyPrint.Helper/app
#define SourceAppDir "..\\PeasyPrint.Helper\\app"

[Setup]
AppId={{B3D7D5C7-3F6D-4E1E-8B7C-3B3D9E7A1A10}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={pf}\\PeasyPrint\\PeasyPrint.Helper
DefaultGroupName=PeasyPrint
DisableDirPage=no
DisableProgramGroupPage=yes
OutputBaseFilename=PeasyHelper-Win10
OutputDir=.
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
MinVersion=10.0
WizardStyle=modern
SetupLogging=yes
SetupIconFile=branding\\swoop.ico

; Optional: enable when you have a code signing setup
; SignTool=osslsigncode sign -pkcs12 "certs\\codesign.pfx" -pass "${PASSWORD}" -n "{#AppName}" -in "$f" -out "$f-signed"&osslsigncode attach-signature -in "$f" -out "$f" -sigin "$f-signed" -nest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "autoStart"; Description: "Start helper in tray after login"; Flags: checkedonce

[Files]
Source: "{#SourceAppDir}\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\\PeasyPrint Helper"; Filename: "{app}\\{#AppExeName}"; IconFilename: "{src}\\branding\\swoop.ico"
Name: "{commondesktop}\\PeasyPrint Helper"; Filename: "{app}\\{#AppExeName}"; IconFilename: "{src}\\branding\\swoop.ico"; Tasks: 

[Run]
Filename: "{app}\\{#AppExeName}"; Parameters: "--tray"; Description: "Launch in tray"; Flags: nowait postinstall skipifsilent

[Registry]
; Protocol registration: peasyprint://
Root: HKCR; Subkey: "peasyprint"; ValueType: string; ValueName: ""; ValueData: "URL:PeasyPrint Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "peasyprint"; ValueType: string; ValueName: "URL Protocol"; ValueData: "";
Root: HKCR; Subkey: "peasyprint\\shell\\open\\command"; ValueType: string; ValueName: ""; ValueData: '"{app}\\{#AppExeName}" "%1"'; Flags: uninsdeletekey

; Auto-start (all users) if selected
Root: HKLM; Subkey: "Software\\Microsoft\\Windows\\CurrentVersion\\Run"; ValueType: string; ValueName: "PeasyPrintHelper"; ValueData: '"{app}\\{#AppExeName}" --tray'; Tasks: autoStart; Flags: uninsdeletevalue

; Environment variables (user-scoped)
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "PEASYPRINT_API_KEY"; ValueData: "{code:GetApiKey}"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "PEASYPRINT_API_BASE"; ValueData: "{code:GetApiBase}"; Flags: uninsdeletevalue

[Code]
var
  ApiPage: TInputQueryWizardPage;
  ApiKey: string;
  ApiBase: string;

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
  if Result = '' then
    Result := ExpandConstant('{param:PEASYPRINT_API_KEY|}');
end;

function GetApiBase(Value: string): string;
begin
  Result := Trim(ApiPage.Values[1]);
  if Result = '' then
    Result := ExpandConstant('{param:PEASYPRINT_API_BASE|}');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = ApiPage.ID then
  begin
    if Trim(ApiPage.Values[0]) = '' then
    begin
      if MsgBox('No API key specified. Continue without setting PEASYPRINT_API_KEY?',
        mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDNO then
      begin
        Result := False;
        Exit;
      end;
    end;
  end;
end;


