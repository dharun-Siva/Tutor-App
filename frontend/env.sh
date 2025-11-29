#!/bin/sh
# Script to inject runtime environment variables into React app

# Create env-config.js with runtime environment variables
cat <<EOF > /usr/share/nginx/html/env-config.js
window._env_ = {
  REACT_APP_API_URL: "${REACT_APP_API_URL:-http://localhost:5000/api}",
  REACT_APP_BACKEND_URL: "${REACT_APP_BACKEND_URL:-http://localhost:5000}",
  REACT_APP_MEETING_SERVER_URL: "${REACT_APP_MEETING_SERVER_URL:-http://localhost:3001}",
  REACT_APP_AGORA_APP_ID: "${REACT_APP_AGORA_APP_ID}",
  REACT_APP_WHITEBOARD_APP_ID: "${REACT_APP_WHITEBOARD_APP_ID}",
  REACT_APP_UI_AVATARS_BASE_URL: "${REACT_APP_UI_AVATARS_BASE_URL:-https://ui-avatars.com/api}"
};
EOF
