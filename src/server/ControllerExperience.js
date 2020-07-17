import { Experience } from 'soundworks/server';

class ControllerExperience extends Experience {
  constructor(options = {}) {
    super('controller');

    this.auth = this.require('auth');
    this.sharedParams = this.require('shared-params');
    this.errorReporter = this.require('error-reporter');

    this.sharedParams.addText('numPlayers', 'num players', 0, ['controller']);
    this.sharedParams.addEnum('state', 'state', ['wait', 'running', 'end'], 'wait');
    this.sharedParams.addTrigger('panic', 'all notes off');
  }

  start() {
    this.errorReporter.addListener('error', (file, line, col, msg, userAgent) => {
      this.broadcast('controller', null, 'log', 'error', file, line, col, msg, userAgent);
    });
  }
}

export default ControllerExperience;