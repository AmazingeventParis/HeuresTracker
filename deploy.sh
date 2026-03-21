#!/bin/bash
# Deploy script: syncs server data before push to prevent data loss
# Usage: bash deploy.sh "commit message"

set -e
cd "$(dirname "$0")"

MSG="${1:-Update}"

echo "1. Syncing data from server..."
curl -s "https://heures.swipego.app/api/projects" > data/heures.json
echo "   Done. $(node -e "const d=require('./data/heures.json');console.log(Object.keys(d.projets).length+' projects')")"

echo "2. Committing..."
git add -A
git commit -m "$MSG" || echo "   Nothing to commit"

echo "3. Pushing..."
git push

echo "4. Deploying to Coolify..."
curl -s "http://217.182.89.133:8000/api/v1/deploy?uuid=zz3vc2xe2hvg6d2h7zp6lwzw&force=true" \
  -H "Authorization: Bearer 1|FNcssp3CipkrPNVSQyv3IboYwGsP8sjPskoBG3ux98e5a576"

echo ""
echo "Deploy queued! Wait ~40s then check https://heures.swipego.app"
