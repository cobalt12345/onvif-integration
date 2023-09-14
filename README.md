# Service provides management endpoint operations for PTZ cameras

Current service manages PTZ IP camera using [ONVIF (Open Network Video Interface)](https://www.onvif.org/) protocol. 
Internally, it uses [Shinobi ONVIF](https://gitlab.com/Shinobi-Systems/shinobi-onvif) library.

## Provided operations

Following operations are implemented:
1. <b>GET</b> http://127.0.0.1:8880/discover - exposes information about discovered ONVIF devices; operation seems to be 
working only in local network.
2. <b>GET</b> http://127.0.0.1:8880/profile - exposes information about the selected and supported profiles.
3. <b>GET</b> http://127.0.0.1:8880/home - turns camera back to the home position, if device supports current operation.
4. <b>GET</b> http://127.0.0.1:8880/move?x=1.0&y=-1.0&z=0.5&t=5 - makes the PTZ camera to move with specified axis 
speeds during 5 seconds. x, y, z values must be within the range [-1.0;1.0]. t - time period in seconds.

    
    x - pan, y - tilt, z - zoom
5. <b>GET</b> http://127.0.0.1:8880/position?x=1.0&y=-1.0&z=0.5 - absolute move; values ranges depend on camera model.

## How Run the Application
1. Create <i>.env</i> file in project folder. Specify following configuration parameters:
```shell
PORT=8880 # port on which NodeJS service is running
LOGIN=admin # user name for ONVIF endpoint
PASSWORD=qwerty123! # user password for ONVIF endpoint
WARN=Port 80 on camera MUST be accessible in any way!
# even when internal port 80 is mapped to any other value, it must also be mapped to the external 80th port!
CAM_MGMT_URL=http://213.87.92.175/onvif/device_service # onvif management endpoint
```

2. ```npm install``` - installs all dependencies
3. ```npm run start``` - starts NodeJS server