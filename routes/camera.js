const express = require('express');
const onvif = require('node-onvif');
const router = express.Router();
require('dotenv').config();

const user = process.env.LOGIN;
const pass = process.env.PASSWORD;
const x_axis_inverse = Boolean(process.env.INVERSE_X_AXIS)
const y_axis_inverse = Boolean(process.env.INVERSE_Y_AXIS)

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

            console.log('Init first listed device...');
            device = new onvif.OnvifDevice({
                xaddr: info.xaddrs[0],
                user,
                pass
            });
        });
    } else {
        console.log('No devices were discovered. Init device explicitly...');
        device = new onvif.OnvifDevice({
            xaddr: process.env.CAM_MGMT_URL,
            user,
            pass
        });
    }
    console.log(JSON.stringify(device, null, '  '));
    device.init().then((info) => {
        // Show the detailed information of the device.
        console.log(JSON.stringify(info, null, '  '));
    }).catch((reason) => {
        console.error('Could not initialize camera due to reason %s', reason);
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

function position_camera(x, y, z, x_speed = 1, y_speed = 1, z_speed = 1) {
    let x_axis = parseFloat(x);
    let y_axis = parseFloat(y);

    if (x_axis_inverse) {
        if (x_axis >= 0) {
            x_axis = x_axis - 1;
        } else {
            x_axis = x_axis + 1;
        }
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
        console.log('Message: ' + JSON.stringify(m, null, '  '));
            console.log('Moved to x=%s y=%s z=%s t = %s', x, y, z, timeout);

            return res.status(200).send(`Moved due ${timeout} seconds with x_axis_speed=${x} 
            y_axis_speed=${y} z_axis_speed=${z}`);
        }
    ).catch(reason => {

        return res.status(500)
            .send(`Could not move camera to x=${x} y=${y} z=${z} t=${t} due to reason: ${reason}`);
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
