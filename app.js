var express = require('express');
var app = express();
var path = require('path');

app.use(express.static(path.join(__dirname, '')));
try {
    var server = app.listen(8080, function () {
        var host = server.address().address;
        var port = server.address().port;
        console.log('dubmonk on http: ', host, port);
    });
} catch (error) {
    console.log(error);
}
app.get('/', function (req, res) {
    res.sendFile('index.html');
});
