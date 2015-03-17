/*jshint -W101 */
/*global brackets, console, $, define, Promise */

define(function (require, exports, module) {
    'use strict';

    //bracketsOnSave: index in tasks array of brackets-onsave, task to run whenever a document is saved, or null if task not defined.
    //bracketsDefault: index in the tasks array of brackets-default, task to run as default when gulp is run from within Brackets, or null if task not defined.
    var cmd, gulpRoot, tasks, bracketsOnsave, bracketsDefault, $icon, bottomPanel, $gulpConsole, gulpMenu,
        AppInit = brackets.getModule('utils/AppInit'),
        ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        CommandManager = brackets.getModule('command/CommandManager'),
        ProjectManager = brackets.getModule('project/ProjectManager'),
        WorkspaceManager = brackets.getModule('view/WorkspaceManager'),
        Menus = brackets.getModule('command/Menus'),
        KeyBindingManager = brackets.getModule('command/KeyBindingManager'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        FileSystem = brackets.getModule('filesystem/FileSystem'),
        FileUtils = brackets.getModule('file/FileUtils'),
        NodeDomain = brackets.getModule('utils/NodeDomain'),
        gulpDomain = new NodeDomain('gulpDomain', ExtensionUtils.getModulePath(module, 'backend.js'));

    AppInit.appReady(function () {
        ExtensionUtils.loadStyleSheet(module, "styles/styles.css");
        createUiElements();
        attachGulpEvents();
        createMenu();

        $(ProjectManager).on('projectOpen', function () {
            createMenu();
        });
    });

    function locateGulpRoot(candidatePath) {
        return new Promise(function (resolve, reject) {
            if (!candidatePath) {
                reject("Gulpfile not found");
            }

            checkPath(candidatePath);

            function checkPath(candidatePath, foundCallback) {
                FileSystem.resolve(candidatePath + 'gulpfile.js', function (exist) {
                    if (exist !== 'NotFound') {
                        return resolve(candidatePath);
                    }

                    if (candidatePath.split('/').length - 1 === 1) {
                        return reject("Gulpfile not found");
                    }

                    FileSystem.resolve(candidatePath + "..", function (err, entry) {
                        checkPath(err ? null : entry.fullPath);
                    });
                });
            }
        });
    }

    function attachGulpEvents() {
        gulpDomain.on('update', function (evt, data) {
            var $item;
            $item = appendGulpMessage(data);

            if (data.match(/Finished/)) {
                setIconState('success');
                $item.addClass('success');
            }

            if (data.match(/[Ee]rror/)) {
                console.log('Gulp error: ' + data);
                bottomPanel.show();
                setIconState('error');
                $item.addClass('error');
            }
        });

        gulpDomain.on('error', function (evt, data) {
            if(!error) {
                return;
            }

            console.error('Gulp error: ' + data);
            bottomPanel.show();

            setIconState('error');
            appendGulpMessage(JSON.stringify(data))
                .addClass('error');
        });

        gulpDomain.on('tasks', function (evt, data) {
            tasks = data.split(/\n/);
            bracketsOnsave = tasks.indexOf('brackets-onsave');
            if (bracketsOnsave === -1) {
                bracketsOnsave = null;
            }

            bracketsDefault = tasks.indexOf('brackets-default');
            if (bracketsDefault === -1) {
                bracketsDefault = null;
            }

            loadGulpTasksToMenu(gulpRoot);
        });
    }

    function createUiElements() {
        createIcon();
        createBottomPanel();
        attachUiEvents();

        function createIcon() {
            if ($icon) {
                throw new Error("Gulp-brackets: Icon already exists.");
            }

            $icon = $('<a id="brackets-gulp-toggle" title="Gulp" class="brackets-gulp-icon" href="#"> </a>')
                .appendTo($('#main-toolbar .buttons'));
        }

        function createBottomPanel() {
            if (bottomPanel) {
                throw new Error("Gulp-brackets: Bottom panel already exists.");
            }

            bottomPanel = WorkspaceManager.createBottomPanel('brackets.gulp.bottomPanel', $(require('text!templates/panel_output.html')));
            $('#brackets-gulp-console-clear').click(function () {
                clearGulpConsole();
            });

            $('.close', $('#brackets-gulp-bottom-panel')).click(function () {
                bottomPanel.hide();
                setIconState('');
            });

            $gulpConsole = $('#brackets-gulp-console');
        }

        function attachUiEvents() {
            $icon.click(function () {
                if (bottomPanel.isVisible()) {
                    bottomPanel.hide();
                    setIconState('', true);
                } else {
                    bottomPanel.show();
                    setIconState('active');
                }
            });
        }
    }

    function createMenu() {
        destroyMenu();

        locateGulpRoot(ProjectManager.getProjectRoot().fullPath)
            .then(function success(path) {
                gulpMenu = Menus.addMenu('Gulp', 'djb.gulp-menu');
                gulpRoot = path;
                gulpDomain.exec('gulp', '--tasks-simple', gulpRoot, false);
            }, function error(message) {
                gulpRoot = null;
                setIconState('disabled', true);
                console.warn("Brakets-gulp: " + message);
            });
    }

    function loadGulpTasksToMenu() {
        $(DocumentManager).on('documentSaved', function () {
            if (gulpRoot && bracketsOnsave) {
                gulpDomain.exec('gulp', 'brackets-onsave', gulpRoot, false);
            }
        });

        if (!Menus.getMenuItem('djb.brackets-gulp.gulp')) {
            if (!CommandManager.get('djb.brackets-gulp.gulp')) {
                var defaultTitle, defaultTask;
                if (bracketsDefault) {
                    defaultTitle = 'Default (brackets-default)';
                    defaultTask = 'brackets-default';
                } else {
                    defaultTitle = 'Default';
                    defaultTask = '';
                }

                CommandManager.register(defaultTitle, 'djb.brackets-gulp.gulp', function () {
                    gulpDomain.exec('gulp', defaultTask, gulpRoot, false);
                });
            }

            gulpMenu.addMenuItem('djb.brackets-gulp.gulp', 'Alt-G');
            gulpMenu.addMenuDivider();
        }

        tasks.forEach(function (task) {
            if (task && task !== (bracketsDefault !== null ? 'brackets-default' : 'default')) {
                if (!CommandManager.get('djb.brackets-gulp.' + task)) {
                    CommandManager.register(task, 'djb.brackets-gulp.' + task, function () {
                        gulpDomain.exec('gulp', task, gulpRoot, false);
                    });
                }

                gulpMenu.addMenuItem('djb.brackets-gulp.' + task);
            }
        });

        CommandManager.register('Clear Gulp Output console', 'djb.brackets-gulp.clear', clearGulpConsole);
        gulpMenu.addMenuDivider();
        gulpMenu.addMenuItem('djb.brackets-gulp.clear');
    }

    function destroyMenu() {
        tasks = [];
        if (Menus.getMenu('djb.gulp-menu')) {
            KeyBindingManager.removeBinding('Alt-G');
            Menus.removeMenu('djb.gulp-menu');
        }

        bracketsOnsave = null;
    }

    function appendGulpMessage(message) {
        var $item;

        if (message && typeof message.trim === 'function') {
            message = message.trim() || '';
        } else {
            message = '';
        }

        $item = $('<p class="brackets-gulp">' + message + '</p>').appendTo($gulpConsole);
        $gulpConsole[0].scrollTop = $gulpConsole[0].scrollHeight;

        return $item;
    }

    function clearGulpConsole(active) {
        if ($gulpConsole) {
            $gulpConsole.html('');
        }

        setIconState(active ? 'active' : '');
    }

    function setIconState(iconState, force) {
        if (iconState && !/disabled|success|active|warning|error/.test(iconState)) {
            throw new Error("Unknown icon state");
        }

        $icon.removeClass('disabled success');

        if (!iconState || iconState === 'active' || force) {
            $icon.removeClass('active warning error');
        }

        if (!$icon.is('warning, error') || force) {
            $icon.addClass(iconState);
        }
    }
});
