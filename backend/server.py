"""
CyberNexus IT Portfolio Platform
File: backend/server.py

Responsibility:
- Application backend server
- Static frontend serving
- Contact message API
- SQLite contact-message storage
- Email notification through Resend
- Health/API status endpoints

Does NOT own:
- Frontend DOM/UI logic
- Frontend API client
- Authentication implementation
- Chat/AI implementation
- Voice implementation
"""

from __future__ import annotations

import html
import json
import logging
import os
import re
import sqlite3
import urllib.error
import urllib.request

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import (
    Flask,
    jsonify,
    request,
    send_from_directory,
)


# =========================================================
# APPLICATION IDENTITY
# =========================================================

APP_NAME = "CyberNexus IT Portfolio"

APP_VERSION = "1.1.0"


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"

DATABASE_DIR = BASE_DIR / "database"

DATABASE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

DATABASE_PATH = Path(
    os.getenv(
        "CYBERNEXUS_DATABASE",
        str(
            DATABASE_DIR /
            "cybernexus.db"
        ),
    )
)


# =========================================================
# APPLICATION
# =========================================================

app = Flask(
    __name__,
    static_folder=None,
)


# =========================================================
# LOGGING
# =========================================================

logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s "
        "%(levelname)s "
        "%(name)s "
        "%(message)s"
    ),
)

logger = logging.getLogger(
    "cybernexus"
)


# =========================================================
# CONTACT CONFIGURATION
# =========================================================

MAX_NAME_LENGTH = 100

MAX_EMAIL_LENGTH = 254

MAX_SUBJECT_LENGTH = 200

MAX_MESSAGE_LENGTH = 5000

MIN_NAME_LENGTH = 2

MIN_SUBJECT_LENGTH = 3

MIN_MESSAGE_LENGTH = 10


# =========================================================
# EMAIL CONFIGURATION
# =========================================================

RESEND_API_URL = (
    "https://api.resend.com/emails"
)

RESEND_API_KEY = os.getenv(
    "RESEND_API_KEY",
    "",
).strip()

CONTACT_RECIPIENT_EMAIL = os.getenv(
    "CONTACT_RECIPIENT_EMAIL",
    "cybernexus.eit@gmail.com",
).strip()

RESEND_FROM_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "",
).strip()


# =========================================================
# CORS CONFIGURATION
# =========================================================

DEFAULT_ALLOWED_ORIGIN = ""


def get_allowed_origin() -> str:
    """
    Return the configured frontend origin.

    For a separate frontend origin, set:

        CYBERNEXUS_ALLOWED_ORIGIN=https://your-domain.example

    For a same-origin Ubuntu + Caddy deployment, leave it unset.

    For local development, use:

        http://127.0.0.1:5000

    or:

        http://localhost:5000
    """

    configured = os.getenv(
        "CYBERNEXUS_ALLOWED_ORIGIN",
        "",
    ).strip()

    if configured:
        return configured

    return DEFAULT_ALLOWED_ORIGIN


# =========================================================
# DATABASE
# =========================================================

def get_database_connection() -> sqlite3.Connection:
    """
    Create a SQLite database connection.
    """

    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=10,
    )

    connection.row_factory = sqlite3.Row

    return connection


def initialize_database() -> None:
    """
    Create the contact message table and indexes.
    """

    with get_database_connection() as connection:

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS
            contact_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                name TEXT NOT NULL,

                email TEXT NOT NULL,

                subject TEXT NOT NULL,

                message TEXT NOT NULL,

                status TEXT NOT NULL
                    DEFAULT 'new',

                email_status TEXT NOT NULL
                    DEFAULT 'pending',

                email_error TEXT,

                created_at TEXT NOT NULL,

                updated_at TEXT NOT NULL
            )
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_contact_messages_created_at
            ON contact_messages(created_at)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_contact_messages_status
            ON contact_messages(status)
            """
        )

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS
            idx_contact_messages_email_status
            ON contact_messages(email_status)
            """
        )

        connection.commit()


# =========================================================
# GENERAL HELPERS
# =========================================================

def clean_text(
    value: Any,
) -> str:
    """
    Convert a value to trimmed text.
    """

    if value is None:
        return ""

    return str(value).strip()


def get_utc_timestamp() -> str:
    """
    Return the current UTC timestamp
    in ISO 8601 format.
    """

    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace(
            "+00:00",
            "Z",
        )
    )


def json_success(
    data: dict[str, Any] | None = None,
    status_code: int = 200,
):
    """
    Return a consistent JSON success response.
    """

    payload: dict[str, Any] = {
        "success": True,
    }

    if data:
        payload.update(data)

    return jsonify(payload), status_code


def json_error(
    message: str,
    status_code: int = 400,
    errors: dict[str, str] | None = None,
):
    """
    Return a consistent JSON error response.
    """

    payload: dict[str, Any] = {
        "success": False,
        "error": message,
    }

    if errors:
        payload["errors"] = errors

    return jsonify(payload), status_code


# =========================================================
# VALIDATION
# =========================================================

EMAIL_PATTERN = re.compile(
    r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
)


def validate_contact_data(
    data: Any,
) -> tuple[
    dict[str, str],
    dict[str, str],
]:
    """
    Validate contact-form data.

    Returns:

        cleaned_data, errors
    """

    if not isinstance(data, dict):
        return (
            {},
            {
                "form":
                    "Invalid request data."
            },
        )

    name = clean_text(
        data.get("name")
    )

    email = clean_text(
        data.get("email")
    )

    subject = clean_text(
        data.get("subject")
    )

    message = clean_text(
        data.get("message")
    )

    errors: dict[str, str] = {}

    # -----------------------------------------------------
    # NAME
    # -----------------------------------------------------

    if not name:

        errors["name"] = (
            "Name is required."
        )

    elif len(name) < MIN_NAME_LENGTH:

        errors["name"] = (
            f"Name must contain at least "
            f"{MIN_NAME_LENGTH} characters."
        )

    elif len(name) > MAX_NAME_LENGTH:

        errors["name"] = (
            f"Name must not exceed "
            f"{MAX_NAME_LENGTH} characters."
        )

    # -----------------------------------------------------
    # EMAIL
    # -----------------------------------------------------

    if not email:

        errors["email"] = (
            "Email is required."
        )

    elif len(email) > MAX_EMAIL_LENGTH:

        errors["email"] = (
            f"Email must not exceed "
            f"{MAX_EMAIL_LENGTH} characters."
        )

    elif not EMAIL_PATTERN.match(email):

        errors["email"] = (
            "Please enter a valid email address."
        )

    # -----------------------------------------------------
    # SUBJECT
    # -----------------------------------------------------

    if not subject:

        errors["subject"] = (
            "Subject is required."
        )

    elif len(subject) < MIN_SUBJECT_LENGTH:

        errors["subject"] = (
            f"Subject must contain at least "
            f"{MIN_SUBJECT_LENGTH} characters."
        )

    elif len(subject) > MAX_SUBJECT_LENGTH:

        errors["subject"] = (
            f"Subject must not exceed "
            f"{MAX_SUBJECT_LENGTH} characters."
        )

    # -----------------------------------------------------
    # MESSAGE
    # -----------------------------------------------------

    if not message:

        errors["message"] = (
            "Message is required."
        )

    elif len(message) < MIN_MESSAGE_LENGTH:

        errors["message"] = (
            f"Message must contain at least "
            f"{MIN_MESSAGE_LENGTH} characters."
        )

    elif len(message) > MAX_MESSAGE_LENGTH:

        errors["message"] = (
            f"Message must not exceed "
            f"{MAX_MESSAGE_LENGTH} characters."
        )

    cleaned_data = {
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
    }

    return (
        cleaned_data,
        errors,
    )


# =========================================================
# EMAIL CONFIGURATION CHECK
# =========================================================

def is_email_configured() -> bool:
    """
    Check whether Resend configuration exists.
    """

    return bool(
        RESEND_API_KEY
        and RESEND_FROM_EMAIL
        and CONTACT_RECIPIENT_EMAIL
    )


# =========================================================
# EMAIL HTML
# =========================================================

def build_contact_email_html(
    message_id: int,
    name: str,
    email: str,
    subject: str,
    message: str,
    timestamp: str,
) -> str:
    """
    Build the HTML email notification.
    """

    safe_name = html.escape(
        name
    )

    safe_email = html.escape(
        email
    )

    safe_subject = html.escape(
        subject
    )

    safe_message = html.escape(
        message
    ).replace(
        "\n",
        "<br>",
    )

    safe_timestamp = html.escape(
        timestamp
    )

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">

    <title>
        New CyberNexus Contact Message
    </title>
</head>

<body
    style="
        margin:0;
        padding:24px;
        background:#f4f6f8;
        font-family:Arial,Helvetica,sans-serif;
        color:#111827;
    "
>

    <div
        style="
            max-width:680px;
            margin:0 auto;
            background:#ffffff;
            border:1px solid #e5e7eb;
            border-radius:12px;
            overflow:hidden;
        "
    >

        <div
            style="
                padding:24px;
                background:#03070b;
                color:#ffffff;
            "
        >

            <h1
                style="
                    margin:0 0 8px;
                    font-size:22px;
                "
            >
                New Contact Message
            </h1>

            <p
                style="
                    margin:0;
                    color:#b8c2cc;
                "
            >
                CyberNexus IT Portfolio
            </p>

        </div>


        <div style="padding:24px;">

            <p>
                A visitor submitted a new message
                through the CyberNexus IT Portfolio.
            </p>


            <table
                style="
                    width:100%;
                    border-collapse:collapse;
                    margin:20px 0;
                "
            >

                <tr>

                    <td
                        style="
                            padding:10px 0;
                            font-weight:bold;
                            width:130px;
                            vertical-align:top;
                        "
                    >
                        Message ID
                    </td>

                    <td
                        style="
                            padding:10px 0;
                        "
                    >
                        #{message_id}
                    </td>

                </tr>


                <tr>

                    <td
                        style="
                            padding:10px 0;
                            font-weight:bold;
                            vertical-align:top;
                        "
                    >
                        Name
                    </td>

                    <td
                        style="
                            padding:10px 0;
                        "
                    >
                        {safe_name}
                    </td>

                </tr>


                <tr>

                    <td
                        style="
                            padding:10px 0;
                            font-weight:bold;
                            vertical-align:top;
                        "
                    >
                        Email
                    </td>

                    <td
                        style="
                            padding:10px 0;
                        "
                    >
                        <a
                            href="mailto:{safe_email}"
                        >
                            {safe_email}
                        </a>
                    </td>

                </tr>


                <tr>

                    <td
                        style="
                            padding:10px 0;
                            font-weight:bold;
                            vertical-align:top;
                        "
                    >
                        Subject
                    </td>

                    <td
                        style="
                            padding:10px 0;
                        "
                    >
                        {safe_subject}
                    </td>

                </tr>


                <tr>

                    <td
                        style="
                            padding:10px 0;
                            font-weight:bold;
                            vertical-align:top;
                        "
                    >
                        Submitted
                    </td>

                    <td
                        style="
                            padding:10px 0;
                        "
                    >
                        {safe_timestamp}
                    </td>

                </tr>

            </table>


            <h2
                style="
                    font-size:18px;
                    margin:24px 0 12px;
                "
            >
                Message
            </h2>


            <div
                style="
                    padding:16px;
                    background:#f8fafc;
                    border:1px solid #e5e7eb;
                    border-radius:8px;
                    line-height:1.6;
                "
            >
                {safe_message}
            </div>


            <p
                style="
                    margin-top:24px;
                    font-size:13px;
                    color:#6b7280;
                "
            >
                Reply directly to this email to respond
                to the visitor.
            </p>

        </div>

    </div>

</body>
</html>
"""


# =========================================================
# EMAIL TEXT
# =========================================================

def build_contact_email_text(
    message_id: int,
    name: str,
    email: str,
    subject: str,
    message: str,
    timestamp: str,
) -> str:
    """
    Build the plain-text email notification.
    """

    return (
        "New Contact Message\n"
        "\n"
        "CyberNexus IT Portfolio\n"
        "\n"
        f"Message ID: #{message_id}\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Subject: {subject}\n"
        f"Submitted: {timestamp}\n"
        "\n"
        "Message\n"
        "-------\n"
        f"{message}\n"
        "\n"
        "Reply directly to this email "
        "to respond to the visitor.\n"
    )


# =========================================================
# RESEND EMAIL
# =========================================================

def send_contact_email(
    message_id: int,
    name: str,
    email: str,
    subject: str,
    message: str,
    timestamp: str,
) -> tuple[bool, str | None]:
    """
    Send a contact notification through Resend.

    Returns:

        True, None
            when the email was accepted.

        False, error_message
            when sending failed.
    """

    if not is_email_configured():

        return (
            False,
            "Email service is not configured.",
        )

    email_subject = (
        f"[CyberNexus Contact] {subject}"
    )

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [
            CONTACT_RECIPIENT_EMAIL
        ],
        "reply_to": [
            email
        ],
        "subject": email_subject,
        "html": build_contact_email_html(
            message_id=message_id,
            name=name,
            email=email,
            subject=subject,
            message=message,
            timestamp=timestamp,
        ),
        "text": build_contact_email_text(
            message_id=message_id,
            name=name,
            email=email,
            subject=subject,
            message=message,
            timestamp=timestamp,
        ),
    }

    request_body = json.dumps(
        payload
    ).encode("utf-8")

    resend_request = urllib.request.Request(
        RESEND_API_URL,
        data=request_body,
        method="POST",
        headers={
            "Authorization":
                f"Bearer {RESEND_API_KEY}",

            "Content-Type":
                "application/json",

            "Accept":
                "application/json",

            "User-Agent":
                "CyberNexus-IT-Portfolio",
        },
    )

    try:

        with urllib.request.urlopen(
            resend_request,
            timeout=15,
        ) as response:

            response_body = (
                response.read()
                .decode("utf-8")
            )

            status_code = (
                response.status
            )

            if 200 <= status_code < 300:

                try:
                    response_data = (
                        json.loads(
                            response_body
                        )
                    )
                except json.JSONDecodeError:
                    response_data = {}

                resend_id = (
                    response_data.get(
                        "id"
                    )
                )

                logger.info(
                    "Contact email sent. "
                    "message_id=%s "
                    "resend_id=%s",
                    message_id,
                    resend_id,
                )

                return (
                    True,
                    None,
                )

            logger.error(
                "Resend returned HTTP %s: %s",
                status_code,
                response_body,
            )

            return (
                False,
                "Email provider rejected "
                "the message.",
            )

    except urllib.error.HTTPError as error:

        try:
            response_body = (
                error.read()
                .decode("utf-8")
            )
        except Exception:
            response_body = ""

        logger.error(
            "Resend HTTP error. "
            "status=%s response=%s",
            error.code,
            response_body,
        )

        return (
            False,
            "Email provider rejected "
            "the message.",
        )

    except urllib.error.URLError as error:

        logger.error(
            "Resend connection error: %s",
            error,
        )

        return (
            False,
            "Could not connect to "
            "the email provider.",
        )

    except TimeoutError:

        logger.error(
            "Resend request timed out."
        )

        return (
            False,
            "Email provider request timed out.",
        )

    except Exception:

        logger.exception(
            "Unexpected Resend error."
        )

        return (
            False,
            "Unexpected email service error.",
        )


# =========================================================
# DATABASE MESSAGE INSERT
# =========================================================

def save_contact_message(
    data: dict[str, str],
    timestamp: str,
) -> int:
    """
    Store a contact message.

    Returns:
        Database message ID.
    """

    with get_database_connection() as connection:

        cursor = connection.execute(
            """
            INSERT INTO contact_messages (
                name,
                email,
                subject,
                message,
                status,
                email_status,
                email_error,
                created_at,
                updated_at
            )
            VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
            )
            """,
            (
                data["name"],
                data["email"],
                data["subject"],
                data["message"],
                "new",
                "pending",
                None,
                timestamp,
                timestamp,
            ),
        )

        connection.commit()

        if cursor.lastrowid is None:
            raise RuntimeError(
                "Database did not return "
                "a message ID."
            )

        return int(
            cursor.lastrowid
        )


# =========================================================
# DATABASE EMAIL STATUS
# =========================================================

def update_email_status(
    message_id: int,
    email_status: str,
    email_error: str | None = None,
) -> None:
    """
    Update the email delivery status
    of a stored contact message.
    """

    timestamp = get_utc_timestamp()

    with get_database_connection() as connection:

        connection.execute(
            """
            UPDATE contact_messages

            SET
                email_status = ?,
                email_error = ?,
                updated_at = ?

            WHERE id = ?
            """,
            (
                email_status,
                email_error,
                timestamp,
                message_id,
            ),
        )

        connection.commit()


# =========================================================
# CORS
# =========================================================

@app.after_request
def add_security_headers(response):
    """
    Add basic security and CORS headers.
    """

    allowed_origin = (
        get_allowed_origin()
    )

    response.headers[
        "Access-Control-Allow-Origin"
    ] = allowed_origin

    response.headers[
        "Access-Control-Allow-Headers"
    ] = (
        "Content-Type, Authorization"
    )

    response.headers[
        "Access-Control-Allow-Methods"
    ] = (
        "GET, POST, OPTIONS"
    )

    response.headers[
        "Access-Control-Max-Age"
    ] = "86400"

    response.headers[
        "X-Content-Type-Options"
    ] = "nosniff"

    response.headers[
        "X-Frame-Options"
    ] = "SAMEORIGIN"

    response.headers[
        "Referrer-Policy"
    ] = "strict-origin-when-cross-origin"

    return response


# =========================================================
# FRONTEND
# =========================================================

@app.route(
    "/",
    methods=["GET"],
)
def index():
    """
    Serve the portfolio homepage.
    """

    index_file = (
        FRONTEND_DIR /
        "index.html"
    )

    if not index_file.exists():

        return json_error(
            "Frontend index.html "
            "was not found.",
            500,
        )

    return send_from_directory(
        FRONTEND_DIR,
        "index.html",
    )


@app.route(
    "/<path:filename>",
    methods=["GET"],
)
def frontend_file(
    filename: str,
):
    """
    Serve frontend files.
    """

    requested_file = (
        FRONTEND_DIR /
        filename
    )

    if not requested_file.is_file():

        return json_error(
            "Resource not found.",
            404,
        )

    return send_from_directory(
        FRONTEND_DIR,
        filename,
    )


# =========================================================
# API STATUS
# =========================================================

@app.route(
    "/api",
    methods=["GET"],
)
def api_status():
    """
    API status endpoint.
    """

    return json_success(
        {
            "application":
                APP_NAME,

            "version":
                APP_VERSION,

            "status":
                "online",
        }
    )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route(
    "/api/health",
    methods=["GET"],
)
def health():
    """
    Application health endpoint.
    """

    database_status = "ok"

    try:

        with get_database_connection() as connection:

            connection.execute(
                "SELECT 1"
            )

    except sqlite3.Error:

        logger.exception(
            "Database health check failed."
        )

        database_status = "error"

    if database_status != "ok":

        return json_error(
            "Database health check failed.",
            503,
        )

    return json_success(
        {
            "application":
                APP_NAME,

            "status":
                "healthy",

            "database":
                database_status,

            "email":
                (
                    "configured"
                    if is_email_configured()
                    else "not-configured"
                ),
        }
    )


# =========================================================
# CONTACT API
# =========================================================

@app.route(
    "/api/contact",
    methods=["OPTIONS"],
)
def contact_options():
    """
    Handle contact API preflight.
    """

    return (
        "",
        204,
    )


@app.route(
    "/api/contact",
    methods=["POST"],
)
def submit_contact():
    """
    Receive, validate, store, and email
    a contact message.

    Expected JSON:

    {
        "name": "...",
        "email": "...",
        "subject": "...",
        "message": "..."
    }
    """

    # -----------------------------------------------------
    # CONTENT TYPE
    # -----------------------------------------------------

    if not request.is_json:

        return json_error(
            "Request must use "
            "application/json.",
            415,
        )

    # -----------------------------------------------------
    # JSON
    # -----------------------------------------------------

    data = request.get_json(
        silent=True
    )

    if data is None:

        return json_error(
            "Invalid JSON request body.",
            400,
        )

    # -----------------------------------------------------
    # VALIDATION
    # -----------------------------------------------------

    cleaned_data, errors = (
        validate_contact_data(
            data
        )
    )

    if errors:

        return json_error(
            "Please correct the "
            "submitted fields.",
            422,
            errors,
        )

    # -----------------------------------------------------
    # TIMESTAMP
    # -----------------------------------------------------

    timestamp = (
        get_utc_timestamp()
    )

    # -----------------------------------------------------
    # DATABASE
    #
    # IMPORTANT:
    #
    # Save first.
    #
    # If email fails afterward,
    # the visitor's message is still
    # retained in the database.
    # -----------------------------------------------------

    try:

        message_id = (
            save_contact_message(
                cleaned_data,
                timestamp,
            )
        )

    except sqlite3.Error:

        logger.exception(
            "Failed to store contact "
            "message."
        )

        return json_error(
            "The message could not be "
            "saved. Please try again later.",
            500,
        )

    except Exception:

        logger.exception(
            "Unexpected database error."
        )

        return json_error(
            "The message could not be "
            "saved. Please try again later.",
            500,
        )

    # -----------------------------------------------------
    # EMAIL
    # -----------------------------------------------------

    email_sent, email_error = (
        send_contact_email(
            message_id=message_id,
            name=cleaned_data["name"],
            email=cleaned_data["email"],
            subject=cleaned_data["subject"],
            message=cleaned_data["message"],
            timestamp=timestamp,
        )
    )

    # -----------------------------------------------------
    # EMAIL STATUS
    # -----------------------------------------------------

    if email_sent:

        try:

            update_email_status(
                message_id=message_id,
                email_status="sent",
                email_error=None,
            )

        except sqlite3.Error:

            logger.exception(
                "Message was emailed, "
                "but email status could "
                "not be updated."
            )

        return json_success(
            {
                "message": (
                    "Your message has "
                    "been sent successfully."
                ),

                "message_id":
                    message_id,

                "email_status":
                    "sent",
            },
            201,
        )

    # -----------------------------------------------------
    # EMAIL FAILED
    #
    # The database record remains.
    # -----------------------------------------------------

    try:

        update_email_status(
            message_id=message_id,
            email_status="failed",
            email_error=email_error,
        )

    except sqlite3.Error:

        logger.exception(
            "Could not update failed "
            "email status."
        )

    logger.warning(
        "Contact message %s was stored "
        "but email notification failed: %s",
        message_id,
        email_error,
    )

    return json_success(
        {
            "message": (
                "Your message was received "
                "and saved successfully."
            ),

            "message_id":
                message_id,

            "email_status":
                "failed",
        },
        201,
    )


# =========================================================
# ERROR HANDLERS
# =========================================================

@app.errorhandler(404)
def handle_not_found(error):
    """
    Handle missing resources.
    """

    if request.path.startswith(
        "/api/"
    ):

        return json_error(
            "API endpoint not found.",
            404,
        )

    return json_error(
        "Resource not found.",
        404,
    )


@app.errorhandler(405)
def handle_method_not_allowed(error):
    """
    Handle unsupported HTTP methods.
    """

    if request.path.startswith(
        "/api/"
    ):

        return json_error(
            "HTTP method not allowed.",
            405,
        )

    return json_error(
        "HTTP method not allowed.",
        405,
    )


@app.errorhandler(500)
def handle_internal_error(error):
    """
    Handle unexpected server errors.
    """

    logger.exception(
        "Unhandled application error."
    )

    return json_error(
        "Internal server error.",
        500,
    )


# =========================================================
# APPLICATION INITIALIZATION
# =========================================================

initialize_database()


# =========================================================
# DEVELOPMENT ENTRY POINT
# =========================================================

if __name__ == "__main__":

    host = os.getenv(
        "HOST",
        "0.0.0.0",
    )

    port = int(
        os.getenv(
            "PORT",
            "5000",
        )
    )

    debug = (
        os.getenv(
            "FLASK_DEBUG",
            "false",
        ).lower()
        == "true"
    )

    app.run(
        host=host,
        port=port,
        debug=debug,
    )
