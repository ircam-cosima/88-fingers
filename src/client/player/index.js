// import client side soundworks and player experience
import * as soundworks from 'soundworks/client';
import PlayerExperience from './PlayerExperience.js';
import viewTemplates from '../shared/viewTemplates';
import viewContent from '../shared/viewContent';

window.addEventListener('load', () => {
  const { appName, clientType, socketIO }  = window.soundworksConfig;

  soundworks.client.init(clientType, { appName, socketIO });
  soundworks.client.setViewContentDefinitions(viewContent);
  soundworks.client.setViewTemplateDefinitions(viewTemplates);

  const experience = new PlayerExperience();

  soundworks.client.start();

  document.addEventListener('touchstart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault());
});
