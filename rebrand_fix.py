import os
files = ['package.json', 'app/layout.tsx', 'app/page.tsx', 'README.md', 'app/globals.css', 'lib/crm.ts']
for f in files:
  if os.path.exists(f):
    with open(f, 'r', encoding='utf-8') as file:
      content = file.read()
    content = content.replace('Belart CRM', 'Orzai Project').replace('belart-crm', 'orzai-project').replace('Belart', 'Orzai')
    with open(f, 'w', encoding='utf-8') as file:
      file.write(content)
