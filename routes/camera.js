const express = require('express');
const onvif = require('node-onvif');
const router = express.Router();
require('dotenv').config();

const user = process.env.USER;
const pass = process.env.PASSWORD;

let discovered_devices;
let device;

console.debug('Start the discovery process.');
// Find the ONVIF network cameras.
// It will take about 3 seconds.
onvif.startProbe().then((device_info_list) => {
    discovered_devices = device_info_list;
    console.log(device_info_list.length + ' devices were found.');
    // Show the device name and the URL of the end point.
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
}).catch((error) => {
    console.error(error);
});

function move_camera(x, y, z) {
    device.init().then((info) => {
        // Show the detailed information of the device.
        console.log(JSON.stringify(info, null, '  '));
        console.log('Now turn the device...');
        return device.ptzMove({
            'speed': {
                x,
                y,
                z
                // x: 1.0, // Speed of pan (in the range of -1.0 to 1.0)
                // y: 0.0, // Speed of tilt (in the range of -1.0 to 1.0)
                // z: 0.0  // Speed of zoom (in the range of -1.0 to 1.0)
            },
            'timeout': 1 // seconds
        });
    }).catch((error) => {
        console.error(error);
    });
}

router.get('/discover', function(req, res, next) {
    res.send('Discovered camera devices: ' + discovered_devices);
})

router.get('/move', function callback(req, res, next) {
    let x = req.query['x'] !== undefined ? req.query['x'] : 0.0;
    let y = req.query.y !== undefined ? req.query.y : 0.0;
    let z = req.query.z !== undefined ? req.query.z : 0.0;

    console.debug('x=%s, y=%s, z=%s', x, y, z);
    if (x > 1.0 || x < -1.0 || y > 1.0 || y < -1.0 || z > 1.0 || y < -1.0) {
        return res.send('Axis parameter value must be within the range [-1.0;1.0]')
    }

    move_camera(x, y, z);
    res.send('Move camera');
});

router.post('/move', function(req, res, next) {
    let x = req.query['x'] !== undefined ? req.query['x'] : 0.0;
    let y = req.query.y !== undefined ? req.query.y : 0.0;
    let z = req.query.z !== undefined ? req.query.z : 0.0;

    console.debug('x=%s, y=%s, z=%s', x, y, z);
    if (x > 1.0 || x < -1.0 || y > 1.0 || y < -1.0 || z > 1.0 || y < -1.0) {
        return res.send('Axis parameter value must be within the range [-1.0;1.0]')
    }

    move_camera(x, y, z);
    res.send('Move camera');
});

module.exports = router;
