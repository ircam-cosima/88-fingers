import * as soundworks from 'soundworks/client';
import ControllerExperience from './ControllerExperience';
import serviceViews from '../shared/serviceViews';

class Controller extends ControllerExperience {
  constructor(options) {
    super(options);
    this.auth = this.require('auth');
  }
}

window.addEventListener('load', () => {
  document.body.classList.remove('loading');

  const config = Object.assign({ appContainer: '#container' }, window.soundworksConfig);
  soundworks.client.init(config.clientType, config);

  soundworks.client.setServiceInstanciationHook((id, instance) => {
    if (serviceViews.has(id))
      instance.view = serviceViews.get(id, config);
  });

  const controller = new ControllerExperience(config.assetsDomain);
  soundworks.client.start();
});
