# Basic Todo Reminder Service

This is a basic todo reminder service that is intended to be run on a proxmox LXC. Tested with Debian 12.

## Installation:

1. Get files in the desired service folder. (However that may be)
2. Edit the ntfy topic name in `server.js`, it is on line 10
3. `chmod +x install.sh`
4. `./install.sh`
        - Run with root permissions

Then visit the service at http://<LXC_IP>:3000 
