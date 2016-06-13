(function () {
    'use strict';
    angular.module('raptor.visualiser').controller('VisualiserController', VisualiserController);

    VisualiserController.$inject = ['$interval'];

    function VisualiserController($interval) {
        var _self = this;
        this.audioContext = null;

        this.nodes = {
            'source': null,
            'analyser1': null,
            'splitter': null,
            'analyser2': null,
            'merger': null,
            'biquad': null
        };
        var WIDTH = document.getElementsByClassName('main-body')[0].clientWidth;
        var HEIGHT = document.getElementsByClassName('main-body')[0].clientHeight;
        this.soundStatus = 0; //not started, 1: started 2: paused 3: ended
        this.canvas = null;
        this.canvasCtx = null;

        this.channel1FrequencyData = [];
        this.channel2FrequencyData = [];
        this.channel1WaveFormData = [];
        this.channel2WaveFormData = [];


        init();
        function init() {
            _self.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            _self.canvas = document.getElementById('visualiser');
            _self.canvas.width = WIDTH;
            _self.canvas.height = HEIGHT;

            initCanvas();
            setupNodes();
            fetchSound();
        }

        function initCanvas() {
            _self.canvasCtx = _self.canvas.getContext('2d');
            _self.canvasBg = _self.canvasCtx.createRadialGradient(WIDTH/2,HEIGHT/2,HEIGHT *(10/100),WIDTH/2,HEIGHT/2,HEIGHT * (100/100));
            _self.canvasBg.addColorStop(0,"#456");

            _self.canvasBg.addColorStop(1,"#200");
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

            //splitter
            _self.nodes.splitter = _self.audioContext.createChannelSplitter(2);

            //merger
            _self.nodes.merger = _self.audioContext.createChannelMerger(2);

            //Biquad filter
            _self.nodes.biquad = _self.audioContext.createBiquadFilter();
            _self.nodes.biquad.type = 'highpass';
            _self.nodes.biquad.frequency.value = 10000;
            //connections
            _self.nodes.source.connect(_self.nodes.splitter);
            _self.nodes.splitter.connect(_self.nodes.analyser1, 0, 0);
            _self.nodes.splitter.connect(_self.nodes.analyser2, 1, 0);

            _self.nodes.analyser1.connect(_self.nodes.merger, 0, 0);
            _self.nodes.analyser2.connect(_self.nodes.merger, 0, 1);

            _self.nodes.merger.connect(_self.nodes.biquad);
            _self.nodes.merger.connect(_self.audioContext.destination);

            _self.nodes.source.connect(_self.audioContext.destination); // For playing the sound directly???
        }

        function fetchSound() {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'components/visualiser/trance.mp3', true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                processArrayBuffer(xhr.response);
            };
            xhr.send();
        }

        function processArrayBuffer(audioData) {
            _self.audioContext.decodeAudioData(audioData, function (buffer) {
                _self.nodes.source.buffer = buffer;
                _self.nodes.source.start(0);

                _self.nodes.source.onended = function() {
                    _self.soundStatus = 3;
                };

                //startDubbing
                _self.channel1FrequencyData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2FrequencyData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);

                _self.channel1WaveFormData = new Uint8Array(_self.nodes.analyser1.frequencyBinCount);
                _self.channel2WaveFormData = new Uint8Array(_self.nodes.analyser2.frequencyBinCount);

                animate();
            });
        }

        function animate(){
            requestAnimationFrame(animate);
            draw();
        }

        function draw() {

            _self.nodes.analyser1.getByteFrequencyData(_self.channel1FrequencyData);
            _self.nodes.analyser2.getByteFrequencyData(_self.channel2FrequencyData);

            _self.nodes.analyser1.getByteTimeDomainData(_self.channel1WaveFormData);
            _self.nodes.analyser2.getByteTimeDomainData(_self.channel2WaveFormData);

            _self.canvasCtx.fillStyle = _self.canvasBg;
            _self.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

            var channel1Volume = getTrackVolume(_self.channel1FrequencyData) * 2;
            var channel2Volume = getTrackVolume(_self.channel2FrequencyData) * 2;

            //left right volumes
            //_self.canvasCtx.beginPath();
            // _self.canvasCtx.arc(200, 300, channel1Volume, 0, 2 * Math.PI, false);
            // _self.canvasCtx.arc(1200, 300, channel2Volume, 0, 2 * Math.PI, false);
            //_self.canvasCtx.fillStyle = 'rgb(234, 91, 77)';
            //_self.canvasCtx.fill();

            //entire wave
            _self.canvasCtx.beginPath();
            _self.canvasCtx.fillStyle = 'red';
            var x = 0;
            var sliceWidth = WIDTH/_self.channel1WaveFormData.length;
            for(var i = 0; i < _self.channel1WaveFormData.length; i++) {

                var value = _self.channel1WaveFormData[i] / 256;
                var y = HEIGHT - (HEIGHT * value) - 1;

                _self.canvasCtx.fillRect(x, y, 5, 1);
                x += sliceWidth;
            }

        }

        function getTrackVolume(array) {
            var sum = 0,
                length = array.length;

            for(var i=0; i<length; i++) {
                sum += array[i];
            }
            return sum/(length);
        }
    }

})();

