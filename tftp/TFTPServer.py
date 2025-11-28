import os
import select
import socket
import threading
import logging
import sqlite3
from errno import EINTR
from .TftpShared import *
from .TftpPacketTypes import *
from .TftpPacketFactory import TftpPacketFactory
from .TftpContexts import TftpContextServer
from .tftp_datamanager import DBManager

log = logging.getLogger('tftpy.TftpServer')
logger = logging.getLogger('tftp_server')
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler('tftp_server_activity.log')
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

class TftpServer(TftpSession):
    def __init__(self, tftproot=None, dyn_file_func=None, upload_open=None):
        super().__init__()
        self.root = os.path.abspath(tftproot)
        self.sock = None
        self.dyn_file_func = dyn_file_func
        self.upload_open = upload_open
        self.sessions = {}

        self.shutdown_gracefully = False
        self.shutdown_immediately = False

        # ✅ Initialize DB (only once here)
        self.db = DBManager("tftp_files.db")

        if not os.path.isdir(self.root):
            raise TftpException("Root must be a directory.")

    # ❌ REMOVE: Disk storage, ✅ ADD DB storage
    def handle_write_completed(self, filename, data_bytes):
        self.db.save_file(filename, data_bytes)
        logger.info("Successful upload saved to database.")

    def handle_read_request(self, context: TftpContextServer):
        data = self.db.get_file(context.filename)
        if data is None:
            logger.error("❌ File not found in database.")
            raise TftpException("File not found on server.")
        return data

    def listen(self, listenip="", listenport=DEF_TFTP_PORT, timeout=SOCK_TIMEOUT, retries=DEF_TIMEOUT_RETRIES):
        if not listenip:
            listenip = '0.0.0.0'
        logger.info(f"Server requested on IP {listenip}, port {listenport}")

        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.bind((listenip, listenport))
            _, self.listenport = self.sock.getsockname()
        except socket.error as err:
            logger.error(f"Socket error: {err}")
            raise

        self.is_running = True
        logger.info("Starting UDP receive loop...")

        while True:
            # ✅ Shutdown checks
            if self.shutdown_immediately:
                logger.warning("Immediate shutdown")
                self.sock.close()
                for s in self.sessions.values():
                    s.end()
                # self.db.close()
                if self.db:
                    self.db.close()
                    self.db = None
                break

            if self.shutdown_gracefully and not self.sessions:
                logger.info("Graceful shutdown, no active sessions")
                self.sock.close()
                # self.db.close()
                if self.db:
                    self.db.close()
                    self.db = None
                break


            # ✅ Select sockets (main + session TIDs)
            inputlist = [self.sock] + [s.sock for s in self.sessions.values()]
            try:
                ready, _, _ = select.select(inputlist, [], [], timeout)
            except select.error as err:
                if err[0] == EINTR:
                    continue
                else:
                    raise

            deletion = []

            for s in ready:
                if s == self.sock:
                    buf, (rip, rport) = self.sock.recvfrom(MAX_BLKSIZE)
                    key = f"{rip}:{rport}"

                    if key not in self.sessions:
                        ctx = TftpContextServer(rip, rport, timeout, self.root, self.dyn_file_func, self.upload_open, retries=retries)
                        # Attach DB directly to the context so states can fetch files
                        ctx.db = self.db
                        self.sessions[key] = ctx
                        try:
                            ctx.start(buf)
                        except TftpException as e:
                            logger.error(f"Session error: {e}")
                            deletion.append(key)

                else:
                    # ✅ Find owner session for this TID socket
                    for key, ctx in self.sessions.items():
                        if s == ctx.sock:
                            try:
                                ctx.cycle()

                                # ✅ Transfer finished
                                if ctx.state is None:
                                    if ctx.context == 'WRQ':  # Upload done
                                        self.handle_write_completed(ctx.filename, ctx.file_bytes)
                                    elif ctx.context == 'RRQ':  # Download request
                                        ctx.file_bytes = self.handle_read_request(ctx)
                                    deletion.append(key)

                            except TftpException as e:
                                logger.error(f"Fatal error session {key}: {e}")
                                deletion.append(key)
                            break

            # ✅ Remove ended sessions
            for key in deletion:
                if key in self.sessions:
                    self.sessions[key].end()
                    del self.sessions[key]

        self.is_running = False
        self.shutdown_gracefully = self.shutdown_immediately = False

    def stop(self, now=False):
        """Stop server without taking new requests and close DB."""
        logger.info("🛑 Stopping server...")
        if now:
            self.shutdown_immediately = True
        else:
            self.shutdown_gracefully = True

        # ✅ Only close DB here, not inside listen loop
        try:
            if self.db:
                self.db.close()
                logger.info("✅ Database closed.")
                self.db = None
        except Exception as e:
            logger.error("❌ DB close error: " + str(e))

