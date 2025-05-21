import hashlib

def get_fingerprint(headers):
    user_agent = headers.get('User-Agent', '')
    accept = headers.get('Accept', '')
    encoding = headers.get('Accept-Encoding', '')
    language = headers.get('Accept-Language', '')
    
    fingerprint_data = f"{user_agent}-{accept}-{encoding}-{language}"
    return hashlib.sha256(fingerprint_data.encode('utf-8')).hexdigest()[:12]  # First 12 chars of the hash
