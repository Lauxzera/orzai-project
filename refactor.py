import re

file_path = "c:/Users/ander/Downloads/belart-crm-portavel-20260625-175520/components/crm/analytics-view.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
content = content.replace('import * as React from "react";', 'import * as React from "react";\nimport { motion, AnimatePresence } from "framer-motion";')

# 2. Card Backgrounds and Borders
content = re.sub(r'bg-card(/\d+)?', 'bg-white/[0.015] backdrop-blur-[24px]', content)
content = content.replace('border-border', 'border-white/5')
content = content.replace('border-primary/10', 'border-white/5')
content = content.replace('shadow-sm', 'shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]')

# 3. CartesianGrid
content = re.sub(r'<CartesianGrid[^>]*/>', '<CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeOpacity={1} />', content)

# 4. XAxis
content = re.sub(r'<XAxis\s+dataKey="([^"]+)"[^>]*/>', r'<XAxis dataKey="\1" stroke="rgba(255,255,255,0.3)" tick={{fill: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 300}} axisLine={{stroke: "rgba(255,255,255,0.05)"}} tickLine={false} />', content)

# 5. Buttons / Navigation Pill
content = content.replace(
    'className="flex flex-col gap-3 rounded-2xl border bg-white/[0.015] backdrop-blur-[24px] p-4 lg:flex-row lg:items-center lg:justify-between"',
    'className="flex flex-col gap-3 rounded-full border border-white/5 bg-white/[0.015] backdrop-blur-[24px] p-2 px-4 lg:flex-row lg:items-center lg:justify-between shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]"'
)

# Replace the buttons to be pills
content = re.sub(r'variant={workspaceView === "([^"]+)" \? "default" : "outline"}', r'variant={workspaceView === "\1" ? "default" : "ghost"} className={workspaceView === "\1" ? "rounded-full shadow-[0_0_15px_rgba(219,13,113,0.3)] bg-primary" : "rounded-full text-white/50 hover:bg-white/5 hover:text-white"}', content)

# 6. Framer motion wrapper for the workspaceView
# Find where workspaceView === "overview" starts
overview_start = content.find('{workspaceView === "overview" ? (')
risks_end = content.find(') : null}') # This is tricky. Let's just wrap the entire block.
if overview_start != -1:
    before = content[:overview_start]
    after = content[overview_start:]
    
    # We will inject the AnimatePresence wrapper
    wrapped_after = '<AnimatePresence mode="wait">\n        <motion.div\n          key={workspaceView}\n          initial={{ opacity: 0, y: 20 }}\n          animate={{ opacity: 1, y: 0 }}\n          exit={{ opacity: 0, y: -20 }}\n          transition={{ duration: 0.3, ease: "easeOut" }}\n        >\n          ' + after
    
    # Find the closing tag of the main div to close AnimatePresence
    # The last characters are `</div>\n  );\n}`
    idx = wrapped_after.rfind('</div>\n  );\n}')
    if idx != -1:
        wrapped_after = wrapped_after[:idx] + '        </motion.div>\n      </AnimatePresence>\n    ' + wrapped_after[idx:]
        content = before + wrapped_after

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Refactor completed.")
