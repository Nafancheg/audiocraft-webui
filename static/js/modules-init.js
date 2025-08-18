import { attachStemProgressHandlers } from './stems.js';
// Attach socket stem progress after legacy main.js created window.socket
(function waitForSocket(){
  if(window.socket){ attachStemProgressHandlers(window.socket); } else { setTimeout(waitForSocket, 60); }
})();
