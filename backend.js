/*global */

(function () {
    'use strict';
    
    var _domainManager = null;
        
    /**
     * @private
     * Handler function for the Gulp command.
     * @param {string} tasks
     */
    function gulp(args, cwd) {
      var exec    = require('child_process').exec,
        fs      = require('fs'),
        cmd     = 'gulp ' + args, 
        child;

      child = exec(cmd, {cwd: cwd}, function (error, stdout, stderr) {
        if (error) { console.log(error); }   
        _domainManager.emitEvent('gulpDomain', 'error', [error]);
      });

      child.stdout.on('data', function (data) {
        //console.log('ok', data);
        if (args === '--tasks-simple') {
          _domainManager.emitEvent('gulpDomain', 'tasks', [data]);
        } else {
          _domainManager.emitEvent('gulpDomain', 'update', [data]);
        }
      });

      child.stderr.on('data', function (data) {
        console.log('err', data);
        //_domainManager.emitEvent('gulp', 'update', [data]);
        _domainManager.emitEvent('gulpDomain', 'error', [data]);
      });
      
    }
    
    /**
     * Initializes the domain 
     * @param {DomainManager} domainManager The DomainManager for the server   
     */
    function init(domainManager) {
      _domainManager = domainManager;

      if (!_domainManager.hasDomain('gulpDomain')) {
          _domainManager.registerDomain('gulpDomain', {major: 0, minor: 1});
      }
      _domainManager.registerCommand(
        'gulpDomain',       // domain name
        'gulp',    // command name
        gulp,   // command handler function
        false,          // this command is synchronous in Node
        'Execute Gulp command',
        [{name: 'args', type: 'string', description: 'task'},
         {name: 'cwd',  type: 'string', description: 'cwd'}]
      );

      _domainManager.registerEvent(
        'gulpDomain',
        'update',
        [{name: 'data', type: 'string'}]
      );

      _domainManager.registerEvent(
        'gulpDomain',
        'tasks',
        [{name: 'data', type: 'string'}]
      );
      
      _domainManager.registerEvent(
        'gulpDomain',
        'error',
        [{name: 'data', type: 'string'}]
      );
    }
    
    exports.init = init;
    
}());
