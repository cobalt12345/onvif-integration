let express = require('express');

let app = express();
const PORT = 8880;


app.post('/move', function (req, res) {

    res.end('Your request: ' + req);
})

var server = app.listen(PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Example app listening at http://%s:%s", host, port)
})