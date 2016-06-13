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

        this.soundStatus = 0; //not started, 1: started 2: paused 3: ended
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

        this.showTimeDomainGraph = false;
        this.showFrequencyGraph = false;
        this.showVolumeBoxes = true;
        this.showStartButton = false;
        //Node data
        this.distortionOverSample = 0;
        this.distortionOverSampleChanged = distortionOverSampleChanged;
        this.gainValueChanged = gainValueChanged;
        this.biquadFilterTypeChanged = biquadFilterTypeChanged;
        this.biquadFrequencyChanged = biquadFrequencyChanged;
        this.gainValue = 10;
        this.biquadFilterType = 'highpass';
        this.biquadFrequency = 0;

        this.boomColorPos = 0;
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
            _self.ctx.fillStyle = _self.canvasBg;
            _self.ctx.fillRect(0, 0, WIDTH, HEIGHT);
            if (_self.isPlaying) {
                if (_self.showVolumeBoxes) {
                    if (_self.showFrequencyGraph) {
                        drawFrequencyAndBoom(true);
                    } else {
                        drawVolumeBoxes(true);
                    }
                } else if (_self.showFrequencyGraph) {
                    drawFrequencyGraph(true);
                }

                if (_self.showTimeDomainGraph) {
                    drawByteDomainData(true);
                }
            }
        }

        function drawFrequencyAndBoom(channeled) {
            var sumOfData1 = 0,
                sumOfData2 = 0;
            _self.ctx.beginPath();
            _self.ctx.fillStyle = 'blue';
            var x1 = 0,
                x2 = 0,
                sliceWidth = WIDTH / _self.channel1FrequencyData.length;
            for (var i = 0; i < _self.channel1FrequencyData.length; i++) {
                sumOfData1 += _self.channel1FrequencyData[i];
                sumOfData2 += _self.channel2FrequencyData[i];
                var height1 = (HEIGHT - 400) * (_self.channel1FrequencyData[i] / 256);
                var height2 = (HEIGHT - 400) * (_self.channel2FrequencyData[i] / 256);
                var y1 = (HEIGHT - 300) - height1 - 1;
                var y2 = (HEIGHT - 100) - height2 - 1;
                _self.ctx.fillRect(x1, y1, sliceWidth, height1);

                if (channeled) {
                    _self.ctx.fillRect(x2, y2, sliceWidth, height2);
                }
                x1 += sliceWidth;
                x2 += sliceWidth;
            }
            _self.ctx.arc(200, 300, sumOfData1 / _self.channel1FrequencyData.length, 0, 2 * Math.PI, false);
            if (channeled) {
                _self.ctx.arc(300, 300, sumOfData2 / _self.channel2FrequencyData.length, 0, 2 * Math.PI, false);
            }
            _self.ctx.fillStyle = 'rgb(234, 91, 77)';
            _self.ctx.fill();
        }

        function getPointOnCircle(cx, cy, radius, angle) {
            return {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            }
        }

        // function drawFrequencyGraph(channeled) {
        //
        //     var x1 = 20,
        //         x2 = 20,
        //         sliceWidth = WIDTH / _self.channel1FrequencyData.length;
        //
        //     var skipInterval = Math.floor(_self.channel1FrequencyData.length / 360);
        //     for (var i = 0; i < _self.channel1FrequencyData.length; i++) {
        //         var height1 = (HEIGHT - 400) * (_self.channel1FrequencyData[i] / 256);
        //
        //         var height2 = (HEIGHT - 400) * (_self.channel2FrequencyData[i] / 256);
        //
        //         _self.ctx.fillStyle = 'hsl(342,100%,' + getRandomInt(1, 50) + '%';
        //
        //         if (i % skipInterval === 0 && height1 > 0) {
        //             _self.ctx.beginPath();
        //             _self.ctx.strokeStyle = 'white';
        //             _self.ctx.moveTo(200, 250);
        //             var lineToPoint1 = getPointOnCircle(200, 250, height1, i * 0.0174533);
        //             _self.ctx.lineTo(lineToPoint1.x, lineToPoint1.y);
        //             _self.ctx.stroke();
        //         }
        //
        //         if (channeled) {
        //             if (i % skipInterval === 0 && height2 > 0) {
        //                 _self.ctx.beginPath();
        //                 _self.ctx.strokeStyle = 'white';
        //                 _self.ctx.moveTo(650, 250);
        //                 var lineToPoint2 = getPointOnCircle(650, 250, height2, i * 0.0174533);
        //                 _self.ctx.lineTo(lineToPoint2.x, lineToPoint2.y);
        //                 _self.ctx.stroke();
        //             }
        //         }
        //
        //         x1 += sliceWidth;
        //         x2 += sliceWidth;
        //     }
        // }

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
                _self.ctx.arc(x, y, 10, 0, 2 * Math.PI, false);
                _self.ctx.fillStyle = 'white';
                _self.ctx.fill();
            }
        }

        function drawFrequencyGraph(channeled) {
            var leftVolume = Math.floor(getTrackVolume(_self.channel1FrequencyData));
            var rightVolume = Math.floor(getTrackVolume(_self.channel2FrequencyData));

            for (var x = 0; x <= leftVolume; x += 1) {

                var lChip = new Chip(getRandomInt(10, 400), getRandomInt(100, 600), 20, leftVolume / 3, '#E37B33');
                lChip.draw();
            }
            for (var y = 0; y <= rightVolume; y += 1) {

                var rChip = new Chip(getRandomInt(400, 800), getRandomInt(100, 600), 20, rightVolume / 3, '#E37B33');
                rChip.draw();
            }
        }

        function getRandomColor() {
            var colorArray = ['#E65100', '#D84315', '#F57C00', '#F4511E', '#FFA726', '#FFB74D', '#FFECB3'];
            return colorArray[getRandomInt(0, 5)];
        }

        function drawVolumeBoxes(channeled) {

            for (var i = 0; i < 1; i++) {
                _self.ctx.beginPath();
                _self.ctx.arc(getRandomInt(100, 500), 200, getTrackVolume(_self.channel1FrequencyData), 0, 2 * Math.PI, false);
                if (channeled) {
                    _self.ctx.arc(getRandomInt(800, 1000), 200, getTrackVolume(_self.channel2FrequencyData), 0, 2 * Math.PI, false);
                }
                _self.ctx.fillStyle = getRandomColor();
                _self.ctx.fill();
            }


        }

        function drawByteDomainData(channeled) {
            //entire wave
            _self.ctx.beginPath();
            _self.ctx.fillStyle = 'red';

            var x1 = 0,
                x2 = 0,
                sliceWidth = WIDTH / _self.channel1TimeDomainData.length;
            for (var i = 0; i < _self.channel1TimeDomainData.length; i++) {
                var timeData1 = _self.channel1TimeDomainData[i] / 256;
                var y1 = (HEIGHT + 100) - (HEIGHT * timeData1) - 1;
                _self.ctx.fillStyle = 'hsl(' + getRandomInt(1, 100) + ', 100%, 50%)';
                _self.ctx.fillRect(x1, y1, sliceWidth, 1);
                _self.ctx.fill();
                x1 += sliceWidth;
            }
            if (channeled) {
                for (var j = 0; j < _self.channel1TimeDomainData.length; j++) {
                    var timeData2 = _self.channel1TimeDomainData[j] / 256;
                    var y2 = (HEIGHT - 100) - (HEIGHT * timeData2) - 1;
                    _self.ctx.fillStyle = 'hsl(' + getRandomInt(1, 100) + '), 100%, ' + getRandomInt(1, 100) + '%';
                    _self.ctx.fillRect(x2, y2, sliceWidth, 1);
                    _self.ctx.fill();
                    x2 += sliceWidth;
                }
            }
        }

        function trackPositionChanged() {
            startMusic(Number(_self.trackPosition));
        }

        function startMusic(trackPosition) {
            if (_self.nodes.source) {
                if (_self.nodes.source.buffer) {
                    _self.nodes.source.stop();
                }
                var elapsedTime = 0;
                //if(trackPosition > 0) {
                elapsedTime = Number(_self.trackPosition);
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
            //_self.nodes.source.stop();
        }

        function distortionOverSampleChanged() {
            if (_self.nodes.distortion) {
                _self.nodes.distortion.curve = makeDistortionCurve(Number(_self.distortionOverSample));
            }
        }

        function gainValueChanged() {
            if (_self.nodes.gain) {
                _self.nodes.gain.gain.value = _self.gainValue * (1 / 10);
            }
        }

        function biquadFilterTypeChanged() {
            if (_self.nodes.biquad) {
                _self.nodes.biquad.type = _self.biquadFilterType;
            }
        }

        function biquadFrequencyChanged() {
            if (_self.nodes.biquad) {
                _self.nodes.biquad.frequency.value = _self.biquadFrequency;
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

        function makeDistortionCurve(amount) {
            var k = typeof amount === 'number' ? amount : 50,
                n_samples = 44100,
                curve = new Float32Array(n_samples),
                deg = Math.PI / 180,
                i = 0,
                x;
            if (amount === 0) {
                return null;
            }
            for (; i < n_samples; ++i) {
                x = i * 2 / n_samples - 1;
                curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
            }
            return curve;
        }

        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }
    }

})();
