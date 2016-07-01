(function () {
    'use strict';
    angular.module('dubmonk.visualiser').controller('VisualiserController', VisualiserController);

    VisualiserController.$inject = ['$timeout', '$scope', '$http'];

    function VisualiserController($timeout, $scope, $http) {
        var _self = this;

        //WebAudio
        this.audioContext = null;

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
        this.showVisualiser = false;

        //Canvas
        this.canvas = null;
        this.canvasCtx = null;
        this.animationId = 1;

        this.channel1FrequencyData = [];
        this.channel2FrequencyData = [];
        this.channel1TimeDomainData = [];
        this.channel2TimeDomainData = [];

        this.canvasBg;
        _self.focus = false;
        //Node data
        this.gainValueChanged = gainValueChanged;
        this.gainValue = 1;

        
        this.goFullScreen = function () {
            var fBtn = document.getElementById('visualiser');
            if (fBtn.requestFullscreen) {
                fBtn.requestFullscreen();
            } else if (fBtn.webkitRequestFullscreen) {
                fBtn.webkitRequestFullscreen();
            } else if (fBtn.mozRequestFullScreen) {
                fBtn.mozRequestFullScreen();
            } else if (fBtn.msRequestFullScreen) {
                fBtn.msRequestFullScreen();
            }
        };

        //Player Controls
        this.resume = resume;
        this.pause = pause;
        this.stop = stop;
        this.start = start;
        this.next = next;
        this.previous = previous;
        this.upload = upload;
        this.playFromList = playFromList;

        this.nowPlayingIndex = 0;
        
        this.trackPositionChanged = trackPositionChanged;
        this.trackDuration = '0.00';
        this.trackPosition = 0;
        this.secondsToDuration = secondsToDuration;
        this.vManager;
        this.smallCanvasList = [];
        this.mainVisualiserIndex = 1;
        init();

        function VisualisationManager(smallCanvasList, mainVisualisationIndex) {

            var mainCanvas = document.getElementById('visualiser');

            var smCanvasArray = [],
                smCanvasCtxArray = [];
            mainCanvas.width = WIDTH;
            mainCanvas.height = HEIGHT;
            mainCanvas.style.backgroundColor = '354147';

            //var mainContext = mainCanvas.getContext('2d');
            this.drawFunctions = [drawVolumeChips,
                drawVolumeBooms,
                drawFrequencyCircle,
                drawByteDomainData,
                drawFrequencyBar
                ];

            smallCanvasList.push(1); //TODO wtf is this
            smallCanvasList.push(2);
            smallCanvasList.push(3);
            smallCanvasList.push(4);
            smallCanvasList.push(5);
            //smallCanvasList.push(6);

            //THREEJS
            //Testing with threejs
            var particle,
                mouseX = 0, mouseY = 0,
                windowHalfX = WIDTH/ 2,
                windowHalfY = HEIGHT / 2;


            var scene = new THREE.Scene();
            var camera = new THREE.PerspectiveCamera(75, WIDTH/HEIGHT, 1, 10000);
            camera.position.z = 1000;
            var renderer = new THREE.CanvasRenderer({canvas: mainCanvas});
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(WIDTH, HEIGHT);

            //particles
            var PI2 = Math.PI * 2;
            var material = new THREE.SpriteCanvasMaterial({
                color: 'rgb(243, 156, 18)',
                program: function (context) {
                    context.beginPath();
                    context.arc( 0, 0, 0.5, 0, PI2, true );
                    context.fill();
                }
            });

            for ( var i = 0; i < 1000; i ++ ) {

                particle = new THREE.Sprite( material );
                particle.position.x = Math.random() * 2 - 1;
                particle.position.y = Math.random() * 2 - 1;
                particle.position.z = Math.random() * 2 - 1;
                particle.position.normalize();
                particle.position.multiplyScalar( Math.random() * 10 + 450 );
                particle.scale.multiplyScalar( 2 );
                scene.add( particle );
            }

            //lines
            for (var j = 0; j < 512; j++) {

                var geometry = new THREE.Geometry();
                var vertex = new THREE.Vector3( Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1 );
                vertex.normalize();
                vertex.multiplyScalar( 450 );

                geometry.vertices.push( vertex );

                var vertex2 = vertex.clone();
                vertex2.multiplyScalar( Math.random() * 0.3 + 1  );

                geometry.vertices.push( vertex2 );

                var line = new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xffffff, opacity: Math.random() } ) );
                scene.add( line );
            }

             document.addEventListener( 'mousemove', onDocumentMouseMove, false );
             document.addEventListener( 'touchstart', onDocumentTouchStart, false );
             document.addEventListener( 'touchmove', onDocumentTouchMove, false );

            //

            window.addEventListener( 'resize', onWindowResize, false );

            function onWindowResize() {

                windowHalfX = window.innerWidth / 2;
                windowHalfY = window.innerHeight / 2;

                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();

                renderer.setSize( window.innerWidth, window.innerHeight );

            }

            //

            function onDocumentMouseMove(event) {

                mouseX = event.clientX - windowHalfX;
                mouseY = event.clientY - windowHalfY;
            }

            function onDocumentTouchStart( event ) {

                if ( event.touches.length > 1 ) {

                    event.preventDefault();

                    mouseX = event.touches[ 0 ].pageX - windowHalfX;
                    mouseY = event.touches[ 0 ].pageY - windowHalfY;

                }

            }

            function onDocumentTouchMove( event ) {

                if ( event.touches.length == 1 ) {

                    event.preventDefault();

                    mouseX = event.touches[ 0 ].pageX - windowHalfX;
                    mouseY = event.touches[ 0 ].pageY - windowHalfY;

                }

            }

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
                    smCanvasCtxArray[i].fillStyle = '#354147';
                    smCanvasCtxArray[i].fillRect(0, 0, smCanvasArray[i].clientWidth, smCanvasArray[i].clientHeight);
                    this.drawFunctions[i](smCanvasCtxArray[i], smCanvasArray[i].clientWidth, smCanvasArray[i].clientHeight);
                }

                drawThreeSphere();

                //mainContext.fillStyle = '#354147';
                //mainContext.fillRect(0, 0, WIDTH, HEIGHT);

                //this.drawFunctions[_self.mainVisualiserIndex](mainContext, WIDTH, HEIGHT);
            };


            this.clearAll = function() {
                for (var i = 0; i < this.drawFunctions.length; i++) {
                    smCanvasCtxArray[i].fillStyle = '#354147';
                    smCanvasCtxArray[i].fillRect(0, 0, smCanvasArray[i].clientWidth, smCanvasArray[i].clientHeight);
                }

                //mainContext.fillStyle = '#354147';
                //mainContext.fillRect(0, 0, WIDTH, HEIGHT);
            };
            function drawThreeSphere() {
                var obj, i;

                for (var i = scene.children.length - 1, j = 0; i >= 0; i--) {
                    obj = scene.children[i];
                    if (obj.type === 'Line') {
                        var a = (_self.channel1FrequencyData[j] * 2) / 1000;
                        var geometry = new THREE.Geometry();

                        var vertex = obj.geometry.vertices[0];
                        geometry.vertices.push(vertex);

                        var vertex2 = vertex.clone();
                        vertex2.multiplyScalar(1 + a);

                        geometry.vertices.push(vertex2);
                        obj.material.color = new THREE.Color("rgb(243, 156, 18)");
                        obj.geometry = geometry;
                    } else {
                        break; //Assuming lines are added after circles
                    }
                }

                camera.position.x += ( mouseX - camera.position.x ) * .05;
                camera.position.y += ( - mouseY + 200 - camera.position.y ) * .05;
                camera.lookAt( scene.position );

                renderer.render( scene, camera );
            }

            function drawVolumeBooms(context, width, height) {
                context.beginPath();
                context.arc(width * (1/3), height/2, getTrackVolume(_self.channel1FrequencyData), 0, 2 * Math.PI, false);

                context.arc(width * (2/3), height/2, getTrackVolume(_self.channel2FrequencyData), 0, 2 * Math.PI, false);

                context.fillStyle = 'red';
                context.fill();

            }

            function drawFrequencyCircle(context, width, height) {

                var skipInterval = Math.floor(_self.channel1FrequencyData.length / 360);
                for (var i = 0; i < _self.channel1FrequencyData.length; i++) {
                    var height1 = (height) * (_self.channel1FrequencyData[i] / 256);

                    var height2 = (height) * (_self.channel2FrequencyData[i] / 256);

                    if (i % skipInterval === 0 && height1 > 0) {
                        context.beginPath();
                        context.strokeStyle = 'white';
                        context.moveTo(width * (1/4), height/2);
                        var lineToPoint1 = getPointOnCircle(width * (1/3), height/2, height1, i * 0.0174533);
                        context.lineTo(lineToPoint1.x, lineToPoint1.y);
                        context.stroke();
                    }


                    // if (i % skipInterval === 0 && height2 > 0) {
                    //     context.beginPath();
                    //     context.strokeStyle = 'white';
                    //     context.moveTo(width *(2/3), height/2);
                    //     var lineToPoint2 = getPointOnCircle(width * (1/3), height/2, height2, i * 0.0174533);
                    //     context.lineTo(lineToPoint2.x, lineToPoint2.y);
                    //     context.stroke();
                    // }
                }
            }

            function drawFrequencyBar(context, width, height) {

                context.beginPath();
                context.fillStyle = 'blue';
                var x1 = 0,
                    x2 = 0,
                    sliceWidth = width / _self.channel1FrequencyData.length;
                for (var i = 0; i < _self.channel1FrequencyData.length; i++) {
                    var height1 = (height) * (_self.channel1FrequencyData[i] / 256);
                    var height2 = (height - 400) * (_self.channel2FrequencyData[i] / 256);
                    var y1 = (height + 50) - height1 - 1;
                    var y2 = (height + 20) - height2 - 1;
                    context.fillRect(x1, y1, sliceWidth, height1);
                    //context.fillRect(x2, y2, sliceWidth, height2);

                    x1 += sliceWidth;
                    x2 += sliceWidth;
                }
                context.fillStyle = 'rgb(234, 91, 77)';
                context.fill();
            }
            
            function drawVolumeChips(context, width, height) {
                var leftVolume = Math.floor(getTrackVolume(_self.channel1FrequencyData));
                var rightVolume = Math.floor(getTrackVolume(_self.channel2FrequencyData));

                for (var x = 0; x <= leftVolume / 5; x += 1) {
                    var lChip = new Chip(getRandomInt(10, width / 2), getRandomInt(10, height), 20, leftVolume / 3, '#4AFF6B');
                    lChip.draw(context);
                }
                for (var y = 0; y <= rightVolume / 5; y += 1) {
                    var rChip = new Chip(getRandomInt(width / 2, width - 10), getRandomInt(10, height), 20, rightVolume / 3, '#5689BD');
                    rChip.draw(context);
                }
            }
        }

        function drawByteDomainData(context, width, height) {
            //entire wave
            context.beginPath();
            context.fillStyle = 'red';

            var x1 = 0,
                x2 = 0,
                sliceWidth = width / _self.channel1TimeDomainData.length;
            for (var i = 0; i < _self.channel1TimeDomainData.length; i++) {
                var timeData1 = _self.channel1TimeDomainData[i] / 256;
                var y1 = (height + 10) - (height * timeData1) - 1;
                context.fillStyle = 'hsl(' + getRandomInt(1, 100) + ', 100%, 50%)';
                context.fillRect(x1, y1, sliceWidth, 1);
                context.fill();
                x1 += sliceWidth;
            }

            for (var j = 0; j < _self.channel1TimeDomainData.length; j++) {
                var timeData2 = _self.channel1TimeDomainData[j] / 256;
                var y2 = (height - 10) - (height * timeData2) - 1;
                context.fillStyle = 'hsl(' + getRandomInt(1, 100) + '), 100%, ' + getRandomInt(1, 100) + '%';
                context.fillRect(x2, y2, sliceWidth, 1);
                context.fill();
                x2 += sliceWidth;
            }
        }

        function init() {
            _self.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            _self.vManager = new VisualisationManager(_self.smallCanvasList, _self.mainVisualiserIndex);
            setupNodes();

            getSongList();

            //fetchSound(getNextTrackUrl());
        }
        
        function getSongList() {
            var myWorker = new Worker('components/visualiser/worker.js');
            myWorker.onmessage = function (event) {
                if(event.data.type === 'songList') {
                    _self.songList = event.data.data;
                    if (!$scope.$$phase) {
                        $scope.$digest();
                    }
                    _self.songList[0].isPlaying = true;
                    fetchSound(_self.songList[0].url);

                } else if (event.data.type === 'listWithImages') {
                    _self.songList = event.data.data;
                    if (!$scope.$$phase) {
                        $scope.$digest();
                    }
                }
            }
        }

        function getNextTrackUrl() {
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
        }

        function fetchSound(url) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                processArrayBuffer(xhr.response);

                // var detailsXhr = new XMLHttpRequest();
                // detailsXhr.open('GET', '/getSongDetails?url=' + url, true);
                // //xhr.responseType = 'application/json';
                // detailsXhr.onload = function () {
                //
                //     _self.songDetails = JSON.parse(detailsXhr.response);
                //     if (!$scope.$$phase) {
                //         $scope.$digest();
                //     }
                // };
                // detailsXhr.send();
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

        function Chip(x, y, r1, r2, c) {
            this.r1 = r1;
            this.r2 = r2;
            this.x = x;
            this.y = y;

            this.color = c;
            this.strokeColor = '#7F8283';

            this.draw = function (ctx) {
                ctx.beginPath();
                ctx.arc(x, y, this.r2, 0, 2 * Math.PI, false);
                ctx.fillStyle = this.color;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(x, y, this.r1, 0, 2 * Math.PI, false);
                ctx.lineWidth = this.r2 / 7;
                ctx.strokeStyle = this.strokeColor;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI, false);
                ctx.fillStyle = 'grey';
                ctx.fill();
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
            //NG-CLASS not getting updated as soon as clicked

            _self.nowPlayingIndex = index;
            $timeout(function(){
                fetchSound(getNextTrackUrl());
            }, 0);
        }

        function upload() {
            var file = document.getElementById('upload-file').files[0];

            if(file) {
                // //convert to arraybuffer
                // var fileReader = new FileReader();
                // fileReader.onload = function (event) {
                //   var b =event.target.result;
                // };
                // fileReader.readAsArrayBuffer(file);

                if(file.type === 'audio/mp3') {
                    var fd = new FormData();
                    fd.append('file', file);

                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', '/upload');
                    xhr.send(fd);
                    xhr.onreadystatechange = function () {
                        if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                            _self.songList.push(JSON.parse(xhr.responseText));
                            if(!$scope.$$phase) {
                                $scope.$digest();
                            }
                        }
                    }
                } else {
                    alert('haha. only mp3 files');
                }
            }else {
                alert('Please select a file');
            }
        }

        function gainValueChanged() {
            if (_self.nodes.gain) {
                _self.nodes.gain.gain.exponentialRampToValueAtTime(_self.gainValue * (1 / 10), _self.audioContext.currentTime + 0.2);
                //_self.nodes.gain.gain.value = _self.gainValue * (1 / 10);
            }
        }

        function getTrackVolume(array) {
            var sum = 0,
                length = array.length;

            for (var i = 0; i < length; i++) {
                sum += array[i];
            }
            return sum / (length);
        }

        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }

        function secondsToDuration(totalSeconds) {
            var minutes = parseInt(totalSeconds / 60) % 60;
            var seconds = totalSeconds % 60;

            return (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
        }
        function getPointOnCircle(cx, cy, radius, angle) {
            return {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            }
        }
    }

})();
