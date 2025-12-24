from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import json
import os
from datetime import datetime, timedelta
import jwt
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import string
from dotenv import load_dotenv
import ssl
from supabase_client import supabase


load_dotenv()


app = FastAPI(title="Lernova Attendsheets API")


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security
security = HTTPBearer()


# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


# Email Configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)


# Temporary storage for verification codes (in production, use Redis or similar)
verification_codes = {}
password_reset_codes = {}


# ==================== PYDANTIC MODELS ====================


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "teacher" 


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class StudentEnrollmentRequest(BaseModel):
    class_id: str
    name: str
    rollNo: str
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    name: str


class ChangePasswordRequest(BaseModel):
    code: str
    new_password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str


class TokenResponse(BaseModel):
    access_token: str
    user: UserResponse


class ClassRequest(BaseModel):
    id: int
    name: str
    students: List[Dict[str, Any]]
    customColumns: List[Dict[str, Any]]
    thresholds: Optional[Dict[str, Any]] = None


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


# ==================== HELPER FUNCTIONS ====================


def teacher_from_row(row: dict) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "password": row["password"],
        "verified": row.get("verified", True),
        "role": row.get("role", "teacher"),
        "overview": row.get("overview") or {},
    }


def student_from_row(row: dict) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "password": row["password"],
        "verified": row.get("verified", True),
        "role": row.get("role", "student"),
    }


def get_teacher_by_email(email: str) -> Optional[Dict[str, Any]]:
    res = (
        supabase
        .table("teachers")
        .select("*")
        .eq("email", email)
        .maybe_single()
        .execute()
    )
    return teacher_from_row(res.data) if res.data else None

def get_student_by_email(email: str) -> Optional[Dict[str, Any]]:
    res = (
        supabase
        .table("students")
        .select("*")
        .eq("email", email)
        .maybe_single()
        .execute()
    )
    return student_from_row(res.data) if res.data else None

def get_password_hash(password: str) -> str:
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return get_password_hash(plain_password) == hashed_password


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))


def send_verification_email(to_email: str, code: str, name: str):
    """Send verification email"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Verify Your Lernova Attendsheets Account"
        msg['From'] = f"Lernova Attendsheets <{FROM_EMAIL}>"
        msg['To'] = to_email

        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #a8edea;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #a8edea 0%, #c2f5e9 100%); min-height: 100vh;">
                <tr>
                    <td style="padding: 40px 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1); overflow: hidden;">
                            
                            <!-- Header Section -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #16a085 0%, #2ecc71 100%); padding: 50px 40px; text-align: center;">
                                    <!-- Icon -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="70" style="margin: 0 auto 20px; background: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
                                        <tr>
                                            <td style="padding: 15px; text-align: center;">
                                                <img src="/logo.png" alt="Lernova Attendsheets Logo" width="40" height="40" />
                                            </td>
                                        </tr>
                                    </table>
                                    <!-- Title -->
                                    <h1 style="margin: 0 0 8px 0; color: white; font-size: 28px; font-weight: 600;">Lernova Attendsheets</h1>
                                    <p style="margin: 0; color: white; font-size: 15px; opacity: 0.95;">Modern Attendance Management</p>
                                </td>
                            </tr>

                            <!-- Content Section -->
                            <tr>
                                <td style="padding: 40px;">
                                    <!-- Welcome Message -->
                                    <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 26px; font-weight: 600;">Welcome, {name}! 👋</h2>
                                    <p style="margin: 0 0 30px 0; color: #7f8c8d; font-size: 15px; line-height: 1.6;">
                                        Thank you for signing up for Lernova Attendsheets. To complete your registration and start managing attendance, please verify your email address.
                                    </p>

                                    <!-- Code Section -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px; background: linear-gradient(135deg, #d4f1f4 0%, #c3f0d8 100%); border-radius: 16px;">
                                        <tr>
                                            <td style="padding: 30px; text-align: center;">
                                                <p style="margin: 0 0 15px 0; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #16a085; text-transform: uppercase;">Your Verification Code</p>
                                                
                                                <!-- Code Box -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: white; border-radius: 12px; margin-bottom: 15px;">
                                                    <tr>
                                                        <td style="padding: 20px; text-align: center;">
                                                            <span style="font-size: 42px; font-weight: 700; letter-spacing: 14px; color: #16a085; font-family: 'Courier New', monospace;">{code}</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                                
                                                <p style="margin: 0; font-size: 13px; color: #16a085;">This code will expire in 15 minutes</p>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Security Tip -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8f9fa; border-left: 4px solid #16a085; border-radius: 8px;">
                                        <tr>
                                            <td style="padding: 15px 20px;">
                                                <p style="margin: 0 0 5px 0; color: #2c3e50; font-size: 14px; font-weight: 600;">Security Tip:</p>
                                                <p style="margin: 0; color: #7f8c8d; font-size: 13px; line-height: 1.5;">If you didn't create an account with Lernova Attendsheets, you can safely ignore this email.</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer Section -->
                            <tr>
                                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #ecf0f1;">
                                    <p style="margin: 0 0 10px 0; color: #95a5a6; font-size: 14px;">
                                        Need help? Contact us at <a href="mailto:support@attendsheets.com" style="color: #16a085; text-decoration: none; font-weight: 500;">support@attendsheets.com</a>
                                    </p>
                                    <p style="margin: 0; color: #95a5a6; font-size: 12px;">
                                        © 2025 Lernova Attendsheets. All rights reserved.<br>
                                        Built by students at Atharva University, Mumbai
                                    </p>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        part = MIMEText(html, 'html')
        msg.attach(part)

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_password_reset_email(to_email: str, code: str, name: str):
    """Send password reset email"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Reset Your Lernova Attendsheets Password"
        msg['From'] = f"Lernova Attendsheets <{FROM_EMAIL}>"
        msg['To'] = to_email

        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #a8edea;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #a8edea 0%, #c2f5e9 100%); min-height: 100vh;">
                <tr>
                    <td style="padding: 40px 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1); overflow: hidden;">
                            
                            <!-- Header Section -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #16a085 0%, #2ecc71 100%); padding: 50px 40px; text-align: center;">
                                    <!-- Icon -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="70" style="margin: 0 auto 20px; background: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
                                        <tr>
                                            <td style="padding: 15px; text-align: center;">
                                                <img src="/logo.png" alt="Lernova Attendsheets Logo" width="40" height="40" />
                                            </td>
                                        </tr>
                                    </table>
                                    <!-- Title -->
                                    <h1 style="margin: 0 0 8px 0; color: white; font-size: 28px; font-weight: 600;">Password Reset</h1>
                                    <p style="margin: 0; color: white; font-size: 15px; opacity: 0.95;">Lernova Attendsheets</p>
                                </td>
                            </tr>

                            <!-- Content Section -->
                            <tr>
                                <td style="padding: 40px;">
                                    <!-- Welcome Message -->
                                    <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 26px; font-weight: 600;">Hi {name}, 🔒</h2>
                                    <p style="margin: 0 0 30px 0; color: #7f8c8d; font-size: 15px; line-height: 1.6;">
                                        We received a request to reset your password for your Lernova Attendsheets account. Use the verification code below to set a new password.
                                    </p>

                                    <!-- Code Section -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px; background: linear-gradient(135deg, #d4f1f4 0%, #c3f0d8 100%); border-radius: 16px;">
                                        <tr>
                                            <td style="padding: 30px; text-align: center;">
                                                <p style="margin: 0 0 15px 0; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #16a085; text-transform: uppercase;">Your Password Reset Code</p>
                                                
                                                <!-- Code Box -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: white; border-radius: 12px; margin-bottom: 15px;">
                                                    <tr>
                                                        <td style="padding: 20px; text-align: center;">
                                                            <span style="font-size: 42px; font-weight: 700; letter-spacing: 14px; color: #16a085; font-family: 'Courier New', monospace;">{code}</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                                
                                                <p style="margin: 0; font-size: 13px; color: #16a085;">This code will expire in 15 minutes</p>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Security Tip -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f8f9fa; border-left: 4px solid #e74c3c; border-radius: 8px;">
                                        <tr>
                                            <td style="padding: 15px 20px;">
                                                <p style="margin: 0 0 5px 0; color: #2c3e50; font-size: 14px; font-weight: 600;">Security Alert:</p>
                                                <p style="margin: 0; color: #7f8c8d; font-size: 13px; line-height: 1.5;">If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer Section -->
                            <tr>
                                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #ecf0f1;">
                                    <p style="margin: 0 0 10px 0; color: #95a5a6; font-size: 14px;">
                                        Need help? Contact us at <a href="mailto:support@attendsheets.com" style="color: #16a085; text-decoration: none; font-weight: 500;">support@attendsheets.com</a>
                                    </p>
                                    <p style="margin: 0; color: #95a5a6; font-size: 12px;">
                                        © 2025 Lernova Attendsheets. All rights reserved.<br>
                                        Built by students at Atharva University, Mumbai
                                    </p>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        part = MIMEText(html, 'html')
        msg.attach(part)

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Error sending reset email: {e}")
        return False


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user email"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = str(payload.get("sub"))
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


# ==================== API ENDPOINTS ====================


@app.get("/")
def read_root():
    return {
        "message": "Lernova Attendsheets API",
        "version": "1.0.0",
        "status": "online",
        "database": "supabase"
    }


@app.get("/stats")
async def get_stats():
    """Get database statistics from Supabase"""
    try:
        teachers_res = supabase.table("teachers").select("id", count="exact").execute()
        students_res = supabase.table("students").select("id", count="exact").execute()
        classes_res = supabase.table("classes").select("id", count="exact").execute()
        
        return {
            "total_teachers": teachers_res.count or 0,
            "total_students": students_res.count or 0,
            "total_classes": classes_res.count or 0,
            "database": "supabase"
        }
    except Exception as e:
        print(f"Error fetching stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch statistics"
        )

# ==================== AUTH ENDPOINTS (TEACHER + SHARED) ====================

@app.post("/auth/signup")
async def signup(request: SignupRequest):
    """Sign up a new teacher"""
    try:
        existing_user = get_teacher_by_email(request.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists",
            )

        if len(request.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long",
            )

        code = generate_verification_code()
        print(f"Verification code for {request.email}: {code}")

        verification_codes[request.email] = {
            "code": code,
            "name": request.name,
            "password": get_password_hash(request.password),
            "role": "teacher",
            "expires_at": (datetime.utcnow() + timedelta(minutes=15)).isoformat(),
        }

        email_sent = send_verification_email(request.email, code, request.name)

        return {
            "success": True,
            "message": "Verification code sent to your email"
            if email_sent
            else f"Code: {code}",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {str(e)}",
        )


@app.post("/auth/verify-email", response_model=TokenResponse)
async def verify_email(request: VerifyEmailRequest):
    """Verify email with code - handles both teacher and student"""
    try:
        if request.email not in verification_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found",
            )

        stored_data = verification_codes[request.email]
        expires_at = datetime.fromisoformat(stored_data["expires_at"])

        if datetime.utcnow() > expires_at:
            del verification_codes[request.email]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code expired",
            )

        if stored_data["code"] != request.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code",
            )

        role = stored_data.get("role", "teacher")

        if role == "student":
            user_id = f"student_{int(datetime.utcnow().timestamp())}"
            row = {
                "id": user_id,
                "email": request.email,
                "name": stored_data["name"],
                "password": stored_data["password"],
                "verified": True,
                "role": "student",
                "created_at": datetime.utcnow().isoformat(),
            }
            supabase.table("students").insert(row).execute()
        else:
            user_id = f"user_{int(datetime.utcnow().timestamp())}"
            row = {
                "id": user_id,
                "email": request.email,
                "name": stored_data["name"],
                "password": stored_data["password"],
                "verified": True,
                "role": "teacher",
                "overview": {
                    "total_classes": 0,
                    "total_students": 0,
                    "last_updated": datetime.utcnow().isoformat(),
                },
                "created_at": datetime.utcnow().isoformat(),
            }
            supabase.table("teachers").insert(row).execute()

        del verification_codes[request.email]

        access_token = create_access_token(
            data={"sub": request.email, "role": role},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        return TokenResponse(
            access_token=access_token,
            user=UserResponse(
                id=user_id, email=request.email, name=stored_data["name"]
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification failed: {str(e)}",
        )


@app.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login teacher"""
    user = get_teacher_by_email(request.email)

    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        data={"sub": request.email, "role": "teacher"},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"]),
    )


@app.post("/auth/resend-verification")
async def resend_verification(request: ResendVerificationRequest):
    """Resend verification code"""
    try:
        if request.email not in verification_codes:
            existing_teacher = get_teacher_by_email(request.email)
            existing_student = get_student_by_email(request.email)
            if existing_teacher or existing_student:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already verified",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No pending verification found for this email",
            )

        stored_data = verification_codes[request.email]

        code = generate_verification_code()
        print(f"New verification code for {request.email}: {code}")

        verification_codes[request.email] = {
            "code": code,
            "name": stored_data["name"],
            "password": stored_data["password"],
            "role": stored_data.get("role", "teacher"),
            "expires_at": (datetime.utcnow() + timedelta(minutes=15)).isoformat(),
        }

        email_sent = send_verification_email(request.email, code, stored_data["name"])

        return {
            "success": True,
            "message": "New verification code sent to your email"
            if email_sent
            else f"Code: {code}",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Resend verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resend verification code: {str(e)}",
        )


@app.post("/auth/request-password-reset")
async def request_password_reset(request: PasswordResetRequest):
    """Request password reset code (teacher or student)"""
    user = get_teacher_by_email(request.email) or get_student_by_email(request.email)

    # Do not reveal whether email exists
    code = generate_verification_code()
    print(f"Password reset code for {request.email}: {code}")

    password_reset_codes[request.email] = {
        "code": code,
        "expires_at": (datetime.utcnow() + timedelta(minutes=15)).isoformat(),
    }

    if user:
        send_password_reset_email(request.email, code, user["name"])

    return {"success": True, "message": "If account exists, reset code sent"}


@app.post("/auth/reset-password")
async def reset_password(request: VerifyResetCodeRequest):
    """Reset password with code (teacher or student)"""
    if request.email not in password_reset_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No reset code found"
        )

    stored_data = password_reset_codes[request.email]
    expires_at = datetime.fromisoformat(stored_data["expires_at"])

    if datetime.utcnow() > expires_at:
        del password_reset_codes[request.email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Reset code expired"
        )

    if stored_data["code"] != request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset code"
        )

    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    user = get_teacher_by_email(request.email)
    if user:
        supabase.table("teachers").update(
            {
                "password": get_password_hash(request.new_password),
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", user["id"]).execute()
    else:
        student = get_student_by_email(request.email)
        if student:
            supabase.table("students").update(
                {
                    "password": get_password_hash(request.new_password),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", student["id"]).execute()

    del password_reset_codes[request.email]
    return {"success": True, "message": "Password reset successfully"}


@app.post("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest, email: str = Depends(verify_token)
):
    """Change password for logged-in user - supports both teachers and students"""
    if email not in password_reset_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code found",
        )

    stored_data = password_reset_codes[email]
    expires_at = datetime.fromisoformat(stored_data["expires_at"])

    if datetime.utcnow() > expires_at:
        del password_reset_codes[email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code expired",
        )

    if stored_data["code"] != request.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    user = get_teacher_by_email(email)
    if user:
        supabase.table("teachers").update(
            {
                "password": get_password_hash(request.new_password),
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", user["id"]).execute()
        del password_reset_codes[email]
        return {"success": True, "message": "Password changed successfully"}

    student = get_student_by_email(email)
    if student:
        supabase.table("students").update(
            {
                "password": get_password_hash(request.new_password),
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", student["id"]).execute()
        del password_reset_codes[email]
        return {"success": True, "message": "Password changed successfully"}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


@app.post("/auth/request-change-password")
async def request_change_password(email: str = Depends(verify_token)):
    """Request verification code for password change - supports both teachers and students"""
    user = get_teacher_by_email(email) or get_student_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    code = generate_verification_code()
    print(f"Password change code for {email}: {code}")

    password_reset_codes[email] = {
        "code": code,
        "expires_at": (datetime.utcnow() + timedelta(minutes=15)).isoformat(),
    }

    send_password_reset_email(email, code, user["name"])
    return {"success": True, "message": "Verification code sent"}


@app.put("/auth/update-profile")
async def update_profile(
    request: UpdateProfileRequest, email: str = Depends(verify_token)
):
    """Update user profile - supports both teachers and students"""
    user = get_teacher_by_email(email)
    if user:
        supabase.table("teachers").update(
            {"name": request.name, "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", user["id"]).execute()
        updated = get_teacher_by_email(email)
        return UserResponse(
            id=updated["id"], email=updated["email"], name=updated["name"]
        )

    student = get_student_by_email(email)
    if student:
        supabase.table("students").update(
            {"name": request.name, "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", student["id"]).execute()
        updated = get_student_by_email(email)
        return UserResponse(
            id=updated["id"], email=updated["email"], name=updated["name"]
        )

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


@app.post("/auth/logout")
async def logout(email: str = Depends(verify_token)):
    """Logout user (stateless JWT)"""
    return {"success": True, "message": "Logged out successfully"}


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user(email: str = Depends(verify_token)):
    """Get current user info (teacher or student)"""
    user = get_teacher_by_email(email) or get_student_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
        
    return UserResponse(id=user["id"], email=user["email"], name=user["name"])


@app.delete("/auth/delete-account")
async def delete_account(email: str = Depends(verify_token)):
    """Delete user account (teacher or student) and related data"""
    try:
        user = get_teacher_by_email(email)
        if user:
            supabase.table("teachers").delete().eq("id", user["id"]).execute()
            return {"success": True, "message": "Account deleted successfully"}

        student = get_student_by_email(email)
        if student:
            supabase.table("students").delete().eq("id", student["id"]).execute()
            return {"success": True, "message": "Account deleted successfully"}

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete account error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account",
        )


# ==================== CLASS ENDPOINTS ====================

@app.get("/classes")
async def get_classes(email: str = Depends(verify_token)):
    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    res = supabase.table("classes").select("*").eq("teacher_id", user["id"]).execute()
    return res.data or []


@app.post("/classes")
async def create_class(class_data: ClassRequest, email: str = Depends(verify_token)):
    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    class_id = class_data.id
    thresholds = class_data.thresholds or {}

    class_row = {
        "id": class_id,
        "teacher_id": user["id"],
        "name": class_data.name,
        "custom_columns": class_data.customColumns,
        "thresholds": thresholds,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "statistics": None,
    }

    supabase.table("classes").insert(class_row).execute()

    for s in class_data.students:
        student_record_id = int(s["id"])
        enroll_row = {
            "class_id": class_id,
            "student_id": s.get("studentId") or "",
            "student_record_id": student_record_id,
            "name": s["name"],
            "roll_no": s.get("rollNo"),
            "email": s.get("email"),
            "status": "active",
        }
        supabase.table("class_enrollments").insert(enroll_row).execute()

        attendance = s.get("attendance") or {}
        for date_str, status_val in attendance.items():
            supabase.table("attendance_entries").insert(
                {
                    "class_id": class_id,
                    "student_record_id": student_record_id,
                    "attendance_date": date_str,
                    "status": status_val,
                }
            ).execute()

    return {"success": True, "class": class_row}

@app.get("/classes/{class_id}")
async def get_class(class_id: str, email: str = Depends(verify_token)):
    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    class_id_int = int(class_id)

    class_res = (
        supabase.table("classes")
        .select("*")
        .eq("id", class_id_int)
        .eq("teacher_id", user["id"])
        .maybe_single()
    )
    if not class_res.data:
        raise HTTPException(status_code=404, detail="Class not found")

    enroll_res = (
        supabase.table("class_enrollments")
        .select("*")
        .eq("class_id", class_id_int)
        .eq("status", "active")
        .execute()
    )
    enrollments = enroll_res.data or []

    student_record_ids = [e["student_record_id"] for e in enrollments]
    if student_record_ids:
        att_res = (
            supabase.table("attendance_entries")
            .select("*")
            .eq("class_id", class_id_int)
            .in_("student_record_id", student_record_ids)
            .execute()
        )
        attendance_rows = att_res.data or []
    else:
        attendance_rows = []

    attendance_map: Dict[int, Dict[str, str]] = {}
    for row in attendance_rows:
        srid = row["student_record_id"]
        date_str = str(row["attendance_date"])
        status_val = row["status"]
        attendance_map.setdefault(srid, {})[date_str] = status_val

    students_payload = []
    for e in enrollments:
        srid = e["student_record_id"]
        students_payload.append(
            {
                "id": srid,
                "name": e["name"],
                "rollNo": e["roll_no"],
                "email": e["email"],
                "attendance": attendance_map.get(srid, {}),
            }
        )

    payload = class_res.data
    payload["students"] = students_payload
    return payload

@app.put("/classes/{class_id}")
async def update_class(
    class_id: str,
    class_data: ClassRequest,
    email: str = Depends(verify_token),
):
    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    class_id_int = int(class_id)

    # Ensure class belongs to this teacher
    class_res = (
        supabase.table("classes")
        .select("*")
        .eq("id", class_id_int)
        .eq("teacher_id", user["id"])
        .maybe_single()
    )
    if not class_res.data:
        raise HTTPException(status_code=404, detail="Class not found")

    # 1) Update basic class fields
    supabase.table("classes").update(
        {
            "name": class_data.name,
            "custom_columns": class_data.customColumns,
            "thresholds": class_data.thresholds or {},
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", class_id_int).execute()

    # 2) Sync enrollments (active list = class_data.students)
    enroll_res = (
        supabase.table("class_enrollments")
        .select("*")
        .eq("class_id", class_id_int)
        .execute()
    )
    existing_enrollments = {e["student_record_id"]: e for e in (enroll_res.data or [])}

    incoming_ids = set(int(s["id"]) for s in class_data.students)
    existing_ids = set(existing_enrollments.keys())

    # Newly added students
    for s in class_data.students:
        srid = int(s["id"])
        if srid not in existing_ids:
            enroll_row = {
                "class_id": class_id_int,
                "student_id": s.get("studentId") or "",
                "student_record_id": srid,
                "name": s["name"],
                "roll_no": s.get("rollNo"),
                "email": s.get("email"),
                "status": "active",
                "enrolled_at": datetime.utcnow().isoformat(),
            }
            supabase.table("class_enrollments").insert(enroll_row).execute()
        else:
            # Existing: update basic info and ensure status active
            supabase.table("class_enrollments").update(
                {
                    "name": s["name"],
                    "roll_no": s.get("rollNo"),
                    "email": s.get("email"),
                    "status": "active",
                }
            ).eq("class_id", class_id_int).eq("student_record_id", srid).execute()

    # Students removed in UI → mark inactive (do NOT delete)
    deleted_ids = existing_ids - incoming_ids
    if deleted_ids:
        supabase.table("class_enrollments").update(
            {
                "status": "inactive",
                "unenrolled_at": datetime.utcnow().isoformat(),
            }
        ).eq("class_id", class_id_int).in_("student_record_id", list(deleted_ids)).execute()

    # 3) Sync attendance map for each student
    for s in class_data.students:
        srid = int(s["id"])
        attendance = s.get("attendance") or {}
        for date_str, status_val in attendance.items():
            # Upsert row for (class_id, student_record_id, date)
            existing_att = (
                supabase.table("attendance_entries")
                .select("id")
                .eq("class_id", class_id_int)
                .eq("student_record_id", srid)
                .eq("attendance_date", date_str)
                .maybe_single()
            )
            if existing_att.data:
                supabase.table("attendance_entries").update(
                    {"status": status_val}
                ).eq("id", existing_att.data["id"]).execute()
            else:
                supabase.table("attendance_entries").insert(
                    {
                        "class_id": class_id_int,
                        "student_record_id": srid,
                        "attendance_date": date_str,
                        "status": status_val,
                    }
                ).execute()

    return {"success": True}

@app.delete("/classes/{class_id}")
async def delete_class(class_id: str, email: str = Depends(verify_token)):
    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    class_id_int = int(class_id)

    # Ensure class belongs to this teacher
    class_res = (
        supabase.table("classes")
        .select("id, teacher_id")
        .eq("id", class_id_int)
        .maybe_single()
    )
    if not class_res.data or class_res.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Class not found or unauthorized")

    # Delete related data (foreign keys are ON DELETE CASCADE, but this is explicit)
    supabase.table("attendance_entries").delete().eq("class_id", class_id_int).execute()
    supabase.table("class_enrollments").delete().eq("class_id", class_id_int).execute()
    supabase.table("qr_scanned_students").delete().eq("class_id", class_id_int).execute()
    supabase.table("qr_sessions").delete().eq("class_id", class_id_int).execute()

    # Finally delete the class
    supabase.table("classes").delete().eq("id", class_id_int).execute()

    return {"success": True, "message": "Class deleted successfully"}

    
    # ==================== QR CODE ATTENDANCE ENDPOINTS ====================

@app.post("/qr/start-session")
async def start_qr_session(request: dict, email: str = Depends(verify_token)):
    class_id = request.get("class_id")
    rotation_interval = int(request.get("rotation_interval", 5))

    if not class_id:
        raise HTTPException(status_code=400, detail="class_id required")

    print(f"[API] QR start request: class_id={class_id}")

    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    class_id_int = int(class_id)

    # Verify class belongs to this teacher
    class_res = (
        supabase.table("classes")
        .select("id, teacher_id")
        .eq("id", class_id_int)
        .maybe_single()
    )
    if not class_res.data or class_res.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Class not found or unauthorized")

    today = datetime.utcnow().date()
    # You can replace this with your own QR code generator if you prefer letters+digits
    qr_code = generate_verification_code()

    session_row = {
        "class_id": class_id_int,
        "teacher_id": user["id"],
        "started_at": datetime.utcnow().isoformat(),
        "rotation_interval": rotation_interval,
        "current_code": qr_code,
        "code_generated_at": datetime.utcnow().isoformat(),
        "attendance_date": today.isoformat(),
        "status": "active",
        "last_scan_at": None,
        "stopped_at": None,
    }

    # Upsert session for this class
    existing = (
        supabase.table("qr_sessions")
        .select("class_id")
        .eq("class_id", class_id_int)
        .maybe_single()
    )
    if existing.data:
        supabase.table("qr_sessions").update(session_row).eq("class_id", class_id_int).execute()
        supabase.table("qr_scanned_students").delete().eq("class_id", class_id_int).execute()
    else:
        supabase.table("qr_sessions").insert(session_row).execute()

    return {"success": True, "session": session_row}

@app.get("/qr/session/{class_id}")
async def get_qr_session(class_id: str, email: str = Depends(verify_token)):
    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    class_id_int = int(class_id)

    session_res = (
        supabase.table("qr_sessions")
        .select("*")
        .eq("class_id", class_id_int)
        .eq("status", "active")
        .maybe_single()
    )
    session = session_res.data
    if not session or session["teacher_id"] != user["id"]:
        return {"active": False}

    return {"active": True, "session": session}

@app.post("/qr/scan")
async def scan_qr_code(
    class_id: str,
    qr_code: str,
    email: str = Depends(verify_token),
):
    """
    Student scans QR code to mark attendance
    """
    try:
        student = get_student_by_email(email)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        class_id_int = int(class_id)

        # Load active session
        session_res = (
            supabase.table("qr_sessions")
            .select("*")
            .eq("class_id", class_id_int)
            .eq("status", "active")
            .maybe_single()
        )
        session = session_res.data
        if not session:
            raise HTTPException(status_code=400, detail="No active session")

        if session["current_code"] != qr_code:
            raise HTTPException(status_code=400, detail="Invalid or expired QR code")

        attendance_date = session["attendance_date"]

        # Find enrollment for this student in this class to get student_record_id
        enroll_res = (
            supabase.table("class_enrollments")
            .select("*")
            .eq("class_id", class_id_int)
            .eq("student_id", student["id"])
            .eq("status", "active")
            .maybe_single()
        )
        enrollment = enroll_res.data
        if not enrollment:
            raise HTTPException(
                status_code=400,
                detail="Student not actively enrolled in this class",
            )

        student_record_id = enrollment["student_record_id"]

        # Mark attendance as Present
        existing_att = (
            supabase.table("attendance_entries")
            .select("id")
            .eq("class_id", class_id_int)
            .eq("student_record_id", student_record_id)
            .eq("attendance_date", attendance_date)
            .maybe_single()
        )
        if existing_att.data:
            supabase.table("attendance_entries").update(
                {"status": "P"}
            ).eq("id", existing_att.data["id"]).execute()
        else:
            supabase.table("attendance_entries").insert(
                {
                    "class_id": class_id_int,
                    "student_record_id": student_record_id,
                    "attendance_date": attendance_date,
                    "status": "P",
                }
            ).execute()

        # Record scan
        existing_scan = (
            supabase.table("qr_scanned_students")
            .select("id")
            .eq("class_id", class_id_int)
            .eq("student_record_id", student_record_id)
            .maybe_single()
        )
        if not existing_scan.data:
            supabase.table("qr_scanned_students").insert(
                {
                    "class_id": class_id_int,
                    "student_record_id": student_record_id,
                }
            ).execute()

        supabase.table("qr_sessions").update(
            {"last_scan_at": datetime.utcnow().isoformat()}
        ).eq("class_id", class_id_int).execute()

        return {
            "success": True,
            "message": "Attendance marked as Present",
            "date": attendance_date,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"QR scan error: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to scan QR code",
        )

@app.post("/qr/stop-session")
async def stop_qr_session(payload: dict, email: str = Depends(verify_token)):
    class_id = payload.get("class_id")
    if not class_id:
        raise HTTPException(status_code=400, detail="class_id required")

    user = get_teacher_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    class_id_int = int(class_id)

    try:
        session_res = (
            supabase.table("qr_sessions")
            .select("*")
            .eq("class_id", class_id_int)
            .eq("status", "active")
            .maybe_single()
        )
        session = session_res.data
        if not session or session["teacher_id"] != user["id"]:
            raise HTTPException(status_code=400, detail="No active session or unauthorized")

        attendance_date = session["attendance_date"]

        # Active enrollments
        enroll_res = (
            supabase.table("class_enrollments")
            .select("student_record_id")
            .eq("class_id", class_id_int)
            .eq("status", "active")
            .execute()
        )
        active_ids = [e["student_record_id"] for e in (enroll_res.data or [])]

        # Scanned IDs
        scan_res = (
            supabase.table("qr_scanned_students")
            .select("student_record_id")
            .eq("class_id", class_id_int)
            .execute()
        )
        scanned_ids = {r["student_record_id"] for r in (scan_res.data or [])}

        absent_count = 0
        for srid in active_ids:
            if srid in scanned_ids:
                continue

            existing_att = (
                supabase.table("attendance_entries")
                .select("id, status")
                .eq("class_id", class_id_int)
                .eq("student_record_id", srid)
                .eq("attendance_date", attendance_date)
                .maybe_single()
            )
            if existing_att.data:
                # already marked (e.g. P/L) – do not override
                continue

            supabase.table("attendance_entries").insert(
                {
                    "class_id": class_id_int,
                    "student_record_id": srid,
                    "attendance_date": attendance_date,
                    "status": "A",
                }
            ).execute()
            absent_count += 1

        supabase.table("qr_sessions").update(
            {"status": "stopped", "stopped_at": datetime.utcnow().isoformat()}
        ).eq("class_id", class_id_int).execute()

        return {
            "success": True,
            "absent_count": absent_count,
            "date": attendance_date,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[QR_STOP] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop QR session")

# ==================== CONTACT ENDPOINT ====================

@app.post("/contact")
async def submit_contact(request: ContactRequest):
    """Submit contact form"""
    try:
        message_data = {
            "email": request.email,
            "name": request.name,
            "subject": request.subject,
            "message": request.message,
            "created_at": datetime.utcnow().isoformat(),
            "status": "unread"
        }
        
        supabase.table("contact_messages").insert(message_data).execute()
        
        return {"success": True, "message": "Message received successfully"}
    
    except Exception as e:
        print(f"Contact form error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process contact form"
        )
    
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
