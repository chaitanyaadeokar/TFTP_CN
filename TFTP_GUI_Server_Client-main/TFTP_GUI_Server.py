import sys
import os
import threading
import socket
import logging
from PyQt5 import QtWidgets, QtGui, QtCore
from PyQt5.QtCore import pyqtSignal, QObject
from tftp.TFTPServer import TftpPacketDAT, TftpPacketERR, TftpServer
from tftp.TftpClient import TftpClient
# Logging Configuration
logger = logging.getLogger('tftp_server')
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler('tftp_server_activity.log')
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)


class LogEmitter(QObject):
    """A QObject that wraps a logging signal so logs from any thread can be
    safely forwarded to Qt widgets via queued signals."""
    log_signal = pyqtSignal(str)

    def __init__(self):
        super().__init__()


class TextHandler(logging.Handler):
    """Custom logging handler to forward records through a LogEmitter."""
    def __init__(self, emitter):
        super().__init__()
        self.emitter = emitter

    def emit(self, record):
        try:
            msg = self.format(record)
            self.emitter.log_signal.emit(msg)
        except Exception:
            pass

import socket

import psutil

def get_ip_addresses():
    """Get the list of available IP addresses on the local machine across all interfaces."""
    ip_addresses = []

    for interface, addresses in psutil.net_if_addrs().items():
        for address in addresses:
            if address.family == socket.AF_INET:  # IPv4 addresses only
                ip_addresses.append(address.address)
    
    # Remove duplicates and return the list of IP addresses
    return list(set(ip_addresses))

class TFTPServer(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("TFTP Server")
        self.setGeometry(100, 100, 500, 400)

        self.current_directory = os.getcwd()
        self.server = None
        self.server_thread = None
        # Log emitter for thread-safe logging into the QTextEdit
        self.log_emitter = LogEmitter()

        # UI Elements
        self.ip_combo = QtWidgets.QComboBox(self)
        self.ip_combo.addItems(get_ip_addresses())  # Populate with available IPs

        self.start_button = QtWidgets.QPushButton("Start Server", self)
        self.start_button.clicked.connect(self.start_server)

        self.stop_button = QtWidgets.QPushButton("Stop Server", self)
        self.stop_button.clicked.connect(self.stop_server)
        self.stop_button.setEnabled(False)

        self.status_label = QtWidgets.QLabel("Server Status: Stopped", self)
        self.status_label.setStyleSheet("font-weight: bold; color: red;")

        self.port_input = QtWidgets.QSpinBox(self)
        self.port_input.setRange(1, 65535)
        self.port_input.setValue(69)
        self.port_label = QtWidgets.QLabel("Port:", self)

        self.dir_label = QtWidgets.QLabel(f"Current Directory: {self.current_directory}", self)

        self.browse_button = QtWidgets.QPushButton("Change Directory", self)
        self.browse_button.clicked.connect(self.change_directory)

        self.view_dir_button = QtWidgets.QPushButton("View Directory Contents", self)
        self.view_dir_button.clicked.connect(self.view_directory)

        self.log_output = QtWidgets.QTextEdit(self)
        self.log_output.setReadOnly(True)
        # connect emitter to the QTextEdit in the GUI thread
        self.log_emitter.log_signal.connect(self.append_log)

        # Layout
        layout = QtWidgets.QVBoxLayout()

        layout.addWidget(QtWidgets.QLabel("Select Server IP:"))
        layout.addWidget(self.ip_combo)

        port_layout = QtWidgets.QHBoxLayout()
        port_layout.addWidget(self.port_label)
        port_layout.addWidget(self.port_input)
        layout.addLayout(port_layout)

        button_layout = QtWidgets.QHBoxLayout()
        button_layout.addWidget(self.start_button)
        button_layout.addWidget(self.stop_button)
        layout.addLayout(button_layout)

        layout.addWidget(self.status_label)
        layout.addWidget(self.dir_label)
        layout.addWidget(self.browse_button)
        layout.addWidget(self.view_dir_button)
        layout.addWidget(QtWidgets.QLabel("Server Log:"))
        layout.addWidget(self.log_output)

        self.setLayout(layout)
        self.setStyleSheet("background-color: #f0f0f0; font-family: Arial;")

    def start_server(self):
        if not self.server:
            port = self.port_input.value()
            ip_address = self.ip_combo.currentText()  # Get selected IP from dropdown
            self.server = TftpServer(self.current_directory)  # Use current directory
            # Start server in a dedicated non-daemon thread so it lives until stopped
            self.server_thread = threading.Thread(target=self.server.listen, args=(ip_address, port), daemon=False)
            self.server_thread.start()
            self.status_label.setText("Server Status: Running")
            self.status_label.setStyleSheet("font-weight: bold; color: green;")
            self.start_button.setEnabled(False)
            self.stop_button.setEnabled(True)

            # Redirect logs to the text output via an emitter (thread-safe)
            # Log handlers are managed by the main application (MainApp)
            # so we don't attach handlers here to avoid duplicates.

    def stop_server(self):
        if self.server:
            self.server.stop()
            self.server = None
            self.status_label.setText("Server Status: Stopped")
            self.status_label.setStyleSheet("font-weight: bold; color: red;")
            self.start_button.setEnabled(True)
            self.stop_button.setEnabled(False)

    def append_log(self, message: str):
        # append must run in GUI thread; connected via signal
        self.log_output.append(message)
        self.log_output.moveCursor(QtGui.QTextCursor.End)

    def change_directory(self):
        new_dir = QtWidgets.QFileDialog.getExistingDirectory(self, "Select Directory", self.current_directory)
        if new_dir:
            self.current_directory = new_dir
            self.dir_label.setText(f"Current Directory: {self.current_directory}")
            if self.server:
                self.server.root = self.current_directory  # Update server root

    def view_directory(self):
        self.dir_window = DirectoryView(self.current_directory)
        self.dir_window.show()

# (LogEmitter and TextHandler are defined earlier in the file)

class DirectoryView(QtWidgets.QDialog):
    def __init__(self, directory):
        super().__init__()
        self.setWindowTitle("Directory Contents")
        self.setGeometry(200, 200, 400, 300)

        self.directory = directory

        self.file_list = QtWidgets.QListWidget(self)
        self.load_directory_contents()

        self.copy_button = QtWidgets.QPushButton("Copy Selected Name", self)
        self.copy_button.clicked.connect(self.copy_selected_name)

        layout = QtWidgets.QVBoxLayout()
        layout.addWidget(self.file_list)
        layout.addWidget(self.copy_button)

        self.setLayout(layout)

    def load_directory_contents(self):
        self.file_list.clear()
        for item in os.listdir(self.directory):
            self.file_list.addItem(item)

    def copy_selected_name(self):
        selected_items = self.file_list.selectedItems()
        if selected_items:
            file_name = selected_items[0].text()
            QtWidgets.QApplication.clipboard().setText(file_name)
            QtWidgets.QMessageBox.information(self, "Copy Name", f"Copied: {file_name}")

class TFTPClient(QtWidgets.QWidget):
    # Signals: log messages, status updates (msg, level), progress (current, total)
    log_signal = QtCore.pyqtSignal(str)
    status_signal = QtCore.pyqtSignal(str, int)
    progress_signal = QtCore.pyqtSignal(int, int)

    def __init__(self):
        super().__init__()
        self.setWindowTitle("TFTP Client")
        self.setGeometry(500, 100, 500, 400)

        self.ip_input = QtWidgets.QLineEdit(self)
        self.ip_input.setPlaceholderText("Enter Server IP Address")

        # Separate inputs for upload and download
        self.upload_file_input = QtWidgets.QLineEdit(self)
        self.upload_file_input.setPlaceholderText("Select File to Upload")
        
        self.download_file_input = QtWidgets.QLineEdit(self)
        self.download_file_input.setPlaceholderText("Enter File Name to Download")

        self.browse_button = QtWidgets.QPushButton("Browse Upload...", self)
        self.browse_button.clicked.connect(self.browse_upload_file)

        self.download_button = QtWidgets.QPushButton("Download File", self)
        self.download_button.clicked.connect(self.download_file)

        self.upload_button = QtWidgets.QPushButton("Upload File", self)
        self.upload_button.clicked.connect(self.upload_file)

        self.use_folder_checkbox = QtWidgets.QCheckBox("Use selected folder for download", self)
        self.use_folder_checkbox.setChecked(False)  # Default unchecked

        self.default_directory_label = QtWidgets.QLabel(self)
        self.default_directory_label.setText(f"Default Download Directory: {self.get_default_directory()}")

        self.status_label = QtWidgets.QLabel("Status: Waiting", self)
        self.status_label.setStyleSheet("font-weight: bold;")

        self.log_output = QtWidgets.QTextEdit(self)
        self.log_output.setReadOnly(True)

        self.progress_bar = QtWidgets.QProgressBar(self)
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)

        layout = QtWidgets.QVBoxLayout()
        layout.addWidget(QtWidgets.QLabel("Enter Server IP Address:"))
        layout.addWidget(self.ip_input)

        # Upload file section
        layout.addWidget(QtWidgets.QLabel("File to Upload:"))
        layout.addWidget(self.upload_file_input)
        layout.addWidget(self.browse_button)

        # Download file section
        layout.addWidget(QtWidgets.QLabel("File to Download:"))
        layout.addWidget(self.download_file_input)
        layout.addWidget(self.use_folder_checkbox)  # Add the checkbox here

        # Add the default directory label
        layout.addWidget(self.default_directory_label)

        button_layout = QtWidgets.QHBoxLayout()
        button_layout.addWidget(self.download_button)
        button_layout.addWidget(self.upload_button)
        button_layout.addWidget(self.status_label)
        layout.addLayout(button_layout)

        layout.addWidget(self.progress_bar)
        layout.addWidget(QtWidgets.QLabel("Client Log:"))
        layout.addWidget(self.log_output)

        self.setLayout(layout)
        self.setStyleSheet("background-color: #f0f0f0; font-family: Arial;")

        self.total_size = 0
        self.downloaded_size = 0

        # Connect signals to slots (queued across threads)
        self.log_signal.connect(self.update_log)
        self.status_signal.connect(self.update_status)
        self.progress_signal.connect(self.update_progress)

    def get_default_directory(self):
        """Return the default download directory."""
        return os.path.expanduser("~")  # User's home directory

    def browse_upload_file(self):
        options = QtWidgets.QFileDialog.Options()
        file_name, _ = QtWidgets.QFileDialog.getOpenFileName(self, "Select File to Upload", "", "All Files (*);;Text Files (*.txt)", options=options)
        if file_name:
            self.upload_file_input.setText(file_name)  # Save the full path for the selected file

    def download_file(self):
        ip = self.ip_input.text()  # Get the manually entered IP address
        filename = self.download_file_input.text()

        if self.use_folder_checkbox.isChecked():
            # Open a dialog to select the folder for saving the downloaded file
            folder = QtWidgets.QFileDialog.getExistingDirectory(self, "Select Folder to Save Downloaded File")
            
            if folder:  # Proceed only if a folder was selected
                self.status_label.setText("Status: Downloading...")
                self.log_output.clear()  # Clear previous logs

                # Construct the full path for the downloaded file
                full_path = os.path.join(folder, filename)

                # Start a new thread for downloading to avoid blocking the UI
                threading.Thread(target=self.perform_download, args=(ip, full_path), daemon=True).start()
            else:
                self.log_signal.emit("Download canceled: No folder selected.")
        else:
            # Default save path (you can modify this to your preferred default directory)
            default_directory = self.get_default_directory()
            full_path = os.path.join(default_directory, filename)

            self.status_label.setText("Status: Downloading...")
            self.log_output.clear()  # Clear previous logs

            # Start a new thread for downloading to avoid blocking the UI
            threading.Thread(target=self.perform_download, args=(ip, full_path), daemon=True).start()

    def perform_download(self, ip, full_path):
        try:
            client = TftpClient(ip, 69)

            # Get total file size
            self.total_size = client.get_file_size(os.path.basename(full_path))
            if self.total_size <= 0:
                self.status_signal.emit("Error: Invalid file size.", 1)
                self.log_signal.emit("Error: Invalid file size.")
                return

            # Function to update progress
            def update_progress(packet):
                if isinstance(packet, TftpPacketERR):
                    self.log_signal.emit(f"Error: {packet.errmsg.decode()}")
                    return
                
                # Check for DAT packets (data packets)
                if isinstance(packet, TftpPacketDAT):
                    self.downloaded_size += len(packet.data)
                    # emit progress and a log message
                    self.progress_signal.emit(self.downloaded_size, self.total_size)
                    self.log_signal.emit(f"Downloaded: {self.downloaded_size} bytes")

            # Start downloading with the update_progress callback
            client.download(os.path.basename(full_path), output=full_path, packethook=update_progress)

            self.status_signal.emit("Status: Download Complete", 2)
            self.log_signal.emit("Download complete.")
        except Exception as e:
            self.status_signal.emit(f"Error: {str(e)}", 1)
            self.log_signal.emit(f"Error: {str(e)}")

    def upload_file(self):
        ip = self.ip_input.text()  # Get the manually entered IP address
        filename = self.upload_file_input.text()
        self.status_label.setText("Status: Uploading...")
        self.log_output.clear()  # Clear previous logs

        # Start a new thread for uploading to avoid blocking the UI
        threading.Thread(target=self.perform_upload, args=(ip, filename), daemon=True).start()

    def perform_upload(self, ip, filename):
        try:
            client = TftpClient(ip, 69)

            # Get total file size
            self.total_size = os.path.getsize(filename)
            self.downloaded_size = 0  # Reset downloaded size

            # Function to update progress
            def update_progress(packet):
                if isinstance(packet, TftpPacketERR):
                    self.log_signal.emit(f"Error: {packet.errmsg.decode()}")
                    return
                
                # Check for DAT packets (data packets)
                if isinstance(packet, TftpPacketDAT):
                    self.downloaded_size += len(packet.data)
                    self.progress_signal.emit(self.downloaded_size, self.total_size)
                    self.log_signal.emit(f"Uploaded: {self.downloaded_size} bytes")

            # Start uploading with the update_progress callback
            with open(filename, 'rb') as f:
                client.upload(os.path.basename(filename), input=f, packethook=update_progress)

            self.status_signal.emit("Status: Upload Complete", 2)
            self.log_signal.emit("Upload complete.")
        except Exception as e:
            self.status_signal.emit(f"Error: {str(e)}", 1)
            self.log_signal.emit(f"Error: {str(e)}")

    def update_log(self, message):
        # Reserved special command to clear logs
        if message == '__CLEAR__':
            self.log_output.clear()
            return

        self.log_output.append(message)
        self.log_output.moveCursor(QtGui.QTextCursor.End)  # Scroll to the bottom

    def update_status(self, message: str, level: int):
        """Update status label and optionally show a messagebox for errors/success.
        level: 0=info, 1=error, 2=success"""
        self.status_label.setText(message)
        if level == 1:
            QtWidgets.QMessageBox.critical(self, "Error", message)
        elif level == 2:
            QtWidgets.QMessageBox.information(self, "Success", message)

    def update_progress(self, current: int, total: int):
        try:
            if total > 0:
                pct = int((current / total) * 100)
                self.progress_bar.setValue(pct)
            else:
                self.progress_bar.setValue(0)
        except Exception:
            pass


class MainApp(QtWidgets.QTabWidget):
    def __init__(self):
        super().__init__()
        # Create tabs and keep references so we can connect shared logging
        self.server_tab = TFTPServer()
        self.client_tab = TFTPClient()
        self.addTab(self.server_tab, "TFTP Server")
        self.addTab(self.client_tab, "TFTP Client")
        self.setStyleSheet("QTabWidget::pane { border: 1px solid #cccccc; }")

        # Shared log emitter for forwarding library logs to both widgets
        self.shared_emitter = LogEmitter()
        handler = TextHandler(self.shared_emitter)
        handler.setFormatter(formatter)
        # Attach handler to relevant loggers if not already attached
        root_logger = logging.getLogger()
        # Avoid duplicate handlers
        has_same = any(isinstance(h, TextHandler) for h in root_logger.handlers)
        if not has_same:
            root_logger.addHandler(handler)
        # Connect emitter to both log displays (queued signals)
        self.shared_emitter.log_signal.connect(self.server_tab.append_log)
        self.shared_emitter.log_signal.connect(self.client_tab.update_log)
        # Also attach to known tftpy loggers
        logging.getLogger('tftpy.TftpClient').addHandler(handler)
        logging.getLogger('tftpy.TftpContext').addHandler(handler)

if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    main_app = MainApp()
    main_app.setWindowTitle("TFTP Client/Server by petrunetworking")
    main_app.setGeometry(100, 100, 800, 500)
    main_app.setStyleSheet("background-color: #eaeaea; font-family: Arial;")
    main_app.show()
    sys.exit(app.exec_())
