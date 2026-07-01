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

def get_exe_icon_base64(exe_path):
    try:
        large, small = win32gui.ExtractIconEx(exe_path, 0)
        use_icon = large[0] if large else small[0] if small else None
        if not use_icon: return None
            
        hdc = win32ui.CreateDCFromHandle(win32gui.GetDC(0))
        hbmp = win32ui.CreateBitmap()
        # Create a large 256x256 canvas to ensure we don't crop high-res icons
        hbmp.CreateCompatibleBitmap(hdc, 256, 256)
        hdc = hdc.CreateCompatibleDC()
        hdc.SelectObject(hbmp)
        
        # Draw the icon normally on the large canvas
        hdc.DrawIcon((0, 0), use_icon)
        
        bmpinfo = hbmp.GetInfo()
        bmpstr = hbmp.GetBitmapBits(True)
        img = Image.frombuffer('RGBA', (256, 256), bmpstr, 'raw', 'BGRA', 0, 1)
        
        # Auto-crop the empty transparent space around the icon
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        win32gui.DestroyIcon(use_icon)
        return f"data:image/png;base64,{img_str}"
    except Exception as e:
        print(f"Icon error for {exe_path}: {e}")
        return None

def get_apps_json():
    shell = win32com.client.Dispatch("WScript.Shell")
    paths = [
        r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs",
        os.path.expanduser(r"~\AppData\Roaming\Microsoft\Windows\Start Menu\Programs")
    ]
    apps = []
    for path in paths:
        if not os.path.exists(path): continue
        for root, dirs, files in os.walk(path):
            for file in files:
                if file.endswith('.lnk'):
                    full_path = os.path.join(root, file)
                    try:
                        shortcut = shell.CreateShortCut(full_path)
                        target = shortcut.Targetpath
                        if target.endswith('.exe'):
                            name = file.replace('.lnk', '')
                            icon_b64 = get_exe_icon_base64(target)
                            if icon_b64:
                                apps.append({'name': name, 'path': target, 'icon': icon_b64})
                    except Exception:
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
        else:
            print(f"JS: {msg}")

from PyQt6.QtCore import QThread, pyqtSignal

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

class DesktopSimulator(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Nexus OS Desktop")
        self.setGeometry(100, 100, 1280, 720)
        
        self.browser = QWebEngineView()
        self.page = CustomWebPage(self.browser)
        self.browser.setPage(self.page)
        
        self.browser.loadFinished.connect(self.on_load_finished)
        
        ui_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ui', 'index.html')
        self.browser.setUrl(QUrl.fromLocalFile(ui_path))
        self.setCentralWidget(self.browser)
        
        self.open_hwnds = []
        self.setup_hotkeys()

    def setup_hotkeys(self):
        try:
            for i in range(1, 10):
                keyboard.add_hotkey(f'alt+{i}', self.focus_window_by_index, args=[i-1])
        except Exception as e:
            print("Hotkey setup failed:", e)

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
    window = DesktopSimulator()
    window.show()
    sys.exit(app.exec())
