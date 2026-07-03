import subprocess
import re
import win32api
import win32process
import sys
import os
import json
import base64
import io
import win32com.client
import win32gui
import win32ui
import win32con
from PIL import Image

from PyQt6.QtWidgets import QApplication, QMainWindow
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEnginePage
from PyQt6.QtCore import QUrl, Qt, QThread, pyqtSignal
import keyboard
import time
import threading

def get_icon_base64_robust(shortcut):
    icon_location = shortcut.IconLocation
    target_path = shortcut.TargetPath
    
    path, index = None, 0
    if icon_location and ',' in icon_location:
        parts = icon_location.split(',')
        path_str = ",".join(parts[:-1]).strip()
        index_str = parts[-1].strip()
        path_str = os.path.expandvars(path_str)
        if os.path.exists(path_str):
            path = path_str
            try:
                index = int(index_str)
            except ValueError:
                index = 0
                
    if not path and target_path:
        target_path = os.path.expandvars(target_path)
        if os.path.exists(target_path):
            path = target_path
            index = 0

    if not path:
        return None

    try:
        lower_path = path.lower()
        if lower_path.endswith('.ico'):
            img = Image.open(path)
            img = img.convert('RGBA')
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return f"data:image/png;base64,{img_str}"
            
        elif lower_path.endswith(('.exe', '.dll', '.lnk')):
            use_icon = None
            ret = win32gui.ExtractIconEx(path, index)
            if isinstance(ret, tuple) and len(ret) == 2:
                large, small = ret
                use_icon = large[0] if large else small[0] if small else None
            
            if not use_icon and index != 0:
                ret = win32gui.ExtractIconEx(path, 0)
                if isinstance(ret, tuple) and len(ret) == 2:
                    large, small = ret
                    use_icon = large[0] if large else small[0] if small else None
                
            if not use_icon:
                return None
                
            hdc = win32ui.CreateDCFromHandle(win32gui.GetDC(0))
            hbmp = win32ui.CreateBitmap()
            hbmp.CreateCompatibleBitmap(hdc, 256, 256)
            hdc = hdc.CreateCompatibleDC()
            hdc.SelectObject(hbmp)
            hdc.DrawIcon((0, 0), use_icon)
            
            bmpstr = hbmp.GetBitmapBits(True)
            img = Image.frombuffer('RGBA', (256, 256), bmpstr, 'raw', 'BGRA', 0, 1)
            
            bbox = img.getbbox()
            if bbox:
                img = img.crop(bbox)
                
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            win32gui.DestroyIcon(use_icon)
            return f"data:image/png;base64,{img_str}"
            
    except Exception as e:
        print(f"Robust icon extraction error for {path}: {e}")
        
    return None

UWP_LOCATIONS = {}
WIFI_ENABLED = True

def init_uwp_locations():
    global UWP_LOCATIONS
    try:
        import subprocess
        cmd = "Get-AppxPackage | Select-Object PackageFamilyName, InstallLocation | ConvertTo-Json"
        out = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True, errors='ignore').stdout.strip()
        if out:
            data = json.loads(out)
            if isinstance(data, list):
                for item in data:
                    fam = item.get("PackageFamilyName")
                    loc = item.get("InstallLocation")
                    if fam and loc:
                        UWP_LOCATIONS[fam.lower()] = loc
            elif isinstance(data, dict):
                fam = data.get("PackageFamilyName")
                loc = data.get("InstallLocation")
                if fam and loc:
                    UWP_LOCATIONS[fam.lower()] = loc
    except Exception as e:
        print(f"Error initializing UWP location list: {e}")

def find_uwp_logo_icon(parsing_path):
    if "!" not in parsing_path:
        return None
    family_name = parsing_path.split("!")[0].lower()
    folder_path = UWP_LOCATIONS.get(family_name)
    if not folder_path or not os.path.exists(folder_path):
        return None
    try:
        manifest_path = os.path.join(folder_path, "AppxManifest.xml")
        if os.path.exists(manifest_path):
            with open(manifest_path, 'r', encoding='utf-8', errors='ignore') as f:
                xml_content = f.read()
            
            logo_rel = None
            for attr in ["Square44x44Logo", "Square30x30Logo", "Square71x71Logo", "Square150x150Logo", "Logo"]:
                matches = re.findall(f'{attr}="([^"]+)"', xml_content)
                if matches:
                    logo_rel = matches[0]
                    break
                    
            if logo_rel:
                logo_name = os.path.basename(logo_rel)
                logo_dir_rel = os.path.dirname(logo_rel)
                logo_dir = os.path.join(folder_path, logo_dir_rel)
                
                if os.path.exists(logo_dir):
                    logo_base = logo_name.replace(".png", "")
                    candidates = []
                    for file in os.listdir(logo_dir):
                        if file.startswith(logo_base) and file.lower().endswith(('.png', '.jpg', '.jpeg')):
                            candidates.append(os.path.join(logo_dir, file))
                    
                    def get_resolution_score(file_path):
                        fname = os.path.basename(file_path).lower()
                        matches = re.findall(r'(?:targetsize-|scale-)(\d+)', fname)
                        if matches:
                            return int(matches[0])
                        return 0
                        
                    candidates = sorted(candidates, key=get_resolution_score, reverse=True)
                    if candidates:
                        img = Image.open(candidates[0])
                        img = img.convert('RGBA')
                        buffered = io.BytesIO()
                        img.save(buffered, format="PNG")
                        return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"
    except Exception as e:
        pass
    return None

def get_apps_json():
    if not UWP_LOCATIONS:
        init_uwp_locations()

    shell = win32com.client.Dispatch("WScript.Shell")
    paths = [
        r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
        os.path.expanduser(r"~\AppData\Roaming\Microsoft\Windows\Start Menu\Programs")
    ]
    apps = []
    seen_names = set()
    
    # Junk filter keywords for both classic and UWP apps
    junk_keywords = [
        "manual", "docs", "document", "readme", "uninstall", "help", "license", 
        "release notes", "website", "wiki", "support", "faq", "how to", "howto", 
        "add a new", "setup", "install", "feedback", "web site", "reference", 
        "configuration tool", "virtual network adapter", "diagnostic"
    ]
    
    # 1. Classic App Lnk scan
    for path in paths:
        if not os.path.exists(path): continue
        for root, dirs, files in os.walk(path):
            for file in files:
                if file.endswith('.lnk'):
                    full_path = os.path.join(root, file)
                    try:
                        shortcut = shell.CreateShortCut(full_path)
                        target = shortcut.TargetPath
                        name = file.replace('.lnk', '')
                        name_lower = name.lower()
                        target_lower = target.lower() if target else ""
                        
                        # Filter by extensions
                        if any(target_lower.endswith(ext) for ext in [".txt", ".html", ".chm", ".pdf", ".url"]) or target_lower.startswith("http"):
                            continue
                            
                        # Filter by junk words in name or target
                        if any(x in name_lower or x in target_lower for x in junk_keywords):
                            continue
                            
                        if name in seen_names:
                            continue
                        
                        extracted = get_icon_base64_robust(shortcut)
                        if extracted:
                            seen_names.add(name)
                            apps.append({'name': name, 'path': full_path, 'target': target, 'icon': extracted})
                    except Exception:
                        pass
                        
    # 2. UWP App scan via shell:AppsFolder
    try:
        sh_app = win32com.client.Dispatch("Shell.Application")
        apps_folder = sh_app.NameSpace("shell:AppsFolder")
        if apps_folder:
            for item in apps_folder.Items():
                name = item.Name
                path = item.Path
                if "!" in path:  # It's a UWP app
                    name_lower = name.lower()
                    if name in seen_names:
                        continue
                        
                    if any(x in name_lower for x in junk_keywords):
                        continue
                        
                    icon_b64 = find_uwp_logo_icon(path)
                    if icon_b64:
                        seen_names.add(name)
                        launch_path = "shell:AppsFolder\\" + path
                        apps.append({
                            'name': name,
                            'path': launch_path,
                            'target': launch_path,
                            'icon': icon_b64
                        })
    except Exception as e:
        print(f"Error scanning UWP apps: {e}")
        
    apps = sorted(apps, key=lambda x: x['name'])
    return json.dumps(apps)

def get_wallpapers_json():
    ui_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui')
    images_dir = os.path.join(ui_dir, 'images')
    wallpapers = []
    if os.path.exists(images_dir):
        for file in os.listdir(images_dir):
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                wallpapers.append(f"images/{file}")
    return json.dumps(wallpapers)

def get_desktop_files_json():
    import win32com.client
    shell = win32com.client.Dispatch("WScript.Shell")
    paths_to_check = [
        shell.SpecialFolders("Desktop"),
        os.path.expanduser(r"~\Desktop"),
        os.path.expanduser(r"~\OneDrive\Desktop")
    ]
    
    files_list = []
    seen_files = set()
    
    for desktop_path in paths_to_check:
        if not desktop_path or not os.path.exists(desktop_path):
            continue
            
        for file in os.listdir(desktop_path):
            if file.lower() == 'desktop.ini': continue
            if file in seen_files: continue
            
            seen_files.add(file)
            full_path = os.path.join(desktop_path, file)
            is_dir = os.path.isdir(full_path)
            files_list.append({
                'name': file,
                'path': full_path.replace("\\", "\\\\"),
                'is_dir': is_dir
            })
            
    files_list = sorted(files_list, key=lambda x: (not x['is_dir'], x['name'].lower()))
    return json.dumps(files_list)

def get_open_windows():
    def callback(hwnd, windows):
        if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowTextLength(hwnd) > 0:
            title = win32gui.GetWindowText(hwnd)
            class_name = win32gui.GetClassName(hwnd)
            if class_name not in ["Progman", "Windows.UI.Core.CoreWindow", "ApplicationFrameWindow", "Shell_TrayWnd"] and "Nexus OS Desktop" not in title:
                if win32gui.GetWindow(hwnd, win32con.GW_OWNER) == 0:
                    exe_path = None
                    try:
                        _, pid = win32process.GetWindowThreadProcessId(hwnd)
                        handle = win32api.OpenProcess(win32con.PROCESS_QUERY_INFORMATION | win32con.PROCESS_VM_READ, False, pid)
                        exe_path = win32process.GetModuleFileNameEx(handle, 0)
                        win32api.CloseHandle(handle)
                    except Exception:
                        pass
                    windows.append({'hwnd': hwnd, 'title': title, 'path': exe_path})
        return True
    windows = []
    win32gui.EnumWindows(callback, windows)
    return windows

class CustomWebPage(QWebEnginePage):
    def javaScriptConsoleMessage(self, level, msg, line, sourceID):
        if msg.startswith("LAUNCH:"):
            app_path = msg.replace("LAUNCH:", "")
            try:
                os.startfile(app_path)
                print(f"Launched: {app_path}")
            except Exception as e:
                print(f"Failed to launch {app_path}: {e}")
        elif msg.startswith("FOCUS:"):
            hwnd = int(msg.replace("FOCUS:", ""))
            try:
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                win32gui.SetForegroundWindow(hwnd)
            except Exception as e:
                print(f"Failed to focus {hwnd}: {e}")
        elif msg == "SHUTDOWN":
            print("Initiating system shutdown...")
            os.system("shutdown /s /t 0")
        elif msg == "RESTART":
            print("Initiating system restart...")
            os.system("shutdown /r /t 0")
        elif msg == "SLEEP":
            print("Initiating system sleep...")
            os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
        elif msg.startswith("SET_VOLUME:"):
            try:
                val = int(msg.split(":")[1])
                print(f"Volume request: {val}%")
                import pythoncom
                pythoncom.CoInitialize()
                from pycaw.pycaw import AudioUtilities
                devices = AudioUtilities.GetSpeakers()
                volume = devices.EndpointVolume
                volume.SetMasterVolumeLevelScalar(val / 100.0, None)
                pythoncom.CoUninitialize()
            except Exception as e:
                print(f"Failed to set volume: {e}")
        elif msg.startswith("SET_BRIGHTNESS:"):
            try:
                val = int(msg.split(":")[1])
                print(f"Brightness request: {val}%")
                import wmi
                c = wmi.WMI(namespace='wmi')
                methods = c.WmiMonitorBrightnessMethods()
                if methods:
                    methods[0].WmiSetBrightness(val, 0)
            except Exception as e:
                print(f"Failed to set brightness: {e}")
        elif msg.startswith("SET_ACCENT:"):
            print(f"Accent Color changed: {msg}")
        elif msg.startswith("TOGGLE_OPTION:"):
            global WIFI_ENABLED
            print(f"Toggle Option updated: {msg}")
            label = msg.split(":")[1]
            status = msg.split(":")[2] == "true"
            if label == "Wi-Fi" or label == "Wifi":
                WIFI_ENABLED = status
                if not status:
                    subprocess.run(["netsh", "wlan", "disconnect"], capture_output=True)
        elif msg.startswith("CONNECT_WIFI:"):
            parts = msg.replace("CONNECT_WIFI:", "").split("|")
            ssid = parts[0]
            password = parts[1] if len(parts) > 1 else ""
            print(f"Connecting to Wi-Fi SSID: {ssid} (Has password: {bool(password)})")
            if password:
                xml_content = f'''<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>{ssid}</name>
    <SSIDConfig>
        <SSID>
            <name>{ssid}</name>
        </SSID>
    </SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM>
        <security>
            <authEncryption>
                <authentication>WPA2PSK</authentication>
                <encryption>AES</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
            <sharedKey>
                <keyType>passPhrase</keyType>
                <protected>false</protected>
                <keyMaterial>{password}</keyMaterial>
            </sharedKey>
        </security>
    </MSM>
</WLANProfile>'''
            else:
                xml_content = f'''<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>{ssid}</name>
    <SSIDConfig>
        <SSID>
            <name>{ssid}</name>
        </SSID>
    </SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM>
        <security>
            <authEncryption>
                <authentication>open</authentication>
                <encryption>none</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
        </security>
    </MSM>
</WLANProfile>'''
            temp_xml = os.path.join(os.environ.get('TEMP', 'C:\\Windows\\Temp'), "temp_wifi_profile.xml")
            try:
                with open(temp_xml, 'w', encoding='utf-8') as f_xml:
                    f_xml.write(xml_content)
                subprocess.run(["netsh", "wlan", "add", "profile", f"filename={temp_xml}"], capture_output=True)
                os.remove(temp_xml)
            except Exception as e_xml:
                print("Error writing profile:", e_xml)
            subprocess.run(["netsh", "wlan", "connect", f"name={ssid}"], capture_output=True)
        elif msg.startswith("DISCONNECT_WIFI:"):
            print("Disconnecting from Wi-Fi...")
            subprocess.run(["netsh", "wlan", "disconnect"], capture_output=True)
        elif msg.startswith("TOGGLE_HOTSPOT:"):
            status = msg.split(":")[1] == "true"
            print(f"Toggling mobile hotspot: {status}")
            ps_code = f'''
            $connectionProfile = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime]::GetInternetConnectionProfile()
            $tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime]::CreateFromConnectionProfile($connectionProfile)
            if ("{str(status).lower()}" -eq "true") {{
                $tetheringManager.StartTetheringAsync()
            }} else {{
                $tetheringManager.StopTetheringAsync()
            }}
            '''
            subprocess.run(["powershell", "-Command", ps_code], capture_output=True)
        elif msg == "TRIGGER_TASK_VIEW":
            print("Opening Windows Task View...")
            keyboard.send("windows+tab")
        elif msg == "OPEN_DISPLAY_SETTINGS":
            print("Opening Windows Display Settings...")
            os.system("start ms-settings:display")
        elif msg == "OPEN_PERSONALIZATION":
            print("Opening Windows Personalization Settings...")
            os.system("start ms-settings:personalization")
        elif msg == "REFRESH_DESKTOP":
            print("Refreshing desktop...")
            self.main_window.scanner = ScannerThread()
            self.main_window.scanner.desktop_ready.connect(self.main_window.inject_desktop)
            self.main_window.scanner.start()
        elif msg.startswith("CREATE_FOLDER:"):
            folder_name = msg.replace("CREATE_FOLDER:", "")
            print(f"Creating new desktop folder: {folder_name}")
            try:
                # Find desktop folder path
                import win32com.client
                shell = win32com.client.Dispatch("WScript.Shell")
                desktop_path = shell.SpecialFolders("Desktop")
                new_dir = os.path.join(desktop_path, folder_name)
                os.makedirs(new_dir, exist_ok=True)
                # Rescan desktop files
                self.main_window.scanner = ScannerThread()
                self.main_window.scanner.desktop_ready.connect(self.main_window.inject_desktop)
                self.main_window.scanner.start()
            except Exception as e:
                print(f"Failed to create folder: {e}")
        elif msg.startswith("RENAME_FILE:"):
            parts = msg.replace("RENAME_FILE:", "").split("|")
            old_path = parts[0]
            new_name = parts[1] if len(parts) > 1 else ""
            if old_path and new_name:
                try:
                    new_path = os.path.join(os.path.dirname(old_path), new_name)
                    os.rename(old_path, new_path)
                    print(f"Renamed: {old_path} -> {new_path}")
                    self.main_window.scanner = ScannerThread()
                    self.main_window.scanner.desktop_ready.connect(self.main_window.inject_desktop)
                    self.main_window.scanner.start()
                except Exception as e:
                    print(f"Failed to rename: {e}")
        elif msg.startswith("DELETE_FILE:"):
            file_path = msg.replace("DELETE_FILE:", "")
            if file_path:
                try:
                    import shutil
                    if os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                    else:
                        os.remove(file_path)
                    print(f"Deleted: {file_path}")
                    self.main_window.scanner = ScannerThread()
                    self.main_window.scanner.desktop_ready.connect(self.main_window.inject_desktop)
                    self.main_window.scanner.start()
                except Exception as e:
                    print(f"Failed to delete: {e}")
        elif msg.startswith("FILE_PROPERTIES:"):
            file_path = msg.replace("FILE_PROPERTIES:", "")
            if file_path and os.path.exists(file_path):
                try:
                    stat = os.stat(file_path)
                    size_kb = stat.st_size / 1024
                    from datetime import datetime
                    modified = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M')
                    created = datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M')
                    is_dir = os.path.isdir(file_path)
                    info = f"Name: {os.path.basename(file_path)}\\nType: {'Folder' if is_dir else 'File'}\\nSize: {size_kb:.1f} KB\\nPath: {file_path}\\nCreated: {created}\\nModified: {modified}"
                    self.page.runJavaScript(f'alert("{info}")')
                except Exception as e:
                    print(f"Failed to get properties: {e}")
        else:
            print(f"JS: {msg}")

def get_connected_wifi():
    try:
        import subprocess
        out = subprocess.run(["netsh", "wlan", "show", "interfaces"], capture_output=True, text=True, errors='ignore').stdout
        for line in out.split('\n'):
            if "SSID" in line and "BSSID" not in line:
                return line.split(":")[1].strip()
    except Exception:
        pass
    return None

def get_wifi_networks():
    try:
        import subprocess
        connected = get_connected_wifi()
        out = subprocess.run(["netsh", "wlan", "show", "networks"], capture_output=True, text=True, errors='ignore').stdout
        networks = []
        seen = set()
        if connected:
            networks.append({'ssid': connected, 'status': 'Connected'})
            seen.add(connected)
        for line in out.split('\n'):
            if "SSID" in line and ":" in line:
                ssid = line.split(":")[1].strip()
                if ssid and ssid not in seen:
                    networks.append({'ssid': ssid, 'status': 'Available'})
                    seen.add(ssid)
        return json.dumps(networks)
    except Exception:
        return json.dumps([
            {'ssid': 'Nexus_5G', 'status': 'Connected'},
            {'ssid': 'Guest_Net', 'status': 'Available'},
            {'ssid': 'Home_Router', 'status': 'Available'}
        ])

def get_hotspot_config():
    try:
        import subprocess
        ps_code = """
        $connectionProfile = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType=WindowsRuntime]::GetInternetConnectionProfile()
        $tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType=WindowsRuntime]::CreateFromConnectionProfile($connectionProfile)
        $accessPoint = $tetheringManager.GetCurrentAccessPointConfiguration()
        Write-Output "SSID:$($accessPoint.Ssid)"
        Write-Output "Password:$($accessPoint.Passphrase)"
        Write-Output "Devices:$($tetheringManager.ClientCount)"
        Write-Output "Status:$($tetheringManager.TetheringOperationalState)"
        """
        out = subprocess.run(["powershell", "-Command", ps_code], capture_output=True, text=True, errors='ignore').stdout
        ssid, password, devices, status = "", "", "0", "Off"
        for line in out.split('\n'):
            if line.startswith("SSID:"):
                ssid = line.split(":", 1)[1].strip()
            elif line.startswith("Password:"):
                password = line.split(":", 1)[1].strip()
            elif line.startswith("Devices:"):
                devices = line.split(":", 1)[1].strip()
            elif line.startswith("Status:"):
                status = line.split(":", 1)[1].strip()
        return json.dumps({
            'ssid': ssid,
            'password': password,
            'devices': devices,
            'status': status
        })
    except Exception:
        return json.dumps({
            'ssid': 'NexusHotspot',
            'password': 'password123',
            'devices': '0',
            'status': 'Off'
        })

class ScannerThread(QThread):
    wallpapers_ready = pyqtSignal(str)
    desktop_ready = pyqtSignal(str)
    apps_ready = pyqtSignal(str)
    network_ready = pyqtSignal(str, str)
    
    def run(self):
        try:
            print("Scanning wallpapers...", flush=True)
            wallpapers = get_wallpapers_json()
            self.wallpapers_ready.emit(wallpapers)

            print("Scanning desktop files...", flush=True)
            desktop = get_desktop_files_json()
            self.desktop_ready.emit(desktop)

            print("Scanning apps... (This might take a few seconds)", flush=True)
            apps = get_apps_json()
            self.apps_ready.emit(apps)

            print("Scanning network...", flush=True)
            wifi = get_wifi_networks()
            hotspot = get_hotspot_config()
            self.network_ready.emit(wifi, hotspot)
            
            print("Scan complete!", flush=True)
        except Exception as e:
            print(f"Error in scanner thread: {e}", flush=True)

class WindowPoller(QThread):
    windows_updated = pyqtSignal(str)
    def run(self):
        while True:
            try:
                wins = get_open_windows()
                self.windows_updated.emit(json.dumps(wins))
            except Exception as e:
                print("Window poller error:", e)
            time.sleep(1)


class SpotlightWebPage(QWebEnginePage):
    def __init__(self, window, parent=None):
        super().__init__(parent)
        self.window = window
        
    def javaScriptConsoleMessage(self, level, msg, line, sourceID):
        if msg.startswith("LAUNCH:"):
            app_path = msg.replace("LAUNCH:", "")
            try:
                os.startfile(app_path)
                print(f"Spotlight Launched: {app_path}")
            except Exception as e:
                print(f"Failed to launch {app_path}: {e}")
        elif msg == "HIDE_SPOTLIGHT":
            self.window.hide()
        else:
            print(f"Spotlight JS: {msg}")

class SpotlightWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Nexus OS Spotlight")
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setFixedSize(700, 500)
        
        screen = QApplication.primaryScreen().geometry()
        x = (screen.width() - self.width()) // 2
        y = (screen.height() - self.height()) // 2
        self.move(x, y - 100)
        
        self.browser = QWebEngineView()
        self.page = SpotlightWebPage(self, self.browser)
        self.browser.setPage(self.page)
        self.browser.page().setBackgroundColor(Qt.GlobalColor.transparent)
        
        import time
        ui_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui', 'spotlight.html')
        url = QUrl.fromLocalFile(ui_path)
        url.setQuery(f"v={time.time()}")
        self.browser.setUrl(url)
        self.setCentralWidget(self.browser)
        
    def focusOutEvent(self, event):
        self.hide()
        super().focusOutEvent(event)
        
    def show_and_focus(self):
        self.show()
        self.raise_()
        self.activateWindow()

class TopBarWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Nexus OS Topbar")
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        
        screen = QApplication.primaryScreen().geometry()
        self.setGeometry(screen.x(), screen.y(), screen.width(), 50)
        
        self.browser = QWebEngineView()
        self.page = CustomWebPage(self.browser)
        self.browser.setPage(self.page)
        self.browser.page().setBackgroundColor(Qt.GlobalColor.transparent)
        
        import time
        ui_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui', 'topbar.html')
        url = QUrl.fromLocalFile(ui_path)
        url.setQuery(f"v={time.time()}")
        self.browser.setUrl(url)
        self.setCentralWidget(self.browser)
        
        from PyQt6.QtCore import QTimer
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_stats)
        self.timer.start(2000)
        
    def update_stats(self):
        try:
            import psutil
            cpu = int(psutil.cpu_percent())
            ram = int(psutil.virtual_memory().percent)
            try:
                ssd = int(psutil.disk_usage('C:\\\\').percent)
            except:
                ssd = 0
            js_code = f"if (window.updateStats) window.updateStats({cpu}, {ram}, {ssd});"
            self.browser.page().runJavaScript(js_code)
        except ImportError:
            pass

class MainWindow(QMainWindow):

    spotlight_signal = pyqtSignal()
    
    def __init__(self):
        super().__init__()
        self.last_spotlight_time = 0
        self.setWindowTitle("Nexus OS Desktop")
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
        self.showFullScreen()
        
        self.browser = QWebEngineView()
        self.page = CustomWebPage(self.browser)
        self.page.main_window = self
        self.browser.setPage(self.page)
        
        self.browser.loadFinished.connect(self.on_load_finished)
        self.spotlight_signal.connect(self.toggle_spotlight_safe)
        
        ui_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui', 'index.html')
        url = QUrl.fromLocalFile(ui_path)
        url.setQuery(f"v={time.time()}")
        self.browser.setUrl(url)
        self.setCentralWidget(self.browser)
        
        self.spotlight_window = SpotlightWindow()
        self.open_hwnds = []
        self.setup_hotkeys()

    def setup_hotkeys(self):
        try:
            for i in range(1, 10):
                keyboard.add_hotkey(f'alt+{i}', self.focus_window_by_index, args=[i-1])
            keyboard.add_hotkey('ctrl+space', self.emit_spotlight_signal)
        except Exception as e:
            print("Hotkey setup failed:", e)

    def emit_spotlight_signal(self):
        current_time = time.time()
        if current_time - self.last_spotlight_time > 0.3:
            self.last_spotlight_time = current_time
            self.spotlight_signal.emit()

    def toggle_spotlight_safe(self):
        print("Toggling independent spotlight window...")
        if self.spotlight_window.isVisible():
            self.spotlight_window.hide()
        else:
            self.spotlight_window.show_and_focus()

    def focus_window_by_index(self, index):
        if index < len(self.open_hwnds):
            hwnd = self.open_hwnds[index]['hwnd']
            try:
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                win32gui.SetForegroundWindow(hwnd)
            except Exception:
                pass

    def on_load_finished(self, ok):
        if ok:
            print("UI Loaded. Starting background scanner thread...", flush=True)
            self.scanner = ScannerThread()
            self.scanner.wallpapers_ready.connect(self.inject_wallpapers)
            self.scanner.desktop_ready.connect(self.inject_desktop)
            self.scanner.apps_ready.connect(self.inject_apps)
            self.scanner.network_ready.connect(self.inject_network)
            self.scanner.start()
            
            self.window_poller = WindowPoller()
            self.window_poller.windows_updated.connect(self.inject_windows)
            self.window_poller.start()

    def inject_wallpapers(self, wallpapers):
        self.page.runJavaScript(f"window.renderWallpapers({wallpapers});")

    def inject_desktop(self, desktop):
        self.page.runJavaScript(f"window.renderDesktopFiles({desktop});")
        self.spotlight_window.browser.page().runJavaScript(f"window.renderDesktopFiles({desktop});")

    def inject_apps(self, apps):
        self.page.runJavaScript(f"window.renderApps({apps});")
        self.spotlight_window.browser.page().runJavaScript(f"window.renderApps({apps});")

    def inject_network(self, wifi, hotspot):
        self.page.runJavaScript(f"if(window.renderWifiNetworks) window.renderWifiNetworks({wifi}); if(window.renderHotspotConfig) window.renderHotspotConfig({hotspot});")

    def inject_windows(self, json_str):
        self.open_hwnds = json.loads(json_str)
        self.page.runJavaScript(f"if (window.renderOpenWindows) window.renderOpenWindows({json_str});")

if __name__ == '__main__':
        # Auto-install pycaw/comtypes for volume support
    try:
        import pycaw
        import comtypes
    except ImportError:
        import subprocess
        import sys
        print("Installing pycaw and comtypes...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pycaw", "comtypes"], capture_output=True)
        
    os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu"
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    topbar = TopBarWindow()
    topbar.show()
    sys.exit(app.exec())

