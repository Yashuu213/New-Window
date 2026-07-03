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
            self.scanner.scan_finished.connect(self.inject_data)
            self.scanner.start()
            
            self.window_poller = WindowPoller()
            self.window_poller.windows_updated.connect(self.inject_windows)
            self.window_poller.start()

    def inject_windows(self, json_str):
        self.open_hwnds = json.loads(json_str)
        self.page.runJavaScript(f"if (window.renderOpenWindows) window.renderOpenWindows({json_str});")

    def inject_data(self, apps, wallpapers, desktop):
        print("Injecting data into JavaScript...", flush=True)
        self.page.runJavaScript(f"window.renderApps({apps}); window.renderWallpapers({wallpapers}); window.renderDesktopFiles({desktop});")
        self.spotlight_window.browser.page().runJavaScript(f"window.renderApps({apps}); window.renderDesktopFiles({desktop});")

if __name__ == '__main__':
    os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu"
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
