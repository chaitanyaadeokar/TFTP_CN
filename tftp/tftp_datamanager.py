import sqlite3

class DBManager:
    def __init__(self, db_path="tftp_files.db"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE,
            filedata BLOB,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        self.conn.commit()

    def save_file(self, filename, binary_data):
        self.cursor.execute("""
        INSERT INTO uploaded_files (filename, filedata)
        VALUES(?, ?)
        ON CONFLICT(filename) DO UPDATE SET filedata=excluded.filedata, uploaded_at=CURRENT_TIMESTAMP
        """, (filename, binary_data))
        self.conn.commit()

    def get_file(self, filename):
        self.cursor.execute("SELECT filedata FROM uploaded_files WHERE filename=?", (filename,))
        row = self.cursor.fetchone()
        return row[0] if row else None

    def close(self):
        self.conn.close()
