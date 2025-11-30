import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash


class DBManager:
    def __init__(self, db_path="tftp_files.db"):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        # uploaded files table
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE,
            filedata BLOB,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        # clients table
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_identifier TEXT,
            ip TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        # uploads table linking clients to uploaded_files (history)
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER,
            client_id INTEGER,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(file_id) REFERENCES uploaded_files(id),
            FOREIGN KEY(client_id) REFERENCES clients(id)
        )""")
        # users table for basic auth (used by frontend register/login)
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'student',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""")
        # assignments table
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            deadline DATETIME NOT NULL,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES users(id)
        )""")
        # assignment_submissions table
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS assignment_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id INTEGER NOT NULL,
            file_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(assignment_id) REFERENCES assignments(id),
            FOREIGN KEY(file_id) REFERENCES uploaded_files(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(assignment_id, user_id)
        )""")

        self.conn.commit()

    # ---------- files ----------
    def save_file(self, filename, binary_data, client_identifier=None, client_ip=None):
        """Insert or update file, and record upload history if client info provided."""
        self.cursor.execute("""
        INSERT INTO uploaded_files (filename, filedata)
        VALUES(?, ?)
        ON CONFLICT(filename) DO UPDATE SET filedata=excluded.filedata, uploaded_at=CURRENT_TIMESTAMP
        """, (filename, binary_data))
        self.conn.commit()

        # record upload history
        if client_identifier or client_ip:
            file_id = self.get_file_id(filename)
            client_id = self.get_or_create_client(client_identifier, client_ip)
            try:
                self.cursor.execute("INSERT INTO uploads (file_id, client_id) VALUES (?, ?)", (file_id, client_id))
                self.conn.commit()
            except Exception:
                # ignore history failures
                pass

    def get_file(self, filename):
        self.cursor.execute("SELECT filedata FROM uploaded_files WHERE filename=?", (filename,))
        row = self.cursor.fetchone()
        return row[0] if row else None

    def get_file_id(self, filename):
        self.cursor.execute("SELECT id FROM uploaded_files WHERE filename=?", (filename,))
        row = self.cursor.fetchone()
        return row['id'] if row else None

    def list_files(self):
        self.cursor.execute("SELECT filename, LENGTH(filedata) as size, uploaded_at FROM uploaded_files ORDER BY uploaded_at DESC")
        return [dict(r) for r in self.cursor.fetchall()]

    # ---------- clients & uploads ----------
    def get_or_create_client(self, client_identifier, ip):
        # Try to find by identifier then by ip
        if client_identifier:
            self.cursor.execute("SELECT id FROM clients WHERE client_identifier=?", (client_identifier,))
            row = self.cursor.fetchone()
            if row:
                return row['id']
        if ip:
            self.cursor.execute("SELECT id FROM clients WHERE ip=?", (ip,))
            row = self.cursor.fetchone()
            if row:
                return row['id']

        # create new
        self.cursor.execute("INSERT INTO clients (client_identifier, ip) VALUES (?, ?)", (client_identifier, ip))
        self.conn.commit()
        return self.cursor.lastrowid

    def get_uploads_for_client(self, client_id):
        self.cursor.execute("SELECT u.id, f.filename, u.uploaded_at FROM uploads u JOIN uploaded_files f ON u.file_id=f.id WHERE u.client_id=?", (client_id,))
        return [dict(r) for r in self.cursor.fetchall()]

    # ---------- users (auth) ----------
    def create_user(self, username, password, role='student'):
        pwd_hash = generate_password_hash(password)
        try:
            self.cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, pwd_hash, role))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def verify_user(self, username, password):
        self.cursor.execute("SELECT id, password_hash, role FROM users WHERE username=?", (username,))
        row = self.cursor.fetchone()
        if not row:
            return False, None
        ok = check_password_hash(row['password_hash'], password)
        if ok:
            return True, row['role']
        return False, None
    
    def get_user_by_username(self, username):
        """Get user ID and role by username"""
        self.cursor.execute("SELECT id, role FROM users WHERE username=?", (username,))
        row = self.cursor.fetchone()
        return dict(row) if row else None

    def get_user_id(self, username):
        self.cursor.execute("SELECT id FROM users WHERE username=?", (username,))
        row = self.cursor.fetchone()
        return row['id'] if row else None

    # ---------- assignments ----------
    def create_assignment(self, title, description, deadline, created_by):
        try:
            self.cursor.execute("""
                INSERT INTO assignments (title, description, deadline, created_by)
                VALUES (?, ?, ?, ?)
            """, (title, description, deadline, created_by))
            self.conn.commit()
            return self.cursor.lastrowid
        except Exception as e:
            return None

    def get_assignment(self, assignment_id):
        self.cursor.execute("""
            SELECT a.*, u.username as created_by_username
            FROM assignments a
            LEFT JOIN users u ON a.created_by = u.id
            WHERE a.id = ?
        """, (assignment_id,))
        row = self.cursor.fetchone()
        return dict(row) if row else None

    def list_assignments(self):
        self.cursor.execute("""
            SELECT a.*, u.username as created_by_username,
                   COUNT(DISTINCT s.id) as submission_count
            FROM assignments a
            LEFT JOIN users u ON a.created_by = u.id
            LEFT JOIN assignment_submissions s ON a.id = s.assignment_id
            GROUP BY a.id
            ORDER BY a.deadline ASC
        """)
        return [dict(r) for r in self.cursor.fetchall()]

    def update_assignment(self, assignment_id, title=None, description=None, deadline=None):
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if deadline is not None:
            updates.append("deadline = ?")
            params.append(deadline)
        if not updates:
            return False
        params.append(assignment_id)
        try:
            self.cursor.execute(f"""
                UPDATE assignments SET {', '.join(updates)}
                WHERE id = ?
            """, params)
            self.conn.commit()
            return True
        except Exception:
            return False

    def delete_assignment(self, assignment_id):
        try:
            self.cursor.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
            self.conn.commit()
            return True
        except Exception:
            return False

    # ---------- submissions ----------
    def create_submission(self, assignment_id, file_id, user_id):
        try:
            # Check if deadline has passed
            self.cursor.execute("SELECT deadline FROM assignments WHERE id = ?", (assignment_id,))
            row = self.cursor.fetchone()
            if not row:
                return False, "Assignment not found"
            
            from datetime import datetime
            deadline_str = row['deadline']
            # Handle both datetime string formats
            if isinstance(deadline_str, str):
                try:
                    deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                except:
                    deadline = datetime.strptime(deadline_str, '%Y-%m-%d %H:%M:%S')
            else:
                deadline = deadline_str
            if datetime.now() > deadline:
                return False, "Deadline has passed"
            
            # Insert or update submission (UNIQUE constraint handles update)
            self.cursor.execute("""
                INSERT INTO assignment_submissions (assignment_id, file_id, user_id)
                VALUES (?, ?, ?)
                ON CONFLICT(assignment_id, user_id) DO UPDATE SET
                    file_id = excluded.file_id,
                    submitted_at = CURRENT_TIMESTAMP
            """, (assignment_id, file_id, user_id))
            self.conn.commit()
            return True, None
        except sqlite3.IntegrityError:
            return False, "Submission already exists"
        except Exception as e:
            return False, str(e)

    def get_submissions_for_assignment(self, assignment_id):
        self.cursor.execute("""
            SELECT s.*, u.username, f.filename, f.uploaded_at,
                   LENGTH(f.filedata) as file_size
            FROM assignment_submissions s
            JOIN users u ON s.user_id = u.id
            JOIN uploaded_files f ON s.file_id = f.id
            WHERE s.assignment_id = ?
            ORDER BY s.submitted_at DESC
        """, (assignment_id,))
        return [dict(r) for r in self.cursor.fetchall()]

    def get_student_submission(self, assignment_id, user_id):
        self.cursor.execute("""
            SELECT s.*, f.filename, f.uploaded_at,
                   LENGTH(f.filedata) as file_size
            FROM assignment_submissions s
            JOIN uploaded_files f ON s.file_id = f.id
            WHERE s.assignment_id = ? AND s.user_id = ?
        """, (assignment_id, user_id))
        row = self.cursor.fetchone()
        return dict(row) if row else None

    def get_student_assignments(self, user_id):
        """Get assignments with submission status for a student"""
        self.cursor.execute("""
            SELECT a.*, u.username as created_by_username,
                   s.id as submission_id,
                   s.submitted_at,
                   f.filename as submission_filename
            FROM assignments a
            LEFT JOIN users u ON a.created_by = u.id
            LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.user_id = ?
            LEFT JOIN uploaded_files f ON s.file_id = f.id
            ORDER BY a.deadline ASC
        """, (user_id,))
        return [dict(r) for r in self.cursor.fetchall()]

    def close(self):
        self.conn.close()
