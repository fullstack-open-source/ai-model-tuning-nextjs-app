#!/bin/bash
# Script to update all API routes to use checkPermissionOrReturnError
# This ensures user-friendly error messages for permission failures

echo "Updating permission checks in API routes..."

# Find all route.ts files
find src/app/api -name "route.ts" -type f | while read file; do
  echo "Processing: $file"
  
  # Check if file uses checkPermission
  if grep -q "await checkPermission" "$file"; then
    # Replace import if needed
    if ! grep -q "checkPermissionOrReturnError" "$file"; then
      sed -i "s/import { checkPermission } from '@lib\/middleware\/permissions';/import { checkPermissionOrReturnError } from '@lib\/middleware\/permission-check';/g" "$file"
    fi
    
    # Replace await checkPermission(user, 'permission') with permission check pattern
    # This is a complex replacement that needs to be done carefully
    echo "  - Found checkPermission calls in $file"
  fi
done

echo "Done!"

