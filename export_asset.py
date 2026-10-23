import base64

with open('character_head.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

with open('character_head_base64.js', 'w', encoding='utf-8') as f:
    f.write('const CHARACTER_HEAD_BASE64 = "data:image/png;base64,' + b64 + '";\n')

print("character_head_base64.js generated successfully")
