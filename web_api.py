from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS
import threading
import os
import io
import logging
import socket
import errno
from tftp.tftp_datamanager import DBManager
from tftp.TFTPServer import TftpServer
from tftp.TftpClient import TftpClient
from flask import make_response
from tftp.TftpPacketTypes import TftpPacketDAT

app = Flask(__name__, static_folder='frontend', static_url_path='/')
# Apply CORS to API routes
CORS(app, resources={r"/api/*": {"origins": "*"}, r"/api/auth/*": {"origins": "*"}})

logger = logging.getLogger('web_api')
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)

# Ensure server log path exists (TftpServer may also write here)
SERVER_LOG = os.path.join(os.path.dirname(__file__), 'tftp_server_activity.log')
CLIENT_LOG = os.path.join(os.path.dirname(__file__), 'tftp_client_activity.log')

def append_client_log(line: str):
    try:
        with open(CLIENT_LOG, 'a', encoding='utf-8') as fh:
            fh.write(line.rstrip('\n') + "\n")
    except Exception:
        pass

# Configure file handlers for tftpy loggers so their runtime logs are
# written to files that the frontend SSE endpoints can stream.
try:
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    # Client-side log file handler
    client_file_handler = logging.FileHandler(CLIENT_LOG, encoding='utf-8')
    client_file_handler.setLevel(logging.INFO)
    client_file_handler.setFormatter(formatter)
    logging.getLogger('tftpy.TftpClient').addHandler(client_file_handler)
    logging.getLogger('tftpy.TftpClient').setLevel(logging.INFO)

    # Server-side log file handler (TftpStates, TftpServer, TftpContext)
    server_file_handler = logging.FileHandler(SERVER_LOG, encoding='utf-8')
    server_file_handler.setLevel(logging.INFO)
    server_file_handler.setFormatter(formatter)
    for lname in ('tftpy.TftpStates', 'tftpy.TftpServer', 'tftpy.TftpContext'):
        logging.getLogger(lname).addHandler(server_file_handler)
        logging.getLogger(lname).setLevel(logging.INFO)
except Exception:
    # Do not crash the API if log file handlers cannot be created.
    logger.exception('Failed to configure tftpy file handlers')

# Shared objects
DB_PATH = os.path.join(os.path.dirname(__file__), 'tftp_files.db')
db = DBManager(DB_PATH)
server = None
server_thread = None

@app.route('/api/files', methods=['GET'])
def list_files():
    """Return list of filenames available in the DB."""
    try:
        files = db.list_files()
        # normalize to filename/size list for frontend
        files_out = [{'filename': f['filename'], 'size': f.get('size') or 0} for f in files]
        return jsonify({'ok': True, 'files': files_out})
    except Exception as e:
        logger.exception('list_files')
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/logs', methods=['GET'])
def get_logs():
    try:
        path = os.path.join(os.path.dirname(__file__), 'tftp_server_activity.log')
        if not os.path.exists(path):
            return jsonify({'ok': True, 'logs': []})
        with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
            lines = fh.readlines()[-500:]
        return jsonify({'ok': True, 'logs': [l.strip('\n') for l in lines]})
    except Exception as e:
        logger.exception('get_logs')
        return jsonify({'ok': False, 'error': str(e)}), 500


def _stream_file(path):
    """Generator that yields new lines appended to file as SSE events."""
    def gen():
        try:
            # open file and seek to end
            with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
                fh.seek(0, os.SEEK_END)
                while True:
                    line = fh.readline()
                    if not line:
                        import time
                        time.sleep(0.5)
                        continue
                    # SSE format
                    yield f"data: {line.strip()}\n\n"
        except GeneratorExit:
            return
        except Exception:
            return
    return gen


@app.route('/api/logs/stream/server')
def stream_server_logs():
    # stream tftp_server_activity.log
    gen = _stream_file(SERVER_LOG)()
    return Response(gen, mimetype='text/event-stream')


@app.route('/api/logs/stream/client')
def stream_client_logs():
    gen = _stream_file(CLIENT_LOG)()
    return Response(gen, mimetype='text/event-stream')

@app.route('/api/server/start', methods=['POST'])
def start_server():
    global server, server_thread
    if server is not None:
        return jsonify({'ok': False, 'error': 'Server already running'}), 400
    data = request.get_json() or {}
    root = data.get('root', os.getcwd())
    host = data.get('host', '0.0.0.0')
    # default to non-privileged port to avoid permission issues
    try:
        port = int(data.get('port', 6969))
    except Exception:
        port = 6969
    # Quick probe: try to bind a temporary socket to check availability/permissions
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.bind((host, port))
        probe.close()
    except OSError as e:
        # If permission denied or port privileged, fallback to 6969
        if getattr(e, 'errno', None) in (errno.EACCES, errno.EPERM) or port < 1024:
            logger.warning('Requested port %s not available (permission). Falling back to 6969', port)
            port = 6969
        elif getattr(e, 'errno', None) == errno.EADDRINUSE:
            return jsonify({'ok': False, 'error': f'Port {port} already in use'}), 400
        else:
            logger.exception('Port probe failed')
            return jsonify({'ok': False, 'error': str(e)}), 500
    try:
        server = TftpServer(root)
        # Attach db to server object (server will attach to contexts)
        server.db = db
        server_thread = threading.Thread(target=server.listen, args=(host, port), daemon=False)
        server_thread.start()
        # Give the server a moment to start and report listen port
        import time
        time.sleep(0.2)
        listen_port = getattr(server, 'listenport', port)
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception('start_server')
        server = None
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/server/status', methods=['GET'])
def server_status():
    global server
    try:
        running = False
        listen_port = None
        if server is not None and getattr(server, 'is_running', False):
            running = True
            listen_port = getattr(server, 'listenport', None)
        return jsonify({'ok': True, 'running': running, 'port': listen_port})
    except Exception as e:
        logger.exception('server_status')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/server/stop', methods=['POST'])
def stop_server():
    global server
    if server is None:
        return jsonify({'ok': False, 'error': 'Server not running'}), 400
    try:
        server.stop()
        server = None
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception('stop_server')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download_file():
    data = request.get_json() or {}
    filename = data.get('filename')
    host = data.get('host', '127.0.0.1')
    port = int(data.get('port', 69))
    if not filename:
        return jsonify({'ok': False, 'error': 'filename required'}), 400
    # Use TftpClient to download into memory and return file bytes
    try:
        client = TftpClient(host, port)
        # download into BytesIO and stream packethook updates to client log
        buf = io.BytesIO()
        cumulative = {'bytes': 0}
        def packethook(pkt):
            try:
                if isinstance(pkt, TftpPacketDAT):
                    cumulative['bytes'] += len(pkt.data)
                    append_client_log(f"Downloaded: {cumulative['bytes']} bytes")
            except Exception:
                pass

        client.download(filename, output=buf, packethook=packethook)
        buf.seek(0)
        append_client_log(f"DOWNLOAD OK: {filename} from {host}:{port} -> requested by {request.remote_addr}")
        return send_file(buf, as_attachment=True, download_name=filename)
    except Exception as e:
        logger.exception('download_file')
        append_client_log(f"DOWNLOAD ERROR: {filename} -> {str(e)}")
        return make_response(jsonify({'ok': False, 'error': str(e)}), 500)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    # accept multipart form-data
    host = request.form.get('host', '127.0.0.1')
    port = int(request.form.get('port', 69))
    f = request.files.get('file')
    if not f:
        return make_response(jsonify({'ok': False, 'error': 'file required'}), 400)
    filename = f.filename
    try:
        # Save file to DB and record client info
        data = f.read()
        client_ip = request.remote_addr
        client_identifier = request.form.get('client_id')
        db.save_file(filename, data, client_identifier=client_identifier, client_ip=client_ip)
        append_client_log(f"UPLOAD OK: {filename} from {client_ip} (client_id={client_identifier})")

        # Optionally also send via TFTP to a host if requested
        if request.form.get('send_to_host') == '1':
            try:
                client = TftpClient(host, port)
                buf = io.BytesIO(data)
                # report upload progress to client log
                cumulative_up = {'bytes': 0}
                def uppack(pkt):
                    try:
                        if isinstance(pkt, TftpPacketDAT):
                            cumulative_up['bytes'] += len(pkt.data)
                            append_client_log(f"Uploaded: {cumulative_up['bytes']} bytes")
                    except Exception:
                        pass
                client.upload(filename, input=buf, packethook=uppack)
            except Exception:
                logger.exception('tftp upload during api.upload')

        return jsonify({'ok': True})
    except Exception as e:
        logger.exception('upload_file')
        append_client_log(f"UPLOAD ERROR: {filename} from {request.remote_addr} -> {str(e)}")
        return make_response(jsonify({'ok': False, 'error': str(e)}), 500)


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'student')
    if not username or not password:
        return make_response(jsonify({'ok': False, 'error': 'username and password required'}), 400)
    ok = db.create_user(username, password, role)
    if not ok:
        return make_response(jsonify({'ok': False, 'error': 'username already exists'}), 409)
    return jsonify({'ok': True})


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return make_response(jsonify({'ok': False, 'error': 'username and password required'}), 400)
    ok, role = db.verify_user(username, password)
    if not ok:
        return make_response(jsonify({'ok': False, 'error': 'invalid credentials'}), 401)
    # Get user info for user_id
    user_info = db.get_user_by_username(username)
    # For now, return simple success + role. Token-based auth can be added later.
    # Return a simple token placeholder expected by the frontend
    token = f"token-{username}"
    return jsonify({'ok': True, 'username': username, 'role': role, 'token': token, 'user_id': user_info['id'] if user_info else None})


# Compatibility endpoints used by the existing frontend (/auth/*)
@app.route('/auth/register', methods=['POST'])
def auth_register():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'student')
    if not email or not password:
        return make_response(jsonify({'ok': False, 'error': 'email and password required'}), 400)
    ok = db.create_user(email, password, role)
    if not ok:
        return make_response(jsonify({'ok': False, 'error': 'email already exists'}), 409)
    return jsonify({'ok': True})


@app.route('/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return make_response(jsonify({'ok': False, 'error': 'email and password required'}), 400)
    ok, role = db.verify_user(email, password)
    if not ok:
        return make_response(jsonify({'ok': False, 'error': 'invalid credentials'}), 401)
    token = f"token-{email}"
    return jsonify({'ok': True, 'token': token, 'role': role})

# Also expose these compatibility endpoints under /api/auth so the frontend dev proxy '/api/auth/*' resolves
app.add_url_rule('/api/auth/register', 'api_auth_register', auth_register, methods=['POST'])
app.add_url_rule('/api/auth/login', 'api_auth_login', auth_login, methods=['POST'])

# ---------- Assignment endpoints ----------
@app.route('/api/assignments', methods=['GET'])
def list_assignments():
    """List all assignments. For students, include submission status."""
    try:
        # Get username from token if available (simple token format: token-username)
        username = request.headers.get('Authorization', '').replace('Bearer token-', '').replace('Bearer ', '')
        user_id = None
        if username:
            user_info = db.get_user_by_username(username)
            if user_info:
                user_id = user_info['id']
                if user_info['role'] == 'student':
                    assignments = db.get_student_assignments(user_id)
                    return jsonify({'ok': True, 'assignments': assignments})
        
        # For teachers or no auth, return all assignments
        assignments = db.list_assignments()
        return jsonify({'ok': True, 'assignments': assignments})
    except Exception as e:
        logger.exception('list_assignments')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/assignments', methods=['POST'])
def create_assignment():
    """Create a new assignment (teacher only)."""
    try:
        data = request.get_json() or {}
        title = data.get('title')
        description = data.get('description', '')
        deadline = data.get('deadline')
        
        if not title or not deadline:
            return jsonify({'ok': False, 'error': 'title and deadline required'}), 400
        
        # Get user from token
        username = request.headers.get('Authorization', '').replace('Bearer token-', '').replace('Bearer ', '')
        if not username:
            return jsonify({'ok': False, 'error': 'authentication required'}), 401
        
        user_info = db.get_user_by_username(username)
        if not user_info or user_info['role'] != 'teacher':
            return jsonify({'ok': False, 'error': 'teacher access required'}), 403
        
        assignment_id = db.create_assignment(title, description, deadline, user_info['id'])
        if not assignment_id:
            return jsonify({'ok': False, 'error': 'failed to create assignment'}), 500
        
        assignment = db.get_assignment(assignment_id)
        return jsonify({'ok': True, 'assignment': assignment})
    except Exception as e:
        logger.exception('create_assignment')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/assignments/<int:assignment_id>', methods=['GET'])
def get_assignment(assignment_id):
    """Get a specific assignment."""
    try:
        assignment = db.get_assignment(assignment_id)
        if not assignment:
            return jsonify({'ok': False, 'error': 'assignment not found'}), 404
        return jsonify({'ok': True, 'assignment': assignment})
    except Exception as e:
        logger.exception('get_assignment')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/assignments/<int:assignment_id>', methods=['PUT'])
def update_assignment(assignment_id):
    """Update an assignment (teacher only)."""
    try:
        data = request.get_json() or {}
        username = request.headers.get('Authorization', '').replace('Bearer token-', '').replace('Bearer ', '')
        if not username:
            return jsonify({'ok': False, 'error': 'authentication required'}), 401
        
        user_info = db.get_user_by_username(username)
        if not user_info or user_info['role'] != 'teacher':
            return jsonify({'ok': False, 'error': 'teacher access required'}), 403
        
        title = data.get('title')
        description = data.get('description')
        deadline = data.get('deadline')
        
        ok = db.update_assignment(assignment_id, title=title, description=description, deadline=deadline)
        if not ok:
            return jsonify({'ok': False, 'error': 'failed to update assignment'}), 500
        
        assignment = db.get_assignment(assignment_id)
        return jsonify({'ok': True, 'assignment': assignment})
    except Exception as e:
        logger.exception('update_assignment')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
def delete_assignment(assignment_id):
    """Delete an assignment (teacher only)."""
    try:
        username = request.headers.get('Authorization', '').replace('Bearer token-', '').replace('Bearer ', '')
        if not username:
            return jsonify({'ok': False, 'error': 'authentication required'}), 401
        
        user_info = db.get_user_by_username(username)
        if not user_info or user_info['role'] != 'teacher':
            return jsonify({'ok': False, 'error': 'teacher access required'}), 403
        
        ok = db.delete_assignment(assignment_id)
        if not ok:
            return jsonify({'ok': False, 'error': 'failed to delete assignment'}), 500
        
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception('delete_assignment')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/assignments/<int:assignment_id>/submissions', methods=['GET'])
def get_submissions(assignment_id):
    """Get all submissions for an assignment (teacher only)."""
    try:
        username = request.headers.get('Authorization', '').replace('Bearer token-', '').replace('Bearer ', '')
        if not username:
            return jsonify({'ok': False, 'error': 'authentication required'}), 401
        
        user_info = db.get_user_by_username(username)
        if not user_info or user_info['role'] != 'teacher':
            return jsonify({'ok': False, 'error': 'teacher access required'}), 403
        
        submissions = db.get_submissions_for_assignment(assignment_id)
        return jsonify({'ok': True, 'submissions': submissions})
    except Exception as e:
        logger.exception('get_submissions')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/submissions', methods=['POST'])
def create_submission():
    """Submit a file for an assignment (student only, before deadline)."""
    try:
        assignment_id = request.form.get('assignment_id')
        f = request.files.get('file')
        
        if not assignment_id or not f:
            return jsonify({'ok': False, 'error': 'assignment_id and file required'}), 400
        
        username = request.headers.get('Authorization', '').replace('Bearer token-', '').replace('Bearer ', '')
        if not username:
            return jsonify({'ok': False, 'error': 'authentication required'}), 401
        
        user_info = db.get_user_by_username(username)
        if not user_info or user_info['role'] != 'student':
            return jsonify({'ok': False, 'error': 'student access required'}), 403
        
        # Generate unique filename for submission to allow updates
        import time
        base_filename = f.filename
        # Add timestamp to make filename unique, but keep original name in the stored filename
        unique_filename = f"assignment_{assignment_id}_{user_info['id']}_{int(time.time())}_{base_filename}"
        
        # Save file to database
        data = f.read()
        db.save_file(unique_filename, data, client_identifier=username, client_ip=request.remote_addr)
        file_id = db.get_file_id(unique_filename)
        
        if not file_id:
            return jsonify({'ok': False, 'error': 'failed to save file'}), 500
        
        # Create submission
        ok, error = db.create_submission(int(assignment_id), file_id, user_info['id'])
        if not ok:
            return jsonify({'ok': False, 'error': error or 'failed to create submission'}), 400
        
        return jsonify({'ok': True})
    except Exception as e:
        logger.exception('create_submission')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/submissions/<int:submission_id>/download', methods=['GET'])
def download_submission(submission_id):
    """Download a submission file (teacher only)."""
    try:
        username = request.headers.get('Authorization', '').replace('Bearer token-', '').replace('Bearer ', '')
        if not username:
            return jsonify({'ok': False, 'error': 'authentication required'}), 401
        
        user_info = db.get_user_by_username(username)
        if not user_info or user_info['role'] != 'teacher':
            return jsonify({'ok': False, 'error': 'teacher access required'}), 403
        
        # Get submission and file
        db.cursor.execute("""
            SELECT s.*, f.filename, f.filedata
            FROM assignment_submissions s
            JOIN uploaded_files f ON s.file_id = f.id
            WHERE s.id = ?
        """, (submission_id,))
        row = db.cursor.fetchone()
        if not row:
            return jsonify({'ok': False, 'error': 'submission not found'}), 404
        
        buf = io.BytesIO(row['filedata'])
        return send_file(buf, as_attachment=True, download_name=row['filename'])
    except Exception as e:
        logger.exception('download_submission')
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def frontend(path):
    # Serve the frontend index.html
    # If frontend built files available in frontend/dist serve them
    dist_dir = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
    if os.path.exists(os.path.join(dist_dir, 'index.html')):
        full = os.path.join(dist_dir, path) if path else os.path.join(dist_dir, 'index.html')
        if path and os.path.exists(full):
            return send_file(full)
        return send_file(os.path.join(dist_dir, 'index.html'))

    # Dev / not built: return minimal message with link
    if path == '' or path == 'tftp':
        return """
            <html><body>
            <h2>TFTP API running</h2>
            <p>Frontend dev server: run <code>cd frontend && npm run dev</code> and open <a href="http://localhost:5173/tftp">http://localhost:5173/tftp</a></p>
            <p>API endpoints: <a href="/api/files">/api/files</a>, <a href="/api/logs">/api/logs</a></p>
            </body></html>
        """
    return ("Not Found", 404)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
