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
from core.models import InterviewSession

def main():
    User = get_user_model()
    username = 'student'
    email = 'student@example.com'
    password = 'student@123'

    user, created = User.objects.get_or_create(username=username, defaults={'email': email})
    if created:
        user.set_password(password)
        user.save()
        print('student user created')
    else:
        print('student user already exists')

    # Create an interview session for this student if none exists
    session_qs = InterviewSession.objects.filter(student=user)
    if session_qs.exists():
        session = session_qs.first()
        print(f'interview session already exists: {session.id}')
    else:
        session = InterviewSession.objects.create(
            student=user,
            position='Software Engineer',
            difficulty='Medium',
            experience_level='0-2 years'
        )
        print(f'created interview session: {session.id}')

    print(f'credentials -> username: {username}, email: {email}, password: {password}')

if __name__ == '__main__':
    main()
