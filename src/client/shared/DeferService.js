import { Service, serviceManager, View } from 'soundworks/client';

const SERVICE_ID = 'service:defer';

const template = `
  <p>Defer service</p>
`;

class DeferService extends Service {
  constructor() {
    super(SERVICE_ID, false);
  }

  configure(options) {
    if (options.service) {
      const service = serviceManager.require(options.service);
      service.require('defer');
    }

    super.configure(options);
  }

  init() {
    this.viewTemplate = template;
    this.viewCtor = View;

    this.view = this.createView();
  }

  start() {
    if (!this.hasStarted)
      this.init();


    console.log(this.view);
    this.show();
  }

  stop() {
    this.hide();
  }

  // defer(...services) {
  //   services.forEach((service) => service.require(this));
  // }
}


serviceManager.register(SERVICE_ID, DeferService);
