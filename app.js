var express = require('express');
var app = express();
var path = require('path');
var multer = require('multer');
var fs = require('fs');
//var redis = require('redis');
var id3 = require('id3js');
//var redisClient = redis.createClient();
//redisClient.on('error', function (err) {
//    console.log("Error: " + err);
//});

app.use(express.static(path.join(__dirname, '')));
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './components/visualiser/songs/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});
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
    id3({ file: req.file.destination + req.file.filename, type: id3.OPEN_LOCAL }, function(err, tags) {
        tags.url = req.file.destination + req.file.filename;
        res.json(tags);
    });
});

app.get('/getSongDetails', function (req, res) {
    id3({ file: './' + req.query.url, type: id3.OPEN_LOCAL }, function(err, tags) {
        res.json(tags);
    });
});
app.get('/getSongList', function (req, res) {
    var response = [];
    var folderUrl = './components/visualiser/songs/';
    fs.readdir(folderUrl, function (err, files) {
       for(var i=0; i< files.length; i++) {
           getID3Data(folderUrl + files[i], function (tags) {
               response.push(tags);
               if(response.length >= files.length) {
                   res.send(response);
               }
           });
        }
    })
});
function getID3Data(fileURL, callback) {
    id3({ file: fileURL , type: id3.OPEN_LOCAL }, function(err, tags) {
        tags.url = fileURL;
        callback(tags);
    });
}