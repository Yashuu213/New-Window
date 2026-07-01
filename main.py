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
from PyQt6.QtCore import QUrl, Qt

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

class CustomWebPage(QWebEnginePage):
    def javaScriptConsoleMessage(self, level, msg, line, sourceID):
        if msg.startswith("LAUNCH:"):
            app_path = msg.replace("LAUNCH:", "")
            try:
                os.startfile(app_path)
                print(f"Launched: {app_path}")
            except Exception as e:
                print(f"Failed to launch {app_path}: {e}")
        else:
            print(f"JS: {msg}")

from PyQt6.QtCore import QThread, pyqtSignal

class ScannerThread(QThread):
    scan_finished = pyqtSignal(str, str)
    
    def run(self):
        try:
            print("Scanning wallpapers...", flush=True)
            wallpapers = get_wallpapers_json()
            print("Scanning apps... (This might take a few seconds)", flush=True)
            apps = get_apps_json()
            print("Scan complete! Sending to UI.", flush=True)
            self.scan_finished.emit(apps, wallpapers)
        except Exception as e:
            print(f"Error in scanner thread: {e}", flush=True)

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

    def on_load_finished(self, ok):
        if ok:
            print("UI Loaded. Starting background scanner thread...", flush=True)
            self.scanner = ScannerThread()
            self.scanner.scan_finished.connect(self.inject_data)
            self.scanner.start()

    def inject_data(self, apps, wallpapers):
        print("Injecting data into JavaScript...", flush=True)
        self.page.runJavaScript(f"window.renderApps({apps}); window.renderWallpapers({wallpapers});")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = DesktopSimulator()
    window.show()
    sys.exit(app.exec())
