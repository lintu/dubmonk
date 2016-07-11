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
        var base64Data = req.body.data;
        var imageUrl = 'components/visualiser/thumbs/';
        if(base64Data) {
            imageUrl += req.file.filename + '.' + req.body.format;
        } else {
            imageUrl += req.file.filename + '.jpeg';
            base64Data = getDefaultImageUri();
        }
        require("fs").writeFile('./' + imageUrl, base64Data, 'base64', function (err) {
            tags.imageUrl = imageUrl;
            res.json(tags);
        });
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
               //TODO this wont work for default images. Do once DB is setup
               tags.imageUrl = 'components/visualiser/thumbs/'+ tags.url.split('/').pop() + '.jpeg';
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

function getDefaultImageUri() {
    return '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';
}