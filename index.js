const onvif = require('node-onvif');

const user = 'admin';
const pass = 'admin!';

console.log('Start the discovery process.');
// Find the ONVIF network cameras.
// It will take about 3 seconds.
onvif.startProbe().then((device_info_list) => {
    console.log(device_info_list.length + ' devices were found.');
    // Show the device name and the URL of the end point.
    device_info_list.forEach((info) => {
        console.log('- ' + info.urn);
        console.log('  - ' + info.name);
        for (let addr of info.xaddrs) {
        	console.log('  - ' + addr);
        }
        
        
        console.log('Init first listed device...');
        let device = new onvif.OnvifDevice({
	  xaddr: info.xaddrs[0],
	  user,
	  pass
	});
        device.init().then((info) => {
	  // Show the detailed information of the device.
	  console.log(JSON.stringify(info, null, '  '));
	  console.log('Now turn the device...');
	  return device.ptzMove({
	    'speed': {
	      x: 1.0, // Speed of pan (in the range of -1.0 to 1.0)
	      y: 0.0, // Speed of tilt (in the range of -1.0 to 1.0)
	      z: 0.0  // Speed of zoom (in the range of -1.0 to 1.0)
	    },
	    'timeout': 1 // seconds
	  });
	}).catch((error) => {
	  console.error(error);
	});
    });
}).catch((error) => {
    console.error(error);
});

