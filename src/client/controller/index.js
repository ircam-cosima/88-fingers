import * as soundworks from 'soundworks/client';
import viewTemplates from '../shared/viewTemplates';
import viewContent from '../shared/viewContent';

window.addEventListener('load', () => {
  const { appName, clientType, socketIO }  = window.soundworksConfig;

  soundworks.client.init(clientType, { socketIO, appName });
  soundworks.client.setViewContentDefinitions(viewContent);
  soundworks.client.setViewTemplateDefinitions(viewTemplates);

  const controller = new soundworks.BasicSharedController({
    numPlayers: { readOnly: true },
    state: { type: 'buttons' },
  });

  soundworks.client.start();
});
