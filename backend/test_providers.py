
import os
import django
import sys
from pathlib import Path

# Setup Django environment
sys.path.append(str(Path(__file__).parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
import requests
import json
from bytez import Bytez

def test_openrouter_model(model_name):
    print(f"\n--- Testing OpenRouter Model: {model_name} ---")
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Fair AI Interview App",
    }
    data = {
        "model": model_name,
        "messages": [{"role": "user", "content": "Say hello briefly."}],
    }
    
    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(data),
            timeout=15
        )
        if response.status_code == 200:
            result = response.json()
            content = result['choices'][0]['message']['content']
            print(f"✅ SUCCESS: {content[:100]}...")
            return True
        else:
            print(f"❌ FAILED: Status {response.status_code} - {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False

def test_bytez_qwen():
    print("\n--- Testing Bytez: Qwen/Qwen3-4B-Instruct-2507 ---")
    if not settings.BYTEZ_API_KEY:
        print("Skipping Bytez (No Key)")
        return

    try:
        client = Bytez(settings.BYTEZ_API_KEY)
        model = client.model("Qwen/Qwen3-4B-Instruct-2507")
        output, error = model.run([
            {"role": "user", "content": "Say hello briefly."}
        ])
        
        if error:
            print(f"❌ FAILED: {error}")
        else:
            print(f"✅ SUCCESS: {output[:100]}...")
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")

if __name__ == "__main__":
    print("Starting Provider Tests...")
    
    # Test OpenRouter Models requested by user
    models_to_test = [
        "allenai/olmo-3-32b-think:free",
        "tngtech/tng-r1t-chimera:free",
        "alibaba/tongyi-deepresearch-30b-a3b:free",
        "meta-llama/llama-3.1-70b-instruct:free" # Verification of current one
    ]
    
    for model in models_to_test:
        test_openrouter_model(model)
        
    # Test Bytez
    test_bytez_qwen()
    
    print("\nTests Completed.")
