const onvif = require('node-onvif');

console.log('Start the discovery process.');
// Find the ONVIF network cameras.
// It will take about 3 seconds.
onvif.startProbe().then((device_info_list) => {
    console.log(device_info_list.length + ' devices were found.');
    // Show the device name and the URL of the end point.
    device_info_list.forEach((info) => {
        console.log('- ' + info.urn);
        console.log('  - ' + info.name);
        console.log('  - ' + info.xaddrs[0]);
    });
}).catch((error) => {
    console.error(error);
});

// Create an OnvifDevice object
let device = new onvif.OnvifDevice({
    xaddr: 'http://127.0.0.1:80/onvif/device_service',
    user : 'admin',
    pass : 'admin'
});

// Initialize the OnvifDevice object
device.init().then((info) => {
    // Show the detailed information of the device.
    console.log(JSON.stringify(info, null, '  '));
}).catch((error) => {
    console.error(error);
});