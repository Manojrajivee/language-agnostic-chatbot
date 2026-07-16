import base64
import urllib.request
import os
import re

markdown_path = r"c:\Users\Manoj\OneDrive\Desktop\Chatbot\project_report_details.md"
output_dir = r"c:\Users\Manoj\OneDrive\Desktop\Chatbot\report_images"
os.makedirs(output_dir, exist_ok=True)

with open(markdown_path, 'r', encoding='utf-8') as f:
    content = f.read()

mermaid_blocks = re.findall(r'```mermaid\s*(.*?)\s*```', content, re.DOTALL)

print(f"Found {len(mermaid_blocks)} mermaid blocks.")

filenames = [
    "fig_4_1_1_overall_system_architecture.png",
    "fig_4_1_2_sequence_diagram_pipeline.png",
    "fig_4_1_3_class_diagram_models.png",
    "fig_4_4_1_entity_relationship_diagram.png"
]

for idx, block in enumerate(mermaid_blocks[:4]):
    print(f"Processing block {idx+1} ({filenames[idx]})...")
    # Clean up formatting whitespace or comments if any
    clean_block = block.strip()
    
    # URL-safe Base64 encoding
    encoded = base64.urlsafe_b64encode(clean_block.encode('utf-8')).decode('ascii').strip('=')
    
    # We can also add styling or background by adding parameters
    url = f"https://mermaid.ink/img/{encoded}"
    
    output_path = os.path.join(output_dir, filenames[idx])
    print(f"Downloading from {url} to {output_path}...")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            with open(output_path, 'wb') as out_file:
                out_file.write(response.read())
        print(f"Successfully saved {filenames[idx]}")
    except Exception as e:
        print(f"Error downloading {filenames[idx]}: {e}")
