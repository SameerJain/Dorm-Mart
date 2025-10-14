#!/bin/bash
# This script makes all files and folders in the current directory accessible to anyone

# Change permissions for all directories (allow read, write, execute to everyone)
find . -type d -exec chmod 777 {} \;

# Change permissions for all files (allow read, write, execute to everyone)
find . -type f -exec chmod 777 {} \;

echo "All files and directories in $(pwd) are now accessible to anyone."