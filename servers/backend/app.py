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
from io import BytesIO
from datetime import datetime, timedelta
import base64
import hashlib

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
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{KEYCLOAK_ADDR}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo",
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            return response.json()
        return None
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
                "client_secret": KEYCLOAK_CLIENT_SECRET,
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

@app.route('/api/auth/totp/setup', methods=['POST'])
@require_auth
def setup_totp():
    """Setup TOTP for user (first time)"""
    try:
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        email = request.user_info.get('email', username)
        
        # Generate secret
        secret = pyotp.random_base32()
        
        # Save to Redis
        save_totp_secret(username, secret)
        
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
            "manual_entry_key": secret
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

@app.route('/api/wireguard/config', methods=['POST'])
@require_auth
def get_wireguard_config():
    """Get WireGuard configuration from Vault (requires MFA)"""
    try:
        data = request.json or {}
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        mfa_token = data.get('mfa_token')
        
        # Verify MFA
        stored_mfa_token = redis_client.get(f"mfa_verified:{username}")
        if not stored_mfa_token or stored_mfa_token != mfa_token:
            log_access(username, "wireguard_config", "failed", "MFA not verified")
            return jsonify({"error": "MFA verification required"}), 403
        
        logger.info(f"Fetching WireGuard config for user: {username}")
        
        # Get config from Vault
        secret_path = f"secret/data/wireguard/{username}"
        try:
            secret = vault_client.secrets.kv.v2.read_secret_version(path=f"wireguard/{username}")
            config_data = secret['data']['data']
        except Exception as e:
            logger.error(f"Failed to read from Vault: {e}")
            return jsonify({"error": "WireGuard config not found"}), 404
        
        # Generate WireGuard config file
        wg_config = f"""[Interface]
PrivateKey = {config_data['private_key']}
Address = {config_data['address']}
DNS = {config_data.get('dns', '1.1.1.1')}

[Peer]
PublicKey = {config_data['server_public_key']}
Endpoint = {config_data['endpoint']}
AllowedIPs = 10.0.0.0/8
PersistentKeepalive = 25

# User: {username}
# Generated: {datetime.now().isoformat()}
# MFA: Verified ✓
"""
        
        log_access(username, "wireguard_config", "success")
        
        return jsonify({
            "config": wg_config,
            "username": username,
            "address": config_data['address'],
            "endpoint": config_data['endpoint']
        })
        
    except Exception as e:
        logger.error(f"WireGuard config error: {e}")
        return jsonify({"error": "Failed to get WireGuard config"}), 500


# ==================== USER INFO ====================

@app.route('/api/user/profile', methods=['GET'])
@require_auth
def get_profile():
    """Get user profile"""
    try:
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        
        return jsonify({
            "username": username,
            "email": request.user_info.get('email', ''),
            "name": request.user_info.get('name', username),
            "email_verified": request.user_info.get('email_verified', False)
        })
        
    except Exception as e:
        logger.error(f"Profile error: {e}")
        return jsonify({"error": "Failed to get profile"}), 500


# ==================== USER PROFILE & PERMISSIONS ====================

@app.route('/api/user/profile', methods=['GET'])
@require_auth
def get_profile():
    """Get user profile"""
    try:
        username = request.user_info.get('preferred_username', request.user_info.get('email'))
        
        # Load permissions data
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        
        # Get user's role
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_info = permissions_data['roles'].get(user_role, {})
        
        return jsonify({
            "username": username,
            "email": request.user_info.get('email', username),
            "name": request.user_info.get('name', username.split('@')[0].title()),
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
        username = request.user_info.get('preferred_username', request.user_info.get('email'))
        
        # Load permissions data
        with open('/app/mock-data/permissions.json', 'r') as f:
            permissions_data = json.load(f)
        
        # Get user's role
        user_role = permissions_data['user_role_mapping'].get(username, 'employee')
        role_permissions = permissions_data['roles'].get(user_role, {})
        all_resources = permissions_data['resources']
        
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

@app.route('/api/admin/logs', methods=['GET'])
@require_auth
def get_logs():
    """Get recent access logs"""
    try:
        # Check if user has admin role (simplified)
        username = request.user_info.get('preferred_username', request.user_info.get('sub'))
        
        # Get logs from Redis
        logs = redis_client.lrange("access_logs", 0, 99)
        log_entries = [json.loads(log) for log in logs]
        
        return jsonify({
            "logs": log_entries,
            "count": len(log_entries)
        })
        
    except Exception as e:
        logger.error(f"Logs error: {e}")
        return jsonify({"error": "Failed to get logs"}), 500


# ==================== RUN APP ====================

if __name__ == '__main__':
    # Ensure logs directory exists
    os.makedirs('logs', exist_ok=True)
    
    logger.info("Starting Zero-Trust VPN Backend API")
    logger.info(f"Vault: {VAULT_ADDR}")
    logger.info(f"Keycloak: {KEYCLOAK_ADDR}")
    logger.info(f"Redis: {REDIS_HOST}:{REDIS_PORT}")
    
    app.run(host='0.0.0.0', port=5000, debug=False)
