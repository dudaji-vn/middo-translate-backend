set -x 
node index.js sign-in -e shhong@dudaji.com -p Baadf00d
node index.js get-rooms -e shhong@dudaji.com
node index.js set-target-room -r 6611262bc7743702bd5c071b
node index.js post-msg -e shhong@dudaji.com -m $1
