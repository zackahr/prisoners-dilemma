import re
from django.utils.deprecation import MiddlewareMixin

class CSRFExemptMiddleware(MiddlewareMixin):
    """
    Middleware to exempt specific URL patterns from CSRF protection
    """
    
    def process_request(self, request):
        # List of URL patterns to exempt from CSRF
        exempt_patterns = [
            r'^/api/ultimatum/.*',
            r'^/api/prisoners/.*',
        ]
        
        path = request.path
        
        for pattern in exempt_patterns:
            if re.match(pattern, path):
                setattr(request, '_dont_enforce_csrf_checks', True)
                break
        
        return None
