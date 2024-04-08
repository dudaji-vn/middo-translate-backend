
# usage: ./sample-post.sh message
set -x
node index.js post-msg -e shhong@dudaji.com -m $1
# npx kill-port 3001 # If you want to kill 3001 server
