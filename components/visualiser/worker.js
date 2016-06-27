console.log('hi');

var xhr = new XMLHttpRequest();
xhr.open('GET', '/getSongList', true);
xhr.send();
xhr.onload = function () {
    postMessage(xhr.response);
};

