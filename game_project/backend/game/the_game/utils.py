import hashlib
import base64

def generate_fingerprint(headers):
    """ Generate a unique fingerprint from request headers """
    user_agent = headers.get('user-agent', '')
    accept = headers.get('accept', '')
    encoding = headers.get('accept-encoding', '')
    language = headers.get('accept-language', '')

    # Combine header values into a string
    data = f"{user_agent}-{accept}-{encoding}-{language}"

    # Generate a SHA256 hash and encode it in Base64 format
    hash = hashlib.sha256(data.encode('utf-8')).hexdigest()
    short_hash = base64.urlsafe_b64encode(hash.encode('utf-8')).decode('utf-8').strip("=")[:12]
    
    return short_hash
