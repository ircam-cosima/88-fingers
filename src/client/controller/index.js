import * as soundworks from 'soundworks/client';
import viewTemplates from '../shared/viewTemplates';
import viewContent from '../shared/viewContent';

class Controller extends soundworks.BasicSharedController {
  constructor(options) {
    super(options);
    this.auth = this.require('auth');
  }
}

window.addEventListener('load', () => {
  const { appName, clientType, socketIO }  = window.soundworksConfig;

  soundworks.client.init(clientType, { socketIO, appName });
  soundworks.client.setViewContentDefinitions(viewContent);
  soundworks.client.setViewTemplateDefinitions(viewTemplates);

  const controller = new Controller({
    numPlayers: { readOnly: true },
    state: { type: 'buttons' },
  });

  soundworks.client.start();
});
