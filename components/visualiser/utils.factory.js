(function () {
    'use strict';
    angular.module('dubmonk.visualiser').factory('Utils', UtilsFactory);

    UtilsFactory.$inject = [];
    function UtilsFactory() {
        var obj = {};
        obj.getPointOnCircle = getPointOnCircle;
        obj.secondsToDuration = secondsToDuration;
        obj.getRandomInt = getRandomInt;
        obj.getAverage = getAverage;

        function getPointOnCircle(cx, cy, radius, angle) {
            return {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            }
        }
        function secondsToDuration(totalSeconds) {
            var minutes = parseInt(totalSeconds / 60) % 60;
            var seconds = totalSeconds % 60;

            return (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
        }
        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }
        function getAverage(array) {
            var sum = 0,
                length = array.length;

            for (var i = 0; i < length; i++) {
                sum += array[i];
            }
            return sum / (length);
        }
        return obj;
    }

})();
