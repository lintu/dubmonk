var express = require('express');
var app = express();
var path = require('path');

app.use(express.static(path.join(__dirname, '')));

var server = app.listen(90, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('dubmonk on http: ', host, port);
});

app.get('/', function (req, res) {
    res.sendFile('index.html');
});
