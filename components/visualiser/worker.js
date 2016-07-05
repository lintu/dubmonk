var songsList = [];
var xhr = new XMLHttpRequest();
xhr.open('GET', '/getSongList', true);
xhr.send();
xhr.onload = function () {
    var response = JSON.parse(xhr.response);
    var message = {
        'type': 'songList',
        'data': response
    };
    postMessage(message);

};
