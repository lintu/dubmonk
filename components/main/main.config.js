(function () {
    'use strict';
    angular.module('dubmonk').config(config);

    function config($stateProvider, $urlRouterProvider){
        $urlRouterProvider.otherwise("/dubmonk");

        $stateProvider.state('main', {
            templateUrl: 'components/main/main.html',
            controller: 'MainController',
            controllerAs: 'ctrl'
        }).
        state('main.visualiser', {
            url: '/dubmonk',
            templateUrl: 'components/visualiser/visualiser.html',
            controller: 'VisualiserController',
            controllerAs: 'ctrl'
        });
    }
})();
