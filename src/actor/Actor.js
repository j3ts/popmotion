"use strict";

var Process = require('../process/Process'),
    Queue = require('../inc/Queue'),
    utils = require('../inc/utils'),
    update = require('./update'),
    valueOps = require('./value-operations'),
    actionManager = require('../actions/manager'),
    defaultRole = require('../roles/defaultRole'),
    cssRole = require('../roles/css/cssRole'),
    svgRole = require('../roles/svg/svgRole'),
    each = utils.each,

    Actor = function (opts) {
        var actor = this,
            roles = [ defaultRole ];

        // Set values object and state object
        this.values = {};
        this.state = {
            values: {}
        };

        // Init queue and process
        this.queue = new Queue();
        this.process = new Process(this, update);

        // Detect/add roles
        if (opts) {
            // Auto-detect element type, if present and no roles defined
            if (!opts.as && opts.element) {
                // Add CSS role if HTMLElement
                if (opts.element instanceof HTMLElement) {
                    roles.push(cssRole);

                } else if (opts.element instanceof SVGElement) {
                    roles.push(svgRole);
                }
            // Manuall adding roles
            } else if (opts.as) {
                if (utils.isArray(opts.as)) {
                    roles.push.apply(roles, opts.as);
                } else {
                    roles.push(opts.as);
                }
            }

            this.set(opts);
        }

        this.roles = roles;
        this.roles.forEach(function (role) {
            // Fire init method if one available
            if (role.init) {
                role.init.call(actor);
            }
        });
    };

Actor.prototype = {
    
    /*
        Set Action values and properties
        
        @param [object]: Element properties
        @param [string] (option): Name of default value property
    */
    set: function (props, defaultValueProp) {
        // Reset Element properties and write new props
        this.clearOrder();
        this.resetProps();

        if (props) {
            this.setProps(props);
            this.setValues(props.values, defaultValueProp);
        }

        return this;
    },

    /*
        Start currently defined Action
    */
    start: function () {
        this.resetProgress();
        this.activate();
        
        if (this.action !== 'track' && this.input && this.input.stop) {
            this.input.stop();
        }

        return this;
    },

    /*
        Stop current Action
    */
    stop: function () {
        this.queue.clear();
        this.pause();
        return this;
    },

    /*
        Pause current Action
    */
    pause: function () {
        this.isActive = false;
        this.process.stop();
        return this;
    },

    /*
        Resume paused Action
    */
    resume: function () {
        this.framestamp = this.started = utils.currentTime();
        this.isActive = true;
        this.process.start();
        return this;
    },

    /*
        Toggle current Action
    */
    toggle: function () {
        if (this.isActive) {
            this.pause();
        } else {
            this.resume();
        }

        return this;
    },
    
    /*
        Activate Element Action
    */
    activate: function () {
        this.isActive = true;
        this.started = utils.currentTime() + this.delay;
        this.framestamp = this.started;
        this.firstFrame = true;

        this.process.start();
    },

    reset: function () {
        this.resetProgress();
        valueOps.all('reset', this.values);

        return this;
    },
    
    /*
        Reset Action progress
    */
    resetProgress: function () {
        this.elapsed = (this.playDirection === 1) ? 0 : this.duration;
        this.started = utils.currentTime();

        return this;
    },
    
    /*
        Loop through all values and create origin points
    */
    resetOrigins: function () {
        valueOps.all('resetOrigin', this.values);
        return this;
    },
    
    /*
        Reverse Action progress and values
    */
    reverse: function () {
        this.playDirection *= -1;
        valueOps.all('retarget', this.values);
        return this;
    },
    
    /*
        Swap value origins and to
    */
    flipValues: function () {
        this.elapsed = this.duration - this.elapsed;
        valueOps.all('flip', this.values);
        return this;
    },

    /*
        Set properties

        @param [object]: Properties to set
    */
    setProps: function (props) {
        var actor = this;

        each(props, function (key, value) {
            if (key !== 'values') {
                actor[key] = value;
            }
        });
    },

    /*
        Reset properties to Action defaults
    */
    resetProps: function () {
        if (this.action) {
            this.setProps(actionManager[this.action].actionDefaults);
        }
        return this;
    },

    /*
        Add a new action to the queue
    */
    then: function () {
        this.queue.add.apply(this.queue, arguments);
        return this;
    },

    /*
        Set values

        @param [object || string || number]: Value
        @param [string] (optional): Default property to set
    */
    setValues: function (values, defaultValueProp) {
        valueOps.process(values, this, defaultValueProp);
        return this;
    },
    
    /*
        Update order of value keys
        
        @param [string]: Key of value
        @param [boolean]: Whether to move value to back
    */
    updateOrder: function (key, moveToBack, hasChildren) {
        var order = !hasChildren ? this.order : this.parentOrder,
            position = order.indexOf(key);

        // If key isn't in list, or moveToBack is set to true, add key
        if (position === -1 || moveToBack) {
            order.push(key);

            // If key already exists, remove
            if (position !== -1) {
                order.splice(position, 1);
            }
        }

        return this;
    },

    /*
        Clear value key update order
    */
    clearOrder: function () {
        this.order = [];
        this.parentOrder = [];
        return this;
    },

    // [boolean]: Is this Element currently active?
    get isActive() {
        return this._isActive;
    },

    /*
        Set Element active status

        If active is being set to true, set hasChanged to true, too

        @param [boolean]: New active status
    */
    set isActive(status) {
        if (status === true) {
            this.hasChanged = status;
        }

        this._isActive = status;
    }
};

// Register Actor with actionManager, so when a new Action is set,
// We get a new method on Actor
actionManager.setActor(Actor);

module.exports = Actor;