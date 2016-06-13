(function () {
    'use strict';
    angular.module('dubmonk.visualiser').controller('VisualiserController', VisualiserController);

    VisualiserController.$inject = ['$interval', '$scope'];

    function VisualiserController($interval, $scope) {
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
        this.isPlaying = false;
        //Canvas
        this.canvas = null;
        this.canvasCtx = null;

        this.channel1FrequencyData = [];
        this.channel2FrequencyData = [];
        this.channel1TimeDomainData = [];
        this.channel2TimeDomainData = [];

        this.canvasBg;

        this.showStartButton = false;
        //Node data
        this.distortionOverSample = 0;
        this.gainValueChanged = gainValueChanged;
        this.gainValue = 10;

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
        this.mp3Url = 'components/visualiser/tragedy.mp3';
        this.resumeMusic = resumeMusic;
        this.pauseMusic = pauseMusic;
        this.stopMusic = stopMusic;
        this.startMusic = startMusic;
        this.trackPositionChanged = trackPositionChanged;
        this.trackDuration = 1;
        this.trackPosition = 0;


        init();
        function init() {
            _self.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            _self.canvas = document.getElementById('visualiser');

            _self.canvas.width = WIDTH;
            _self.canvas.height = HEIGHT;
            _self.canvas.style.backgroundColor = 'rgb(22, 82, 142)';
            _self.ctx = _self.canvas.getContext('2d');

            initCanvas();
            setupNodes();
            fetchSound();
        }

        function initCanvas() {
            _self.ctx = _self.canvas.getContext('2d');

            _self.canvasBg = _self.ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * (10 / 100), WIDTH / 2, HEIGHT / 2, HEIGHT * (100 / 100));
            _self.canvasBg.addColorStop(0, "#456");
            _self.canvasBg.addColorStop(1, "#200");

            _self.canvas.style.background = 'radial-gradient(circle, #456, #200)';
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
            //_self.nodes.convolver.connect(_self.nodes.biquad, 0, 0);
            _self.nodes.biquad.connect(_self.nodes.gain, 0, 0);
            _self.nodes.gain.connect(_self.audioContext.destination, 0, 0);
        }

        function fetchSound() {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', _self.mp3Url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                processArrayBuffer(xhr.response);
            };
            xhr.send();
        }

        function processArrayBuffer(audioData) {
            _self.audioContext.decodeAudioData(audioData, function (buffer) {
                _self.soundBuffer = buffer;
                _self.showStartButton = true;
                //startMusic(0);
                _self.trackDuration = Math.floor(_self.soundBuffer.duration);

                //startDubbing
                _self.channel1FrequencyData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2FrequencyData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);

                _self.channel1TimeDomainData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2TimeDomainData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);

                $scope.$apply();
                animate();
            });
        }

        function animate() {

            //if (_self.isPlaying) {
            requestAnimationFrame(animate);
            //}
            _self.nodes.analyser1.getByteFrequencyData(_self.channel1FrequencyData);
            _self.nodes.analyser2.getByteFrequencyData(_self.channel2FrequencyData);

            _self.nodes.analyser1.getByteTimeDomainData(_self.channel1TimeDomainData);
            _self.nodes.analyser2.getByteTimeDomainData(_self.channel2TimeDomainData);
            draw();
            if (_self.isPlaying) {
                _self.trackPosition = Math.floor(_self.audioContext.currentTime - _self.startTime);
                $scope.$apply();
            }
        }

        function draw() {
            _self.ctx.fillStyle = 'white';
            _self.ctx.fillRect(0, 0, WIDTH, HEIGHT);
            if (_self.isPlaying) {
                drawVolumeBoxes(true);
            }
        }


        function Chip(x, y, r1, r2, c) {
            this.r1 = r1;
            this.r2 = r2;
            this.x = x;
            this.y = y;

            this.color = c;
            this.strokeColor = '#7F8283';
            this.draw = function () {
                //if (r2 > r1) {
                _self.ctx.beginPath();
                _self.ctx.arc(x, y, this.r2, 0, 2 * Math.PI, false);
                _self.ctx.fillStyle = this.color;
                _self.ctx.fill();
                //}
                _self.ctx.beginPath();
                _self.ctx.arc(x, y, this.r1, 0, 2 * Math.PI, false);
                _self.ctx.lineWidth = this.r2 / 7;
                _self.ctx.strokeStyle = this.strokeColor;
                _self.ctx.stroke();

                _self.ctx.beginPath();
                _self.ctx.arc(x, y, 5, 0, 2 * Math.PI, false);
                _self.ctx.fillStyle = 'grey';
                _self.ctx.fill();
            }
        }

        function drawVolumeBoxes(channeled) {
            var leftVolume = Math.floor(getTrackVolume(_self.channel1FrequencyData));
            var rightVolume = Math.floor(getTrackVolume(_self.channel2FrequencyData));

            for (var x = 0; x <= leftVolume; x += 1) {
                var lChip = new Chip(getRandomInt(10, WIDTH/2), getRandomInt(10, HEIGHT), 20, leftVolume / 3, '#E37B33');
                lChip.draw();
            }
            for (var y = 0; y <= rightVolume; y += 1) {
                var rChip = new Chip(getRandomInt(WIDTH/2, WIDTH - 10), getRandomInt(10, HEIGHT), 20, rightVolume / 3, '#E37B33');
                rChip.draw();
            }
        }

        function trackPositionChanged() {
            startMusic(Number(_self.trackPosition));
        }

        function startMusic() {
            if (_self.nodes.source) {
                if (_self.nodes.source.buffer) {
                    _self.nodes.source.stop();
                }
                //if(trackPosition > 0) {
                var elapsedTime = Number(_self.trackPosition);
                //}
                _self.nodes.source = _self.audioContext.createBufferSource();
                _self.nodes.source.buffer = _self.soundBuffer;

                _self.nodes.source.connect(_self.nodes.splitter);
                _self.startTime = _self.audioContext.currentTime - elapsedTime;
                _self.nodes.source.start(0, elapsedTime);

                // _self.nodes.source.onended = function () {
                //     _self.isPlaying = false;
                // };
                _self.isPlaying = true;
            }
        }

        function resumeMusic() {
            if (_self.audioContext.state === 'suspended') {
                _self.audioContext.resume().then(function () {
                });
            }
        }

        function pauseMusic() {
            if (_self.audioContext.state === 'running') {
                _self.audioContext.suspend().then(function () {
                });
            }
        }

        function stopMusic() {
            if (_self.nodes.source) {
                if (_self.nodes.source.buffer) {
                    _self.nodes.source.stop();
                }
                _self.trackPosition = 0;
                _self.showStartButton = true;
                _self.isPlaying = false;
            }
        }

        function gainValueChanged() {
            if (_self.nodes.gain) {
                _self.nodes.gain.gain.value = _self.gainValue * (1 / 10);
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
    }

})();
