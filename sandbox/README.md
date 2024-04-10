# cli
- This is cli tool for testing middo

# Usage

```
> node index.js

Usage: middo-cli [options] [command]

CLI for middo

Options:
  -V, --version              output the version number
  -h, --help                 display help for command

Commands:
  get-users                  Get users
  get-daily-msg-stat         Get daily msg stat
  get-google-stat            Get google api call stat
  sign-in [options]          Sign in
  get-rooms [options]        get rooms
  set-target-room [options]  set target room
  post-msg [options]         post msg
  socket-connect [options]   socket connect
  socket-join [options]      socket join
  help [command]             display help for command
```

# Quick start

- in terminal tab1, run middo-translate-backend
```
➜  middo-translate-backend ✗ yarn dev
```

- in terminal tab2, run middo-translate-cli scripts
```
> ./sample/sample-kill.sh && ./sample/sample-ready.sh
> ./sample/sample-post.sh message
```