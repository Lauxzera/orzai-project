import os
import re

directory = "c:/Users/ander/Downloads/belart-crm-portavel-20260625-175520/features"
directory2 = "c:/Users/ander/Downloads/belart-crm-portavel-20260625-175520/components/crm"

def strip_classes(dir_path):
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.endswith((".tsx", ".ts")):
                path = os.path.join(root, file)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # We want to remove 'bg-card', 'bg-card/80', 'bg-card/70', 'border-border', 'shadow-sm', 'border-border/70', 'shadow-md', 'perf-card', 'soft-panel'
                # from anywhere inside <Card className="..."> or just globally in the file (safe since they are highly specific to old styling).
                
                original = content
                classes_to_remove = [
                    r'\bbg-card\b(?:/\d+)?',
                    r'\bborder-border\b(?:/\d+)?',
                    r'\bshadow-sm\b',
                    r'\bshadow-md\b',
                    r'\bperf-card\b',
                    r'\bsoft-panel\b',
                    r'\bbg-muted/20\b'
                ]
                
                for cls in classes_to_remove:
                    content = re.sub(cls, '', content)
                
                # Cleanup multiple spaces in className strings
                content = re.sub(r'className="([^"]+)"', lambda m: 'className="' + ' '.join(m.group(1).split()) + '"', content)
                
                # Remove empty classNames
                content = content.replace('className=""', '')
                content = content.replace('className=" "', '')
                
                if content != original:
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"Updated {file}")

strip_classes(directory)
strip_classes(directory2)
print("Done")
