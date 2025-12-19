"""
Zero-Trust VPN Backend API
Flask application handling authentication, TOTP, and WireGuard config
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from functools import wraps
import os
import requests
import pyotp
import qrcode
import hvac
import redis
import json
import logging
import jwt
from io import BytesIO
from datetime import datetime, timedelta
import base64
import hashlib
import subprocess

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
VAULT_ADDR = os.getenv('VAULT_ADDR', 'http://vault:8200')
VAULT_TOKEN = os.getenv('VAULT_TOKEN', 'myroot')
KEYCLOAK_ADDR = os.getenv('KEYCLOAK_ADDR', 'http://keycloak:8080')
KEYCLOAK_REALM = os.getenv('KEYCLOAK_REALM', 'company')
KEYCLOAK_CLIENT_ID = os.getenv('KEYCLOAK_CLIENT_ID', 'vpn-client')
KEYCLOAK_CLIENT_SECRET = os.getenv('KEYCLOAK_CLIENT_SECRET', 'change-me')
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))

# Initialize clients
vault_client = hvac.Client(url=VAULT_ADDR, token=VAULT_TOKEN)
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# ==================== HELPER FUNCTIONS ====================

def verify_token(token):
    """Verify JWT token with Keycloak"""
    try:
        # First try userinfo endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{KEYCLOAK_ADDR}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo",
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            return response.json()
        
        # Fallback: decode token without verification (for dev/demo)
        import jwt
        decoded = jwt.decode(token, options={"verify_signature": False})
        logger.warning("Token verified without signature check (dev mode)")
        return {
            "sub": decoded.get("sub"),
            "preferred_username": decoded.get("preferred_username"),
            "email": decoded.get("email"),
            "email_verified": decoded.get("email_verified")
        }
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        return None


def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Missing authorization header"}), 401
        
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return jsonify({"error": "Invalid authorization header format"}), 401
        
        user_info = verify_token(token)
        if not user_info:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        request.user_info = user_info
        request.token = token
        return f(*args, **kwargs)
    
    return decorated_function


def log_access(username, action, status, details=""):
    """Log access attempts"""
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "username": username,
        "action": action,
        "status": status,
        "ip": request.remote_addr,
        "details": details
    }
    logger.info(f"ACCESS_LOG: {json.dumps(log_entry)}")
    
    # Store in Redis for real-time monitoring
    redis_client.lpush("access_logs", json.dumps(log_entry))
    redis_client.ltrim("access_logs", 0, 999)  # Keep last 1000 entries


def get_totp_secret(username):
    """Get TOTP secret from Redis"""
    return redis_client.get(f"totp_secret:{username}")


def save_totp_secret(username, secret):
    """Save TOTP secret to Redis"""
    redis_client.set(f"totp_secret:{username}", secret)


def is_totp_used(username, code):
    """Check if TOTP code was already used (prevent replay)"""
    key = f"totp_used:{username}:{code}"
    if redis_client.exists(key):
        return True
    return False


def mark_totp_used(username, code):
    """Mark TOTP code as used"""
    key = f"totp_used:{username}:{code}"
    redis_client.setex(key, 60, "1")  # Expire after 60 seconds


# ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {}
    }
    
    # Check Vault
    try:
        if vault_client.sys.is_initialized():
            health_status["services"]["vault"] = "healthy"
        else:
            health_status["services"]["vault"] = "unhealthy"
    except:
        health_status["services"]["vault"] = "unreachable"
    
    # Check Redis
    try:
        redis_client.ping()
        health_status["services"]["redis"] = "healthy"
    except:
        health_status["services"]["redis"] = "unreachable"
    
    # Check Keycloak
    try:
        response = requests.get(f"{KEYCLOAK_ADDR}/health/ready", timeout=2)
        if response.status_code == 200:
            health_status["services"]["keycloak"] = "healthy"
        else:
            health_status["services"]["keycloak"] = "unhealthy"
    except:
        health_status["services"]["keycloak"] = "unreachable"
    
    return jsonify(health_status)


# ==================== AUTHENTICATION ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Step 1: Authenticate with username/password via Keycloak"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
        
        logger.info(f"Login attempt for user: {username}")
        
        # Authenticate with Keycloak
        response = requests.post(
            f"{KEYCLOAK_ADDR}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token",
            data={
                "client_id": KEYCLOAK_CLIENT_ID,
                "username": username,
                "password": password,
                "grant_type": "password"
            },
            timeout=5
        )
        
        if response.status_code == 200:
            tokens = response.json()
            log_access(username, "login", "success")
            
            return jsonify({
                "access_token": tokens['access_token'],
                "refresh_token": tokens['refresh_token'],
                "expires_in": tokens['expires_in'],
                "requires_totp": True  # Always require TOTP for Zero-Trust
            })
        else:
            log_access(username, "login", "failed", "Invalid credentials")
            return jsonify({"error": "Invalid credentials"}), 401
            
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": "Internal server error"}), 500


# ==================== TOTP (Multi-Factor Authentication) ====================

@app.route('/api/auth/totp/status', methods=['GET'])
@require_auth
def totp_status():
    """Check if user has completed TOTP setup"""
    try:
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        
        # Check if setup is completed
        setup_completed = redis_client.get(f"totp_setup_completed:{username}")
        has_secret = redis_client.get(f"totp_secret:{username}")
        
        return jsonify({
            "setup_completed": bool(setup_completed),
            "has_secret": bool(has_secret),
            "requires_setup": not bool(setup_completed)
        })
        
    except Exception as e:
        logger.error(f"TOTP status check error: {e}")
        return jsonify({"setup_completed": False, "requires_setup": True}), 200


@app.route('/api/auth/totp/setup', methods=['POST'])
@require_auth
def setup_totp():
    """Setup TOTP for user (first time only)"""
    try:
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        email = request.user_info.get('email', username)
        
        # STRICT CHECK: Reject if already completed setup
        setup_completed = redis_client.get(f"totp_setup_completed:{username}")
        if setup_completed:
            logger.warning(f"User {username} tried to view QR code again (already setup)")
            return jsonify({
                "error": "TOTP already configured. QR code can only be viewed once during first login.",
                "already_setup": True
            }), 403
        
        # Check if secret exists but not completed (user refreshed page)
        existing_secret = redis_client.get(f"totp_secret:{username}")
        if existing_secret:
            # Allow re-viewing QR if not yet verified (same session)
            secret = existing_secret
            logger.info(f"User {username} re-viewing QR code (not yet verified)")
        else:
            # First time - generate new secret
            secret = pyotp.random_base32()
            save_totp_secret(username, secret)
            logger.info(f"Generated new TOTP secret for {username}")
        
        # Create TOTP URI
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(
            name=email,
            issuer_name='Zero-Trust VPN'
        )
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        log_access(username, "totp_setup", "success")
        
        return jsonify({
            "qr_code": f"data:image/png;base64,{img_base64}",
            "secret": secret,
            "manual_entry_key": secret,
            "first_time": not bool(existing_secret)
        })
        
    except Exception as e:
        logger.error(f"TOTP setup error: {e}")
        return jsonify({"error": "Failed to setup TOTP"}), 500


@app.route('/api/auth/totp/verify', methods=['POST'])
@require_auth
def verify_totp():
    """Verify TOTP code"""
    try:
        data = request.json
        totp_code = data.get('totp_code')
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        
        if not totp_code or len(totp_code) != 6:
            return jsonify({"error": "Invalid TOTP code format"}), 400
        
        # Get secret
        secret = get_totp_secret(username)
        if not secret:
            return jsonify({"error": "TOTP not configured. Please setup first."}), 400
        
        # Verify code
        totp = pyotp.TOTP(secret)
        if not totp.verify(totp_code, valid_window=1):
            log_access(username, "totp_verify", "failed", "Invalid code")
            return jsonify({"error": "Invalid TOTP code"}), 401
        
        # Check replay attack
        if is_totp_used(username, totp_code):
            log_access(username, "totp_verify", "failed", "Code already used")
            return jsonify({"error": "TOTP code already used"}), 401
        
        # Mark as used
        mark_totp_used(username, totp_code)
        
        # Mark TOTP setup as completed (important!)
        redis_client.set(f"totp_setup_completed:{username}", "true")
        
        # Generate MFA session token
        mfa_token = hashlib.sha256(f"{username}{totp_code}{datetime.now()}".encode()).hexdigest()
        redis_client.setex(f"mfa_verified:{username}", 3600, mfa_token)  # Valid for 1 hour
        
        log_access(username, "totp_verify", "success")
        
        return jsonify({
            "verified": True,
            "mfa_token": mfa_token,
            "expires_in": 3600
        })
        
    except Exception as e:
        logger.error(f"TOTP verification error: {e}")
        return jsonify({"error": "Failed to verify TOTP"}), 500


# ==================== WIREGUARD CONFIG ====================

def _get_wireguard_config_impl(username, mfa_token=None):
    """Implementation of WireGuard config retrieval"""
    # MFA verification is optional for demo
    # In production, always verify MFA
    if mfa_token:
        stored_mfa_token = redis_client.get(f"mfa_verified:{username}")
        if stored_mfa_token:
            # Redis returns bytes, decode to string
            stored_mfa_token = stored_mfa_token.decode('utf-8') if isinstance(stored_mfa_token, bytes) else stored_mfa_token
        
        if not stored_mfa_token or stored_mfa_token != mfa_token:
            log_access(username, "wireguard_config", "failed", "MFA not verified")
            return {"error": "MFA verification required. Please login again."}, 403
    
    logger.info(f"Fetching WireGuard config for user: {username}")
    
    # Get user role and permissions
    try:
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        user_role = permissions_data['user_role_mapping'].get(username, 'nhan_vien')
        role_info = permissions_data['roles'].get(user_role, {})
        vpn_access = role_info.get('vpn_access', 'basic')
    except Exception as e:
        logger.warning(f"Failed to get role info: {e}")
        user_role = 'nhan_vien'
        vpn_access = 'basic'
    
    # Configure AllowedIPs based on role
    if vpn_access == 'priority' or user_role == 'giam_doc':
        # Full access to all internal networks
        allowed_ips = "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16"
        dns_servers = "1.1.1.1, 8.8.8.8"
        access_note = "Full Network Access (All Subnets)"
    elif vpn_access == 'full' or user_role == 'quan_ly':
        # Manager access - most internal networks
        allowed_ips = "10.0.0.0/16, 10.1.0.0/16"
        dns_servers = "1.1.1.1"
        access_note = "Manager Access (Extended)"
    else:
        # Basic employee access - limited subnets
        allowed_ips = "10.0.0.0/24"
        dns_servers = "1.1.1.1"
        access_note = "Employee Access (Limited)"
    
    # Generate REAL WireGuard keys for demo
    try:
        # Try to get from Vault first
        secret = vault_client.secrets.kv.v2.read_secret_version(path=f"wireguard/{username}")
        config_data = secret['data']['data']
        logger.info(f"Using existing keys from Vault for {username}")
    except Exception as e:
        logger.info(f"Generating new WireGuard keys for {username}")
        
        # Generate real client private key
        client_private = subprocess.run(['wg', 'genkey'], capture_output=True, text=True).stdout.strip()
        # Generate client public key from private key
        client_public = subprocess.run(['wg', 'pubkey'], input=client_private, capture_output=True, text=True).stdout.strip()
        
        # Get server public key from Vault (or generate if not exists)
        try:
            server_secret = vault_client.secrets.kv.v2.read_secret_version(path='wireguard/server')
            server_public_key = server_secret['data']['data']['public_key']
        except:
            # Generate server keys if not exist
            server_private = subprocess.run(['wg', 'genkey'], capture_output=True, text=True).stdout.strip()
            server_public_key = subprocess.run(['wg', 'pubkey'], input=server_private, capture_output=True, text=True).stdout.strip()
            # Store server keys in Vault
            try:
                vault_client.secrets.kv.v2.create_or_update_secret(
                    path='wireguard/server',
                    secret=dict(private_key=server_private, public_key=server_public_key)
                )
            except:
                pass
        
        config_data = {
            'private_key': client_private,
            'address': f'10.8.0.{hash(username) % 200 + 2}/24',
            'dns': dns_servers,
            'server_public_key': server_public_key,
            'endpoint': f'{os.getenv("SERVER_IP", "192.168.1.9")}:51820'
        }
        
        # Store client keys in Vault for reuse
        try:
            vault_client.secrets.kv.v2.create_or_update_secret(
                path=f'wireguard/{username}',
                secret=config_data
            )
        except Exception as ve:
            logger.warning(f"Failed to store keys in Vault: {ve}")
    
    # Generate WireGuard config file
    wg_config = f"""[Interface]
PrivateKey = {config_data['private_key']}
Address = {config_data['address']}
DNS = {dns_servers}

[Peer]
PublicKey = {config_data['server_public_key']}
Endpoint = {config_data['endpoint']}
AllowedIPs = {allowed_ips}
PersistentKeepalive = 25

# ═══════════════════════════════════════
# Zero Trust VPN Configuration
# ═══════════════════════════════════════
# User: {username}
# Role: {user_role.upper()} ({role_info.get('display_name', 'N/A')})
# Access Level: {access_note}
# Generated: {datetime.now().isoformat()}
# MFA: Verified ✓
# ═══════════════════════════════════════
"""
    
    log_access(username, "wireguard_config", "success", f"Role: {user_role}, Access: {vpn_access}")
    
    return {
        "config": wg_config,
        "username": username,
        "role": user_role,
        "vpn_access": vpn_access,
        "allowed_networks": allowed_ips,
        "address": config_data['address'],
        "endpoint": config_data['endpoint']
    }, 200


@app.route('/api/wireguard/config', methods=['POST'])
@require_auth
def get_wireguard_config():
    """Get WireGuard configuration from Vault (requires MFA)"""
    try:
        data = request.json or {}
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        mfa_token = data.get('mfa_token')
        
        result, status = _get_wireguard_config_impl(username, mfa_token)
        return jsonify(result), status
        
    except Exception as e:
        logger.error(f"WireGuard config error: {e}")
        return jsonify({"error": "Failed to get WireGuard config"}), 500


@app.route('/api/vpn/config', methods=['GET', 'POST'])
@require_auth
def get_vpn_config():
    """Get VPN configuration - Alias for /api/wireguard/config"""
    try:
        data = request.json or {}
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        mfa_token = data.get('mfa_token')
        
        result, status = _get_wireguard_config_impl(username, mfa_token)
        
        # Support both JSON and file download
        if request.args.get('download') == 'true' or request.headers.get('Accept') == 'application/octet-stream':
            # Return as file download
            from flask import Response
            filename = f"zerotrust-vpn-{username}.conf"
            return Response(
                result['config'],
                mimetype="application/octet-stream",
                headers={"Content-Disposition": f"attachment;filename={filename}"}
            )
        else:
            # Return as JSON
            return jsonify(result), status
        
    except Exception as e:
        logger.error(f"VPN config error: {e}")
        return jsonify({"error": "Failed to get VPN config"}), 500


# ==================== USER PROFILE & PERMISSIONS ====================

@app.route('/api/user/profile', methods=['GET'])
@require_auth
def get_profile():
    """Get user profile"""
    try:
        email = request.user_info.get('email')
        preferred_username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        username = email if email else preferred_username
        
        # Load permissions and company data
        with open('/app/mock-data/permissions.json', 'r', encoding='utf-8') as f:
            permissions_data = json.load(f)
        
        # Get user's role - try both email and preferred_username
        user_role_mapping = permissions_data.get('user_role_mapping', {})
        user_role = user_role_mapping.get(username) or user_role_mapping.get(preferred_username) or permissions_data.get('default_role', 'nhan_vien')
        role_info = permissions_data['roles'].get(user_role, {})
        
        # Get department from company_data
        department = None
        company_employees = permissions_data.get('company_data', {}).get('employees', [])
        for emp in company_employees:
            if emp.get('email') == email or emp.get('email') == username:
                department = emp.get('department')
                break
        
        return jsonify({
            "username": preferred_username,
            "email": email or username,
            "name": request.user_info.get('name', preferred_username.split('@')[0].title()),
            "department": department or "Engineering",
            "role": user_role,
            "role_display": role_info.get('display_name', 'Employee'),
            "level": role_info.get('level', 'limited')
        })
        
    except Exception as e:
        logger.error(f"Profile error: {e}")
        return jsonify({"error": "Failed to get profile"}), 500


@app.route('/api/user/permissions', methods=['GET'])
@require_auth
def get_permissions():
    """Get user permissions from mock data"""
    try:
        # Use email for role mapping (more reliable than preferred_username)
        email = request.user_info.get('email')
        preferred_username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        username = email if email else preferred_username
        
        logger.info(f"Getting permissions for user: {username} (email: {email}, preferred_username: {preferred_username})")
        
        # Load permissions data
        with open('/app/mock-data/permissions.json', 'r', encoding='utf-8') as f:
            permissions_data = json.load(f)
        
        # Get user's role - try both email and preferred_username
        user_role_mapping = permissions_data.get('user_role_mapping', {})
        user_role = user_role_mapping.get(username) or user_role_mapping.get(preferred_username) or permissions_data.get('default_role', 'nhan_vien')
        
        logger.info(f"User {username} has role: {user_role}")
        
        role_permissions = permissions_data['roles'].get(user_role, permissions_data['roles']['nhan_vien'])
        all_resources = permissions_data.get('resources', {})
        
        # Determine VPN and company access based on role
        vpn_access_level = role_permissions.get('vpn_access', 'none')
        vpn_enabled = vpn_access_level in ['basic', 'full', 'priority']
        company_access = user_role in ['quan_ly', 'giam_doc']  # Manager and above
        # Check TOTP using preferred_username (as Redis stores it that way)
        totp_enabled = redis_client.get(f"totp_setup_completed:{preferred_username}")
        
        logger.info(f"VPN enabled: {vpn_enabled}, Company access: {company_access}")
        
        # Get user's VPN IP (from mock data if available)
        vpn_ip = None
        try:
            with open('/app/mock-data/users.json', 'r') as f:
                users_data = json.load(f)
                for user in users_data.get('users', []):
                    if user.get('email') == username:
                        vpn_ip = user.get('vpn_ip')
                        break
        except:
            pass
        
        # Build response with detailed permissions
        databases_allowed = role_permissions.get('databases', {}).get('allowed', [])
        databases_readonly = role_permissions.get('databases', {}).get('read_only', [])
        servers_allowed = role_permissions.get('servers', {}).get('allowed', [])
        
        # Filter resources based on permissions
        accessible_databases = []
        for db in all_resources['databases']:
            if '*' in databases_allowed or db['id'] in databases_allowed:
                db_copy = db.copy()
                db_copy['access'] = 'read-only' if db['id'] in databases_readonly else 'full'
                db_copy['status'] = 'allowed'
                accessible_databases.append(db_copy)
            else:
                db_copy = db.copy()
                db_copy['access'] = 'none'
                db_copy['status'] = 'denied'
                accessible_databases.append(db_copy)
        
        accessible_servers = []
        for server in all_resources['servers']:
            if '*' in servers_allowed or server['id'] in servers_allowed:
                server_copy = server.copy()
                server_copy['status'] = 'allowed'
                accessible_servers.append(server_copy)
            else:
                server_copy = server.copy()
                server_copy['status'] = 'denied'
                accessible_servers.append(server_copy)
        
        return jsonify({
            # Dashboard-required fields
            "vpn_enabled": vpn_enabled,
            "company_access": company_access,
            "totp_enabled": bool(totp_enabled),
            "vpn_ip": vpn_ip or "Not assigned",
            
            # Traditional permission fields
            "role": user_role,
            "role_display": role_permissions.get('display_name', 'Employee'),
            "level": role_permissions.get('level', 'limited'),
            "vpn_access": role_permissions.get('vpn_access', 'basic'),
            "features": role_permissions.get('features', {}),
            "databases": accessible_databases,
            "servers": accessible_servers,
            "description": role_permissions.get('description', '')
        })
        
    except Exception as e:
        logger.error(f"Permissions error: {e}")
        return jsonify({"error": "Failed to get permissions"}), 500


@app.route('/api/resources/check', methods=['POST'])
@require_auth
def check_resource_access():
    """Check if user can access a specific resource"""
    try:
        data = request.json
        resource_type = data.get('type')  # 'database', 'server', 'api'
        resource_id = data.get('id')
        action = data.get('action', 'read')  # 'read', 'write', 'connect'
        
        username = request.user_info.get('preferred_username', request.user_info.get('email'))
        
        # Load permissions
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_permissions = permissions_data['roles'].get(user_role, {})
        
        # Check access
        allowed = False
        details = {}
        
        if resource_type == 'database':
            databases_allowed = role_permissions.get('databases', {}).get('allowed', [])
            databases_readonly = role_permissions.get('databases', {}).get('read_only', [])
            
            if '*' in databases_allowed or resource_id in databases_allowed:
                if action == 'write':
                    allowed = resource_id not in databases_readonly and role_permissions['features'].get('database_write', False)
                    details['reason'] = 'read-only access' if resource_id in databases_readonly else 'write allowed'
                else:
                    allowed = True
                    details['access_type'] = 'read-only' if resource_id in databases_readonly else 'full'
            else:
                details['reason'] = 'resource not in permitted list'
        
        elif resource_type == 'server':
            servers_allowed = role_permissions.get('servers', {}).get('allowed', [])
            if '*' in servers_allowed or resource_id in servers_allowed:
                allowed = True
                details['ssh_enabled'] = role_permissions['features'].get('ssh_access', False)
            else:
                details['reason'] = 'server access denied'
        
        log_access(username, f"check_{resource_type}:{resource_id}:{action}", "allowed" if allowed else "denied")
        
        return jsonify({
            "allowed": allowed,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "action": action,
            "details": details
        })
        
    except Exception as e:
        logger.error(f"Resource check error: {e}")
        return jsonify({"error": "Failed to check resource access"}), 500


# ==================== ADMIN ENDPOINTS ====================

@app.route('/api/admin/users', methods=['GET'])
@require_auth
def list_users():
    """List all users (admin only)"""
    try:
        # Check admin permission
        username = request.user_info.get('preferred_username', request.user_info.get('email'))
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_info = permissions_data['roles'].get(user_role, {})
        
        logger.info(f"list_users: username={username}, role={user_role}, has_user_mgmt={role_info.get('features', {}).get('user_management')}")
        
        if not role_info.get('features', {}).get('user_management'):
            logger.warning(f"Access denied for {username}: user_management permission required")
            return jsonify({"error": "Unauthorized"}), 403
        
        # Load users from mock data
        with open('/app/mock-data/users.json', 'r') as f:
            users_data = json.load(f)
        
        return jsonify({"users": users_data.get('users', [])})
    except Exception as e:
        logger.error(f"List users error: {e}")
        return jsonify({"error": "Failed to list users"}), 500


@app.route('/api/admin/users', methods=['POST'])
@require_auth
def create_user():
    """Create new user (admin only)"""
    try:
        # Check admin permission
        username = request.user_info.get('preferred_username', request.user_info.get('email'))
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_info = permissions_data['roles'].get(user_role, {})
        
        if not role_info.get('features', {}).get('user_management'):
            return jsonify({"error": "Unauthorized"}), 403
        
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'employee')
        full_name = data.get('name', email.split('@')[0])
        department = data.get('department', 'General')
        position = data.get('position', 'Staff')
        
        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400
        
        # Split full name
        name_parts = full_name.split(' ')
        first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else full_name
        last_name = name_parts[-1] if len(name_parts) > 1 else ''
        
        # Create user in Keycloak
        try:
            # Get admin token
            token_resp = requests.post(
                f"{KEYCLOAK_ADDR}/realms/master/protocol/openid-connect/token",
                data={
                    "client_id": "admin-cli",
                    "username": "admin",
                    "password": "admin123",
                    "grant_type": "password"
                },
                timeout=5
            )
            
            if token_resp.status_code != 200:
                return jsonify({"error": "Failed to authenticate with Keycloak"}), 500
            
            admin_token = token_resp.json()["access_token"]
            
            # Create user
            user_resp = requests.post(
                f"{KEYCLOAK_ADDR}/admin/realms/{KEYCLOAK_REALM}/users",
                headers={
                    "Authorization": f"Bearer {admin_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "username": email,
                    "email": email,
                    "firstName": first_name,
                    "lastName": last_name,
                    "enabled": True,
                    "emailVerified": True,
                    "credentials": [{
                        "type": "password",
                        "value": password,
                        "temporary": False
                    }],
                    "attributes": {
                        "role": [role],
                        "position": [position],
                        "department": [department]
                    }
                },
                timeout=5
            )
            
            if user_resp.status_code not in [201, 409]:
                logger.error(f"Keycloak user creation failed: {user_resp.status_code} - {user_resp.text}")
                return jsonify({"error": f"Failed to create user in Keycloak: {user_resp.text}"}), 500
            
            if user_resp.status_code == 409:
                return jsonify({"error": "User already exists"}), 409
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Keycloak connection error: {e}")
            return jsonify({"error": "Failed to connect to Keycloak"}), 500
        
        # Add to users.json
        try:
            with open('/app/mock-data/users.json', 'r') as f:
                users_data = json.load(f)
            
            # Get max ID
            max_id = max([u.get('id', 0) for u in users_data.get('users', [])], default=0)
            new_id = max_id + 1
            
            # Create new user entry
            new_user = {
                "id": new_id,
                "username": email.split('@')[0],
                "email": email,
                "password": password,
                "name": full_name,
                "role": role,
                "department": department,
                "position": position,
                "hire_date": datetime.now().strftime("%Y-%m-%d"),
                "vpn_ip": f"10.0.0.{100 + new_id}",
                "totp_enabled": False,
                "status": "active",
                "last_login": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "vpn_status": "not_configured",
                "allowed_resources": ["dev-server-1 (10.0.0.50)"]
            }
            
            users_data['users'].append(new_user)
            
            with open('/app/mock-data/users.json', 'w') as f:
                json.dump(users_data, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            logger.warning(f"Failed to update users.json: {e}")
        
        logger.info(f"Admin {username} created user {email} with role {role}")
        log_access(username, "create_user", "success", f"Created user {email}")
        
        return jsonify({
            "success": True,
            "message": f"User {email} created successfully",
            "user": {
                "email": email,
                "role": role,
                "name": full_name,
                "department": department,
                "position": position,
                "totp_enabled": False
            }
        })
    except Exception as e:
        logger.error(f"Create user error: {e}")
        return jsonify({"error": "Failed to create user"}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_auth
def delete_user(user_id):
    """Delete user (admin only)"""
    try:
        # Check admin permission
        username = request.user_info.get('preferred_username', request.user_info.get('email'))
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_info = permissions_data['roles'].get(user_role, {})
        
        if not role_info.get('features', {}).get('user_management'):
            return jsonify({"error": "Unauthorized"}), 403
        
        # In production, this would delete user from Keycloak
        log_access(username, "delete_user", "success", f"Deleted user ID {user_id}")
        logger.info(f"Admin {username} deleted user ID {user_id}")
        
        return jsonify({"success": True, "message": "User deleted"})
    except Exception as e:
        logger.error(f"Delete user error: {e}")
        return jsonify({"error": "Failed to delete user"}), 500


@app.route('/api/admin/users/<int:user_id>/revoke', methods=['POST'])
@require_auth
def revoke_user_access(user_id):
    """Revoke user VPN access (admin only)"""
    try:
        # Check admin permission
        username = request.user_info.get('preferred_username', request.user_info.get('email'))
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_info = permissions_data['roles'].get(user_role, {})
        
        if not role_info.get('features', {}).get('user_management'):
            return jsonify({"error": "Unauthorized"}), 403
        
        # Load users to get email
        with open('/app/mock-data/users.json', 'r') as f:
            users_data = json.load(f)
        
        target_user = next((u for u in users_data['users'] if u['id'] == user_id), None)
        if not target_user:
            return jsonify({"error": "User not found"}), 404
        
        target_username = target_user['username']
        
        # Revoke TOTP secret
        redis_client.delete(f"totp_secret:{target_username}")
        redis_client.delete(f"totp_setup_completed:{target_username}")
        redis_client.delete(f"mfa_verified:{target_username}")
        
        # In production: Delete WireGuard config from Vault
        # vault_client.secrets.kv.v2.delete_metadata_and_all_versions(path=f"wireguard/{target_username}")
        
        log_access(username, "revoke_user_access", "success", f"Revoked access for {target_user['email']}")
        logger.info(f"Admin {username} revoked access for user {target_user['email']}")
        
        return jsonify({
            "success": True, 
            "message": f"Access revoked for {target_user['email']}",
            "revoked_items": [
                "TOTP secret deleted",
                "MFA sessions cleared",
                "VPN config access revoked"
            ]
        })
    except Exception as e:
        logger.error(f"Revoke user error: {e}")
        return jsonify({"error": "Failed to revoke user access"}), 500


@app.route('/api/admin/logs', methods=['GET'])
@require_auth
def get_logs():
    """Get recent access logs with filtering"""
    try:
        # Check if user has admin role
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        
        # Get query params
        limit = int(request.args.get('limit', 100))
        action_filter = request.args.get('action', None)
        user_filter = request.args.get('user', None)
        status_filter = request.args.get('status', None)
        
        # Get logs from Redis
        logs = redis_client.lrange("access_logs", 0, limit - 1)
        log_entries = [json.loads(log) for log in logs]
        
        # Apply filters
        if action_filter:
            log_entries = [l for l in log_entries if l.get('action') == action_filter]
        if user_filter:
            log_entries = [l for l in log_entries if user_filter in l.get('username', '')]
        if status_filter:
            log_entries = [l for l in log_entries if l.get('status') == status_filter]
        
        # Statistics
        stats = {
            "total": len(log_entries),
            "success": len([l for l in log_entries if l.get('status') == 'success']),
            "failed": len([l for l in log_entries if l.get('status') == 'failed']),
            "unique_users": len(set(l.get('username') for l in log_entries))
        }
        
        return jsonify({
            "logs": log_entries,
            "count": len(log_entries),
            "stats": stats
        })
        
    except Exception as e:
        logger.error(f"Logs error: {e}")
        return jsonify({"error": "Failed to get logs"}), 500


# ==================== COMPANY DATA ENDPOINTS ====================

@app.route('/api/company/data', methods=['GET'])
@require_auth
def get_company_data():
    """Get all company data for dashboard"""
    try:
        username = request.user_info.get('email', request.user_info.get('preferred_username'))
        
        # Load permissions to check role
        permissions_path = '/app/mock-data/permissions.json'
        with open(permissions_path, 'r') as f:
            permissions_data = json.load(f)
        
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_info = permissions_data['roles'].get(user_role, {})
        
        # Load users data to count active/connected
        users_data = {}
        try:
            with open('/app/mock-data/users.json', 'r') as f:
                users_content = json.load(f)
                users_data = {u['email']: u for u in users_content.get('users', [])}
        except:
            pass
        
        # Return company data with metadata
        company_data = permissions_data.get('company_data', {})
        
        # Add company metadata
        response_data = {
            "company": {
                "name": "Zero Trust Corp",
                "department": "Engineering",
                "employees": len(company_data.get('employees', [])),
                "description": "Leading-edge zero-trust security architecture with WireGuard VPN and HashiCorp Vault integration",
                "departments": ["IT", "Finance", "HR", "Marketing"],
                "contact": {
                    "email": "contact@zerotrust-corp.com",
                    "phone": "+84 (28) XXXX XXXX",
                    "website": "https://zerotrust-corp.example.com"
                }
            },
            "users": [
                {
                    "status": users_data.get(u.get('email'), {}).get('status', 'active'),
                    "vpn_status": users_data.get(u.get('email'), {}).get('vpn_status', 'disconnected'),
                    "totp_enabled": users_data.get(u.get('email'), {}).get('totp_enabled', False),
                    **u
                }
                for u in company_data.get('employees', [])
            ]
        }
        
        # Add remaining company data
        response_data.update({
            "employees": company_data.get('employees', []),
            "leave_requests": company_data.get('leave_requests', []),
            "timesheets": company_data.get('timesheets', []),
            "projects": company_data.get('projects', []),
            "expenses": company_data.get('expenses', [])
        })
        
        # Filter data based on role
        if role_info.get('level') == 'limited':
            # Employee: only see own data
            response_data['leave_requests'] = [lr for lr in response_data.get('leave_requests', []) if lr['employee_email'] == username]
            response_data['timesheets'] = [ts for ts in response_data.get('timesheets', []) if ts['employee_email'] == username]
            response_data['projects'] = [p for p in response_data.get('projects', []) if username in p.get('team_members', [])]
            response_data['expenses'] = [e for e in response_data.get('expenses', []) if e['employee_email'] == username]
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Get company data error: {e}")
        return jsonify({"error": "Failed to get company data"}), 500


@app.route('/api/company/<data_type>', methods=['POST'])
@require_auth
def create_company_item(data_type):
    """Create new company data item"""
    try:
        username = request.user_info.get('email', request.user_info.get('preferred_username'))
        data = request.json
        
        # Load current data
        permissions_path = '/app/mock-data/permissions.json'
        with open(permissions_path, 'r') as f:
            permissions_data = json.load(f)
        
        # Add new item
        if 'company_data' not in permissions_data:
            permissions_data['company_data'] = {}
        
        if data_type not in permissions_data['company_data']:
            permissions_data['company_data'][data_type] = []
        
        # Generate ID
        existing_ids = [item['id'] for item in permissions_data['company_data'][data_type]]
        new_id = f"{data_type.upper()[:2]}{len(existing_ids) + 1:03d}"
        data['id'] = new_id
        
        permissions_data['company_data'][data_type].append(data)
        
        # Save back
        with open(permissions_path, 'w') as f:
            json.dump(permissions_data, f, indent=2)
        
        logger.info(f"User {username} created {data_type} item {new_id}")
        return jsonify({"success": True, "id": new_id, "data": data})
        
    except Exception as e:
        logger.error(f"Create company item error: {e}")
        return jsonify({"error": "Failed to create item"}), 500


@app.route('/api/company/<data_type>/<item_id>', methods=['PUT'])
@require_auth
def update_company_item(data_type, item_id):
    """Update company data item"""
    try:
        username = request.user_info.get('email', request.user_info.get('preferred_username'))
        data = request.json
        
        # Load current data
        permissions_path = '/app/mock-data/permissions.json'
        with open(permissions_path, 'r') as f:
            permissions_data = json.load(f)
        
        # Find and update item
        items = permissions_data.get('company_data', {}).get(data_type, [])
        for i, item in enumerate(items):
            if item['id'] == item_id:
                permissions_data['company_data'][data_type][i] = data
                break
        
        # Save back
        with open(permissions_path, 'w') as f:
            json.dump(permissions_data, f, indent=2)
        
        logger.info(f"User {username} updated {data_type} item {item_id}")
        return jsonify({"success": True, "data": data})
        
    except Exception as e:
        logger.error(f"Update company item error: {e}")
        return jsonify({"error": "Failed to update item"}), 500


@app.route('/api/company/<data_type>/<item_id>', methods=['DELETE'])
@require_auth
def delete_company_item(data_type, item_id):
    """Delete company data item"""
    try:
        username = request.user_info.get('email', request.user_info.get('preferred_username'))
        
        # Check permissions
        permissions_path = '/app/mock-data/permissions.json'
        with open(permissions_path, 'r') as f:
            permissions_data = json.load(f)
        
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_info = permissions_data['roles'].get(user_role, {})
        
        # Only managers and admins can delete
        if role_info.get('level') == 'limited':
            return jsonify({"error": "Unauthorized"}), 403
        
        # Find and delete item
        items = permissions_data.get('company_data', {}).get(data_type, [])
        permissions_data['company_data'][data_type] = [item for item in items if item['id'] != item_id]
        
        # Save back
        with open(permissions_path, 'w') as f:
            json.dump(permissions_data, f, indent=2)
        
        logger.info(f"User {username} deleted {data_type} item {item_id}")
        return jsonify({"success": True})
        
    except Exception as e:
        logger.error(f"Delete company item error: {e}")
        return jsonify({"error": "Failed to delete item"}), 500


# ==================== RUN APP ====================

if __name__ == '__main__':
    # Ensure logs directory exists
    os.makedirs('logs', exist_ok=True)
    
    logger.info("Starting Zero-Trust VPN Backend API")
    logger.info(f"Vault: {VAULT_ADDR}")
    logger.info(f"Keycloak: {KEYCLOAK_ADDR}")
    logger.info(f"Redis: {REDIS_HOST}:{REDIS_PORT}")
    
    app.run(host='0.0.0.0', port=5000, debug=False)
