import os

with open('main.py', 'r', encoding='utf8') as f:
    content = f.read()

# Add SpotlightWebPage, SpotlightWindow, TopBarWindow right before MainWindow
if 'class SpotlightWindow' not in content:
    classes_to_add = '''
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
                ssd = int(psutil.disk_usage('C:\\').percent)
            except:
                ssd = 0
            js_code = f"if (window.updateStats) window.updateStats({cpu}, {ram}, {ssd});"
            self.browser.page().runJavaScript(js_code)
        except ImportError:
            pass

class MainWindow(QMainWindow):
'''
    content = content.replace('class MainWindow(QMainWindow):', classes_to_add)

# Add self.spotlight_window = SpotlightWindow() in MainWindow.__init__
if 'self.spotlight_window = SpotlightWindow()' not in content:
    init_target = '''        self.open_hwnds = []
        self.setup_hotkeys()'''
    init_replace = '''        self.spotlight_window = SpotlightWindow()
        self.open_hwnds = []
        self.setup_hotkeys()'''
    content = content.replace(init_target, init_replace)

# Modify toggle_spotlight_safe to actually show SpotlightWindow
toggle_target = '''    def toggle_spotlight_safe(self):
        print("Toggling spotlight globally via safe signal...")
        self.setWindowState(self.windowState() & ~Qt.WindowState.WindowMinimized | Qt.WindowState.WindowActive)
        self.activateWindow()
        self.raise_()
        self.browser.page().runJavaScript("if(window.toggleSpotlight) window.toggleSpotlight();")'''
toggle_replace = '''    def toggle_spotlight_safe(self):
        print("Toggling independent spotlight window...")
        if self.spotlight_window.isVisible():
            self.spotlight_window.hide()
        else:
            self.spotlight_window.show_and_focus()'''
content = content.replace(toggle_target, toggle_replace)

# Modify inject_desktop and inject_apps to push to SpotlightWindow
if 'self.spotlight_window.browser.page().runJavaScript' not in content:
    inject_target = '''    def inject_desktop(self, desktop):
        self.page.runJavaScript(f"window.renderDesktopFiles({desktop});")

    def inject_apps(self, apps):
        self.page.runJavaScript(f"window.renderApps({apps});")'''
    inject_replace = '''    def inject_desktop(self, desktop):
        self.page.runJavaScript(f"window.renderDesktopFiles({desktop});")
        self.spotlight_window.browser.page().runJavaScript(f"window.renderDesktopFiles({desktop});")

    def inject_apps(self, apps):
        self.page.runJavaScript(f"window.renderApps({apps});")
        self.spotlight_window.browser.page().runJavaScript(f"window.renderApps({apps});")'''
    content = content.replace(inject_target, inject_replace)

# Add topbar = TopBarWindow() and --disable-gpu in main block
main_target = '''    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())'''
main_replace = '''    os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu"
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    topbar = TopBarWindow()
    topbar.show()
    sys.exit(app.exec())'''
content = content.replace(main_target, main_replace)

with open('main.py', 'w', encoding='utf8') as f:
    f.write(content)
