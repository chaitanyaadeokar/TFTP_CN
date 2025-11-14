call python -m venv venv
call venv\Scripts\activate.bat
call pip install PyQt5
call pip install psutil
call python TFTP_GUI_Server.py 
