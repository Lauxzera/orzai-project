import os

replacements = {
    "Instituto Belart": "Base CRM",
    "instituto belart": "base crm",
    "Instituto belart": "Base CRM",
    "Belart CRM": "Base CRM",
    "CRM Belart": "Base CRM",
    "Equipe Belart": "Equipe Base",
    "Administrador Belart": "Administrador Base",
}

directory = "c:/Users/ander/Downloads/belart-crm-portavel-20260625-175520"
extensions = (".tsx", ".ts", ".md", ".json")
exclude_dirs = ["node_modules", ".next", ".git"]

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original_content = content
        
        for old_str, new_str in replacements.items():
            content = content.replace(old_str, new_str)
            
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated: {filepath}")
    except Exception as e:
        print(f"Error reading {filepath}: {e}")

for root, dirs, files in os.walk(directory):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file.endswith(extensions):
            replace_in_file(os.path.join(root, file))

print("Rebranding completed.")
