const express = require('express');
const onvif = require('node-onvif');
const router = express.Router();
require('dotenv').config();

const user = process.env.LOGIN;
const pass = process.env.PASSWORD;
const x_axis_inverse = process.env.INVERSE_X_AXIS.toLowerCase() === 'true'
const y_axis_inverse = process.env.INVERSE_Y_AXIS.toLowerCase() === 'true'
const prefer_cam_mgmt_ip_than_cam_mgmt_url =
    process.env.PREFER_CAM_MGMT_IP_THAN_CAM_MGMT_URL.toLowerCase() === 'true';

const cam_not_support_abs_move_timeout =
    process.env.CAM_NOT_SUPPORT_ABS_MOVE_TIMEOUT.toLowerCase() === 'true';

const cam_zero_azimuth = Number(process.env.CAM_ZERO_AZIMUTH);
console.log('Camera zero azimuth: %s = %d', typeof cam_zero_azimuth, cam_zero_azimuth)


let discovered_devices;
let device;

console.debug('Start the discovery process.');
// Find the ONVIF network cameras.
// It will take about 3 seconds.
onvif.startProbe().then((device_info_list) => {
    discovered_devices = device_info_list;
    console.log(device_info_list.length + ' devices were found.');
    // Show the device name and the URL of the end point.
    if (device_info_list.length > 0) {
        device_info_list.forEach((info) => {
            console.log('- ' + info.urn);
            console.log('  - ' + info.name);
            for (let addr of info.xaddrs) {
                console.log('  - ' + addr);
            }
        });
    }
    const deviceInitSettings = {
        user,
        pass
    }
    if (prefer_cam_mgmt_ip_than_cam_mgmt_url) {
        deviceInitSettings['address'] = process.env.CAM_MGMT_IP;
    } else {
        deviceInitSettings['xaddr'] = process.env.CAM_MGMT_URL;
    }
    console.log('Init device with following settings: %s', deviceInitSettings);
    device = new onvif.OnvifDevice(deviceInitSettings);
    device.init().then((info) => {
        // Show the detailed information of the device.
        console.log('Initialized device info: %s', JSON.stringify(info, null, '  '));
    }).catch((reason) => {
        console.error('Could not initialize camera due to reason %s', reason);

        throw Error(reason);
    });
}).catch((error) => {
    console.error(error);
});

function move_camera(x, y, z, t) {
    let x_axis = parseFloat(x);
    let y_axis = parseFloat(y);

    return device.ptzMove({
        'speed': {
            x: x_axis,
            y: y_axis,
            z: parseFloat(z)
        },
        'timeout': parseInt(t) // seconds
    })
}

function stop_camera() {
    device.ptzStop().then(console.log('Camera stopped moving')).catch((error) =>
        console.error('Stop movement failed due to reason: %s', error));
}

function position_camera(x, y, z, x_speed = 1, y_speed = 1, z_speed = 1) {
    let x_axis = parseFloat(x);
    let y_axis = parseFloat(y);

    // inverse control - X
    if (x_axis_inverse) {
        if (x_axis >= 0) {
            x_axis = x_axis - 1;
        } else {
            x_axis = x_axis + 1;
        }
    }
    // precision based on camera zero azimuth
    if ((x_axis - cam_zero_azimuth >= -1) && (x_axis - cam_zero_azimuth) <= 1) {
        x_axis = x_axis - cam_zero_azimuth;
    } else if ((x_axis - cam_zero_azimuth) < -1) {
        x_axis = 1 + ((x_axis - cam_zero_azimuth) % 1);
    } else if ((x_axis - cam_zero_azimuth) > 1) {
        x_axis = -(1 - ((x_axis - cam_zero_azimuth) % 1));
    }

    if (Math.abs(x_axis) > 1) {
        throw Error('Precision algorithm error. Gamma\' is out of range [-1;+1]');
    }

    if (y_axis_inverse) {
        y_axis = -y_axis;
    }

    let ptzService = device.services.ptz;
    if (!ptzService) {
        throw new Error('Your ONVIF network camera does not support the PTZ service.');
    }
    console.log('Profile token: ' + device.getCurrentProfile().token)
    return ptzService.absoluteMove({
        'ProfileToken': device.getCurrentProfile().token,
        'Position': {
            'x': x_axis,
            'y': y_axis,
            'z': parseFloat(z)
        },
        'Speed': {
            'x': x_speed,
            'y': y_speed,
            'z': z_speed
        }
    });
}

router.get('/discover', function (req, res,
                                  next) {

    if (discovered_devices.length > 0) {
        res.send(JSON.stringify(discovered_devices, null, '  '));
    } else {
        res.status(404).send("No discovered ONVIF devices");
    }
})

router.get('/profile', function (req, res,
                                 next) {

    let response = {
        'selectedProfile': JSON.stringify(device.getCurrentProfile(), null, '  '),
        'supportedProfiles': JSON.stringify(device.getProfileList(), null, '  ')
    }

    res.send(response);
})

router.get('/home', function (req, res,
                              next) {

    let ptz = device.services.ptz;
    if (!ptz) {
        return res.send('Your ONVIF network camera does not support the PTZ service.');
    }
    // The parameters for the gotoHomePosition() method
    let profile = device.getCurrentProfile();
    let params = {
        'ProfileToken': profile['token'],
        'Speed': 1
    };
    //stop device movement before returning to the home position
    ptz.stop({
        'ProfileToken': profile['token'],
        'PanTilt': true,
        'Zoom': true
    });
    // Send the GotoHomePosition command using the gotoHomePosition() method
    ptz.gotoHomePosition(params).then(() => res.send('Camera moved to home position'))
        .catch(reason => res.status(404).send('Could not move camera to home position due to reason '
            + reason));

})

router.get('/move', function callback(req, res,
                                      next) {

    let x = req.query['x'] !== undefined ? req.query['x'] : 0.0;
    let y = req.query.y !== undefined ? req.query.y : 0.0;
    let z = req.query.z !== undefined ? req.query.z : 0.0;
    let timeout = req.query.t !== undefined ? req.query.t : 1;

    console.debug('x=%s, y=%s, z=%s', x, y, z);
    if (x > 1.0 || x < -1.0 || y > 1.0 || y < -1.0 || z > 1.0 || z < -1.0) {

        return res.status(400).send('Axis parameters X, Y, Z value must be within the range [-1.0;1.0].')
    }

    move_camera(x, y, z, timeout).then((m) => {
        if (cam_not_support_abs_move_timeout) {
            setTimeout(()=>{
                stop_camera();
            }, timeout * 1000);
        }
        console.log('Moved to x=%s y=%s z=%s t=%s', x, y, z, timeout);
            return res.status(200).send(`Moved due ${timeout} seconds with x_axis_speed=${x} 
            y_axis_speed=${y} z_axis_speed=${z}`);
        }
    ).catch(reason => {

        return res.status(500)
            .send(`Could not move camera to x=${x} y=${y} z=${z} t=${timeout} due to reason: ${reason}`);
    });
});

router.get('/position', function callback(req, res,
                                          next) {

    let x = req.query['x'] !== undefined ? req.query['x'] : 0.0;
    let y = req.query.y !== undefined ? req.query.y : 0.0;
    let z = req.query.z !== undefined ? req.query.z : 0.0;

    console.debug('x=%s, y=%s, z=%s', x, y, z);
    if (x > 1.0 || x < -1.0 || y > 1.0 || y < -1.0 || z > 1.0 || z < 0.0) {

        return res.status(400).send('Axis parameters X, Y value must be within the range [-1.0;1.0]. ' +
            'Z: [0;1.0]')
    }
    position_camera(x, y, z).then((m) => {
        console.log('Positioned to x=%s y=%s z=%s', x, y, z);

        return res.status(200).send(`Positioned to x=${x} y=${y} z=${z}`);
    }).catch(reason => {
        const errorMessage = `Could not move camera to x=${x} y=${y} z=${z} due to reason: ${reason}`;
        console.error(errorMessage);

        return res.status(500).send(errorMessage);
    });
});


module.exports = router;
