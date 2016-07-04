(function () {
    'use strict';
    angular.module('dubmonk.visualiser').service('InfoService', InfoService);

    InfoService.$inject = ['$timeout'];
    function InfoService($timeout) {
        //create the canvas
        var outerDiv = document.createElement('div');
        var messageDiv = document.createElement('div');
        outerDiv.className = 'info-service';
        outerDiv.appendChild(messageDiv);
        document.body.appendChild(outerDiv);

        this.addAlert = function(text) {
            messageDiv.className = 'in';
            messageDiv.innerHTML = text;

            $timeout(function () {
                messageDiv.className = 'out';
                messageDiv.innerHTML = '';
            }, 5000);
        };
   }

})();
