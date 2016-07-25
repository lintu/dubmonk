(function () {
    'use strict';
    angular.module('dubmonk.visualiser').controller('VisualiserModernController', VisualiserModernController);

    VisualiserModernController.$inject = ['$timeout', '$scope', '$http', 'Utils', 'InfoService'];

    function VisualiserModernController($timeout, $scope, $http, Utils, InfoService) {
        var _self = this;

        this.audioContext = null;

        // var masonGrid = new Masonry( '.grid', {
        //     itemSelector: '.grid__item'
        // });


        this.nodes = {
            'source': null,
            'analyser1': null,
            'splitter': null,
            'analyser2': null,
            'merger': null,
            'distortion': null,
            'gain': null,
            'biquad': null,
            'convolver': null
        };

        var WIDTH = document.getElementById('visualiser').clientWidth;
        var HEIGHT = document.getElementById('visualiser').clientHeight;

        this.soundBuffer;
        this.isPaused = false;
        this.isLooped = false;
        this.showVisualiser = true;

        //Canvas
        this.canvas = null;
        this.canvasCtx = null;
        this.animationId = 1;

        this.mainCanvasType = '3d';

        this.channel1FrequencyData = [];
        this.channel2FrequencyData = [];
        this.channel1TimeDomainData = [];
        this.channel2TimeDomainData = [];

        this.canvasBg;

        this.gainValueChanged = gainValueChanged;
        this.gainValue = "1";

        this.goFullScreen = goFullScreen;

        //Player Controls
        this.resume = resume;
        this.pause = pause;
        this.stop = stop;
        this.start = start;
        this.next = next;
        this.previous = previous;

        this.upload = upload;
        this.playFromList = playFromList;
        this.setMainItem = setMainItem;

        this.nowPlayingIndex = 0;

        this.trackPositionChanged = trackPositionChanged;
        this.trackDuration = '0.00';
        this.trackPosition = 0;
        this.secondsToDuration = Utils.secondsToDuration;

        this.vManager;
        this.smallCanvasList = [];
        this.mainVisualiserIndex = 4;

        this.songList = [];

        init();

        function setMainItem(index) {
            if(_self.vManager) {
                _self.mainCanvasType = _self.vManager.initMainCanvas(index);
            }
            $timeout(function () {
                _self.mainVisualiserIndex = index;
            }, 0);
        }

        function init() {
            //InfoService.addAlert('Welcome');

            // //Vertical range slider for volume
            // new Slider('#ex4', {
            //     reversed : true,
            //     formatter: function(value) {
            //         _self.gainValue = value;
            //         gainValueChanged()
            //     }
            // });

            _self.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            _self.vManager = new VisualisationManager(_self.smallCanvasList, _self.mainVisualiserIndex);
            setMainItem(_self.mainVisualiserIndex);
            setupNodes();
            getSongList();
        }

        function processImages(blob, callback) {
            jsmediatags.read(blob, {
                onSuccess: function(tag) {
                    var dataUrl = '';
                    if(tag.tags.picture) {
                        var base64String = "";
                        for (var i = 0; i < tag.tags.picture.data.length; i++) {
                            base64String += String.fromCharCode(tag.tags.picture.data[i]);
                        }
                        dataUrl = window.btoa(base64String);
                        callback(dataUrl, tag.tags.picture.format);
                    } else {
                        callback(undefined, undefined);
                    }
                },
                onError: function(error) {
                    console.log(error);
                    callback(null);
                }
            });

            // From remote host

        }
        function getSongList() {
            var myWorker = new Worker('components/visualiser/worker.js');
            myWorker.onmessage = function (event) {
                if(event.data.type === 'songList') {
                    _self.songList = event.data.data;
                    if(_self.songList.length > 0) {
                        if (!$scope.$$phase) {
                            $scope.$digest();
                        }
                        _self.songList[0].isPlaying = true;
                        fetchSound(_self.songList[0].url);
                        // $timeout(function () {
                        //     masonGrid.layout();
                        // }, 1000);
                    }
               }
            }
        }

        function getNextTrackUrl() {
            if(_self.nowPlayingIndex > _self.songList.length - 1 || _self.nowPlayingIndex < 0) {
                _self.nowPlayingIndex = 0;
            }

            return _self.songList[_self.nowPlayingIndex].url;
        }

        function setupNodes() {
            //source
            _self.nodes.source = _self.audioContext.createBufferSource();

            //analyser
            _self.nodes.analyser1 = _self.audioContext.createAnalyser();
            _self.nodes.analyser2 = _self.audioContext.createAnalyser();
            _self.nodes.analyser1.smoothingTimeConstant = 0.3;
            _self.nodes.analyser1.fftSize = 1024;
            _self.nodes.analyser2.smoothingTimeConstant = 0.3;
            _self.nodes.analyser2.fftSize = 1024;

            _self.nodes.splitter = _self.audioContext.createChannelSplitter(2);
            _self.nodes.merger = _self.audioContext.createChannelMerger(2);
            _self.nodes.distortion = _self.audioContext.createWaveShaper();
            _self.nodes.gain = _self.audioContext.createGain();
            _self.nodes.biquad = _self.audioContext.createBiquadFilter();
            _self.nodes.convolver = _self.audioContext.createConvolver();

            _self.nodes.gain.gain.value = 1;
            _self.nodes.biquad.frequency.value = 0;
            _self.nodes.biquad.type = 'highpass';
            //connections
            _self.nodes.source.connect(_self.nodes.splitter);
            _self.nodes.splitter.connect(_self.nodes.analyser1, 0, 0);
            _self.nodes.splitter.connect(_self.nodes.analyser2, 1, 0);

            _self.nodes.analyser1.connect(_self.nodes.merger, 0, 0);
            _self.nodes.analyser2.connect(_self.nodes.merger, 0, 1);

            _self.nodes.merger.connect(_self.nodes.distortion, 0, 0);
            _self.nodes.distortion.connect(_self.nodes.biquad);
            _self.nodes.biquad.connect(_self.nodes.gain, 0, 0);
            _self.nodes.gain.connect(_self.audioContext.destination, 0, 0);
            _self.nodes.gain.gain.setValueAtTime(Number(_self.gainValue), _self.audioContext.currentTime)
        }

        function fetchSound(url) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                processArrayBuffer(xhr.response);
            };
            xhr.send();
        }

        function processArrayBuffer(audioData) {
            _self.audioContext.decodeAudioData(audioData, function (buffer) {
                _self.soundBuffer = buffer;

                _self.trackDuration = Math.floor(_self.soundBuffer.duration);

                //startDubbing
                _self.channel1FrequencyData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2FrequencyData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);

                _self.channel1TimeDomainData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2TimeDomainData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);
                if (!$scope.$$phase) {
                    $scope.$digest();
                }
                start(0);
            });
        }

        function threadFunction() {
            if (_self.animationId) {
                _self.animationId = requestAnimationFrame(threadFunction);

                _self.nodes.analyser1.getByteFrequencyData(_self.channel1FrequencyData);
                _self.nodes.analyser2.getByteFrequencyData(_self.channel2FrequencyData);

                _self.nodes.analyser1.getByteTimeDomainData(_self.channel1TimeDomainData);
                _self.nodes.analyser2.getByteTimeDomainData(_self.channel2TimeDomainData);

                if (_self.trackPosition >= _self.trackDuration) {
                    if (_self.isLooped) {
                        stop();
                        start(0);
                    } else {
                        stop();
                        _self.nowPlayingIndex++;
                        fetchSound(getNextTrackUrl());
                    }
                    if (!$scope.$$phase) {
                        $scope.$digest();
                    }
                } else {
                    if (_self.showVisualiser) {
                        _self.vManager.draw();
                    } else {
                        _self.vManager.clearAll();
                    }
                    if (!$scope.$$phase) {
                        _self.trackPosition = Math.floor(_self.audioContext.currentTime - _self.startTime);
                        $scope.$digest();
                    }
                }

            }
        }

        function trackPositionChanged() {
            if (_self.isPaused) {
                pause();
                cancelAnimationFrame(_self.animationId);
                _self.animationId = undefined;
            } else {
                start(Number(_self.trackPosition));
            }
        }

        function start(startFrom) {
            if (_self.nodes.source) {

                if (_self.nodes.source.buffer) {
                    _self.nodes.source.stop();
                }

                _self.nodes.source = _self.audioContext.createBufferSource();
                _self.nodes.source.buffer = _self.soundBuffer;
                _self.nodes.source.connect(_self.nodes.splitter);
                _self.startTime = _self.audioContext.currentTime - startFrom;
                _self.nodes.source.start(0, startFrom);
                _self.nodes.source.loop = false;
                _self.animationId = 1;
                threadFunction();

                _self.isPaused = false;
                gainValueChanged();
            } else {
                alert('Song is not ready to play');
            }
        }

        function resume() {
            _self.isPaused = false;
            start(Number(_self.trackPosition));
            _self.animationId = 1;
            threadFunction();
        }

        function pause() {
            if (_self.nodes.source.buffer) {
                _self.nodes.source.stop();
                window.cancelAnimationFrame(_self.animationId);
                _self.animationId = undefined;

            }
            _self.isPaused = true;
        }

        function previous() {
            _self.nowPlayingIndex --;
            fetchSound(getNextTrackUrl());
        }

        function next() {
            _self.nowPlayingIndex ++;
            fetchSound(getNextTrackUrl());
        }

        function stop() {
            if (_self.nodes.source) {
                if (_self.nodes.source.buffer) {
                    _self.nodes.source.stop();
                    window.cancelAnimationFrame(_self.animationId);
                    _self.animationId = undefined;
                }
                _self.trackPosition = 0;
                _self.isPaused = true;
            }
        }

        function playFromList(index) {
            _self.nowPlayingIndex = index;
            $timeout(function(){
                fetchSound(getNextTrackUrl());
            }, 0);
        }

        function upload() {
            var file = document.getElementById('upload-file').files[0];

            if(file) {
                InfoService.addAlert('Starting upload...');
                processImages(file, function(dataUri, format){
                    if(file.type === 'audio/mp3') {
                        var fd = new FormData();
                        fd.append('file', file);
                        fd.append('data', dataUri);
                        fd.append('format', format? format.split('/')[1] : '');
                        var xhr = new XMLHttpRequest();

                        xhr.open('POST', '/upload');
                        xhr.send(fd);
                        xhr.onreadystatechange = function () {
                            if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                                InfoService.addAlert('Yes done with upload. you can start listening...');

                                _self.songList.push(JSON.parse(xhr.responseText));
                                if(!$scope.$$phase) {
                                    $scope.$digest();
                                }
                                // $timeout(function () {
                                //     masonGrid.layout();
                                // }, 0);
                            }
                        }
                    } else {
                        alert('haha. only mp3 files');
                    }
                });

            }else {
                alert('Please select a file');
            }
        }

        function gainValueChanged() {
            if (_self.nodes && _self.nodes.gain) {
                if(_self.gainValue != 0 && _self.gainValue !=1) {
                    _self.nodes.gain.gain.exponentialRampToValueAtTime(_self.gainValue * (1 / 10), _self.audioContext.currentTime + .5);
                    //_self.nodes.gain.gain.value = _self.gainValue * (1 / 10);
                } else {
                    _self.nodes.gain.gain.value = 0;
                }
            }
        }

        function goFullScreen() {
            var fBtn;
            if(_self.mainCanvasType === '3d') {
                fBtn = document.getElementById('3d-visualiser');
            } else {
                fBtn = document.getElementById('visualiser');
            }
            if (fBtn.requestFullscreen) {
                fBtn.requestFullscreen();
            } else if (fBtn.webkitRequestFullscreen) {
                fBtn.webkitRequestFullscreen();
            } else if (fBtn.mozRequestFullScreen) {
                fBtn.mozRequestFullScreen();
            } else if (fBtn.msRequestFullScreen) {
                fBtn.msRequestFullScreen();
            }
        }

        function VisualisationManager(smallCanvasList, mainVisualisationIndex) {

            var canvas2d = document.getElementById('visualiser');
            var canvas3d = document.getElementById('3d-visualiser');

            var mouseX = 0, mouseY = 0, windowHalfX = WIDTH / 2, windowHalfY = HEIGHT / 2;
            var scene, camera, renderer;

            var smCanvasArray = [],
                smCanvasCtxArray = [];

            var mainContext = canvas2d.getContext('2d');

            canvas2d.width = WIDTH;
            canvas2d.height = HEIGHT;
            canvas2d.style.backgroundColor = '354147';

            canvas3d.width = WIDTH;
            canvas3d.height = HEIGHT;
            canvas3d.style.backgroundColor = '354147';

            this.initMainCanvas = function (index) {
                var item = this.drawFunctions[index];
                clear3DCanvas();
                if (item.type === '3d') {
                    item.initFn();
                }
                return item.type;
            };

            this.drawFunctions = [
                {
                    type: '2d', drawFn: drawVolumeBooms, name: 'booms', initFn: function () {
                }
                },
                {
                    type: '2d', drawFn: drawFrequencyCircle, name: 'fcircle', initFn: function () {
                }
                },
                {
                    type: '2d', drawFn: drawByteDomainData, name: 'domain', initFn: function () {
                }
                },
                {
                    type: '2d', drawFn: drawFrequencyBar, name: 'bar', initFn: function () {
                }
                },
                {type: '3d', drawFn: drawThreeSphere, name: '3dsphere', initFn: initThreeSphere}
            ];

            smallCanvasList.push({id: 1, url: ''}); //TODO wtf is this
            smallCanvasList.push({id: 2, url: ''});
            smallCanvasList.push({id: 3, url: ''});
            smallCanvasList.push({id: 4, url: ''});
            smallCanvasList.push({id: 6, url: 'components/visualiser/img/3d-thumbs/sphere.png'});

            document.addEventListener('mousemove', onDocumentMouseMove, false);
            document.addEventListener('touchstart', onDocumentTouchStart, false);
            document.addEventListener('touchmove', onDocumentTouchMove, false);
            window.addEventListener('resize', onWindowResize, false);

            initThreeGlobals();

            $timeout(function () { //to call a apply for smallCanvasList
                smCanvasArray = document.getElementsByClassName('sm-canvas');

                for (var j = 0; j < smCanvasArray.length; j++) {
                    smCanvasCtxArray.push(smCanvasArray[j].getContext('2d'));
                    smCanvasArray[j].height = smCanvasArray[j].clientHeight; //TODO required check y
                    smCanvasArray[j].width = smCanvasArray[j].clientWidth;
                    smCanvasArray[j].style.backgroundColor = '#354147';
                }
            }, 0);

            this.draw = function () {
                for (var i = 0; i < this.drawFunctions.length; i++) {
                    if (smCanvasArray[i]) {
                        smCanvasCtxArray[i].fillStyle = '#354147';
                        smCanvasCtxArray[i].fillRect(0, 0, smCanvasArray[i].clientWidth, smCanvasArray[i].clientHeight);
                        this.drawFunctions[i].drawFn(smCanvasCtxArray[i], smCanvasArray[i].clientWidth, smCanvasArray[i].clientHeight);
                    }
                }
                mainContext.fillStyle = '#354147';
                mainContext.fillRect(0, 0, WIDTH, HEIGHT);

                this.drawFunctions[_self.mainVisualiserIndex].drawFn(mainContext, WIDTH, HEIGHT);
            };

            this.clearAll = function () {
                for (var i = 0; i < this.drawFunctions.length; i++) {
                    if (smCanvasArray[i]) {
                        smCanvasCtxArray[i].fillStyle = '#354147';
                        smCanvasCtxArray[i].fillRect(0, 0, smCanvasArray[i].clientWidth, smCanvasArray[i].clientHeight);
                    }
                }

                mainContext.fillStyle = '#354147';
                mainContext.fillRect(0, 0, WIDTH, HEIGHT);
            };

            function initThreeGlobals() {
                scene = new THREE.Scene();
                camera = new THREE.PerspectiveCamera(55, WIDTH / HEIGHT, 1, 10000);
                renderer = new THREE.CanvasRenderer({canvas: canvas3d, alpha: true});

                renderer.setPixelRatio(window.devicePixelRatio);
                renderer.setSize(WIDTH, HEIGHT);
            }

            function clear3DCanvas() {
                camera.position.x = 1500;
                scene.children = [];
            }

            function initThreeSphere() {
                camera.position.z = 1;
                //particles
                var PI2 = Math.PI * 2;
                var material = new THREE.SpriteCanvasMaterial({
                    color: 'red',
                    program: function (context) {
                        context.beginPath();
                        context.arc(0, 0, 0.5, 0, PI2, true);
                        context.fill();
                    }
                });
                var particle;
                for (var i = 0; i < 2000; i++) {

                    particle = new THREE.Sprite(material);
                    particle.position.x = Math.random() * 2 - 1;
                    particle.position.y = Math.random() * 2 - 1;
                    particle.position.z = Math.random() * 2 - 1;
                    particle.position.normalize();
                    particle.position.multiplyScalar(Math.random() * 10 + 450);
                    particle.scale.multiplyScalar(2);
                    scene.add(particle);
                }

                //lines
                for (var j = 0; j < 256; j++) {

                    var geometry = new THREE.Geometry();
                    var vertex = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
                    vertex.normalize();
                    vertex.multiplyScalar(450);

                    geometry.vertices.push(vertex);

                    var vertex2 = vertex.clone();
                    vertex2.multiplyScalar(Math.random() * 0.3 + 1);

                    geometry.vertices.push(vertex2);

                    var line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
                        color: 0xffffff,
                        opacity: Math.random()
                    }));
                    scene.add(line);
                }
            }

            function drawThreeSphere() {
                var obj;
                //var volume = Utils.getAverage(_self.channel1FrequencyData);
                for (var i = scene.children.length - 1, j = 0; i >= 0; i--, j++) {
                    obj = scene.children[i];
                    if (obj.type === 'Line') {
                        var a = (_self.channel1FrequencyData[j] ) / 1000;
                        var geometry = new THREE.Geometry();

                        var vertex = obj.geometry.vertices[0];
                        geometry.vertices.push(vertex);

                        var vertex2 = vertex.clone();
                        vertex2.multiplyScalar(1 + a);

                        geometry.vertices.push(vertex2);
                        obj.material.color = new THREE.Color("red");
                        obj.geometry = geometry;
                    } else {
                        break; //Assuming lines are added after circles
                    }
                }

                if (camera.position.z < 1500) {
                    camera.position.z += 1;
                }
                camera.position.x += ( 200 - camera.position.x ) * .5;
                camera.position.y += ( -200 + 200 - camera.position.y ) * .5;
                camera.lookAt(scene.position);
                //renderer.clear();

                renderer.render(scene, camera);
            }

            function drawVolumeBooms(context, width, height) {
                context.beginPath();
                context.arc(width * (1 / 3), height / 2, Utils.getAverage(_self.channel1FrequencyData) / 2, 0, 2 * Math.PI, false);

                context.arc(width * (2 / 3), height / 2, Utils.getAverage(_self.channel2FrequencyData) / 2, 0, 2 * Math.PI, false);

                context.fillStyle = '#F39C12';
                context.fill();

            }

            function onWindowResize() {

                var containerHeight = document.getElementsByClassName('player-stand')[0].clientHeight;
                var containerWidth = document.getElementsByClassName('player-stand')[0].clientWidth;

                windowHalfX = containerWidth / 2;
                windowHalfY = containerHeight / 2;

                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();

                renderer.setSize(containerWidth, containerHeight);
            }

            function onDocumentMouseMove(event) {
                mouseX = event.clientX - windowHalfX;
                mouseY = event.clientY - windowHalfY;
            }

            function onDocumentTouchStart(event) {
                if (event.touches.length > 1) {
                    event.preventDefault();

                    mouseX = event.touches[0].pageX - windowHalfX;
                    mouseY = event.touches[0].pageY - windowHalfY;
                }
            }

            function onDocumentTouchMove(event) {
                if (event.touches.length == 1) {
                    event.preventDefault();

                    mouseX = event.touches[0].pageX - windowHalfX;
                    mouseY = event.touches[0].pageY - windowHalfY;
                }
            }

            function drawFrequencyCircle(context, width, height) {

                var skipInterval = 1;
                for (var i = 0; i < _self.channel1FrequencyData.length; i++) {
                    var height1 = (height) * (_self.channel1FrequencyData[i] / 256);

                    //var height2 = (height) * (_self.channel2FrequencyData[i] / 256);

                    if (i % skipInterval === 0 && height1 > 0) {
                        context.beginPath();
                        context.strokeStyle = '#F39C12';
                        context.moveTo(width * (1 / 4), height / 2);
                        var lineToPoint1 = Utils.getPointOnCircle(width * (1 / 3), height / 2, height1, i * 0.0174533);
                        context.lineTo(lineToPoint1.x, lineToPoint1.y);
                        context.stroke();
                    }


                    // if (i % skipInterval === 0 && height2 > 0) {
                    //     context.beginPath();
                    //     context.strokeStyle = 'white';
                    //     context.moveTo(width *(2/3), height/2);
                    //     var lineToPoint2 = Utils.getPointOnCircle(width * (1/3), height/2, height2, i * 0.0174533);
                    //     context.lineTo(lineToPoint2.x, lineToPoint2.y);
                    //     context.stroke();
                    // }
                }
            }

            function drawFrequencyBar(context, width, height) {

                context.beginPath();
                context.fillStyle = '#F39C12';
                var x1 = 2,
                    x2 = 0,
                    sliceWidth = (width - 4) / _self.channel1FrequencyData.length;
                for (var i = 0; i < _self.channel1FrequencyData.length; i++) {
                    var height1 = (height) * (_self.channel1FrequencyData[i] / 400);
                    //var height2 = (height - 400) * (_self.channel2FrequencyData[i] / 256);
                    var y1 = (height - (height / 10)) - height1 - 1;
                    //var y2 = (height + 20) - height2 - 1;
                    context.fillRect(x1, y1, sliceWidth, height1);
                    //context.fillRect(x2, y2, sliceWidth, height2);

                    x1 += sliceWidth;
                    x2 += sliceWidth;
                }
                context.fillStyle = 'rgb(234, 91, 77)';
                context.fill();
            }

            function drawByteDomainData(context, width, height) {
                //entire wave
                context.beginPath();
                context.fillStyle = '#F39C12';

                var x1 = 2,
                    x2 = 0,
                    sliceWidth = (width - 4) / _self.channel1TimeDomainData.length;
                for (var i = 0; i < _self.channel1TimeDomainData.length; i++) {
                    var timeData1 = _self.channel1TimeDomainData[i] / 256;
                    var y1 = (height + 10) - (height * timeData1) - 1;
                    //context.fillStyle = 'hsl(' + getRandomInt(1, 100) + ', 100%, 50%)';
                    context.fillRect(x1, y1, sliceWidth, 1);
                    context.fill();
                    x1 += sliceWidth;
                }

                // for (var j = 0; j < _self.channel1TimeDomainData.length; j++) {
                //     var timeData2 = _self.channel1TimeDomainData[j] / 256;
                //     var y2 = (height - 10) - (height * timeData2) - 1;
                //     //context.fillStyle = 'hsl(' + getRandomInt(1, 100) + '), 100%, ' + getRandomInt(1, 100) + '%';
                //     context.fillRect(x2, y2, sliceWidth, 1);
                //     context.fill();
                //     x2 += sliceWidth;
                // }
            }
        }
    }

})();
