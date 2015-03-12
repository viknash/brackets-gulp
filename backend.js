/*global require, exports, console */

(function () {
    'use strict';

    var manager = null;

    /**
     * @private
     * Handler function for the Gulp command.
     * @param {string} tasks
     */
    function gulp(args, cwd) {
        var child,
            exec = require('child_process').exec,
            fs = require('fs'),
            cmd = 'gulp ' + args;

        child = exec(cmd, {cwd: cwd}, function (error, stdout, stderr) {
            if (error) {
                console.log(error);
                manager.emitEvent('gulpDomain', 'error', [error]);
            }
        });

        child.stdout.on('data', function (data) {
            if (args === '--tasks-simple') {
                manager.emitEvent('gulpDomain', 'tasks', [data]);
            } else {
                manager.emitEvent('gulpDomain', 'update', [data]);
            }
        });

        child.stderr.on('data', function (data) {
            console.log('err', data);
            manager.emitEvent('gulpDomain', 'error', [data]);
        });
    }

    /**
     * Initializes the domain
     * @param {DomainManager} domainManager The DomainManager for the server
     */
    function init(domainManager) {
        manager = domainManager;

        if (!manager.hasDomain('gulpDomain')) {
            manager.registerDomain('gulpDomain', {
                major: 0,
                minor: 1
            });
        }
        manager.registerCommand(
            'gulpDomain', // domain name
            'gulp', // command name
            gulp, // command handler function
            false, // this command is synchronous in Node
            'Execute Gulp command',
            [{name: 'args', type: 'string', description: 'task'},
                {name: 'cwd', type: 'string', description: 'cwd'}]
        );

        manager.registerEvent(
            'gulpDomain',
            'update',
            [{name: 'data', type: 'string'}]
        );

        manager.registerEvent(
            'gulpDomain',
            'tasks',
            [{name: 'data', type: 'string'}]
        );

        manager.registerEvent(
            'gulpDomain',
            'error',
            [{name: 'data', type: 'string'}]
        );
    }

    exports.init = init;
}());
