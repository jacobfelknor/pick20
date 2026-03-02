from .settings import *

DEBUG = False

ALLOWED_HOSTS = ["pick20.jacobfelknor.com"]

CORS_ALLOWED_ORIGINS = [
    "https://pick20.jacobfelknor.com",
]

# The domain where your site is actually hosted
CSRF_TRUSTED_ORIGINS = [
    "https://pick20.jacobfelknor.com",
]

# This tells Django to trust the 'X-Forwarded-Proto' header from NGINX
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')