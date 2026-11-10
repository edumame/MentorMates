#!/usr/bin/env python3
"""Read-only migration inventory gate; does not rewrite or apply SQL."""
from pathlib import Path
from collections import defaultdict
import sys
import re
root = Path(__file__).resolve().parents[1]
groups = defaultdict(list)
for file in sorted((root / 'supabase/migrations').glob('*.sql')):
    groups[file.name.split('_', 1)[0]].append(file.name)
collisions = {version: names for version, names in groups.items() if len(names) > 1}
invalid_views = [p.name for p in (root / 'supabase/migrations').glob('*.sql')
                 if re.search(r'ALTER\s+VIEW\s+\S+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY', p.read_text(), re.I)]
for version,names in collisions.items():
    print(f'DUPLICATE {version}: {", ".join(names)}')
for name in invalid_views:
    print(f'INVALID VIEW RLS: {name}')
print(f'{len(collisions)} duplicate historical version groups. Fresh replay is blocked until a validated baseline is adopted.')
print('See docs/database-migration-recovery.md. No files or databases were changed.')
sys.exit(1 if collisions or invalid_views else 0)
