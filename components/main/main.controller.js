(function () {
    'use strict';
    angular.module('dubmonk').controller('MainController', MainController);

    MainController.$inject = ['$interval'];

    function MainController($interval) {


        var _self = this;
        this.headerBackgroud = {
            'background' : 'linear-gradient(to left, rgb(245, 245, 245) , rgb(255, 255, 255))'
        };

        //init();

        function init() {
            $interval(function () {
               _self.headerBackgroud = {
                   'background' : 'linear-gradient(to left,' + getRandomColor() +', #9a8478)'
               }
            }, 5000);
        }
        function getRandomColor() {
            var letters = '0123456789ABCDEF'.split('');
            var color = '#';
            for (var i = 0; i < 6; i++ ) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        }




    }
})();
