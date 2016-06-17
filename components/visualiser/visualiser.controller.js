(function () {
    'use strict';
    angular.module('dubmonk.visualiser').controller('VisualiserController', VisualiserController);

    VisualiserController.$inject = ['$timeout', '$scope'];

    function VisualiserController($timeout, $scope) {
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
        this.animationId;

        this.channel1FrequencyData = [];
        this.channel2FrequencyData = [];
        this.channel1TimeDomainData = [];
        this.channel2TimeDomainData = [];

        this.canvasBg;
        _self.focus = false;
        //Node data
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
        this.mp3Url = 'components/visualiser/songs/'+ getRandomInt(1, 10)+'.mp3';
        this.resumeMusic = resumeMusic;
        this.pauseMusic = pauseMusic;
        this.stopMusic = stopMusic;
        this.startMusic = startMusic;
        this.trackPositionChanged = trackPositionChanged;
        this.trackDuration = '0.00';
        this.trackPosition = 0;
        this.secondsToDuration = secondsToDuration;

        init();
        function init() {
            _self.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            _self.canvas = document.getElementById('visualiser');

            _self.canvas.width = WIDTH;
            _self.canvas.height = HEIGHT;
            _self.canvas.style.backgroundColor = 'white';
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
            _self.canvas.style.background = '#45cb96';
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

                _self.trackDuration = Math.floor(_self.soundBuffer.duration);

                //startDubbing
                _self.channel1FrequencyData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2FrequencyData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);

                _self.channel1TimeDomainData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2TimeDomainData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);

                $scope.$apply();
                startMusic(0);
            });
        }

        function animate() {
            _self.animationId =  requestAnimationFrame(animate);

            _self.nodes.analyser1.getByteFrequencyData(_self.channel1FrequencyData);
            _self.nodes.analyser2.getByteFrequencyData(_self.channel2FrequencyData);

            _self.nodes.analyser1.getByteTimeDomainData(_self.channel1TimeDomainData);
            _self.nodes.analyser2.getByteTimeDomainData(_self.channel2TimeDomainData);
            //if(!_self.isPaused) {
                draw();
                _self.trackPosition = Math.floor(_self.audioContext.currentTime - _self.startTime);
                //$scope.$apply();
            //}
        }

        function draw() {
            _self.ctx.fillStyle = '#45cb96';
            _self.ctx.fillRect(0, 0, WIDTH, HEIGHT);
            if(_self.showVisualiser) {
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
                _self.ctx.beginPath();
                _self.ctx.arc(x, y, this.r2, 0, 2 * Math.PI, false);
                _self.ctx.fillStyle = this.color;
                _self.ctx.fill();

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

            for (var x = 0; x <= leftVolume/5; x += 1) {
                var lChip = new Chip(getRandomInt(10, WIDTH/2), getRandomInt(10, HEIGHT), 20, leftVolume / 3, 'black');
                lChip.draw();
            }
            for (var y = 0; y <= rightVolume/5; y += 1) {
                var rChip = new Chip(getRandomInt(WIDTH/2, WIDTH - 10), getRandomInt(10, HEIGHT), 20, rightVolume / 3, 'black');
                rChip.draw();
            }
        }

        function trackPositionChanged() {
            if(_self.isPaused) {
                pauseMusic();
                cancelAnimationFrame(_self.animationId);
            } else {
                startMusic(Number(_self.trackPosition));
            }
        }

        function startMusic(startFrom) {
            if (_self.nodes.source) {

                if (_self.nodes.source.buffer) {
                    _self.nodes.source.stop();
                }

                _self.nodes.source = _self.audioContext.createBufferSource();
                _self.nodes.source.buffer = _self.soundBuffer;
                _self.nodes.source.connect(_self.nodes.splitter);
                _self.startTime = _self.audioContext.currentTime - startFrom;
                _self.nodes.source.start(0, startFrom);
                _self.nodes.source.loop = _self.isLooped;

                // _self.nodes.source.onended = function () {
                //
                //     _self.trackPosition = 0;
                // };

                animate();

                _self.isPaused = false;
            } else {
                alert('Song is not ready to play');
            }
        }

        function resumeMusic() {
            _self.isPaused = false;
            startMusic(Number(_self.trackPosition));
            animate();
        }

        function pauseMusic() {
            if (_self.nodes.source.buffer) {
                _self.nodes.source.stop();
                cancelAnimationFrame(_self.animationId);
                _self.isPaused = true;
            }
        }

        function stopMusic() {
            if (_self.nodes.source) {
                if (_self.nodes.source.buffer) {
                    _self.nodes.source.stop();
                    cancelAnimationFrame(_self.animationId);
                }
                _self.trackPosition = 0;
                _self.isPaused = true;
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

        function secondsToDuration(totalSeconds) {
            var minutes = parseInt( totalSeconds / 60 ) % 60;
            var seconds = totalSeconds % 60;

           return (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds  < 10 ? "0" + seconds : seconds);
        }
    }

})();
