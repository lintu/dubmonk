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
    //processImages(response);
};


// for (var i = scene.children.length - 1, j= 0; i >= 0; i--) {
//     obj = scene.children[i];
//     if (obj.type === 'Line') {
//         var a = (_self.channel1FrequencyData[j] * 2) / 1000;
//         var geometry = new THREE.Geometry();
//
//         var vertex = obj.geometry.vertices[0];
//         geometry.vertices.push(vertex);
//
//         var vertex2 = vertex.clone();
//         vertex2.multiplyScalar(1 + a);
//
//         geometry.vertices.push(vertex2);
//
//         //obj.material.color = new THREE.Color( Math.random(), Math.random(), Math.random());
//         obj.geometry = geometry;
//     } else {
//         break; //Assuming lines are added after circles
//     }
// }