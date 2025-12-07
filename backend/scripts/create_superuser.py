#!/usr/bin/env python
import os
import sys
import pathlib

# Ensure project root (backend/) is on sys.path so `config` package can be imported
sys.path.append(str(pathlib.Path(__file__).resolve().parent.parent))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth import get_user_model

def main():
    User = get_user_model()
    username = 'sample'
    email = 'sample@gmail.com'
    password = 'sample@123'

    if User.objects.filter(username=username).exists():
        print('superuser already exists')
        return

    User.objects.create_superuser(username=username, email=email, password=password)
    print('superuser created')

if __name__ == '__main__':
    main()
