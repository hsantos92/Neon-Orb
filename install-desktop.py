#!/usr/bin/env python3
"""Install a per-user GNOME launcher for this checkout."""
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
data = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share'))
def exec_quote(value):
    value = str(value).replace('%', '%%')
    for char in ('\\', '"', '`', '$'):
        value = value.replace(char, '\\' + char)
    return '"' + value + '"'

def entry_value(value):
    return str(value).replace('\\', '\\\\').replace('\n', '\\n')

launcher = data / 'applications/neon-orb.desktop'
launcher.parent.mkdir(parents=True, exist_ok=True)
launcher.write_text('\n'.join([
    '[Desktop Entry]', 'Type=Application', 'Version=1.0', 'Name=Neon Orb',
    'Comment=Audio-reactive GPU particle visualization',
    'Exec=' + exec_quote(root / 'launch.sh'),
    'Path=' + entry_value(root), 'Icon=' + entry_value(root / 'assets/neon-orb.svg'),
    'Terminal=false', 'Categories=AudioVideo;',
    'Keywords=audio;particles;visualizer;orb;', 'Actions=Transparent;', '',
    '[Desktop Action Transparent]', 'Name=Launch Transparent',
    'Exec=' + exec_quote(root / 'launch.sh') + ' --transparent', ''
]))
try:
    subprocess.run(['update-desktop-database', str(launcher.parent)], check=True)
except FileNotFoundError:
    pass
print('Installed:', launcher)
