var express = require('express');
var app = express();
var path = require('path');
var multer = require('multer');


app.use(express.static(path.join(__dirname, '')));
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})
var upload = multer({storage: storage});
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
    console.log('hello');
    res.sendFile(__dirname + '/index.html');
});
app.post('/upload', upload.single('file'), function(req, res, next){
    res.end("File uploaded.");
});
