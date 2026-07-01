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

def get_apps_json():
    shell = win32com.client.Dispatch("WScript.Shell")
    paths = [
        r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
        os.path.expanduser(r"~\AppData\Roaming\Microsoft\Windows\Start Menu\Programs")
    ]
    apps = []
    seen_names = set()
    for path in paths:
        if not os.path.exists(path): continue
        for root, dirs, files in os.walk(path):
            for file in files:
                if file.endswith('.lnk'):
                    full_path = os.path.join(root, file)
                    try:
                        shortcut = shell.CreateShortCut(full_path)
                        name = file.replace('.lnk', '')
                        if name in seen_names:
                            continue
                        seen_names.add(name)
                        
                        extracted = get_icon_base64_robust(shortcut)
                        if extracted:
                            apps.append({'name': name, 'path': full_path, 'icon': extracted})
                    except Exception as e:
                        print(f"Error processing shortcut {file}: {e}")
                        pass
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
                    windows.append({'hwnd': hwnd, 'title': title})
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
                from ctypes import cast, POINTER
                from comtypes import CLSCTX_ALL
                from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
                devices = AudioUtilities.GetSpeakers()
                interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
                volume = cast(interface, POINTER(IAudioEndpointVolume))
                volume.SetMasterVolumeLevelScalar(val / 100.0, None)
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
            print(f"Toggle Option updated: {msg}")
        else:
            print(f"JS: {msg}")

class ScannerThread(QThread):
    scan_finished = pyqtSignal(str, str, str)
    
    def run(self):
        try:
            print("Scanning wallpapers...", flush=True)
            wallpapers = get_wallpapers_json()
            print("Scanning apps... (This might take a few seconds)", flush=True)
            apps = get_apps_json()
            print("Scanning desktop files...", flush=True)
            desktop = get_desktop_files_json()
            print("Scan complete! Sending to UI.", flush=True)
            self.scan_finished.emit(apps, wallpapers, desktop)
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
        self.browser.setPage(self.page)
        
        self.browser.loadFinished.connect(self.on_load_finished)
        self.spotlight_signal.connect(self.toggle_spotlight_safe)
        
        ui_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui', 'index.html')
        self.browser.setUrl(QUrl.fromLocalFile(ui_path))
        self.setCentralWidget(self.browser)
        
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
        print("Toggling spotlight globally via safe signal...")
        self.setWindowState(self.windowState() & ~Qt.WindowState.WindowMinimized | Qt.WindowState.WindowActive)
        self.activateWindow()
        self.raise_()
        self.browser.page().runJavaScript("if(window.toggleSpotlight) window.toggleSpotlight();")

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
            self.scanner.scan_finished.connect(self.inject_data)
            self.scanner.start()
            
            self.window_poller = WindowPoller()
            self.window_poller.windows_updated.connect(self.inject_windows)
            self.window_poller.start()

    def inject_data(self, apps, wallpapers, desktop):
        print("Injecting data into JavaScript...", flush=True)
        self.page.runJavaScript(f"window.renderApps({apps}); window.renderWallpapers({wallpapers}); window.renderDesktopFiles({desktop});")

    def inject_windows(self, json_str):
        self.open_hwnds = json.loads(json_str)
        self.page.runJavaScript(f"if (window.renderOpenWindows) window.renderOpenWindows({json_str});")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

